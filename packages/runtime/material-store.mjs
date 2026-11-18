import {Worker} from 'node:worker_threads';
import {mkdirSync,rmSync} from 'node:fs';
import {join,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {privatePath} from './paths.mjs';
import {createStoreLifecycle} from './store-lifecycle.mjs';
import {requireThat,digest} from '../core/protocol.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** One bounded worker; test hooks are internal, never populated by IPC. */
export function createMaterialStore(directory,options,lifecycle=createStoreLifecycle(directory),{
 workerFactory=(url,args)=>new Worker(url,args),validationTimeoutMs=120000,rpcTimeoutMs=2000,timers={setTimeout,clearTimeout},
}={}){
 digest(options.indexSha256);
 for(const value of [validationTimeoutMs,rpcTimeoutMs])requireThat(Number.isSafeInteger(value)&&value>0,'invalid_timeout');
 const store=join(directory,'material-store');try{mkdirSync(store,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}privatePath(store,'directory');
 const stage=join(store,`.staging-${randomUUID()}`);mkdirSync(stage,{mode:0o700});lifecycle.beginStage(basename(stage),options.indexSha256);
 let status={phase:'pending',validated_assets:0,validated_bytes:0},terminal=false,closing=null,n=0,resolveReady,rejectReady,worker,validationTimer;
 let alive=false,highWater=0,timeouts=0;
 const requests=new Map(),available=new Set();
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
 function shutdown(code){
  if(closing)return closing;
  terminal=true;timers.clearTimeout(validationTimer);rejectReady(fault(code));
  for(const p of requests.values()){timers.clearTimeout(p.timer);p.reject(fault(code));}requests.clear();
  closing=(async()=>{try{await worker?.terminate();alive=false;rmSync(stage,{recursive:true,force:true});}finally{lifecycle.finishStage(basename(stage));lifecycle.endCatalog(options.indexSha256);}})();
  return closing;
 }
 function fail(code){if(terminal)return;status={...status,phase:'failed',error:code};void shutdown(code).catch(()=>{status={...status,cleanup_error:true};});}
 try{worker=workerFactory(new URL('./material-worker.mjs',import.meta.url),{workerData:{options,stage,store}});alive=true;}
 catch(e){terminal=true;rmSync(stage,{recursive:true,force:true});lifecycle.finishStage(basename(stage));lifecycle.endCatalog(options.indexSha256);rejectReady(e);throw e;}
 validationTimer=timers.setTimeout(()=>{timeouts++;fail('validation_timeout');},validationTimeoutMs);validationTimer?.unref?.();
 worker.on('error',()=>fail('worker_failed'));worker.on('exit',()=>{alive=false;if(!terminal)fail('worker_exited');});
 worker.on('message',m=>{
  if(terminal)return;
  if(m.type==='reserve'){lifecycle.reserve(basename(stage),m.bytes).then(()=>{if(!terminal)worker.postMessage({type:'reservation',approved:true});}).catch(e=>{if(!terminal)worker.postMessage({type:'reservation',approved:false,error:e.code??'quota_failed'});});return;}
  const metrics=Object.fromEntries(['peak_asset_bytes','retained_library_bytes','decoder_count','worker_heap_bytes','worker_array_buffer_bytes'].filter(k=>m[k]!==undefined).map(k=>[k,m[k]]));
  if(m.type==='progress')status={...status,...metrics,phase:m.phase,validated_assets:m.validated_assets,validated_bytes:m.validated_bytes,validated_frames:m.validated_frames??0};
  if(m.type==='failed')fail(m.error);
  if(m.type==='ready'){
   timers.clearTimeout(validationTimer);lifecycle.finishStage(basename(stage));status={...status,...metrics,phase:'ready'};for(const manifest of m.manifests)for(const a of manifest.actions)available.add(a.sha256);
   resolveReady({manifests:m.manifests,...(m.blob_proofs?{blobProofs:structuredClone(m.blob_proofs)}:{}),hasAsset:hash=>available.has(hash),prepare,release});
  }
  if(m.type==='reply'){
   const pending=requests.get(m.requestId);if(!pending)return;status={...status,...metrics};requests.delete(m.requestId);timers.clearTimeout(pending.timer);
   if(m.error)pending.reject(fault(m.error));else pending.resolve(m.result);
  }
 });
 function request(data){
  if(terminal||status.phase!=='ready')return Promise.reject(fault('store_unavailable'));
  if(requests.size>=8)return Promise.reject(fault('store_busy'));
  const requestId=++n;return new Promise((resolve,reject)=>{
   const timer=timers.setTimeout(()=>{timeouts++;fail('rpc_timeout');},rpcTimeoutMs);timer?.unref?.();
   requests.set(requestId,{resolve,reject,timer});highWater=Math.max(highWater,requests.size);
   try{worker.postMessage({requestId,...data});}catch{fail('worker_failed');}
  });
 }
 async function prepare(deviceId,action,manifest){const token=randomUUID();const proof=await request({op:'prepare',deviceId,token,hash:action.sha256,manifestSha:manifest.sha256,actionId:action.id});
  return proof===true?true:{...proof,frame:frameIndex=>request({op:'frame',deviceId,token,frameIndex}),pixels:frameIndex=>request({op:'pixels',deviceId,token,frameIndex})};
 }
 function release(deviceId){return request({op:'release',deviceId}).catch(()=>{});}
 return {ready,snapshot:()=>structuredClone({...status,worker_alive:alive,pending_requests:requests.size,max_pending_requests:highWater,timeouts}),
  close(){if(!closing)status={...status,phase:'closed'};return shutdown('store_closed');}};
}
