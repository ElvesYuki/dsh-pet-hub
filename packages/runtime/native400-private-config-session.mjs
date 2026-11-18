import {openSync,closeSync,writeSync,fstatSync,lstatSync,realpathSync,mkdtempSync,unlinkSync,rmdirSync,ftruncateSync} from 'node:fs';import {join,isAbsolute} from 'node:path';
import {privatePath} from './paths.mjs';import {native400DeviceRamConfig} from './native400-tcp-lan-request.mjs';import {beginNative400ReviewedConfigHandoff} from './native400-reviewed-lan-request.mjs';import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
const used=new WeakSet(),fail=code=>Object.assign(new Error(code),{code});
const controls=new WeakMap();
/** Transfer one genuine session to a trusted lifecycle owner. Captured methods
 * cannot be forged by replacing public ready/close/resources. No usage grant. */
export function claimNative400PrivateConfigSession(task,owner){const entry=controls.get(task);need(entry&&owner&&typeof owner==='object'&&!entry.owner,'config_session_owner_invalid');entry.owner=owner;return entry.control;}
const codes=new Set(['config_session_invalid','config_session_closed','config_session_aborted','config_session_deadline','config_session_guard_failed','config_session_locked','config_session_prepare_failed','config_session_storage_changed','config_session_write_failed','config_session_consumer_used','config_session_consumer_invalid','config_session_consumer_failed']);
const need=(ok,code='config_session_invalid')=>{if(!ok)throw fail(code);};
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)));
function normalized(config){
 exact(config,['schema_version','profile','identity','endpoint','wifi']);need(config.schema_version===1&&config.profile==='native400-device-lan-ram/1');
 exact(config.identity,['namespace_sha256','source_manifest_sha256','role_index_sha256','records']);const {role_index_sha256,...identity}=config.identity;
 return native400DeviceRamConfig({identity:{...identity,hub_index_sha256:role_index_sha256},endpoint:config.endpoint,wifi:config.wifi});
}
function samePath(path,origin,kind){privatePath(path,kind);const s=lstatSync(path);need(s.dev===origin.dev&&s.ino===origin.ino&&(kind==='directory'||s.nlink===1),'config_session_storage_changed');}
function sameFd(fd,origin){const s=fstatSync(fd);need(s.isFile()&&s.dev===origin.dev&&s.ino===origin.ino&&s.uid===origin.uid,'config_session_storage_changed');}

/** Explicit low-level private-file session, not material/transport authorization.
 * Consumer is trusted code: run({file,signal}) once; close() must await actual
 * serial/process I/O exit. This module never opens USB or launches a process.
 * Cancellation fences results but keeps file/lock until run AND close exit.
 * Cleanup failure retains ownership; retryCleanup never repeats run. Visible
 * overwrite/truncate/unlink is not physical secure erasure (JS/OS/SSD copies).
 * beforeConsume/fault/guard are trusted lifecycle/test hooks, never file inputs. */
