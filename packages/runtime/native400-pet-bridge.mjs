import {native400PetHoldContext} from './native400-pet-hold-source.mjs';
import {randomBytes} from 'node:crypto';
import {NODE_CONTROL_PROTOCOL,native400NodeControlEnvelope,native400NodeControlAck} from '../core/native400-node-control-access.mjs';
const mapped=new Map([[null,0],['thinking',1],['working',11]]),states=new Set([null,'thinking','working','result','success','waiting','error']);
/** Trusted source owner only. read is a read-only pet adapter; client must already
 * hold independent material/window/shared authorization. No issuer or TCP owner.
 * close stops polling and awaits the active read; unknown commands require exact
 * explicit confirmation or original TTL expiry, never a speculative replacement. */
export function createNative400PetBridge({enabled=false,read,client,expectedRevision,ttlMs=5000,pollMs=500,mode='event',source,priority,arbitration='observed-local',timers={setInterval,clearInterval}}={}){
 // Policy A delegates touch arbitration to the endpoint; it is not a clear-state
 // observation. Keep the observed-local policy and event default compatible.
 const endpoint=arbitration==='endpoint-arbitrated';if(!['observed-local','endpoint-arbitrated'].includes(arbitration)||endpoint&&(mode!=='hold-state'||priority!==undefined))throw Error('pet_bridge_invalid');const observedPriority=priority===undefined?()=> 'unknown':priority;
 const holding=mode==='hold-state';if(!['event','hold-state'].includes(mode)||holding&&(ttlMs!==5000||typeof observedPriority!=='function'))throw Error('pet_bridge_invalid');const hold=holding&&enabled?native400PetHoldContext(source):null;let sample=null,halted=false;const viewTimes=new WeakMap();
 if(typeof enabled!=='boolean'||enabled&&(!holding&&typeof read!=='function'||typeof client?.request!=='function'||! /^(0|[1-9][0-9]{0,19})$/.test(expectedRevision)||BigInt(expectedRevision)>=(1n<<64n)||!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>60000||!Number.isInteger(pollMs)||pollMs<100||pollMs>10000))throw Error('pet_bridge_invalid');
 let requestSignal;
 let phase=enabled?'ready':'disabled',counter=null,lastState=null,identity=null,revision=expectedRevision,owned=null,pending=null,timer=null,busy=null,closed=false,closing=null;
 const lifetime=new AbortController();requestSignal=lifetime.signal;
 function stopTimer(){if(timer!==null){timers.clearInterval(timer);timer=null;}}
 function block(reason){phase=reason;if(holding)halted=true;stopTimer();}
 async function controls(timed=false){const at=timed?hold.time():null;const v=native400NodeControlEnvelope(await client.request('GET','/v1/node-control/controls',undefined,{signal:requestSignal}));if(!v.shared)throw Error('bridge_not_shared');const key=v.service_instance_id+':'+v.control_session_id;if(identity!==null&&identity!==key||v.revision!==revision)throw Error('bridge_conflict');identity=key;if(timed)viewTimes.set(v,at);return v;}
 async function send(body){pending=body;try{const ack=native400NodeControlAck(await client.request('POST','/v1/node-control/command',body,{signal:requestSignal}),body);revision=ack.revision;owned=body.operation==='base'?ack.command_id:null;pending=null;phase='ready';}catch(e){if([400,401,403,404,409,413].includes(e.status)){pending=null;block('blocked');}else block('unknown');}}
 async function command(action,{closing=false,state}={}){const v=state??await controls(holding&&action!==null);if(holding&&action!==null)holdGuard(v);if(closed&&!closing)return;if(action===null&&(!owned||v.shared.last_command?.command_id!==owned||!v.shared.desired)){owned=null;return;}
  const body={protocol:NODE_CONTROL_PROTOCOL,service_instance_id:v.service_instance_id,control_session_id:v.control_session_id,request_seq:v.next_request_seq,request_id:randomBytes(32).toString('hex'),expected_revision:revision,operation:action===null?'cancel':'base',...(action===null?{}:{action,ttl_ms:ttlMs})};await send(body);
 }
 function holdGuard(v){const l=hold.check(sample),age=hold.time()-viewTimes.get(v);if(!Number.isSafeInteger(age)||age<0)throw Error('hold_view_stale');if(!endpoint&&observedPriority()!=='clear')throw Error('hold_priority');if(v.transport.phase!=='open'||!v.transport.network_ready)throw Error('hold_transport');if(v.shared.limits?.profile!=='shared-limits/1'||Math.min(l.remaining_ms,v.remaining_ms-age,v.shared.limits.source_window_ms-age)<=7500)throw Error('hold_budget');}
 async function holdStop(reason){try{await command(null);}catch{}if(phase!=='unknown')block(reason);}
 async function holdStep(value){sample=value;try{
  const v=await controls(true);if(closed)return;holdGuard(v);
  if(!mapped.has(value.state)){await holdStop('unsupported_action');return;}
  if(owned){if(v.shared.last_command?.command_id!==owned)throw Error('hold_ownership');if(!v.shared.desired){await holdStop('expired');return;}if(v.shared.desired.action===mapped.get(value.state)&&v.shared.desired.remaining_ms>2000){counter=value.counter;lastState=value.state;return;}}
  else if(v.shared.desired)throw Error('hold_ownership');
  counter=value.counter;lastState=value.state;await command(mapped.get(value.state),{state:v});
 }catch{if(!closed)await holdStop('hold_stopped');}}
 async function step(){try{let value;try{value=await (holding?hold.read({signal:lifetime.signal}):read({signal:lifetime.signal}));}catch{value={status:'unavailable'};}if(closed)return;
  if(holding&&value?.status!=='ready'){await holdStop('source_unavailable');return;}
  if(value?.status!=='ready'){if(!['pending','unsupported','unavailable'].includes(value?.status))throw Error('invalid source');await command(null);if(phase==='ready')phase=value.status;return;}
  if(!Number.isSafeInteger(value.counter)||value.counter<0||!states.has(value.state)){await command(null);if(phase!=='unknown')block('blocked');return;}
  if(counter!==null&&(value.counter<counter||value.counter===counter&&value.state!==lastState)){await command(null);if(phase!=='unknown')block('counter_conflict');return;}
  if(holding){await holdStep(value);return;}
  if(value.counter===counter)return;counter=value.counter;lastState=value.state;
  await command(mapped.has(value.state)?mapped.get(value.state):null);if(phase==='ready'&&!mapped.has(value.state))phase='unsupported_action';
 }catch{if(!closed)block('blocked');}}
 function poll(){if(!enabled||closed||halted||['blocked','unknown','counter_conflict'].includes(phase))return Promise.resolve();if(busy)return busy;busy=step().finally(()=>{busy=null;});return busy;}
 return Object.freeze({poll,start(){if(!enabled||closed||halted||timer!==null||['blocked','unknown','counter_conflict'].includes(phase))return;timer=timers.setInterval(()=>void poll(),pollMs);void poll();},
  async confirm(){if(closed||phase!=='unknown'||!pending||busy)return;busy=send(pending).finally(()=>{busy=null;});await busy;if(holding&&phase==='ready'){try{const v=await controls(true);holdGuard(v);if(!owned||!v.shared.desired||v.shared.last_command?.command_id!==owned)throw Error('hold_ownership');halted=false;}catch{await holdStop('confirmation_stale');}}},
  snapshot:()=>({phase,mode,arbitration,counter,pending:!!pending,owns_target:!!owned,timer_active:timer!==null,device_evidence:false}),
  close(){if(closing)return closing;closed=true;stopTimer();lifetime.abort();return closing=(async()=>{await busy;requestSignal=AbortSignal.timeout(2500);if(enabled&&!pending&&owned){try{await command(null,{closing:true});}catch{/* Authority loss leaves original finite TTL; never reauthorize. */}}phase='closed';})();}
 });
}
