import table from './native400-wire-contract.json' with {type:'json'};
import {parseRoundPetJson,roundPetCanonical as C} from './round-pet-identity.mjs';
import {requireThat as need,clone,same,uint64,bounded,id} from './protocol.mjs';
export const NATIVE400_WIRE_PROFILE=table.profile;
const text=new TextEncoder(),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Closed fixed review table, reused MIT validation rules; not a general JSON Schema engine.
function matches(v,s,depth=0){
 if(depth>32)return false;if(typeof s==='string')return matches(v,table.defs[s],depth+1);if(!s)return false;
 if(Object.hasOwn(s,'const'))return same(v,s.const);if(s.enum)return s.enum.some(x=>same(x,v));if(s.oneOf)return s.oneOf.filter(x=>matches(v,x,depth+1)).length===1;
 if(s.type==='null')return v===null;if(s.type==='boolean')return typeof v==='boolean';
 if(s.type==='integer')return Number.isSafeInteger(v)&&v>=s.min&&v<=s.max;
 if(s.type==='string'){if(typeof v!=='string')return false;if(s.format==='id')return /^[A-Za-z0-9_-]{1,80}$/.test(v);if(s.format==='sha')return /^[a-f0-9]{64}$/.test(v);return /^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n&&(s.format!=='positive'||v!=='0');}
 if(s.type==='array')return Array.isArray(v)&&v.length>=s.min&&v.length<=s.max&&v.every(x=>matches(x,s.items,depth+1));
 return s.type==='object'&&object(v)&&Object.keys(v).length===Object.keys(s.fields).length&&Object.keys(s.fields).every(k=>Object.hasOwn(v,k)&&matches(v[k],s.fields[k],depth+1));
}
const frames=action=>action===42?118:241;
function semantics(v){const context=v.context;
 const visit=o=>{if(!object(o)){if(Array.isArray(o))o.forEach(visit);return;}
  if(o.control&&Object.hasOwn(o.control,'control_epoch')){const c=o.control,ctx=o.source_context??context;need(c.controller_id===ctx.controller_id&&c.service_instance_id===ctx.service_instance_id,'invalid_native400_wire');}
  if(o.package_ref)for(const target of [o.target,o.desired].filter(Boolean))need(target.manifest_sha256===o.package_ref.hub_manifest_sha256,'invalid_native400_wire');
  if(o.asset_descriptor){const action=o.target?.action_id??o.asset_ref?.action_id??o.action_id,d=o.asset_descriptor;need(d.frames===frames(action)&&d.extra_keyframes<=d.frames-Math.ceil(d.frames/12),'invalid_native400_wire');}
  if(o.type==='lease.granted')need(same(o.context,context),'invalid_native400_wire');
  if(['playback.report','asset.verified'].includes(o.type)&&o.verification){const p=o.verification,d=o.asset_descriptor;need(p.file_sha256===(o.target??o.asset_ref).asset_sha256&&p.index_sha256===d.index_sha256&&p.rgb565_sha256===d.rgb565_sha256&&p.frames===d.frames&&p.extra_keyframes===d.extra_keyframes,'invalid_native400_wire');}
  if(o.type==='display.report'){
   need(o.kind==='event'?o.query_id===null:o.query_id!==null,'invalid_native400_wire');need((o.display_state==='unknown')===(o.actual===null),'invalid_native400_wire');
   if(o.display_state==='playing')need(o.maintenance==='none'&&!o.actual.historical,'invalid_native400_wire');
   if(o.actual){const a=o.actual;need(a.frame_index<frames(a.asset_ref.action_id)&&uint64(a.first_frame_commit_seq)<=uint64(a.commit_seq),'invalid_native400_wire');if(!a.historical)need(same(a.source_context,context),'invalid_native400_wire');
    if(a.origin==='local')need(a.control===null&&a.source_target===null&&[0,4].includes(a.asset_ref.action_id),'invalid_native400_wire');
    else{need(a.control!==null&&a.source_target!==null,'invalid_native400_wire');const t=a.source_target;need(t.action_id===a.asset_ref.action_id&&t.asset_sha256===a.asset_ref.asset_sha256&&t.manifest_sha256===o.package_ref.hub_manifest_sha256,'invalid_native400_wire');if(!a.historical){need(o.desired&&same(o.desired,t),'invalid_native400_wire');}}
   }
  }
  if(o.kind==='playback.set')need(o.payload.target.action_id!==4,'invalid_native400_wire');
  if(o.kind==='asset'){need(o.range_start<=o.range_end&&o.range_end<o.total_bytes&&o.range_end-o.range_start+1<=32768,'invalid_native400_wire');}
  for(const x of Object.values(o))visit(x);
 };visit(v.payload);
 if(v.type==='error')need((v.request_id===null)===(v.request_seq===null),'invalid_native400_wire');
 if(v.type==='exchange.response')need(!(v.payload.control&&v.payload.read_permit),'invalid_native400_wire');
 if(v.type==='exchange.request'&&v.payload.observation?.record.type==='touch.event')need(v.payload.observation.dispatch_id===null,'invalid_native400_wire');
 if(v.type==='manifest.page'){const p=v.payload,end=p.offset+p.actions.length;need(end<=78&&(end===78?p.next_offset===null:p.next_offset===end),'invalid_native400_wire');need(p.actions.every((a,i)=>a.action_id===p.offset+i),'invalid_native400_wire');}
}
/** Closed shape/relations only. Does not authenticate peers, license assets, verify SHA
 * evidence or apply lease/revision/stream freshness. The outer session/guard owns these. */