export function createNative400PrivateConfigSession({directory,config,consumer,signal,timeoutMs=10000,guard=()=>true,beforeConsume=async()=>{},fault=()=>{}}){
 let root;try{need(typeof directory==='string'&&isAbsolute(directory)&&realpathSync(directory)===directory);privatePath(directory,'directory');root=lstatSync(directory);}catch{throw fail('config_session_invalid');}
 need(consumer&&typeof consumer==='object'&&typeof consumer.run==='function'&&typeof consumer.close==='function'&&typeof guard==='function'&&typeof beforeConsume==='function'&&typeof fault==='function');
 need(Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=120000);need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');
 let buffer;try{let data=normalized(structuredClone(config));buffer=Buffer.from(C(data)+'\n');need(buffer.length<=16384);data=null;}catch{buffer?.fill(0);throw fail('config_session_invalid');}config=null;
 const controller=new AbortController(),lock=join(directory,'config-session.lock');let lockFd=null,fileFd=null,lockStat=null,dir=null,dirStat=null,file=null,fileStat=null,unlinked=false,wiped=false,lockRemoved=false,dirRemoved=false;
 let closed=false,phase='preparing',outcome='not-started',error=null,claimed=false,runExited=true,consumerExited=false,closeWork=null,closing=null,retrying=null,cleanupUnknown=false,timer=null,poll=null;
 const rootCheck=()=>samePath(directory,root,'directory');
 const sync=fn=>{const value=fn();if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});throw fail('config_session_invalid');}return value;};
 const stopConsumer=()=>{if(!claimed||consumerExited)return Promise.resolve();if(!closeWork){closeWork=Promise.resolve().then(()=>consumer.close()).then(()=>{consumerExited=true;});closeWork.catch(()=>{});}return closeWork;};
 const stop=code=>{if(!controller.signal.aborted)controller.abort(fail(code));void stopConsumer();};
 const onAbort=()=>stop('config_session_aborted');
 const live=()=>{need(!closed&&!controller.signal.aborted,closed?'config_session_closed':controller.signal.reason?.code??'config_session_aborted');need(sync(guard)===true,'config_session_guard_failed');};
 const clear=()=>{clearTimeout(timer);clearInterval(poll);timer=poll=null;signal?.removeEventListener('abort',onAbort);buffer?.fill(0);buffer=null;};
 const cleanLocal=()=>{
  rootCheck();if(dir&&!dirRemoved)samePath(dir,dirStat,'directory');
  if(fileFd!==null){sameFd(fileFd,fileStat);if(!unlinked)samePath(file,fileStat,'file');if(!wiped){sync(()=>fault('before_wipe'));const size=fstatSync(fileFd).size;need(size<=16384,'config_session_storage_changed');const zero=Buffer.alloc(size);let n=0;while(n<size){const count=writeSync(fileFd,zero,n,size-n,n);need(count>0,'config_session_write_failed');n+=count;}ftruncateSync(fileFd,0);wiped=true;}}
  if(fileStat&&!unlinked){sync(()=>fault('before_unlink'));samePath(file,fileStat,'file');unlinkSync(file);unlinked=true;}
  if(fileFd!==null){sameFd(fileFd,fileStat);closeSync(fileFd);fileFd=null;}
  if(dir&&!dirRemoved){samePath(dir,dirStat,'directory');rmdirSync(dir);dirRemoved=true;}
  if(lockStat&&!lockRemoved){sync(()=>fault('before_unlock'));samePath(lock,lockStat,'file');if(lockFd!==null){sameFd(lockFd,lockStat);closeSync(lockFd);lockFd=null;}unlinkSync(lock);lockRemoved=true;}
  need(fileFd===null&&lockFd===null&&(!dir||dirRemoved)&&(!lockStat||lockRemoved),'config_session_cleanup_unknown');
 };
 const finish=async()=>{need(runExited,'config_session_cleanup_unknown');await stopConsumer();cleanLocal();};
 signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();
 timer=setTimeout(()=>stop('config_session_deadline'),timeoutMs);poll=setInterval(()=>{try{live();}catch{stop(controller.signal.reason?.code??'config_session_guard_failed');}},25);
 async function run(){let bodyError=null;
  try{
   live();rootCheck();try{lockFd=openSync(lock,'wx',0o600);}catch(e){throw fail(e.code==='EEXIST'?'config_session_locked':'config_session_prepare_failed');}lockStat=fstatSync(lockFd);
   rootCheck();dir=mkdtempSync(join(directory,'config-'));dirStat=lstatSync(dir);samePath(dir,dirStat,'directory');file=join(dir,'config.json');fileFd=openSync(file,'wx+',0o600);fileStat=fstatSync(fileFd);
   sync(()=>fault('before_write'));live();let at=0;while(at<buffer.length){const n=writeSync(fileFd,buffer,at,buffer.length-at,at);need(n>0,'config_session_write_failed');at+=n;}buffer.fill(0);buffer=null;
   sync(()=>fault('after_write'));await beforeConsume({signal:controller.signal});live();rootCheck();samePath(dir,dirStat,'directory');samePath(file,fileStat,'file');need(!used.has(consumer),'config_session_consumer_used');
   used.add(consumer);claimed=true;outcome='unknown';phase='consuming';runExited=false;
   let value;try{value=await consumer.run({file,signal:controller.signal});}catch{throw fail('config_session_consumer_failed');}finally{runExited=true;}
   if(!closed&&!controller.signal.aborted){need(['queued','rejected','unknown'].includes(value),'config_session_consumer_invalid');outcome=value==='queued'?'queued-not-connected-or-presented':value;}
  }catch(e){bodyError=controller.signal.aborted?(controller.signal.reason?.code??'config_session_aborted'):codes.has(e.code)?e.code:claimed?'config_session_consumer_failed':'config_session_prepare_failed';}
  phase='closing';try{await finish();}catch{cleanupUnknown=true;phase='cleanup-unknown';error='config_session_cleanup_unknown';throw fail(error);}finally{clear();}
  if(!bodyError&&controller.signal.aborted)bodyError=controller.signal.reason?.code??'config_session_aborted';
  if(bodyError){phase=closed||controller.signal.aborted?'cancelled':'failed';error=bodyError;throw fail(error);}phase='completed';return snapshot();
 }
 function snapshot(){return {schema_version:1,profile:'native400-private-config-session-view/1',phase,outcome,closed,consumer_started:claimed,run_exited:runExited,consumer_exit_confirmed:consumerExited,storage_cleaned:(!lockStat||lockRemoved)&&(!dir||dirRemoved)&&fileFd===null&&lockFd===null,error,device_evidence:false,device_cleanup:'unknown'};}
 const ready=run();ready.catch(()=>{});
 const task={ready,snapshot,resources:()=>({file_descriptors:Number(lockFd!==null)+Number(fileFd!==null),lock_held:!!lockStat&&!lockRemoved,staging_directory:!!dir&&!dirRemoved,consumer_running:!runExited,consumer_exit_confirmed:consumerExited,timers:Number(timer!==null)+Number(poll!==null),buffer_retained:buffer!==null}),
  close(){if(closing)return closing;closed=true;stop('config_session_closed');return closing=(async()=>{try{await ready;}catch{}need(!cleanupUnknown,'config_session_cleanup_unknown');})();},
  retryCleanup(){if(retrying)return retrying;need(cleanupUnknown&&runExited,'config_session_retry_unavailable');closed=true;controller.abort(fail('config_session_closed'));if(!consumerExited)closeWork=null;
   retrying=(async()=>{try{await finish();cleanupUnknown=false;phase='cleaned';closing=null;return snapshot();}catch{throw fail('config_session_cleanup_unknown');}finally{retrying=null;}})();return retrying;}
 };
 controls.set(task,{owner:null,control:{ready,close:task.close,resources:task.resources,snapshot:task.snapshot}});return task;
}

/** Optional higher-level candidate. Consumes only a genuine TCP12 one-shot
 * handoff, then polls its source/window/endpoint/epoch guard during the session.
 * Invalid/unstarted owners fail before private files or consumers are touched. */
export function createNative400ReviewedConfigSession({request,owner,wifi,...options}){
 const handoff=beginNative400ReviewedConfigHandoff(request,{owner,wifi});return createNative400PrivateConfigSession({...options,config:handoff.config,guard:handoff.check});
}
