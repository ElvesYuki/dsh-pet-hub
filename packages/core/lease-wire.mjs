import {keys,id,uint64,bounded,requireThat,clone} from './protocol.mjs';
export const canonicalLeaseJSON=v=>JSON.stringify((function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;})(v));
/** Validate the fixed full control context; throws before external identity can be mapped. */
export function validateLeaseContext(c){keys(c,['device_id','binding_id','binding_epoch','boot_id','session_id','controller_id','service_instance_id']);for(const k of ['device_id','binding_id','boot_id','session_id','controller_id','service_instance_id'])id(c[k]);uint64(c.binding_epoch);}
function validate(v){
 keys(v,['protocol','profile','type','request_id','request_seq','context','kind','control','lease_ms']);requireThat(v.protocol==='hub-device/1'&&v.profile==='native360-v5-lease/1'&&v.type==='lease.granted','unsupported_protocol');id(v.request_id);uint64(v.request_seq);requireThat(['acquire','renew'].includes(v.kind));bounded(v.lease_ms,1,30000);
 const c=v.context;validateLeaseContext(c);
 const g=v.control;keys(g,['controller_id','service_instance_id','control_epoch','lease_id']);id(g.controller_id);id(g.service_instance_id);id(g.lease_id);uint64(g.control_epoch);requireThat(g.controller_id===c.controller_id&&g.service_instance_id===c.service_instance_id,'stale_control');
}
/** Candidate management profile only. Remaining TTL is generated on the device; expired grants never encode. */
export function encodeLeaseV5({context,request,grant,device_now}){
 bounded(device_now,0,Number.MAX_SAFE_INTEGER);bounded(grant.expires_at,0,Number.MAX_SAFE_INTEGER);requireThat(grant.expires_at>device_now,'lease_expired');
 const control=Object.fromEntries(['controller_id','service_instance_id','control_epoch','lease_id'].map(k=>[k,grant[k]]));
 const value={protocol:'hub-device/1',profile:'native360-v5-lease/1',type:'lease.granted',request_id:request.request_id,request_seq:request.request_seq,context:clone(context),kind:request.kind,control,lease_ms:grant.expires_at-device_now};validate(value);const bytes=new TextEncoder().encode(canonicalLeaseJSON(value));bounded(bytes.length,1,4096);return bytes;
}
/** Strict 4KiB canonical JSON; rejects alternate/duplicate encodings, absolute expiry, invalid UTF8 and schema. */
export function decodeLeaseV5(bytes){
 requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=4096,'wire_size');let text,v;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);v=JSON.parse(text);}catch(cause){throw Object.assign(new Error('invalid lease wire',{cause}),{code:'invalid_wire'});}validate(v);requireThat(text===canonicalLeaseJSON(v),'noncanonical_wire');
 return {schemaVersion:1,request_id:v.request_id,request_seq:v.request_seq,context:v.context,kind:v.kind,grant:v.control,lease_ms:v.lease_ms};
}
