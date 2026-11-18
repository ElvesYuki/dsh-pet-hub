import https from 'node:https';
import {X509Certificate,createHash} from 'node:crypto';
import {once} from 'node:events';
import {setImmediate as turn} from 'node:timers/promises';
import {createMTLSPeerAuth,MTLS_OPTIONS} from '../../packages/runtime/mtls-peer.mjs';
import {assetRange,validateSegmentResponse,MAX_SEGMENT_BYTES} from '../../packages/runtime/asset-segment.mjs';
import {createSessionRuntime} from '../../packages/runtime/session-runtime.mjs';
import {Registry} from '../../packages/core/registry.mjs';
import {createLeaseGuard} from '../../packages/core/lease-budget.mjs';
import {keys,requireThat} from '../../packages/core/protocol.mjs';
import {VirtualClock,MemoryStore} from '../../packages/simulator/index.mjs';
import {leaseDelayBudget} from '../../packages/simulator/lease-delay.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const pem=der=>new X509Certificate(der).toString();
const credentials=(pki,name)=>name?{cert:pem(pki.certs[name].der),key:pki.certs[name].key.export({format:'pem',type:'pkcs8'})}:{};
export const CONTEXT=Object.freeze({device_id:'D',binding_id:'B',binding_epoch:'1',boot_id:'boot',session_id:'session',controller_id:'C',service_instance_id:'H'});
export const CAPS={schema_version:1,protocols:['hub-device/1'],codecs:['PET4'],firmware_version:'synthetic',board_profile:'synthetic',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},cache:{slots:4,slot_bytes:3145728,persistent:false},max_asset_bytes:3145728,max_downloads:1,inputs:['touch'],outputs:['display']};
export function mtlsFixtureMedia(){const asset=Buffer.from(Array.from({length:70001},(_,i)=>(i*31+7)%256)),assetSHA=sha(asset),manifest={character_id:'test',variant_id:'synthetic',codec:'PET4',sha256:sha('test-manifest'),display:CAPS.display,actions:[{id:11,bytes:asset.length,sha256:assetSHA}]};return {asset,assetSHA,manifest};}
/** Explicit test-only server owner: literal loopback, disposable credentials, bounded HTTP, zero production config. */
export async function createMTLSLab(pki,{sessionStore,sessionRuntime,clock:injectedClock,metrics,writeBytes=4096,rangeBytes=32768,verification='scoped'}={}){
 let wall=Date.now(),closed=false,fault=null,lastPeer=null,lastReceipt=null,lastError=null,activeRequests=0,activeTimers=0,invalidations=0,lastServerSocket=null,releasePause=null,signalChunk=null,chunkReached=Promise.resolve();
 let approved={...CONTEXT,state:'bound',credential_epoch:'1',certificate_sha256:sha(pki.certs.client.der)};
 const sockets=new Set(),agents=new Set(),requests=new Set(),timers=new Set(),helloSockets=new WeakSet(),idleWaiters=new Set(),clock=injectedClock??new VirtualClock();
 requireThat(!(sessionStore&&sessionRuntime),'invalid_fixture_owner');
 requireThat([4096,16384].includes(writeBytes)&&[8192,32768].includes(rangeBytes),'invalid_probe_profile');
 const {asset,assetSHA,manifest}=mtlsFixtureMedia();
 let registry,guard,auth,coordinator;
 const delay=leaseDelayBudget({queue_ms:100,segment_ms:1000,poll_ms:500,network_ms:200,process_ms:100},{host_ppm:500}),policy={host_ppm:500,device_ppm:500,...delay,margin_ms:10,max_lease_ms:15000};
 if(sessionRuntime){coordinator=sessionRuntime;({registry,guard,auth}=coordinator);}
 else if(sessionStore){coordinator=createSessionRuntime({store:sessionStore,rootDER:pki.rootDER,now:()=>wall,clock,manifest,policy,controller_id:'C',metrics,verification});({registry,guard,auth}=coordinator);}
 else{
  auth=createMTLSPeerAuth({rootDER:pki.rootDER,now:()=>wall,controller_id:'C',service_instance_id:'H',metrics,lookupByFingerprint:f=>f===approved.certificate_sha256?approved:null,onInvalidate(ctx){invalidations++;guard.invalidate(ctx.device_id);registry.invalidate(ctx);}});
  registry=new Registry({clock,store:new MemoryStore({bindings:{}}),manifest,verifyPeer:(...args)=>auth.verifyPeer(...args)});registry.bind({device_id:'D',binding_id:'B',binding_epoch:'1',controller_id:'C',identity_ref:'test-peer'});
  guard=createLeaseGuard({registry,clock,policy,verifyResponse:(...args)=>auth.verifyResponse(...args)});
 }
 const check=socket=>coordinator?coordinator.assertCurrent(socket):auth.assertCurrent(socket);
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;};
 async function body(req){requireThat(req.headers['content-type']==='application/json'&&/^(0|[1-9][0-9]{0,3})$/.test(req.headers['content-length']??'')&&!req.headers['transfer-encoding']&&Number(req.headers['content-length'])<=4096,'body_size');const chunks=[];let n=0;for await(const c of req){n+=c.length;requireThat(n<=4096,'body_size');chunks.push(c);}return Buffer.concat(chunks);}
 const server=https.createServer({...MTLS_OPTIONS,...credentials(pki,'server'),ca:pem(pki.rootDER),requestCert:true,rejectUnauthorized:true,handshakeTimeout:1000,maxHeaderSize:8192},(req,res)=>{
  lastServerSocket=req.socket;activeRequests++;let finished=false;const timer=later(()=>req.destroy(),1000);const finish=()=>{if(finished)return;finished=true;activeRequests--;clearTimeout(timer);timers.delete(timer);if(activeRequests===0){for(const resolve of idleWaiters)resolve();idleWaiters.clear();}};res.once('close',finish);
  (async()=>{
   requireThat(!closed,'closed');
   if(req.method==='POST'&&req.url==='/hub-device/v1/hello'){
    let v;try{v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await body(req)));}catch(cause){throw Object.assign(new Error('hello body',{cause}),{code:'invalid_hello'});}if(coordinator){const result=v.type==='hello.begin'?coordinator.begin(req.socket,v):coordinator.confirm(req.socket,v),out=JSON.stringify(result);res.writeHead(200,{'content-type':'application/json','content-length':Buffer.byteLength(out)});res.end(out);return;}keys(v,['context','capabilities']);const proof=auth.establish(req.socket,v.context);if(!helloSockets.has(req.socket)){registry.connect({protocol:'hub-device/1',device_id:v.context.device_id,binding_id:v.context.binding_id,binding_epoch:v.context.binding_epoch,boot_id:v.context.boot_id,session_id:v.context.session_id,capabilities:v.capabilities},proof);helloSockets.add(req.socket);}lastPeer=proof;
    res.writeHead(200,{'content-length':2});res.end('ok');return;
   }
   check(req.socket);
   if(req.method==='POST'&&req.url==='/hub-device/v1/exchange'){
    const raw=await body(req);check(req.socket);if(coordinator)lastReceipt=coordinator.accept(req.socket,raw);else{const {packet,proof}=auth.attest(req.socket,raw);guard.accept(packet.context,packet,proof);lastReceipt={packet,proof};}res.writeHead(200,{'content-length':2});res.end('ok');return;
   }
   requireThat(req.method==='GET'&&req.url==='/hub-device/v1/assets/'+assetSHA,'not_found');const range=assetRange(req.headers,asset.length,assetSHA),mode=fault;
   const headers={'content-length':String(range.length),'content-range':`bytes ${range.start}-${range.end}/${asset.length}`,etag:'"'+assetSHA+'"'};
   if(mode==='etag')headers.etag='"changed"';if(mode==='content-range')headers['content-range']='bytes 1-2/3';if(mode==='gzip')headers['content-encoding']='gzip';if(mode==='chunked')delete headers['content-length'];if(mode==='length')headers['content-length']=String(range.length+1);if(mode==='redirect')headers.location='https://never.test.invalid/';
   res.writeHead(mode==='whole'?200:mode==='redirect'?302:206,headers);
   if(mode==='hold')return;
   if(mode==='truncate'){res.write(asset.subarray(range.start,range.start+1));await turn();res.destroy();return;}
   for(let start=range.start;start<=range.end;start+=writeBytes){check(req.socket);const bytes=Buffer.from(asset.subarray(start,Math.min(start+writeBytes,range.end+1)));if(mode==='corrupt')bytes[0]^=1;metrics?.add('asset_write_calls',1);metrics?.add('asset_write_bytes',bytes.length);if(!res.write(bytes))await once(res,'drain');if(mode==='pause'&&start===range.start){signalChunk();await new Promise(resolve=>{releasePause=resolve;});}await turn();}
   res.end();
  })().catch(error=>{lastError=error.code??'internal_error';if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.writeHead(error.code==='invalid_range'?416:error.code==='body_size'?413:403,{'content-length':0,'connection':'close'});res.end();});
 });
 server.maxConnections=32;server.headersTimeout=2000;server.requestTimeout=2000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=64;
 server.on('resumeSession',(_id,cb)=>cb(null,null));server.on('tlsClientError',()=>{});server.on('clientError',(_error,socket)=>socket.destroy());
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
 const port=server.address().port;
 function client({name='client',ca=pki.rootDER,servername='hub.test.invalid',tls={}}={}){
  const agent=new https.Agent({keepAlive:true,maxSockets:1,maxCachedSessions:0});agents.add(agent);let busy=false,lastSocket=null,meta=null;
  const api={
   async request({method='POST',path='/hub-device/v1/hello',bytes=Buffer.from(JSON.stringify({context:CONTEXT,capabilities:CAPS})),headers={},timeout=1000}={}){
    requireThat(!closed&&!busy,'request_busy');busy=true;activeTimers++;let deadline;
    try{return await new Promise((resolve,reject)=>{
     const req=https.request({host:'127.0.0.1',port,servername,ca:pem(ca),...credentials(pki,name),...MTLS_OPTIONS,...tls,rejectUnauthorized:true,agent,method,path,headers:{...(method==='POST'?{'content-type':'application/json','content-length':String(bytes.length)}:{}),...headers}},res=>{
      const chunks=[];let n=0;res.on('data',c=>{n+=c.length;if(n>MAX_SEGMENT_BYTES){req.destroy(Object.assign(new Error('response too large'),{code:'response_size'}));return;}chunks.push(c);});res.once('error',reject);res.once('end',()=>{if(!res.complete){reject(Object.assign(new Error('truncated'),{code:'truncated'}));return;}resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)});});
     });requests.add(req);req.once('close',()=>requests.delete(req));req.once('error',reject);
     req.on('socket',socket=>{lastSocket=socket;const capture=()=>{meta={authorized:socket.authorized,protocol:socket.getProtocol(),cipher:socket.getCipher()?.standardName,reused:socket.isSessionReused(),session:socket.getSession(),sameSocket:lastSocket===socket};};if(socket.secureConnecting){const at=metrics?performance.now():0;socket.once('secureConnect',()=>{metrics?.record('tls_handshake',performance.now()-at);capture();});}else capture();});
     deadline=setTimeout(()=>req.destroy(Object.assign(new Error('test request deadline'),{code:'request_timeout'})),timeout);if(method==='POST')req.end(bytes);else req.end();
    });}finally{clearTimeout(deadline);activeTimers--;busy=false;}
   },
   async segment(start,end,options={}){const range={start,end,length:end-start+1};const response=await this.request({method:'GET',path:'/hub-device/v1/assets/'+assetSHA,bytes:Buffer.alloc(0),headers:{range:`bytes=${start}-${end}`,'if-range':'"'+assetSHA+'"',...options.headers},timeout:options.timeout??1000});return validateSegmentResponse({...response,range,total:asset.length,sha:assetSHA});},
   async download(){const parts=[];for(let start=0;start<asset.length;start+=rangeBytes)parts.push(await this.segment(start,Math.min(start+rangeBytes-1,asset.length-1)));const candidate=Buffer.concat(parts);requireThat(sha(candidate)===assetSHA,'asset_digest');return candidate;},
   async hello({boot_id='boot',capabilities=CAPS}={}){const first=await this.request({bytes:Buffer.from(JSON.stringify({protocol:'hub-device/1',type:'hello.begin',boot_id,capabilities}))});requireThat(first.status===200,'hello_refused');const challenge=JSON.parse(first.body);const ready=await this.request({bytes:Buffer.from(JSON.stringify({protocol:'hub-device/1',type:'hello.confirm',challenge_id:challenge.challenge_id,context:challenge.context}))});requireThat(ready.status===200,'hello_refused');return JSON.parse(ready.body).context;},metadata:()=>meta,socket:()=>lastSocket,close(){agent.destroy();agents.delete(agent);}
  };
  if(metrics){const segment=api.segment.bind(api);api.segment=(...args)=>metrics.measureAsync('segment_round_trip',()=>segment(...args));}
  return api;
 }
 return {client,auth,registry,guard,coordinator,clock,serverSocket:()=>lastServerSocket,assetSHA,assetLength:asset.length,command:()=>({command_id:'cmd',revision:'1',character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id:11,asset_sha256:assetSHA}),setBinding:patch=>{requireThat(!coordinator,'managed_binding');approved={...approved,...patch};},setWall:t=>wall=t,setFault:mode=>{fault=mode;if(mode==='pause')chunkReached=new Promise(resolve=>{signalChunk=resolve;});},waitForChunk:()=>chunkReached,resume:()=>{releasePause?.();releasePause=null;},lastPeer:()=>lastPeer,lastReceipt:()=>lastReceipt,lastError:()=>lastError,waitForIdle:()=>activeRequests===0?Promise.resolve():new Promise(resolve=>idleWaiters.add(resolve)),
  resources:()=>({listening:server.listening,sockets:sockets.size,agents:agents.size,requests:requests.size,timers:timers.size+activeTimers,activeRequests,invalidations,auth:auth.resources()}),
  async close(){if(closed)return;closed=true;releasePause?.();releasePause=null;const waits=[...requests,...sockets].map(r=>new Promise(resolve=>r.once('close',resolve)));for(const a of agents)a.destroy();agents.clear();for(const r of requests)r.destroy();if(!sessionRuntime){if(coordinator)coordinator.close();else auth.close();}for(const s of sockets)s.destroy();for(const t of timers)clearTimeout(t);timers.clear();await Promise.all([...waits,new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))]);await turn();if(!sessionRuntime)guard.close();}
 };
}
