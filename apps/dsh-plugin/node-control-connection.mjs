import {native400NodeControlBody,native400NodeControlEnvelope,native400NodeControlAck} from '../../packages/core/native400-node-control-access.mjs';
import {native400ReviewError} from '../../packages/runtime/native400-review-channel.mjs';
import {SMALL_RESPONSE_BYTES} from '../../packages/core/material-profile.mjs';
const prefix='/api/pet-hub-node',failure=code=>Object.assign(Error(code),{code});
function wait(value,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(failure('controls_operation_failed'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
async function body(request,signal){
 const length=request.headers.get('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/.test(length)||Number(length)>4096))throw failure('controls_body_too_large');
 const reader=request.body?.getReader();if(!reader)throw failure('controls_invalid_request');const chunks=[];let size=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{for(;;){signal.throwIfAborted();const {done,value}=await wait(reader.read(),signal);signal.throwIfAborted();if(done)break;size+=value.byteLength;if(size>4096)throw failure('controls_body_too_large');chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}try{return native400NodeControlBody(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{throw failure('controls_invalid_request');}}
 finally{signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Explicit trusted assembly only. Connection admits owner before Fetch dispatch;
 * resolve must independently bind that Request to an authorized scoped hub client.
 * No grant minting, raw-Origin bypass, cookie parsing, or service ownership. */
export function createDshNodeControlConnection({enabled=false,resolve}={}){
 if(typeof enabled!=='boolean'||enabled&&typeof resolve!=='function')throw Error('invalid connection control provider');
 return function apply(ctx){if(!enabled)return;ctx.effect(()=>{
  let mounted=true;const active=new Set(),off=[];
  const stop=()=>{mounted=false;for(const c of active)c.abort();for(const dispose of off.reverse())dispose();};
  function reply(status,value){let text=JSON.stringify(value);if(Buffer.byteLength(text)>SMALL_RESPONSE_BYTES){status=503;text=JSON.stringify({error:'controls_invalid_response'});}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'no-store'}});}
  async function fetch(request,method,path){const controller=new AbortController(),signal=AbortSignal.any([controller.signal,request.signal]),timer=setTimeout(()=>controller.abort(),2500);active.add(controller);
   try{
    if(!mounted)throw failure('controls_closed');signal.throwIfAborted();const url=new URL(request.url);
    if(request.method!==method||url.pathname!==prefix+path||url.search)return reply(404,{error:'not found'});
    if(method==='POST'&&(request.headers.get('content-type')!=='application/json'||request.headers.get('x-pet-hub')!=='1'))return reply(403,{error:'controls_unauthorized'});
    const scoped=await wait(resolve(request,{signal}),signal);signal.throwIfAborted();if(!mounted)throw failure('controls_closed');if(!scoped||typeof scoped.request!=='function')return reply(401,{error:'controls_unauthorized'});
    const input=method==='POST'?await body(request,signal):undefined;signal.throwIfAborted();if(!mounted)throw failure('controls_closed');
    const result=await wait(scoped.request(method,'/v1/node-control'+path,input,{signal}),signal);signal.throwIfAborted();if(!mounted)throw failure('controls_closed');
    return reply(200,method==='GET'?native400NodeControlEnvelope(result):native400NodeControlAck(result,input));
   }catch(error){const f=native400ReviewError({...error,code:error.code??error.message});return reply(f.status,{error:f.error});}finally{clearTimeout(timer);active.delete(controller);}
  }
  try{for(const [method,path] of [['GET','/controls'],['POST','/command']])off.push(ctx.connection.fetch.register({path:prefix+path,methods:[method],requestBody:method==='POST'?'streaming':'buffered',fetch:request=>fetch(request,method,path)}));}catch(error){stop();throw error;}
  return stop;
 },'pet-hub: Connection control routes');};
}
