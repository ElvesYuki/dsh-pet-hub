import table from './round-pet-wire-contract.json' with {type:'json'};
import {parseRoundPetJson,roundPetCanonical as canonical} from './round-pet-identity.mjs';
import {requireThat as need,clone,same,uint64,bounded,keys} from './protocol.mjs';
export const DEVICE_WIRE_PROFILE=table.profile;
const text=new TextEncoder(),isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
/** Fixed bundled closed-table validator; not a general JSON Schema interpreter. */
function matches(v,s,depth=0){
 if(depth>32)return false;if(typeof s==='string')return matches(v,table.defs[s],depth+1);if(!s)return false;
 if(Object.hasOwn(s,'const'))return same(v,s.const);if(s.enum)return s.enum.some(x=>same(x,v));if(s.oneOf)return s.oneOf.filter(x=>matches(v,x,depth+1)).length===1;
 if(s.type==='null')return v===null;if(s.type==='boolean')return typeof v==='boolean';
 if(s.type==='integer')return Number.isSafeInteger(v)&&v>=s.min&&v<=s.max;
 if(s.type==='string'){if(typeof v!=='string')return false;if(s.format==='id')return /^[A-Za-z0-9_-]{1,80}$/.test(v);if(s.format==='sha')return /^[a-f0-9]{64}$/.test(v);if(!/^(0|[1-9][0-9]{0,19})$/.test(v)||BigInt(v)>18446744073709551615n)return false;return s.format!=='positive'||v!=='0';}
 if(s.type==='array')return Array.isArray(v)&&v.length>=s.min&&v.length<=s.max&&v.every(x=>matches(x,s.items,depth+1));
 return s.type==='object'&&isObject(v)&&Object.keys(v).length===Object.keys(s.fields).length&&Object.keys(s.fields).every(k=>Object.hasOwn(v,k)&&matches(v[k],s.fields[k],depth+1));
}
function semantics(v){const ctx=v.context;
 function walk(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return;}
  if(o.control&&Object.hasOwn(o.control,'control_epoch')){need(o.control.controller_id===ctx.controller_id&&o.control.service_instance_id===ctx.service_instance_id,'invalid_wire');}
  if(o.package_ref){for(const t of [o.target,o.source_target].filter(Boolean))need(t.manifest_sha256===o.package_ref.hub_manifest_sha256,'invalid_wire');}
  if(o.type==='lease.granted')need(same(o.context,ctx),'invalid_wire');
  if(o.type==='inventory.snapshot'&&o.known){let previous=-1;for(const a of o.active){need(a.action_id>previous&&uint64(a.object_generation)<=uint64(o.root_seq),'invalid_wire');previous=a.action_id;}const ids=o.active.map(a=>a.action_id);need(o.root_state==='EMPTY'?ids.length===0:o.root_state==='IDLE_READY'?same(ids,[0]):ids.includes(0)&&ids.includes(4),'invalid_wire');}
  if(o.type==='storage.report'&&o.commit)need(uint64(o.commit.object_generation)<=uint64(o.commit.root_seq),'invalid_wire');
  if(o.type==='display.report'){need(o.kind==='event'?o.query_id===null:o.query_id!==null,'invalid_wire');need(o.display_state!=='playing'||o.maintenance.phase==='none','invalid_wire');if(o.display_state!=='unknown'){if(o.origin==='local')need([0,4].includes(o.asset_ref.action_id),'invalid_wire');else{const t=o.source_command.target;need(t.action_id===o.asset_ref.action_id&&t.asset_sha256===o.asset_ref.asset_sha256,'invalid_wire');}}}
  if(o.kind==='storage.save'&&o.payload.victim_action_id!==null)need(![0,4,o.payload.target.action_id].includes(o.payload.victim_action_id),'invalid_wire');
  for(const x of Object.values(o))walk(x);
 }
 walk(v.payload);
 if(v.type==='error')need((v.request_id===null)===(v.request_seq===null),'invalid_wire');
 if(v.type==='hello.begin')need(same(v.payload.versions,v.payload.capabilities.extensions.round_pet.versions),'invalid_wire');
 if(v.type==='exchange.request'&&v.payload.observation?.record.type==='touch.event')need(v.payload.observation.dispatch_id===null,'invalid_wire');
 if(v.type==='exchange.response')need(!(v.payload.control&&v.payload.read_permit),'invalid_wire');
 if(v.type==='manifest.page'){const p=v.payload,end=p.offset+p.actions.length;need(end<=46&&(end===46?p.next_offset===null:p.next_offset===end),'invalid_wire');let last=-1;for(const a of p.actions){need(a.action_id>last,'invalid_wire');last=a.action_id;}}
}
/** Shape/relations only: does NOT authenticate a peer, approve a package or authorize execution. */
export function validateDeviceWire(value){canonical(value);need(matches(value,'message'),'invalid_wire');semantics(value);return clone(value);}
export function encodeDeviceWire(value){validateDeviceWire(value);const bytes=text.encode(canonical(value));need(bytes.length>0&&bytes.length<=4096,'wire_size');return bytes;}
export function decodeDeviceWire(bytes){need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=4096,'wire_size');const v=parseRoundPetJson(bytes);validateDeviceWire(v);need(new TextDecoder().decode(bytes)===canonical(v),'noncanonical_wire');return v;}
export const deviceWireContract=()=>clone(table);
export function deviceWireError(code){need(Object.hasOwn(table.errors,code),'unknown_wire_error');return clone(table.errors[code]);}
/** Numeric limits for future adapter; does not parse HTTP or claim a device resource bound. */
export function deviceWireBudget({body_bytes=0,header_bytes=0,range_bytes=0}={}){bounded(body_bytes,0,4096);bounded(header_bytes,0,8192);bounded(range_bytes,0,32768);return true;}
/** Relative exact paths only. Authenticated permits/file ETag/total bytes remain owner's checks. */
export function classifyDeviceWireRequest({method,path,range=null}){need(typeof path==='string','invalid_wire_path');const p=table.paths;if(method==='POST'&&[p.hello,p.exchange].includes(path)){need(range===null,'invalid_wire_path');return {kind:path===p.hello?'hello':'exchange'};}
 if(method==='GET'&&range===null){const m=/^\/hub-device\/v1\/manifests\/([a-f0-9]{64})\?offset=(0|[1-9][0-9]?)&limit=([1-8])$/.exec(path);if(m){const offset=Number(m[2]);need(offset<46,'invalid_wire_path');return {kind:'manifest',sha256:m[1],offset,limit:Number(m[3])};}}
 if(method==='GET'){const m=/^\/hub-device\/v1\/assets\/([a-f0-9]{64})$/.exec(path),r=typeof range==='string'&&/^bytes=(0|[1-9][0-9]{0,6})-(0|[1-9][0-9]{0,6})$/.exec(range);if(m&&r){const start=Number(r[1]),end=Number(r[2]);need(start<=end&&end<5865472&&end-start+1<=32768,'invalid_wire_path');return {kind:'asset',sha256:m[1],start,end};}}
 need(false,'invalid_wire_path');
}
const stream=r=>({ 'playback.report':'report_seq','display.report':'display_seq','storage.report':'storage_seq','inventory.snapshot':'inventory_seq','touch.event':'event_seq','cancel.report':'cancel_seq','control.receipt':'receipt_seq'})[r.type];
function correlate(job,r){const p=job.payload;
 if(job.kind==='playback.set')need(r.type==='playback.report'&&['accepted','failed','cancelled'].includes(r.phase)&&same(r.target,p.target)&&same(r.control,p.control)&&same(r.package_ref,p.package_ref),'stale_dispatch');
 else if(job.kind==='storage.save')need(r.type==='storage.report'&&r.operation_id===p.operation_id&&same(r.source_target,p.target)&&same(r.package_ref,p.package_ref),'stale_dispatch');
 else if(job.kind==='playback.cancel')need(r.type==='cancel.report'&&r.operation_id===p.operation_id&&same(r.target,p.target)&&same(r.control,p.control),'stale_dispatch');
 else if(job.kind==='binding.revoke')need(r.type==='control.receipt'&&r.operation_id===p.operation_id,'stale_dispatch');
 else if(job.kind.startsWith('query.'))need(r.type===(job.kind==='query.display'?'display.report':'inventory.snapshot')&&r.query_id===p.query_id,'stale_dispatch');
 else{need(r.type==='lease.granted'&&r.request_id===p.request_id&&r.request_seq===p.request_seq&&job.kind==='lease.'+r.kind,'stale_dispatch');need(r.kind==='acquire'?uint64(r.control.control_epoch)===uint64(p.expected_epoch)+1n:r.control.control_epoch===p.expected_epoch&&r.control.lease_id===p.lease_id,'stale_dispatch');}
}
/** Post-authentication pure correlation ledger, max one HTTP/control. No I/O/lease timers/retry.
 * Caller must discard on authority/session loss; it is not a substitute for the session guard.
 * Invalid input leaves its state intact; observed facts do not activate targets or write storage. */
