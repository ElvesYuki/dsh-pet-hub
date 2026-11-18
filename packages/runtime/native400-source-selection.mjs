import {open,lstat} from 'node:fs/promises';import {constants} from 'node:fs';import {isAbsolute,normalize,basename} from 'node:path';
import {NATIVE400_BOOT_LAYOUT as L} from '../core/native400-bootstrap.mjs';
import {native400ReviewSourceName,NATIVE400_REVIEW_ERRORS} from '../core/native400-source-review-view.mjs';
import {bounded,same,requireThat as need} from '../core/protocol.mjs';
const selections=new WeakMap(),failure=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
/** Shared with the actual reader. BigInt metadata stays decimal text, no content I/O. */
export function native400SourceFingerprint(s){need(s.isFile()&&s.size===BigInt(L.bytes)&&s.uid===BigInt(process.getuid())&&(s.mode&0o077n)===0n&&s.nlink===1n,'bootstrap_unsafe_source');return Object.fromEntries(['dev','ino','size','uid','mode','nlink','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));}
export async function checkNative400SourceFile(fd,file,original){need(same(original,native400SourceFingerprint(await fd.stat({bigint:true})))&&same(original,native400SourceFingerprint(await lstat(file,{bigint:true}))),'bootstrap_source_changed');}
function clockNow(r){
 try{const now=r.clock();if(now&&typeof now.then==='function')Promise.resolve(now).catch(()=>{});need(typeof now==='number'&&Number.isFinite(now)&&now>=0&&now<=Number.MAX_SAFE_INTEGER-r.lifetimeMs&&(r.lastTime===null||now>=r.lastTime),'bootstrap_selection_clock');r.lastTime=now;return now;}
 catch(cause){r.clockError=true;throw failure('bootstrap_selection_clock',cause);}
}
function live(r){need(!r.closed&&!r.revoked,'bootstrap_selection_revoked');need(!r.clockError,'bootstrap_selection_clock');clockNow(r);}
/** Internal metadata selection, not a usage approval or one-use browser grant.
 * ready returns an opaque reference only after fd close and fd/path stability.
 * Single short fd, zero content reads. TTL gates NEW tasks; admitted tasks retain
 * identity but observe revoke/close/signal/bad clocks. No timer survives capture.
 * close fences synchronously and waits actual metadata/hook exit, idempotently.
 * beforeCheck is an internal asynchronous test hook, never a page/config option. */
export function createNative400SourceSelection({file,sourceName,lifetimeMs=60000,clock=()=>performance.now(),signal,timeoutMs=10000,beforeCheck=async()=>{}}){
 need(typeof file==='string'&&isAbsolute(file)&&normalize(file)===file&&!file.includes('\0'),'bootstrap_selection_invalid');bounded(lifetimeMs,1,60000);bounded(timeoutMs,1,30000);need(typeof clock==='function'&&typeof beforeCheck==='function','bootstrap_selection_invalid');const name=native400ReviewSourceName(sourceName??basename(file));
 const r={file,clock,lifetimeMs,lastTime:null,expiresAt:null,clockError:false,closed:false,revoked:false,fingerprint:null};clockNow(r);
 const controller=new AbortController(),reference=Object.freeze({});let fd=null,issued=false,error=null,closing=null,listening=false;
 const detach=()=>{if(listening){signal.removeEventListener('abort',abort);listening=false;}},abort=()=>{r.revoked=true;controller.abort(failure('bootstrap_selection_revoked'));detach();};
 if(signal){signal.addEventListener('abort',abort,{once:true});listening=true;if(signal.aborted)abort();}
 const alive=()=>{live(r);need(!controller.signal.aborted,controller.signal.reason?.code??'bootstrap_cancelled');};
 const timer=setTimeout(()=>controller.abort(failure('bootstrap_deadline')),timeoutMs);
 const ready=(async()=>{
  try{alive();fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const original=native400SourceFingerprint(await fd.stat({bigint:true}));await beforeCheck({signal:controller.signal});alive();await checkNative400SourceFile(fd,file,original);alive();await fd.close();fd=null;alive();r.fingerprint=original;r.expiresAt=clockNow(r)+lifetimeMs;selections.set(reference,r);issued=true;return reference;}
  catch(cause){const reported=controller.signal.aborted?(controller.signal.reason?.code??'bootstrap_cancelled'):cause.code;error=NATIVE400_REVIEW_ERRORS.includes(reported)?reported:'bootstrap_read_failed';throw failure(error,cause);}
  finally{clearTimeout(timer);if(!issued)detach();if(fd){await fd.close();fd=null;}}
 })();ready.catch(()=>{});
 return {ready,
  snapshot(){let phase=r.closed?'closed':r.revoked?'revoked':r.clockError||error?'failed':issued?'selected':'selecting';let safeError=r.closed?null:r.revoked?'bootstrap_selection_revoked':r.clockError?'bootstrap_selection_clock':error;
   if(phase==='selected'){try{if(clockNow(r)>=r.expiresAt){phase='expired';safeError='bootstrap_selection_expired';}}catch{phase='failed';safeError='bootstrap_selection_clock';}}
   return {schema_version:1,profile:'native400-source-selection-status/1',source_name:name,phase,error:safeError};},
  resources:()=>({closed:r.closed,open_files:fd?1:0,content_reads:0,retained_cache_bytes:0,signal_listener:listening}),
  revoke(){abort();},
  close(){if(closing)return closing;r.closed=true;controller.abort(failure('bootstrap_selection_revoked'));detach();return closing=(async()=>{try{await ready;}catch{} })();}
 };
}
/** Reader-only binding. A reference cannot be cloned/serialized or used at another
 * path. No filesystem precheck here: verify MUST run on the reader's actual fd stat.
 * check remains valid after that reader closes so the manager can fence its commit.
 * It checks revocation/clock, not the selection TTL already passed at admission. */
export function bindNative400ExpectedSource(reference,file){
 if(reference===undefined)return null;const r=selections.get(reference);need(r,'bootstrap_selection_invalid');need(file===r.file,'bootstrap_selection_mismatch');live(r);need(clockNow(r)<r.expiresAt,'bootstrap_selection_expired');
 return {check:()=>live(r),verify(fingerprint){live(r);need(same(r.fingerprint,fingerprint),'bootstrap_selection_changed');}};
}
