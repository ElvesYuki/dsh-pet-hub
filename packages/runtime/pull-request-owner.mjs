import https from 'node:https';
import {requireThat as need,bounded} from '../core/protocol.mjs';
import {MTLS_OPTIONS} from './mtls-peer.mjs';
const failure=code=>Object.assign(new Error(code),{code});
/** No implicit queue. Abort/deadline invalidates work, but busy is held until actual run settles.
 * An abort-ignoring run can delay close indefinitely: this deliberately blocks reconnect, not fakes cleanup. */
export function createPullRequestOwner({clock,timers={setTimeout,clearTimeout}}){
 let active=null,blocked=false,closed=false,closing=null;
 return {
  async run({deadline,signal,operation}){
   need(!closed&&!blocked,'request_blocked');need(!active,'request_busy');bounded(deadline,clock.now()+1,Number.MAX_SAFE_INTEGER);need(typeof operation==='function');
   const controller=new AbortController(),job={controller,done:null};active=job;let reason=null;
   const stop=code=>{reason??=failure(code);blocked=true;controller.abort(reason);},abort=()=>stop('request_cancelled');
   const timer=timers.setTimeout(()=>stop('request_deadline'),deadline-clock.now());signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   job.done=(async()=>{try{await Promise.resolve();need(!reason&&!controller.signal.aborted,'request_cancelled');const result=await operation({signal:controller.signal,deadline});if(reason)throw reason;need(!closed&&clock.now()<deadline,'request_deadline');return result;}catch(error){blocked=true;throw reason??error;}finally{timers.clearTimeout(timer);signal?.removeEventListener('abort',abort);active=null;}})();return job.done;
  },
  resources:()=>({closed,blocked,inflight:active?1:0}),
  close(){if(closing)return closing;closed=true;blocked=true;active?.controller.abort(failure('request_closed'));return closing=(async()=>{try{await active?.done;}catch{} })();}
 };
}
/** Literal-loopback test transport; caller supplies disposable TLS keys/CA. Not a production endpoint.
 * One keepalive socket, no TLS resumption, fixed origin; failures wait request AND socket close. */
export function createLoopbackPullClient({port,servername='hub.test.invalid',ca,cert,key,clock,pathPrefix='/offline-round-pet/v1/'}){
 need(['/offline-round-pet/v1/','/hub-device/v1/','/hub-device/native400-review/v1/'].includes(pathPrefix),'invalid_pull_path');bounded(port,1,65535);const agent=new https.Agent({keepAlive:true,maxSockets:1,maxCachedSessions:0}),owner=createPullRequestOwner({clock});let socket=null,sockets=new Set(),requests=new Set(),connections=0;
 async function operation({method,path,body,headers,maxBytes,signal}){
  let response,error,result;const req=https.request({host:'127.0.0.1',port,servername,ca,cert,key,...MTLS_OPTIONS,rejectUnauthorized:true,maxHeaderSize:8192,agent,method,path,headers:{...(body?{'content-type':'application/json','content-length':String(body.length)}:{}),...headers}});requests.add(req);
  const waitClose=o=>new Promise(resolve=>o.closed?resolve():o.once('close',resolve)),closed=waitClose(req),abort=()=>{error??=signal.reason??failure('request_cancelled');req.destroy(error);socket?.destroy();};
  req.on('socket',s=>{socket=s;if(!sockets.has(s)){connections++;sockets.add(s);s.once('close',()=>sockets.delete(s));}});
  const finished=new Promise(resolve=>{
   req.once('error',e=>{error??=e;resolve();});req.once('response',res=>{response=res;const parts=[];let n=0;res.on('data',chunk=>{n+=chunk.length;if(n>maxBytes){error=failure('response_size');req.destroy(error);return;}parts.push(chunk);});res.once('error',e=>{error??=e;resolve();});res.once('end',()=>{if(!res.complete)error??=failure('response_truncated');else result={status:res.statusCode,headers:res.headers,rawHeaders:res.rawHeaders.slice(),body:Buffer.concat(parts)};resolve();});res.once('close',()=>{if(!res.complete){error??=failure('response_truncated');resolve();}});});
  });
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();req.end(body);
  try{await finished;await closed;if(error){if(socket&&!socket.closed){const end=waitClose(socket);socket.destroy();await end;}throw error;}return result;}
  finally{signal.removeEventListener('abort',abort);requests.delete(req);response?.removeAllListeners('data');}
 }
 return {request({method='POST',path,body,headers={},maxBytes=4096,deadline,signal}={}){need(typeof path==='string'&&path.startsWith(pathPrefix)&&!path.includes('://'),'invalid_pull_path');bounded(maxBytes,1,32768);return owner.run({deadline,signal,operation:args=>operation({method,path,body,headers,maxBytes,...args})});},
  socket:()=>socket,resources:()=>({...owner.resources(),requests:requests.size,sockets:sockets.size,connections}),
  async close(){const exiting=[...sockets].map(s=>new Promise(resolve=>s.closed?resolve():s.once('close',resolve)));const done=owner.close();agent.destroy();for(const r of requests)r.destroy();await done;await Promise.all(exiting);}
 };
}