export function validateNative400Wire(value){C(value);need(matches(value,'message'),'invalid_native400_wire');semantics(value);return clone(value);}
export function encodeNative400Wire(value){validateNative400Wire(value);const bytes=text.encode(C(value));need(bytes.length>0&&bytes.length<=4096,'wire_size');return bytes;}
export function decodeNative400Wire(bytes){need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=4096,'wire_size');const v=parseRoundPetJson(bytes);validateNative400Wire(v);need(new TextDecoder().decode(bytes)===C(v),'noncanonical_wire');return v;}
export const native400WireContract=()=>clone(table);
export function native400WireError(code){need(Object.hasOwn(table.errors,code),'unknown_wire_error');return clone(table.errors[code]);}
export function native400WireBudget({body_bytes=0,header_bytes=0,range_bytes=0}={}){bounded(body_bytes,0,4096);bounded(header_bytes,0,8192);bounded(range_bytes,0,32768);return true;}
/** Exact review-relative paths only. No URL resolution or HTTP I/O. */
export function classifyNative400Request({method,path,range=null}){
 need(typeof method==='string'&&typeof path==='string','invalid_wire_path');const root='/hub-device/native400-review/v1/';if(method==='POST'&&[root+'hello',root+'exchange'].includes(path)){need(range===null,'invalid_wire_path');return {kind:path.endsWith('hello')?'hello':'exchange'};}
 if(method==='GET'&&range===null){const m=/^\/hub-device\/native400-review\/v1\/manifests\/([a-f0-9]{64})\?offset=(0|[1-9][0-9]?)&limit=([1-4])$/.exec(path);if(m){const offset=Number(m[2]);need(offset<78,'invalid_wire_path');return {kind:'manifest',sha256:m[1],offset,limit:Number(m[3])};}}
 if(method==='GET'){const m=/^\/hub-device\/native400-review\/v1\/assets\/([a-f0-9]{64})$/.exec(path),r=typeof range==='string'&&/^bytes=(0|[1-9][0-9]{0,6})-(0|[1-9][0-9]{0,6})$/.exec(range);if(m&&r){const start=Number(r[1]),end=Number(r[2]);need(start<=end&&end<5865472&&end-start+1<=32768,'invalid_wire_path');return {kind:'asset',sha256:m[1],start,end};}}
 need(false,'invalid_wire_path');
}
/** Make a page from already independently approved 400-01 metadata. No hashing/approval.
 * The supplied envelope is still validated, including its package and correlation shape. */
export function native400ManifestPage(metadata,{request_id,request_seq,context,package_ref,permit_id,offset,limit}){
 bounded(offset,0,77);bounded(limit,1,4);need(metadata.manifest.actions.length===78,'unapproved_package');need(same(package_ref,{namespace_scope:metadata.identity.namespace_scope,namespace:metadata.identity.namespace,firmware_package_sha256:metadata.identity.firmware_package_sha256,hub_manifest_sha256:metadata.identity.hub_manifest_sha256}),'unapproved_package');
 const actions=metadata.manifest.actions.slice(offset,offset+limit).map(a=>{const t=metadata.package.content.timing[a.id];return {action_id:a.id,asset_sha256:a.sha256,asset_descriptor:{bytes:a.bytes,width:t.width,height:t.height,fps:t.fps,frames:t.frames,codec_flag:1,key_interval:12,tile_rows:20,index_sha256:t.index_sha256,rgb565_sha256:t.rgb565_sha256,extra_keyframes:t.extra_keyframes}};});
 const end=offset+actions.length;return validateNative400Wire({protocol:'hub-device/1',profile:NATIVE400_WIRE_PROFILE,schema_version:1,type:'manifest.page',request_id,request_seq,context,payload:{package_ref,permit_id,offset,total_actions:78,next_offset:end===78?null:end,actions}});
}
/** Parsed HTTP response metadata, not a raw HTTP parser. Expected permit comes from a
 * trusted current exchange owner. Does not consume permit, authorize chunks or verify F. */
