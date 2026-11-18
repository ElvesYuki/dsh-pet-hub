import {encodeTcp} from '../../packages/core/native400-tcp.mjs';import http from 'node:http';import {Readable} from 'node:stream';import {randomBytes} from 'node:crypto';import {readFileSync,existsSync} from 'node:fs';
import {F,until} from './native400-controls-test-support.mjs';import {createDshNodeControlConnection} from '../../apps/dsh-plugin/node-control-connection.mjs';import {createHostPlugin} from '../../apps/dsh-plugin/index.mjs';import {createHubClient} from '../../packages/runtime/client.mjs';
/** Original contract carrier, NOT DSH authentication. Installed Connection API was
 * inspected read-only. This fixture separately models host admission and hub grant. */
export function connectionRegistry(resolve,{enabled=true}={}){const routes=new Map();let dispose;const ctx={effect:fn=>dispose=fn(),connection:{fetch:{register(route){if(routes.has(route.path))throw Error('duplicate route');routes.set(route.path,route);return()=>routes.delete(route.path);}}}};createDshNodeControlConnection({enabled,resolve})(ctx);return {routes,close:()=>dispose?.()};}
export async function native400ConnectionHarness({reactSeed,clientBundle=readFileSync('dist/client.connection.js')}={}){
 const cleanup=[],f=await F({after:fn=>cleanup.push(fn)}),x=await f.start({shared:true,sessionMs:1000}),pages=new Map();let registry,raw,server,origin,closing,peer,drop=false,posts=0,denied=0;const bodies=[];
 // First fixture authorization is not a browser grant; revoke its attachment.
 x.window.detachControls(x.credential);
 const session=request=>{const cookie=request.headers.get('cookie');return [...pages.values()].find(p=>cookie?.split('; ').includes('hubtest_host='+p.cookie));};
 const resolve=request=>{const p=session(request);return p?.hubAllowed?p.client:null;};
 const boot=`const root=ReactDOM.createRoot(document.getElementById('app'));window.__ModuleLoader__={load({factory}){factory(name=>{if(name==='react')return React;throw Error('unknown external');}).apply({get:()=>undefined,slots:{inject(_name,gen){[...gen()];},register(_meta,C){root.render(React.createElement(C));}}});}};`;
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>TCP20 · 独立共享控制验证</title><div id="app"></div><script src="/react.js"></script><script src="/boot.js"></script><script src="/client.js"></script></html>';
 function load(){registry=connectionRegistry(resolve);}
 try{
  load();createHostPlugin(createHubClient(f.directory))({effect:fn=>{const off=fn();cleanup.push(off);},webServer:{register(route){raw=route.handler;return()=>raw=null;}}});
  server=http.createServer(async(req,res)=>{try{
   if(req.url.startsWith('/api/')){
    const p=[...pages.values()].find(p=>req.headers.cookie?.split('; ').includes('hubtest_host='+p.cookie));
    if(!p?.hostAllowed){denied++;res.writeHead(401);res.end();return;}
    if(p.principal!=='owner'||req.headers.origin&&req.headers.origin!==origin){denied++;res.writeHead(403);res.end();return;}
    const route=registry.routes.get(req.url.split('?')[0]);if(!route||!route.methods.includes(req.method)){res.writeHead(404);res.end();return;}
    const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
    if(req.method==='POST')posts++;
    const request=new Request('http://dsh.internal'+req.url,{method:req.method,headers:req.headers,signal:abort.signal,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
    if(req.method==='POST'){const bytes=[];const source=request.body;let count=0;const reader=source.getReader();const tapped=new ReadableStream({async pull(c){try{const item=await reader.read();if(item.done){if(count<=4096)bodies.push(Buffer.concat(bytes).toString());c.close();return;}count+=item.value.byteLength;if(count<=4096)bytes.push(Buffer.from(item.value));c.enqueue(item.value);}catch(e){c.error(e);}},cancel:reason=>reader.cancel(reason)});const forwarded=new Request(request,{body:tapped,duplex:'half'});const response=await route.fetch(forwarded);const lose=drop&&response.status===200;drop=false;res.writeHead(lose?503:response.status,Object.fromEntries(response.headers));res.end(lose?'{}':await response.text());return;}
    const response=await route.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
   }
   if(req.url.startsWith('/dsh-pet-hub/')){void raw(req,res);return;}
   const value=req.url==='/'?html:req.url==='/react.js'?reactSeed:req.url==='/boot.js'?boot:req.url==='/client.js'?clientBundle:null;
   if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}if(value==null){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'"});res.end(value);
  }catch{if(!res.writableEnded){res.writeHead(503);res.end();}}});await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});origin='http://127.0.0.1:'+server.address().port;
 }catch(e){registry?.close();server?.closeAllConnections();if(server?.listening)await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();throw e;}
 function page(label){const p=pages.get(label);if(!p)throw Error('unknown original page');return p;}
 return {origin,f,x,
  grant(label){if(!/^[ab]$/.test(label))throw Error('original page label');const old=pages.get(label);if(old){try{x.window.detachControls(old.credential);}catch(error){if(error.code!=='controls_unauthorized')throw error;}}const credential=x.window.authorizeControls(),p={cookie:old?.cookie??randomBytes(32).toString('hex'),credential,client:x.window.controlClient(credential),hostAllowed:true,hubAllowed:true,principal:'owner'};pages.set(label,p);return {cookies:[{name:'hubtest_host',value:p.cookie,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict',secure:false}],origins:[]};},
  allow(label,kind,value){const p=page(label);if(!['hostAllowed','hubAllowed','principal'].includes(kind))throw Error('original permission');p[kind]=value;},
  async request(label,path='controls',body){const p=page(label);return fetch(origin+'/api/pet-hub-node/'+path,{headers:{cookie:'hubtest_host='+p.cookie,...(body?{origin,'content-type':'application/json','x-pet-hub':'1'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});},
  async connect(){peer=await f.peer(x.window);},async disconnect(){if(peer){peer.socket.destroy();await peer.closed;await until(()=>x.window.resources().transport.active===0);peer=null;}},advance(ms){if(!Number.isInteger(ms)||ms<0)throw Error('invalid original time');f.time+=ms;},dropNext(){drop=true;},
  async frame(){const target=peer?.model.target;if(!target||!peer.model.prepare(target.token,'55',f.identity.records.find(r=>r.action===target.action).asset_sha256))throw Error('original model frame unavailable');peer.socket.write(encodeTcp(peer.model.presented(target.token,'55')));await until(()=>x.window.snapshot().transport.frame0_history?.action===target.action);},
  unload(){registry.close();},reload(){registry.close();load();},end(){x.window.endControls();},
  state(){return {posts,denied,phase:x.window.snapshot().transport?.phase,base_records:peer?.records.filter(r=>r.type===2).length??0,cancel_records:peer?.records.filter(r=>r.type===3).length??0,duplicate_bodies:bodies.length>=2&&bodies.at(-1)===bodies.at(-2),routes:registry.routes.size,service_alive:x.window.resources().service_owned,device_evidence:false};},
  close(){if(closing)return closing;return closing=(async()=>{registry.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();})();},resourcesRemoved:()=>!existsSync(f.f.root),
 };
}
