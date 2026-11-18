import http from 'node:http';import {randomBytes} from 'node:crypto';import {readFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
import {native400BootstrapFixture} from '../../packages/simulator/native400-bootstrap-fixture.mjs';
import {prepareNative400SourceReview} from '../../packages/runtime/native400-source-review-host.mjs';import {startOrAttach} from '../../packages/runtime/service.mjs';import {createNative400ReviewClient} from '../../packages/runtime/native400-review-channel.mjs';import {createHostPlugin} from '../../apps/dsh-plugin/index.mjs';
/** Original-only temporary browser fixture. No production import or HTTP admin API.
 * Privileged methods model trusted operator handoff, not actual DSH/native identity.
 * close releases gates and waits real I/O before removing its own fixture. */
export async function native400BrowserHarness({reactSeed,clientBundle=readFileSync('dist/client.js'),clock}={}){
 const f=native400BootstrapFixture(),directory=join(f.root,'s'),gates=new Set();let hub,server,handler,dispose,credential,scoped,pageCookie=null,closed=false,closing,hold=false,unknown=false,drop=false,reads=0,starts=0,denied=0;
 let held=null;
 const boot=`let Panel;const root=ReactDOM.createRoot(document.getElementById('app'));window.__ModuleLoader__={load({factory}){factory(name=>{if(name==='react')return React;throw Error('unknown external');}).apply({get:()=>undefined,slots:{inject(_name,gen){[...gen()];},register(_meta,C){Panel=C;root.render(React.createElement(Panel));}}});}};`;
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>400 审阅 · 原创隔离验证</title><body><div id="app"></div><script src="/react.js"></script><script src="/boot.js"></script><script src="/client.js"></script></body></html>';
 function release(){for(const g of gates)g();gates.clear();held=null;}
 async function beforeRead(){reads++;if(!hold)return;hold=false;let done;const promise=new Promise(r=>done=r);gates.add(done);held=true;await promise;gates.delete(done);held=null;}
 function attach(){createHostPlugin(hub.client,{reviewAccess:{origin,resolve:req=>{if(!pageCookie||req.headers.cookie!==`hubreview=${pageCookie}`){denied++;return null;}return scoped;}}})({effect:fn=>dispose=fn(),webServer:{register:route=>{handler=route.handler;return()=>handler=null;}}});}
 let origin;
 try{
  hub=await startOrAttach({directory,sourceReview:prepareNative400SourceReview({...f.inputs(),createJournal:true,controls:{beforeRead,...(clock?{clock}:{} )},fault:stage=>{if(unknown&&stage==='after_rename'){unknown=false;throw Error('original test uncertain commit');}}})});
  server=http.createServer((req,res)=>{
   if(req.url?.startsWith('/dsh-pet-hub/')){if(!handler){res.writeHead(404);res.end();return;}
    if(drop&&req.method==='POST'&&req.url==='/dsh-pet-hub/source-review/start'){drop=false;const writeHead=res.writeHead.bind(res),end=res.end.bind(res);res.writeHead=(_code,headers)=>writeHead(503,headers);res.end=()=>end(JSON.stringify({error:'controls_operation_failed'}));}
    if(req.method==='POST'&&req.url==='/dsh-pet-hub/source-review/start')starts++;
    void handler(req,res);return;
   }
   const body=req.url==='/'?html:req.url==='/react.js'?reactSeed:req.url==='/boot.js'?boot:req.url==='/client.js'?clientBundle:null;
   if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(body===null||body===undefined){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'"});res.end(body);
  });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;attach();
 }catch(e){release();dispose?.();server?.closeAllConnections();if(server?.listening)await new Promise(r=>server.close(r));await hub?.close();f.close();throw e;}
 const channel=()=>hub.sourceReview.reviewChannel;
 return {
  origin,
  async grant(){if(closed)throw Error('fixture closed');if(credential){try{channel().revoke(credential);}catch(e){if(e.code!=='controls_session_expired')throw e;}await hub.sourceReview.idle();}credential=channel().authorize();await channel().choose(credential,{file:f.file,sourceName:'原创离线样本',expectedRevision:hub.sourceReview.snapshot().revision});scoped=createNative400ReviewClient(hub.client,credential);pageCookie=randomBytes(32).toString('hex');return {cookies:[{name:'hubreview',value:pageCookie,domain:'127.0.0.1',path:'/',httpOnly:true,secure:false,sameSite:'Strict',expires:Math.floor(Date.now()/1000)+300}],origins:[]};},
  async choose(){if(closed||!credential)throw Error('fixture unauthorized');return channel().choose(credential,{file:f.file,sourceName:'原创离线样本',expectedRevision:hub.sourceReview.snapshot().revision});},
  revoke(){if(credential){channel().revoke(credential);credential=null;}pageCookie=null;scoped=null;},
  holdNext(){hold=true;},release,dropNext(){drop=true;},unknownNext(){unknown=true;},
  unload(){dispose();},reload(){dispose();attach();},
  async reopen(){release();pageCookie=null;credential=null;scoped=null;await hub.close();hub=await startOrAttach({directory,sourceReview:prepareNative400SourceReview({...f.inputs(),createJournal:false,controls:{beforeRead,...(clock?{clock}:{} )}})});dispose();attach();},
  state(){const source=hub.sourceReview.snapshot(),resources=hub.sourceReview.resources();return {phase:source.phase,revision:source.revision,current:source.current_run,reads,starts,denied,held:!!held,busy:resources.busy,open_files:resources.open_files,closed:resources.closed};},
  idle:()=>hub.sourceReview.idle(),
  close(){if(closing)return closing;closed=true;pageCookie=null;scoped=null;release();dispose();return closing=(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));try{await hub.close();}finally{f.close();}})();},
  resourcesRemoved:()=>!existsSync(f.root),
 };
}
