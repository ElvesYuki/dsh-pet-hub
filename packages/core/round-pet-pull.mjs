import {keys,id,uint64,bounded,digest,clone,same,increment,requireThat as need} from './protocol.mjs';
import {parseRoundPetJson,roundPetCanonical} from './round-pet-identity.mjs';
import {observationContext,observationPackage,observationControl,observationKeys as exact} from './round-pet-observation-schema.mjs';
export const PULL_PROFILE='round-pet-pull-candidate/1';
const kinds=['lease.acquire','lease.renew','playback.set','playback.cancel','binding.revoke','storage.save','query.display','query.inventory'];
function targetShape(t){exact(t,['command_id','revision','character_id','variant_id','manifest_sha256','action_id','asset_sha256']);for(const k of ['command_id','character_id','variant_id'])id(t[k]);uint64(t.revision);bounded(t.action_id,0,77);digest(t.manifest_sha256);digest(t.asset_sha256);}
export function validatePullControl(c,context){
 exact(c,['dispatch_id','kind','payload']);id(c.dispatch_id);need(kinds.includes(c.kind),'invalid_pull_control');const p=c.payload;
 if(c.kind.startsWith('lease.')){exact(p,['request_id','request_seq','kind','expected_epoch','lease_id','lease_ms']);id(p.request_id);uint64(p.request_seq);uint64(p.expected_epoch);bounded(p.lease_ms,1,30000);need(c.kind==='lease.'+p.kind,'invalid_pull_control');if(p.kind==='acquire')need(p.lease_id===null,'invalid_pull_control');else id(p.lease_id);}
 else if(c.kind==='playback.set'){exact(p,['target','control','package_ref']);targetShape(p.target);observationControl(p.control,context);observationPackage(p.package_ref);}
 else if(c.kind==='storage.save'){keys(p,['operation_id','target','package_ref','victim_action_id']);id(p.operation_id);targetShape(p.target);observationPackage(p.package_ref);if(p.victim_action_id!==undefined){bounded(p.victim_action_id,0,77);need(![0,4].includes(p.victim_action_id),'unsafe_cache_write');}}
 else if(c.kind.startsWith('query.')){exact(p,['query_id']);id(p.query_id);}
 else if(c.kind==='playback.cancel'){exact(p,['operation_id','command_id']);id(p.operation_id);id(p.command_id);}
 else{exact(p,['operation_id']);id(p.operation_id);}return c;
}
export function validatePullMessage(v){
 const response=v?.type==='exchange.response';exact(v,response?['profile','schema_version','type','context','request_id','request_seq','control','read_permit','poll_after_ms']:['profile','schema_version','type','context','request_id','request_seq','observation']);
 need(v.profile===PULL_PROFILE&&v.schema_version===1&&['exchange.request','exchange.response'].includes(v.type),'unsupported_pull_profile');observationContext(v.context);id(v.request_id);uint64(v.request_seq);
 if(response){
  if(v.control!==null)validatePullControl(v.control,v.context);bounded(v.poll_after_ms,0,500);
  if(v.read_permit!==null){const p=v.read_permit;exact(p,['id','target','package_ref','remaining_ms']);id(p.id);targetShape(p.target);observationPackage(p.package_ref);bounded(p.remaining_ms,1,30000);}need(!(v.control&&v.read_permit),'invalid_pull_control');
 }else if(v.observation!==null){const o=v.observation;need(o&&typeof o==='object','invalid_observation');
  if(o.kind==='lease'){exact(o,['kind','dispatch_id','wire']);id(o.dispatch_id);need(typeof o.wire==='string'&&o.wire.length<=3500&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(o.wire),'invalid_pull_receipt');}
  else if(o.kind==='record'){exact(o,['kind','dispatch_id','record']);if(o.dispatch_id!==null)id(o.dispatch_id);need(o.record&&typeof o.record==='object','invalid_pull_receipt');}
  else{exact(o,['kind','dispatch_id','status']);need(o.kind==='ack'&&['accepted','cancelled'].includes(o.status),'invalid_pull_receipt');id(o.dispatch_id);}
 }return v;
}
export function encodePullMessage(v){validatePullMessage(v);const bytes=new TextEncoder().encode(roundPetCanonical(v));need(bytes.length<=4096,'pull_size');return bytes;}
export function decodePullMessage(bytes){need(bytes instanceof Uint8Array&&bytes.length<=4096,'pull_size');const v=parseRoundPetJson(bytes);validatePullMessage(v);need(new TextDecoder().decode(bytes)===roundPetCanonical(v),'noncanonical_pull');return v;}

