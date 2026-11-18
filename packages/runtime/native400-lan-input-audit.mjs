import {open,lstat} from 'node:fs/promises';import {constants} from 'node:fs';import {isAbsolute,normalize} from 'node:path';import {createHash} from 'node:crypto';
import {native400SourceCandidate} from '../core/native400-identity.mjs';
import {inspectNative400BootstrapHeaders,NATIVE400_BOOT_LAYOUT as L,NATIVE400_BOOT_NAMESPACE} from '../core/native400-bootstrap.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {native400LanIdentity} from './native400-tcp-lan-profile.mjs';import {native400TcpMapping} from './native400-tcp.mjs';import {sha256} from './material-import.mjs';
const fail=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const need=(ok,code='lan_audit_invalid')=>{if(!ok)throw fail(code);};
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)));
const path=p=>need(typeof p==='string'&&isAbsolute(p)&&normalize(p)===p&&!p.includes('\0'));
const digest=d=>need(typeof d==='string'&&d.length===64&&/^[a-f0-9]{64}$/.test(d)&&d!=='0'.repeat(64));
const fingerprint=s=>Object.fromEntries(['dev','ino','size','uid','mode','nlink','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));
const contexts=new WeakMap();

/** Trusted local assembly only. JSON/snapshots cannot stand in for a completed
 * task. Returns a copied historical evidence and its parsed source license ref,
 * or null after close/failure/before ready. No approval or ongoing file watch. */
export function native400LanInputAuditContext(task){
 const get=contexts.get(task);need(get,'lan_audit_evidence_unavailable');return get();
}

/** Explicit offline provenance audit. No approvals, LAN option, config export,
 * persistence or network/USB access. Keeps up to three read-only fds pinned until
 * final cross-file checks; one 64KiB cache stream buffer, metadata <=2MiB.
 * ready returns historical-only self-hashed evidence after actual fd exit.
 * close/abort/deadline fence publication and wait actual I/O/hook exit (not hard
 * preemption). beforeRead is trusted test code, never a file/IPC option. */
export function createNative400LanInputAudit({sourceManifestFile,sourceIndexFile,cacheSource,expected,minimumSequence='0',signal,timeoutMs=10000,beforeRead=async()=>{}}){
 path(sourceManifestFile);path(sourceIndexFile);exact(cacheSource,['file','offset','source_bytes']);path(cacheSource.file);
 const cache=structuredClone(cacheSource),pin=structuredClone(expected);exact(pin,['source_manifest_sha256','source_index_sha256','cache_sha256','mapping_sha256']);Object.values(pin).forEach(digest);
 need(Number.isSafeInteger(cache.offset)&&cache.offset>=0&&cache.offset+L.bytes===cache.source_bytes&&cache.source_bytes<=33554432);
 need(Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=30000&&typeof beforeRead==='function');
 need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');
 let closed=false,closing,phase='reading',error=null,result=null,sourceLicense=null,reads=0,streamed=0;const files=[],controller=new AbortController();
 const abort=()=>controller.abort(fail('lan_audit_cancelled')),alive=()=>{need(!closed&&!controller.signal.aborted,closed?'lan_audit_closed':controller.signal.reason?.code??'lan_audit_cancelled');};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(()=>controller.abort(fail('lan_audit_deadline')),timeoutMs);
 async function unchanged(r){alive();const s=await r.fd.stat({bigint:true}),p=await lstat(r.file,{bigint:true});need(C(fingerprint(s))===C(r.original)&&C(fingerprint(p))===C(r.original),'lan_audit_source_changed');alive();}
 async function opened(file,kind,limit,privateFile=false){
  alive();const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK),r={fd,file,kind,original:null};files.push(r);alive();const s=await fd.stat({bigint:true});
  need(s.isFile()&&s.uid===BigInt(process.getuid())&&s.nlink===1n&&(s.mode&(privateFile?0o077n:0o022n))===0n&&s.size>0n&&s.size<=BigInt(limit),'lan_audit_unsafe_source');r.original=fingerprint(s);await unchanged(r);return r;
 }
 async function read(r,offset,length,out){
  await unchanged(r);await beforeRead({kind:r.kind,offset,length,signal:controller.signal});alive();let n=0;
  while(n<length){const v=await r.fd.read(out,n,length-n,offset+n);need(v.bytesRead>0,'lan_audit_source_changed');n+=v.bytesRead;alive();}
  reads++;await unchanged(r);return out;
 }
 async function small(file,kind){const r=await opened(file,kind,1048576),b=Buffer.alloc(Number(r.original.size));await read(r,0,b.length,b);return b;}
 async function run(){let evidence,cause,cleanup;
  try{
   const sourceBytes=await small(sourceManifestFile,'manifest'),indexBytes=await small(sourceIndexFile,'index');
   need(sha256(sourceBytes)===pin.source_manifest_sha256&&sha256(indexBytes)===pin.source_index_sha256,'lan_audit_metadata_pin');
   const candidate=native400SourceCandidate({sourceBytes,indexBytes,hash:sha256});sourceLicense=candidate.manifest.license_ref;
   const r=await opened(cache.file,'cache',cache.source_bytes,true);need(Number(r.original.size)===cache.source_bytes,'lan_audit_cache_size');
   const roots=[],objects=[];for(let i=0;i<2;i++)roots.push(await read(r,cache.offset+i*4096,256,Buffer.alloc(256)));
   for(let i=0;i<5;i++)objects.push(await read(r,cache.offset+8192+i*L.stride,256,Buffer.alloc(256)));
   const selected=inspectNative400BootstrapHeaders({metadata:candidate,roots,objects,bytes:L.bytes,minimumSequence});
   need(!selected.selection.degraded_roots&&!selected.selection.fallback_from_newer,'lan_audit_degraded_roots');
   const identity=native400LanIdentity({namespace_sha256:NATIVE400_BOOT_NAMESPACE,source_manifest_sha256:candidate.identity.source_manifest_sha256,hub_index_sha256:candidate.identity.source_index_sha256,records:selected.objects.map(o=>({action:o.action_id,bytes:o.bytes,frames:o.frames,asset_sha256:o.file_sha256}))});
   const mapping=native400TcpMapping(identity);need(mapping===pin.mapping_sha256,'lan_audit_mapping_pin');
   const buffer=Buffer.alloc(65536),hash=createHash('sha256');
   for(let at=0;at<L.bytes;at+=buffer.length){const n=Math.min(buffer.length,L.bytes-at);await read(r,cache.offset+at,n,buffer);hash.update(buffer.subarray(0,n));streamed+=n;}
   const cacheSha=hash.digest('hex');need(cacheSha===pin.cache_sha256,'lan_audit_cache_pin');
   for(const o of selected.objects){const h=createHash('sha256');for(let at=0;at<o.bytes;at+=buffer.length){const n=Math.min(buffer.length,o.bytes-at);await read(r,cache.offset+o.payload_offset+at,n,buffer);h.update(buffer.subarray(0,n));streamed+=n;}need(h.digest('hex')===o.file_sha256,'lan_audit_payload_mismatch');}
   for(const f of files)await unchanged(f);alive();
   const content={schema_version:1,scope:'offline-input-audit',identity,mapping_sha256:mapping,cache:{bytes:L.bytes,sha256:cacheSha,source_file_bytes:cache.source_bytes,offset:cache.offset,historical_only:true},selection:selected.selection,checks:{catalog_metadata:true,payload_sha256:true,media_validation:'not-performed'},current_device_inventory:false,material_usage_approved:false,device_evidence:false,authenticated:false};
   evidence={recipe:'native400-lan-input-evidence/1',sha256:sha256(C(content)),content};
  }catch(e){cause=e;}
  finally{
   for(const r of files){if(!r.fd)continue;try{await r.fd.close();r.fd=null;}catch(e){cleanup??=e;}}
   clearTimeout(timer);signal?.removeEventListener('abort',abort);
  }
  try{
   if(cleanup)throw fail('lan_audit_cleanup_failed',cleanup);if(cause)throw cause;alive();result=evidence;phase='audited';return structuredClone(evidence);
  }catch(e){const reason=closed?'lan_audit_closed':controller.signal.aborted?controller.signal.reason?.code:e.code;error=/^(lan_audit_|bootstrap_)/.test(reason??'')?reason:'lan_audit_failed';phase=closed?'closed':'failed';throw fail(error,e);}
 }
 const ready=run();ready.catch(()=>{});
 const task={ready,snapshot:()=>({schema_version:1,profile:'native400-lan-input-audit-view/1',phase,error,reads,streamed_bytes:streamed,result:phase==='audited'?structuredClone(result):null,device_evidence:false}),
  resources:()=>({closed,open_files:files.filter(r=>r.fd).length,metadata_bytes_max:2097152,stream_buffer_max:65536,retained_cache_bytes:0}),
  close(){if(closing)return closing;closed=true;phase='closed';controller.abort(fail('lan_audit_closed'));return closing=(async()=>{try{await ready;}catch{}need(!files.some(r=>r.fd),'lan_audit_cleanup_failed');})();}
 };
 contexts.set(task,()=>!closed&&phase==='audited'?{evidence:structuredClone(result),license_ref:sourceLicense}:null);return task;
}
