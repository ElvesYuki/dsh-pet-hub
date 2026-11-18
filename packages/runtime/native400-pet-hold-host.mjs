import {spawn} from 'node:child_process';
import {readFileSync,realpathSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {acquireNative400ExecutionSnapshot} from './native400-execution-snapshot.mjs';
import {validateNative400NodeLoadReceipt} from './native400-node-load-audit.mjs';
import {acquireNative400NodeControlRunClient,checkNative400NodeControlRunWindow} from './native400-node-control-window.mjs';
import {native400NodeControlBody,native400NodeControlEnvelope} from '../core/native400-node-control-access.mjs';
import {validatePetUrl} from '../source-pet/index.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),fail=code=>Object.assign(Error(code),{code}),need=(v,c='pet_hold_host_invalid')=>{if(!v)throw fail(c);};
const childPath='packages/runtime/native400-pet-hold-host-child.mjs',loaderPath='packages/runtime/native400-node-load-child.mjs',entryPath='packages/runtime/native400-pet-hold-run.mjs';
/** Trusted local fixed-copy host. window must be the genuine elected parent's
 * window, not JSON. It retains audit/request/shared owner; child gets no bearer,
 * grant or issuer, only a one-at-a-time transport to this loan's original UDS.
 * Does not create material approval, listener or a DSH/ESP runtime identity. */
export function createNative400PetHoldHost(input={}){
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['enabled','snapshot','window','base','expectedRevision','runMs','sourceMs','signal','startupMs','closeMs','observe'].includes(k)));
 const {enabled=false,snapshot,window,base,expectedRevision='0',runMs=45000,sourceMs=60000,signal,startupMs=5000,closeMs=3000,observe}=input;
 need(enabled===true&&process.version==='v24.14.1'&&process.platform!=='win32'&&Number.isInteger(runMs)&&runMs>0&&runMs<=45000&&Number.isInteger(sourceMs)&&sourceMs>runMs+7500&&sourceMs<=120000);
 need(typeof expectedRevision==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(expectedRevision)&&BigInt(expectedRevision)<(1n<<64n)&&Number.isInteger(startupMs)&&startupMs>=100&&startupMs<=10000&&Number.isInteger(closeMs)&&closeMs>=100&&closeMs<=5000);validatePetUrl(base);
 need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');
 let phase='ready',error=null,stopReason=null,armed=false,queued=false,attempted=false,closed=false,child=null,exited=true,loan=null,authority=null,home=null,starting=null,closing=null,stdout='',stderrBytes=0,receipt=null,instance=null,loaded=false,lastState=null,final=null,active=null,high=0,startSent=null,watch=null,killTimer=null,code=null,detached=null,finished=false;
 let readyResolve,readyReject,doneResolve;const ready=new Promise((a,b)=>{readyResolve=a;readyReject=b;}),done=new Promise(a=>doneResolve=a);ready.catch(()=>{});
 const tasks=new Set();
 need(observe===undefined||typeof observe==='function');
 const note=e=>{if(observe){const v=observe(Object.freeze(e));need(!v||typeof v.then!=='function','pet_hold_host_observer');}};
 let provenance=null;const id=randomBytes(32).toString('hex');
 function emit(m){if(child?.connected)child.send(m,e=>{if(e)stop('ipc_failed');});}
 function kill(kind){if(!child||exited)return;try{process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH'){try{child.kill(kind);}catch{error??='termination_unknown';}}}}
 function armExit(){if(killTimer!==null||exited)return;killTimer=setTimeout(()=>{killTimer=null;error??='close_timeout';kill('SIGTERM');killTimer=setTimeout(()=>{killTimer=null;kill('SIGKILL');},200);},closeMs);}
 function stop(reason){if(!closed){closed=true;stopReason??=reason;if(!['closed','aborted'].includes(reason))error??=reason;phase='closing';clearTimeout(watch);watch=null;emit({kind:'close'});armExit();} }
 function messageValid(m){need(m&&typeof m==='object'&&!Array.isArray(m)&&Buffer.byteLength(JSON.stringify(m))<=8192,'pet_hold_host_message');need(typeof m.instance==='string'&&/^[a-f0-9]{64}$/.test(m.instance),'pet_hold_host_instance');if(instance!==null)need(m.instance===instance,'pet_hold_host_instance');else need(m.kind==='loaded','pet_hold_host_instance');const fields={loaded:['pid'],request:['id','method','path','body'],abort_request:['id'],armed:['constructed','started','snapshot','resources'],state:['constructed','started','snapshot','resources'],final:['reason','constructed','started','snapshot','resources'],failed:['error']}[m.kind];need(fields&&Object.keys(m).every(k=>['kind','instance',...fields].includes(k)),'pet_hold_host_message');}
 async function route(m){
  need(Number.isSafeInteger(m.id)&&m.id===high+1&&!queued,'pet_hold_host_request');high=m.id;
  const get=m.method==='GET'&&m.path==='/v1/node-control/controls'&&!Object.hasOwn(m,'body'),post=m.method==='POST'&&m.path==='/v1/node-control/command';need(get||post,'pet_hold_host_request');
  if(post)native400NodeControlBody(m.body);
  if(post&&m.body.operation==='base'&&(closed||startSent===null||performance.now()>=startSent+runMs)){emit({kind:'response',instance,id:m.id,ok:false,status:403});return;}
  if(active){queued=true;try{await active.task;}finally{queued=false;}}
  if(exited||post&&m.body.operation==='base'&&(closed||performance.now()>=startSent+runMs))return;
  const controller=new AbortController(),slot={id:m.id,controller,task:null};active=slot;
  slot.task=(async()=>{try{const value=await authority.request(m.method,m.path,m.body,{signal:controller.signal});if(get)native400NodeControlEnvelope(value);note({kind:'rpc_settled',id:m.id,method:m.method,operation:post?m.body.operation:null,request_seq:post?m.body.request_seq:null,body_sha256:post?hash(Buffer.from(JSON.stringify(m.body))):null});emit({kind:'response',instance,id:m.id,ok:true,value});}catch(e){emit({kind:'response',instance,id:m.id,ok:false,status:[400,401,403,404,409,413].includes(e.status)?e.status:503});}finally{if(active===slot)active=null;}})();await slot.task;
 }
 function maybeStart(){if(closed||!loaded||!receipt||startSent!==null)return;loan.verify();authority=acquireNative400NodeControlRunClient(window);startSent=performance.now();clearTimeout(watch);watch=setTimeout(()=>stop('host_deadline'),runMs+1000);emit({kind:'start',instance,options:{base,runMs,sourceMs,expectedRevision}});}
 async function finalize(){if(finished)return;finished=true;closed=true;clearTimeout(watch);clearTimeout(killTimer);watch=killTimer=null;signal?.removeEventListener('abort',abort);if(active)active.controller.abort();await Promise.allSettled([...tasks]);
  try{if(loan)loan.verify();}catch{error??='snapshot_changed';}
  detached=authority?.release()??null;loan?.release();loan=null;if(home){try{rmSync(home,{recursive:true,force:true});home=null;}catch{error??='home_cleanup_unknown';}}
  if(!armed)readyReject(fail('pet_hold_host_start_failed'));phase=error||child&&(code!==0||!final)?'unknown':'closed';doneResolve({phase,error,reason:stopReason,code,instance_id:id,child_instance_id:instance,import_receipt:receipt,actual:final,last_observation:lastState,provenance,pid_matched:loaded,grant_release:detached,device_evidence:false});
 }
 function start(){need(!attempted&&!closed,'pet_hold_host_already_started');attempted=true;phase='starting';
  starting=Promise.resolve().then(async()=>{try{
   need(!closed,'pet_hold_host_closed');checkNative400NodeControlRunWindow(window);loan=acquireNative400ExecutionSnapshot(snapshot,'manager');loan.verify();need(loan.manifest.runtime.kind==='node'&&realpathSync(loan.executable)===realpathSync(process.execPath));
   const entry=loan.manifest.entries.find(e=>e.role==='manager');need(entry.path===entryPath,'pet_hold_host_entry');
   const select=path=>{const expected=hash(readFileSync(fileURLToPath(new URL('./'+path.split('/').at(-1),import.meta.url)))),rows=loan.manifest.roots.flatMap(r=>r.files.filter(f=>f.path===path&&f.sha256===expected).map(f=>join(loan.directory,r.label,f.path)));need(rows.length===1,'pet_hold_host_bootstrap');return rows[0];};
   const executable=select(childPath);select(loaderPath);select(entryPath);provenance={snapshot_sha256:loan.sha256,runtime:loan.manifest.runtime,entry,bootstrap_sha256:hash(readFileSync(executable))};home=realpathSync(mkdtempSync(join(tmpdir(),'pet-hold-host-')));mkdirSync(join(home,'tmp'),{mode:0o700});writeFileSync(join(home,'.hold-owner.json'),JSON.stringify({profile:'pet-hold-owned-home/1',token:id}),{mode:0o600,flag:'wx'});
   child=spawn(loan.executable,['--no-addons','--disable-proto=throw','--no-warnings',executable,loan.directory,loan.sha256],{cwd:loan.directory,detached:true,shell:false,env:{PET_HOLD_HOME_TOKEN:id,HOME:home,TMPDIR:join(home,'tmp'),LANG:'C.UTF-8',NODE_DISABLE_COMPILE_CACHE:'1'},stdio:['ignore','pipe','pipe','ipc']});exited=false;
   watch=setTimeout(()=>stop('startup_timeout'),startupMs);
   child.stdout.on('data',b=>{try{need(Buffer.byteLength(stdout)+b.length<=2097152,'pet_hold_host_output');stdout+=b.toString();if(stdout.includes('\n')){need(!receipt&&stdout.endsWith('\n')&&stdout.indexOf('\n')===stdout.length-1,'pet_hold_host_output');const bootstrapSha=hash(readFileSync(fileURLToPath(new URL('./native400-node-load-child.mjs',import.meta.url))));receipt=validateNative400NodeLoadReceipt(JSON.parse(stdout),loan,bootstrapSha);stdout='';maybeStart();}}catch{stop('import_receipt_failed');}});
   child.stderr.on('data',b=>{stderrBytes+=b.length;if(stderrBytes>16384)stop('child_output');});
   child.on('message',m=>{try{messageValid(m);if(m.kind==='loaded'){need(!loaded&&m.pid===child.pid,'pet_hold_host_pid');instance=m.instance;loaded=true;maybeStart();}else if(m.kind==='request'){const task=route(m).catch(()=>stop('request_failed'));tasks.add(task);void task.finally(()=>tasks.delete(task));}else if(m.kind==='abort_request'){if(active?.id===m.id)active.controller.abort();}else if(m.kind==='armed'){need(m.constructed&&m.started&&startSent!==null,'pet_hold_host_not_started');lastState=m;if(closed)return;armed=true;phase='running';readyResolve({started:true,instance_id:id,child_instance_id:instance,snapshot_sha256:loan.sha256,device_evidence:false});}else if(m.kind==='state'){lastState=m;}else if(m.kind==='final'){final=m;lastState=m;}else if(m.kind==='failed')stop('child_failed');else throw fail('pet_hold_host_message');}catch{stop('child_protocol_failed');}});
   child.on('error',()=>stop('spawn_failed'));child.once('close',exit=>{exited=true;code=exit;void finalize();});
  }catch{error??='start_failed';closed=true;await finalize();}});starting.catch(()=>{});return ready;
 }
 const abort=()=>{stop('aborted');if(!attempted)void finalize();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 return Object.freeze({start,done,confirm(){need(!closed&&phase==='running'&&lastState?.snapshot?.phase==='unknown','pet_hold_host_confirm_unavailable');emit({kind:'confirm',instance});},
  close(){if(closing)return closing;stop('closed');if(!attempted)void finalize();closing=(async()=>{await starting;return done;})();return closing;},
  snapshot:()=>({profile:'native400-pet-hold-host/1',phase,error,instance_id:id,child_instance_id:instance,started:!!lastState?.started,run:lastState?.snapshot??null,device_evidence:false}),
  resources:()=>({child_pid:child&&!exited?child.pid:null,child_running:!!child&&!exited,streams_open:!!child&&!exited,timers:(watch!==null?1:0)+(killTimer!==null?1:0),rpc_pending:active!==null||queued,snapshot_lease:loan!==null,grant_held:!!authority&&!detached,home_owned:home!==null,host_window_owned:false})});
}