/** Pure queue only: one dispatched control, one latest base, one ordinary operation and bounded flags.
 * No retry/transport/lease code. Absolute enqueue deadlines survive waiting; any expiry blocks.
 * Dispatched controls are never replaced; IDs are monotonic per owner, no replay history collection. */
export class PullControlQueue{
 #clock;#seq='0';#base=null;#ordinary=null;#flags=new Map();#pending=null;#blocked=false;#closed=false;
 constructor(clock){this.#clock=clock;}
 #now(){const t=this.#clock.now();bounded(t,0,Number.MAX_SAFE_INTEGER);return t;}
 check(deadline){need(!this.#closed&&!this.#blocked,'pull_blocked');bounded(deadline,this.#now()+1,Number.MAX_SAFE_INTEGER);}
 put(kind,payload,deadline){this.check(deadline);need(kinds.includes(kind),'invalid_pull_control');const item={kind,payload:clone(payload),deadline};
  if(kind==='playback.set')this.#base=item;
  else if(['lease.acquire','lease.renew','playback.cancel','binding.revoke'].includes(kind)){const old=this.#flags.get(kind);if(old){need(same(old.payload,payload),'queue_full');return false;}this.#flags.set(kind,item);}
  else{need(!this.#ordinary&&this.#pending?.kind!=='storage.save','queue_full');this.#ordinary=item;}return true;
 }
 take(ackMs){this.expire();if(this.#pending)return null;bounded(ackMs,1,30000);let job;
  for(const kind of ['binding.revoke','playback.cancel','lease.acquire','lease.renew'])if(this.#flags.has(kind)){job=this.#flags.get(kind);this.#flags.delete(kind);break;}
  if(!job&&this.#base){job=this.#base;this.#base=null;}if(!job&&this.#ordinary){job=this.#ordinary;this.#ordinary=null;}if(!job)return null;
  const seq=increment(this.#seq);this.#seq=seq;this.#pending={...job,dispatch_id:`dispatch_${seq}`,deadline:Math.min(job.deadline,this.#now()+ackMs)};return clone(this.#pending);
 }
 /** Trusted scheduler operation: discard only an undispatched latest target. */
 discardLatest(){const old=this.#base;this.#base=null;return clone(old);}
 pending(){return clone(this.#pending);}
 payload(dispatchId,payload){need(this.#pending?.dispatch_id===dispatchId,'stale_dispatch');this.#pending.payload=clone(payload);}
 ack(id){need(this.#pending?.dispatch_id===id,'stale_dispatch');this.#pending=null;}
 expire(){need(!this.#closed&&!this.#blocked,'pull_blocked');const t=this.#now();if([this.#base,this.#ordinary,this.#pending,...this.#flags.values()].some(j=>j&&t>=j.deadline)){this.#blocked=true;need(false,'control_deadline');}}
 hasWork(){return !!(this.#pending||this.#base||this.#ordinary||this.#flags.size);}
 resources(){return {closed:this.#closed,blocked:this.#blocked,pending:this.#pending?1:0,latest_base:this.#base?1:0,ordinary:this.#ordinary?1:0,flags:this.#flags.size};}
 close(){this.#closed=true;this.#base=this.#ordinary=this.#pending=null;this.#flags.clear();}
}