export function validateNative400AssetResponse({status,headers},expected){
 const {permit,request_id,request_seq}=expected;need(matches(permit,'asset_permit')&&permit.target.manifest_sha256===permit.package_ref.hub_manifest_sha256,'invalid_read_response');id(request_id);need(uint64(request_seq)>0n,'invalid_read_response');
 need(status===206&&Array.isArray(headers)&&headers.length<=64,'invalid_read_response');const h={};let length=34;
 for(const pair of headers){need(Array.isArray(pair)&&pair.length===2&&pair.every(x=>typeof x==='string'),'invalid_read_response');const [name,value]=pair,key=name.toLowerCase();need(/^[A-Za-z0-9-]+$/.test(name)&&!/[\r\n\u0000]/.test(value)&&!Object.hasOwn(h,key),'invalid_read_response');h[key]=value;length+=text.encode(name+': '+value+'\r\n').length;}
 bounded(length,0,8192);need(!Object.hasOwn(h,'content-encoding')&&!Object.hasOwn(h,'transfer-encoding'),'invalid_read_response');
 need(permit.range_start<=permit.range_end&&permit.range_end<permit.total_bytes&&permit.range_end-permit.range_start+1<=32768,'invalid_read_response');
 need(h['content-length']===String(permit.range_end-permit.range_start+1)&&h['content-range']===`bytes ${permit.range_start}-${permit.range_end}/${permit.total_bytes}`&&h.etag===`"${permit.target.asset_sha256}"`&&h['x-pet-hub-read']===permit.permit_id&&h['x-pet-hub-request-id']===request_id&&h['x-pet-hub-request-seq']===request_seq,'invalid_read_response');return true;
}
/** Bind parsed material references to caller-trusted, independently approved 400-01
 * metadata. No hashing, license discovery, session/lease or report freshness authority. */
export function validateNative400MaterialRefs(value,metadata){
 const v=validateNative400Wire(value),m=metadata.manifest,expected={namespace_scope:metadata.identity.namespace_scope,namespace:metadata.identity.namespace,firmware_package_sha256:metadata.identity.firmware_package_sha256,hub_manifest_sha256:metadata.identity.hub_manifest_sha256};
 const asset=a=>{const known=m.actions[a.action_id];need(known?.id===a.action_id&&known.sha256===a.asset_sha256,'incompatible_asset');};
 const visit=o=>{if(!object(o)){if(Array.isArray(o))o.forEach(visit);return;}if(o.package_ref)need(same(o.package_ref,expected),'unapproved_package');
  for(const field of ['target','source_target','desired','base_target'])if(o[field]){const t=o[field];asset(t);need(t.manifest_sha256===expected.hub_manifest_sha256&&t.character_id===m.character_id&&t.variant_id===m.variant_id,'unapproved_package');}
  if(o.asset_ref)asset(o.asset_ref);if(o.kind==='asset')need(o.total_bytes===m.actions[o.target.action_id].bytes,'incompatible_asset');if(o.asset_descriptor){const action=o.target?.action_id??o.asset_ref?.action_id??o.action_id,known=m.actions[action],t=metadata.package.content.timing[action];need(known&&t,'incompatible_asset');need((!o.asset_sha256||o.asset_sha256===known.sha256)&&same(o.asset_descriptor,{bytes:known.bytes,width:t.width,height:t.height,fps:t.fps,frames:t.frames,codec_flag:1,key_interval:12,tile_rows:20,index_sha256:t.index_sha256,rgb565_sha256:t.rgb565_sha256,extra_keyframes:t.extra_keyframes}),'incompatible_asset');}
  for(const x of Object.values(o))visit(x);
 };visit(v.payload);return v;
}
