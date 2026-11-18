import {native400SourceFingerprint as fingerprint,checkNative400SourceFile,bindNative400ExpectedSource} from './native400-source-selection.mjs';
import {open} from 'node:fs/promises';import {constants} from 'node:fs';import {createHash} from 'node:crypto';
import {createNative400BootstrapInspector,NATIVE400_BOOT_LAYOUT as L} from '../core/native400-bootstrap.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';import {bounded,clone,requireThat as need} from '../core/protocol.mjs';
import {sha256} from './material-import.mjs';
const failure=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
/** Explicit private cache-file review. Caller supplies two separate trusted decisions.
 * One read-only fd/64KiB stream buffer. ready publishes only after all hashes/checks
 * and fd close. close fences immediately and awaits actual read/hook exit; no writes,
 * imports, file approval lookup, device attestations or production entry points.
 * expectedSource optionally pins an internal metadata selection before first read;
 * checkSource synchronously fences later manager commit without reopening the file. */
export function createNative400BootstrapReview({file,package:pkg,catalog,approval,mappingApproval,minimumSequence='0',signal,timeoutMs=10000,beforeRead=async()=>{},expectedSource}){
 bounded(timeoutMs,1,30000);const inspector=createNative400BootstrapInspector({package:pkg,catalog,approval,mappingApproval,hash:sha256});
 const binding=bindNative400ExpectedSource(expectedSource,file);
 const controller=new AbortController();let closed=false,closing=null,fd=null,phase='reading',error=null,reads=0,streamed=0,result=null;
 const abort=()=>controller.abort(failure('bootstrap_cancelled')),alive=()=>{need(!closed&&!controller.signal.aborted,'bootstrap_cancelled');binding?.check();};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(()=>controller.abort(failure('bootstrap_deadline')),timeoutMs);
 async function run(){
  try{
   alive();fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const original=fingerprint(await fd.stat({bigint:true}));binding?.verify(original);
   async function unchanged(){alive();await checkNative400SourceFile(fd,file,original);alive();}
   async function read(offset,length,out){await unchanged();await beforeRead({offset,length,signal:controller.signal});alive();let n=0;while(n<length){const r=await fd.read(out,n,length-n,offset+n);need(r.bytesRead>0,'bootstrap_source_changed');n+=r.bytesRead;}reads++;await unchanged();return out;}
   const roots=[],objects=[];for(let i=0;i<2;i++)roots.push(await read(i*4096,256,Buffer.alloc(256)));for(let i=0;i<5;i++)objects.push(await read(8192+i*L.stride,256,Buffer.alloc(256)));
   const selected=inspector.inspect({roots,objects,bytes:L.bytes,minimumSequence}),buffer=Buffer.alloc(65536),hash=createHash('sha256');
   for(let offset=0;offset<L.bytes;offset+=buffer.length){const n=Math.min(buffer.length,L.bytes-offset);await read(offset,n,buffer);hash.update(buffer.subarray(0,n));streamed+=n;}
   const cacheSha=hash.digest('hex');
   for(const o of selected.objects){const h=createHash('sha256');for(let offset=0;offset<o.bytes;offset+=buffer.length){const n=Math.min(buffer.length,o.bytes-offset);await read(o.payload_offset+offset,n,buffer);h.update(buffer.subarray(0,n));streamed+=n;}need(h.digest('hex')===o.file_sha256,'bootstrap_payload_mismatch');}
   await unchanged();alive();await fd.close();fd=null;alive();const content={schema_version:1,scope:'offline-source-review',...selected,cache:{bytes:L.bytes,sha256:cacheSha},checks:{catalog_metadata:true,payload_sha256:true,media_validation:'not-performed'},device_evidence:false};
   result={recipe:'native400-bootstrap-source-map-v1-canonical-json',sha256:sha256(C(content)),content};phase='reviewed';return clone(result);
  }catch(e){error=controller.signal.aborted?(controller.signal.reason?.code??'bootstrap_cancelled'):e.code??'bootstrap_read_failed';phase=closed?'closed':'failed';throw failure(error,e);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(fd){await fd.close();fd=null;}}
 }
 const ready=run();ready.catch(()=>{});
 return {ready,checkSource:()=>binding?.check(),snapshot:()=>({phase,error,reads,streamed_bytes:streamed,result:phase==='reviewed'?clone(result):null}),resources:()=>({closed,open_files:fd?1:0,stream_buffer_max:65536,retained_cache_bytes:0}),close(){if(closing)return closing;closed=true;phase='closed';controller.abort(failure('bootstrap_cancelled'));return closing=(async()=>{try{await ready;}catch{} })();}};
}
