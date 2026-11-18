import {keys,bounded,id,uint64,increment,same,clone,requireThat} from './protocol.mjs';
const SCALE=1000000n;
function policyCheck(p){keys(p,['host_ppm','device_ppm','command_delay_ms','margin_ms','max_round_trip_ms','max_lease_ms']);bounded(p.host_ppm,0,100000);bounded(p.device_ppm,0,100000);bounded(p.command_delay_ms,0,30000);bounded(p.margin_ms,2,30000);bounded(p.max_round_trip_ms,1,30000);bounded(p.max_lease_ms,1,30000);return clone(p);}
function duration(lease,p){const drift=BigInt(lease)*(SCALE-BigInt(p.host_ppm))/(SCALE+BigInt(p.device_ppm)),reserve=(BigInt(p.command_delay_ms+p.margin_ms)*(SCALE+BigInt(p.host_ppm))+SCALE-1n)/SCALE;const usable=drift-reserve;requireThat(usable>0n,'insufficient_lease_budget');return Number(usable);}
/** Conservative host send horizon in ms. Integer floor/ceil; throws for unknown fields/ranges or no usable budget. */
export function leaseSendBudget(lease,policy){const p=policyCheck(policy);bounded(lease,1,p.max_lease_ms);return duration(lease,p);}
const fields=['device_id','binding_id','binding_epoch','boot_id','session_id','controller_id','service_instance_id'];
function contextCheck(c){keys(c,fields);for(const f of fields)f==='binding_epoch'?uint64(c[f]):id(c[f]);}
function matchContext(registry,c){contextCheck(c);const actual=registry.context(c.device_id);requireThat(Object.keys(actual).every(k=>actual[k]===c[k]),'stale_session');}
/** Opt-in trusted-receipt boundary, no I/O. verifyResponse defaults to deny and must bind proof+packet+context.
 * begin/accept/expect throw stable protocol errors. expire/invalidate reclaim bounded state; close is idempotent.
 * Not a TLS implementation; old raw Registry entry points are not secured by creating this object. */
export function createLeaseGuard({registry,clock,policy,verifyResponse=()=>false}){
 const p=policyCheck(policy),pending=new Map(),completed=new Map(),confirmed=new Map(),high=new Map();let sequence='0',closed=false;
 const active=()=>requireThat(!closed,'closed');
 const now=()=>{const n=clock.now();bounded(n,0,Number.MAX_SAFE_INTEGER);return n;};
 function expire(){active();const t=now();for(const [k,r] of pending)if(t-r.sent_at>p.max_round_trip_ms)pending.delete(k);}
 function packetCheck(v){keys(v,['schemaVersion','request_id','request_seq','context','kind','grant','lease_ms']);requireThat(v.schemaVersion===1);id(v.request_id);uint64(v.request_seq);contextCheck(v.context);requireThat(['acquire','renew'].includes(v.kind));bounded(v.lease_ms,1,p.max_lease_ms);const g=v.grant;keys(g,['controller_id','service_instance_id','control_epoch','lease_id','expires_at']);id(g.controller_id);id(g.service_instance_id);id(g.lease_id);uint64(g.control_epoch);if(Object.hasOwn(g,'expires_at'))bounded(g.expires_at,0,Number.MAX_SAFE_INTEGER);requireThat(g.controller_id===v.context.controller_id&&g.service_instance_id===v.context.service_instance_id,'stale_control');}
 return {
  begin(context,input){active();matchContext(registry,context);keys(input,['request_id','kind','expected_epoch','lease_id']);id(input.request_id);uint64(input.expected_epoch);requireThat(['acquire','renew'].includes(input.kind));if(input.kind==='renew')id(input.lease_id);else requireThat(input.lease_id===undefined);expire();requireThat(!pending.has(input.request_id)&&!completed.has(input.request_id),'idempotency_conflict');requireThat(pending.size<32,'capacity_exceeded');const sent_at=now(),next=increment(sequence);bounded(sent_at+p.max_round_trip_ms,0,Number.MAX_SAFE_INTEGER);const r={...clone(input),context:clone(context),request_seq:next,sent_at};sequence=next;pending.set(input.request_id,r);return clone(r);},
  accept(context,packet,proof){active();matchContext(registry,context);packetCheck(packet);requireThat(same(packet.context,context),'stale_session');requireThat(verifyResponse(proof,packet,context)===true,'untrusted_receipt');
   const old=completed.get(packet.request_id);if(old){requireThat(same(old.packet,packet),'idempotency_conflict');requireThat(high.get(context.device_id)===packet.request_seq,'stale_response');registry.control(context,old.packet.grant,old.observation);return clone(old.observation);}
   const r=pending.get(packet.request_id);requireThat(r,'unknown_request');requireThat(same(r.context,context)&&r.request_seq===packet.request_seq&&r.kind===packet.kind,'stale_response');const t=now();requireThat(t>=r.sent_at&&t-r.sent_at<=p.max_round_trip_ms,'delay_exceeded');
   requireThat(!high.has(context.device_id)||uint64(packet.request_seq)>uint64(high.get(context.device_id)),'stale_response');const g=packet.grant;requireThat(g.control_epoch===(r.kind==='acquire'?increment(r.expected_epoch):r.expected_epoch),'stale_control');if(r.kind==='renew')requireThat(g.lease_id===r.lease_id,'stale_control');
   const observation={sent_at:r.sent_at,lease_ms:duration(packet.lease_ms,p),request_seq:r.request_seq};bounded(observation.sent_at+observation.lease_ms,0,Number.MAX_SAFE_INTEGER);requireThat(t<observation.sent_at+observation.lease_ms,'lease_expired');requireThat(high.has(context.device_id)||high.size<64,'capacity_exceeded');
   registry.control(context,g,observation);const entry={packet:clone(packet),observation};pending.delete(packet.request_id);completed.set(packet.request_id,entry);if(completed.size>32)completed.delete(completed.keys().next().value);confirmed.set(context.device_id,entry);high.set(context.device_id,packet.request_seq);return clone(observation);
  },
  expect(context,command){active();matchContext(registry,context);const e=confirmed.get(context.device_id);requireThat(e&&same(e.packet.context,context),'stale_session');requireThat(now()<e.observation.sent_at+e.observation.lease_ms,'lease_expired');registry.expect(context,command,e.packet.grant,e.observation);},
  expire,
  invalidate(deviceId){active();id(deviceId);for(const [k,r] of pending)if(r.context.device_id===deviceId)pending.delete(k);for(const [k,e] of completed)if(e.packet.context.device_id===deviceId)completed.delete(k);confirmed.delete(deviceId);/* keep seq high-water until guard close */},
  resources(){return {pending:pending.size,completed:completed.size,confirmed:confirmed.size,devices:high.size,closed};},
  close(){closed=true;pending.clear();completed.clear();confirmed.clear();high.clear();}
 };
}