export function createDeviceWireLedger({context,packageRef,initialRequestSeq='0'}){
 need(matches(context,'context')&&matches(packageRef,'package'),'invalid_wire');context=clone(context);packageRef=clone(packageRef);uint64(initialRequestSeq);let last=initialRequestSeq,request=null,pending=null,closed=false;const seq={};
 const valid=(v,type)=>{need(!closed,'wire_closed');validateDeviceWire(v);need(v.type===type&&same(v.context,context),'stale_session');};
 return {
  receiveRequest(v){valid(v,'exchange.request');need(!request,'http_inflight');need(uint64(v.request_seq)>uint64(last),'stale_request');const o=v.payload.observation,r=o?.record,k=r&&stream(r);if(r?.package_ref)need(same(r.package_ref,packageRef),'unapproved_package');if(r?.target)need(r.target.manifest_sha256===packageRef.hub_manifest_sha256,'unapproved_package');if(k)need(!seq[k]||uint64(r[k])>uint64(seq[k]),'stale_sequence');if(o?.dispatch_id!==null&&o!==null){need(pending&&o.dispatch_id===pending.dispatch_id,'stale_dispatch');correlate(pending,r);}if(k)seq[k]=r[k];if(o&&o.dispatch_id!==null)pending=null;last=v.request_seq;request={request_id:v.request_id,request_seq:v.request_seq};return true;},
  receiveResponse(v){valid(v,'exchange.response');need(request&&v.request_id===request.request_id&&v.request_seq===request.request_seq,'stale_response');const job=v.payload.control,permit=v.payload.read_permit;need(!pending||(!job&&!permit),'control_inflight');for(const ref of [job?.payload?.package_ref,permit?.package_ref].filter(Boolean))need(same(ref,packageRef),'unapproved_package');if(job)pending=clone(job);request=null;return true;},
  snapshot:()=>({closed,http:request?1:0,controls:pending?1:0,last_request_seq:last,streams:clone(seq)}),
  close(){closed=true;request=pending=null;for(const k of Object.keys(seq))delete seq[k];}
 };
}
