import {validatePetUrl} from '../source-pet/index.mjs';
import {native400NodeControlEnvelope} from '../core/native400-node-control-access.mjs';
import {createNative400PetHoldSource} from './native400-pet-hold-source.mjs';
import {createNative400PetBridge} from './native400-pet-bridge.mjs';
const fail=code=>Object.assign(Error(code),{code});
const need=(value,code='pet_hold_run_invalid')=>{if(!value)throw fail(code);};
/** Trusted local, default-off finite A hold slice. Borrows a scoped shared client;
 * owns only its source, bridge, poll/deadline timers. Never grants authority, starts
 * a listener, closes the shared host window or attests real runtime identity.
 * start is one-shot; close fences synchronously, awaits reads/IPC, and withdraws
 * only its own confirmed target. Unknown requires explicit original-body confirm. */
export function createNative400PetHoldRun(input={}){
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['enabled','client','base','expectedRevision','runMs','sourceMs','pollMs','clock','timers','signal'].includes(k)));
 const {enabled=false,client,base,expectedRevision='0',runMs=45000,sourceMs=60000,pollMs=500,clock=()=>Math.floor(performance.now()),timers={setTimeout,clearTimeout,setInterval,clearInterval},signal}=input;
 need(enabled===true&&typeof client?.request==='function'&&typeof expectedRevision==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(expectedRevision)&&BigInt(expectedRevision)<(1n<<64n));
 need(Number.isInteger(runMs)&&runMs>0&&runMs<=45000&&Number.isInteger(sourceMs)&&sourceMs>runMs+7500&&sourceMs<=120000&&Number.isInteger(pollMs)&&pollMs>=100&&pollMs<=10000&&typeof clock==='function');
 need(['setTimeout','clearTimeout','setInterval','clearInterval'].every(k=>typeof timers?.[k]==='function')&&(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function'));validatePetUrl(base);
 let phase='ready',reason=null,closed=false,attempted=false,starting=null,startPending=false,busy=null,closing=null,bridge=null,source=null,sourceOpen=false,deadline=null,pollTimer=null,end=null,last=-1;
 const lifetime=new AbortController();
 function now(){const t=clock();need(Number.isSafeInteger(t)&&t>=0&&t>=last,'pet_hold_run_clock');last=t;return t;}
 function clearPoll(){if(pollTimer!==null){timers.clearInterval(pollTimer);pollTimer=null;}}
 function fence(why){if(closed)return;closed=true;reason??=why;phase='closing';clearPoll();if(deadline!==null){timers.clearTimeout(deadline);deadline=null;}lifetime.abort();signal?.removeEventListener('abort',abort);}
 function finish(why){fence(why);void close().catch(()=>{});}
 function alive(){if(closed)return false;try{const t=now();if(end!==null&&t>=end){finish('deadline');return false;}return true;}catch{finish('clock_invalid');return false;}}
 function syncBridge(){const s=bridge.snapshot();if(s.phase==='unknown'){phase='unknown';clearPoll();return;}if(s.phase!=='ready'){phase='stopped';reason??=s.phase;clearPoll();source.close();sourceOpen=false;}else phase='running';}
 function armPoll(){if(pollTimer===null&&!closed&&phase==='running')pollTimer=timers.setInterval(()=>void poll(),pollMs);}
 function poll(){if(!alive()||!bridge||phase!=='running')return Promise.resolve();if(busy)return busy;busy=bridge.poll().then(()=>{if(!closed&&alive())syncBridge();}).finally(()=>{busy=null;});return busy;}
 function start(){
  if(closed)return Promise.reject(fail('pet_hold_run_closed'));if(attempted)return starting;attempted=true;startPending=true;phase='starting';
  try{const began=now();need(began<=Number.MAX_SAFE_INTEGER-runMs);end=began+runMs;deadline=timers.setTimeout(()=>finish('deadline'),runMs);}catch{startPending=false;finish('clock_invalid');return Promise.reject(fail('pet_hold_run_start_failed'));}
  starting=Promise.resolve().then(async()=>{try{
   need(alive(),'pet_hold_run_closed');
   const queryAt=now(),v=native400NodeControlEnvelope(await client.request('GET','/v1/node-control/controls',undefined,{signal:lifetime.signal}));need(alive(),'pet_hold_run_closed');const age=now()-queryAt;
   need(v.shared&&v.revision===expectedRevision&&!v.shared.desired&&v.transport.phase==='open'&&v.transport.network_ready&&v.shared.limits?.profile==='shared-limits/1','pet_hold_run_start_rejected');
   need(Math.min(v.remaining_ms-age,v.shared.limits.source_window_ms-age,sourceMs)>runMs+7500,'pet_hold_run_budget');
   source=createNative400PetHoldSource({base,sourceMs,clock:now});sourceOpen=true;
   const guardedClient={request(method,path,body,options){if(method==='POST'&&body?.operation==='base'&&!alive())return Promise.reject(Object.assign(fail('pet_hold_run_closed'),{status:403}));return client.request(method,path,body,options);}};
   bridge=createNative400PetBridge({enabled:true,mode:'hold-state',arbitration:'endpoint-arbitrated',client:guardedClient,source,expectedRevision,ttlMs:5000,pollMs});
   need(alive(),'pet_hold_run_closed');phase='running';armPoll();void poll();return {armed:true,device_evidence:false};
  }catch(e){finish(e.code==='pet_hold_run_budget'?'budget':e.code==='pet_hold_run_clock'?'clock_invalid':'start_rejected');throw fail('pet_hold_run_start_failed');}}).finally(()=>{startPending=false;});starting.catch(()=>{});return starting;
 }
 async function confirm(){if(!alive()||phase!=='unknown'||busy)return;if(!bridge)return;busy=bridge.confirm().then(()=>{if(!closed&&alive()){syncBridge();armPoll();}}).finally(()=>{busy=null;});await busy;}
 function close(){if(closing)return closing;fence('closed');closing=(async()=>{await starting?.catch(()=>{});try{await bridge?.close();await busy;}finally{source?.close();sourceOpen=false;}phase='closed';})();closing=closing.catch(e=>{phase='cleanup_unknown';closing=null;throw fail('pet_hold_run_cleanup_unknown');});return closing;}
 const abort=()=>finish('aborted');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 return Object.freeze({start,poll,confirm,close,snapshot(){if(!closed&&attempted)alive();return {profile:'native400-pet-hold-run/1',phase,reason,remaining_ms:end===null?null:Math.max(0,end-last),bridge:bridge?.snapshot()??null,device_evidence:false};},resources:()=>({deadline_timers:deadline===null?0:1,poll_timers:pollTimer===null?0:1,source_open:sourceOpen,start_pending:startPending,operation_pending:busy!==null,host_window_owned:false})});
}
