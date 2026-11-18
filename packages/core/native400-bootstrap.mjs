import {native400Metadata,NATIVE400_OFFLINE_NAMESPACE} from './native400-identity.mjs';
import {roundPetCanonical as C} from './round-pet-identity.mjs';
import {crc32} from './pet4.mjs';
import {uint64,id,clone,same,requireThat as need} from './protocol.mjs';
export const NATIVE400_BOOT_NAMESPACE_TEXT='round-pet/whale/native400/pet4/tile20/key12/v1';
export const NATIVE400_BOOT_NAMESPACE='a34d0c7ba6e7ede9fb9973977dd31fb8a7eb7dc92158cff0308da2640c226e2a';
export const NATIVE400_BOOT_LAYOUT=Object.freeze({bytes:29360128,sector:4096,stride:5869568,slots:5,header:256});
const IDS=[0,4,1,11],geometry=[2,400,24,20,12,1];
const exact=(v,fields)=>{need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k)),'bootstrap_approval_required');};
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength),zero=(b,a,z)=>b.subarray(a,z).every(n=>n===0);
const sequence=b=>view(b).getBigUint64(8,true).toString();
function common(b,magic){
 need(String.fromCharCode(...b.subarray(0,8))===magic,'bootstrap_magic');need(hex(b.subarray(24,56))===NATIVE400_BOOT_NAMESPACE,'bootstrap_namespace');const v=view(b);
 need(geometry.every((n,i)=>v.getUint32(112+4*i,true)===n),'bootstrap_geometry');need(zero(b,136,248),'bootstrap_reserved');
 need(v.getUint32(248,true)===crc32(b.subarray(0,248)),'bootstrap_crc');need(v.getUint32(252,true)===0x36434d54,'bootstrap_commit');
}
/** Structural diagnostics against a trusted normalized native400 candidate/metadata.
 * No approval is accepted or issued here; returns only selected header references.
 * Source bytes, payload hashes, usage rights and current device state are separate. */
export function inspectNative400BootstrapHeaders({metadata:m,roots,objects,bytes,minimumSequence='0'}){
  need(bytes===NATIVE400_BOOT_LAYOUT.bytes,'bootstrap_size');uint64(minimumSequence);
  need(Array.isArray(roots)&&roots.length===2&&Array.isArray(objects)&&objects.length===5,'bootstrap_headers');
  for(const b of [...roots,...objects])need(b instanceof Uint8Array&&b.length===256,'bootstrap_headers');
  const statuses=roots.map((b,sector)=>{let seq=null;try{
   common(b,'PET4ROT2');seq=sequence(b);const v=view(b);need(seq!=='0'&&v.getUint32(16,true)===2&&zero(b,20,24)&&v.getUint32(56,true)===0&&v.getUint32(60,true)===4,'bootstrap_root');
   const refs=[];
   for(let i=0;i<4;i++){
    const slot=v.getUint32(64+12*i,true),generation=v.getBigUint64(68+12*i,true).toString();need(slot<5&&generation!=='0'&&!refs.some(r=>r.slot===slot),'bootstrap_reference');
    const raw=objects[slot];common(raw,'PET4OBJ2');const o=view(raw),action=o.getUint32(16,true);need(zero(raw,88,112)&&sequence(raw)===generation,'bootstrap_generation');
    need(IDS.includes(action)&&!refs.some(r=>r.action_id===action),'bootstrap_actions');const asset=m.manifest.actions[action],length=o.getUint32(20,true);
    need(length===asset.bytes&&length<=NATIVE400_BOOT_LAYOUT.stride-4096&&hex(raw.subarray(56,88))===asset.sha256,'bootstrap_asset_identity');
    refs.push({slot,generation,action_id:action,bytes:length,file_sha256:asset.sha256,frames:m.package.content.timing[action].frames,payload_offset:8192+slot*NATIVE400_BOOT_LAYOUT.stride+4096});
   }
   return {sector,valid:true,sequence:seq,error:null,objects:refs};
  }catch(e){if(!e.code)throw e;return {sector,valid:false,sequence:seq,error:e.code};}});
  const valid=statuses.filter(r=>r.valid);need(valid.length>0,'bootstrap_no_valid_root');need(valid.length!==2||valid[0].sequence!==valid[1].sequence,'bootstrap_equal_roots');
  const selected=valid.reduce((x,y)=>uint64(x.sequence)>uint64(y.sequence)?x:y);need(uint64(selected.sequence)>=uint64(minimumSequence),'bootstrap_below_floor');
  return {selection:{sector:selected.sector,sequence:selected.sequence,minimum_sequence:minimumSequence,degraded_roots:valid.length!==2,fallback_from_newer:statuses.some(r=>!r.valid&&r.sequence!==null&&uint64(r.sequence)>uint64(selected.sequence)),roots:statuses.map(({objects,...r})=>r)},objects:clone(selected.objects)};
 }
/** Independent offline-source-review decision, never inferred from a file/ledger.
 * Validates existing candidate approval once; returns a pure bounded inspector.
 * Input headers are untrusted. No I/O, asset verification, device state or writes. */
export function createNative400BootstrapInspector({package:pkg,catalog,approval,mappingApproval:a,hash}){
 const m=native400Metadata({package:pkg,catalog,approval,sourceSha256:approval?.source_manifest_sha256,sourceIndexSha256:approval?.source_index_sha256,hash});
 need(hash(NATIVE400_BOOT_NAMESPACE_TEXT)===NATIVE400_BOOT_NAMESPACE,'bootstrap_namespace');
 need(a&&typeof a==='object','bootstrap_approval_required');C(a);exact(a,['schema_version','profile','usage','namespace_boot','namespace_offline','firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256','source_index_sha256','action_ids','approval_id','candidate_approval_id','license_ref','credits','source_kind']);
 need(a.schema_version===1&&a.profile==='native400-bootstrap-source-review/1'&&a.usage==='offline-source-review','bootstrap_approval_required');
 need(a.namespace_boot===NATIVE400_BOOT_NAMESPACE&&a.namespace_offline===NATIVE400_OFFLINE_NAMESPACE,'bootstrap_namespace');
 for(const k of ['firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256','source_index_sha256'])need(a[k]===m.identity[k],'bootstrap_identity_mismatch');
 need(same(a.action_ids,IDS)&&a.candidate_approval_id===m.approval.approval_id,'bootstrap_approval_required');id(a.approval_id);
 for(const k of ['license_ref','credits','source_kind'])need(same(a[k],m.approval[k]),'license_not_approved');
 const identity={namespace_boot:NATIVE400_BOOT_NAMESPACE,namespace_offline:NATIVE400_OFFLINE_NAMESPACE,firmware_package_sha256:m.identity.firmware_package_sha256,hub_manifest_sha256:m.identity.hub_manifest_sha256,source_manifest_sha256:m.identity.source_manifest_sha256,source_index_sha256:m.identity.source_index_sha256};
 const decision={mapping_approval_id:a.approval_id,candidate_approval_id:m.approval.approval_id,license_ref:a.license_ref,credits:clone(a.credits),source_kind:a.source_kind,usage:a.usage};
 function inspect(input){return {identity:clone(identity),approval:clone(decision),...inspectNative400BootstrapHeaders({...input,metadata:m})};}
 /** Historical structure/approved identity validation only. No raw headers/CRC,
  * source bytes or device proof can be recovered from a self-hashed map. */
 function validateMap(input){
  const bad='bootstrap_map_invalid',eq=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k)),bad);
  const map=clone(input);need(new TextEncoder().encode(C(map)).length<=32768,bad);eq(map,['recipe','sha256','content']);
  need(map.recipe==='native400-bootstrap-source-map-v1-canonical-json'&&map.sha256===hash(C(map.content)),bad);
  const c=map.content;eq(c,['schema_version','scope','identity','approval','selection','objects','cache','checks','device_evidence']);
  need(c.schema_version===1&&c.scope==='offline-source-review'&&c.device_evidence===false,bad);
  need(C(c.identity)===C(identity)&&C(c.approval)===C(decision),'bootstrap_map_approval_mismatch');
  eq(c.cache,['bytes','sha256']);need(c.cache.bytes===NATIVE400_BOOT_LAYOUT.bytes&&/^[a-f0-9]{64}$/.test(c.cache.sha256),bad);
  need(C(c.checks)===C({catalog_metadata:true,payload_sha256:true,media_validation:'not-performed'}),bad);
  const s=c.selection;eq(s,['sector','sequence','minimum_sequence','degraded_roots','fallback_from_newer','roots']);uint64(s.sequence);uint64(s.minimum_sequence);
  need(Array.isArray(s.roots)&&s.roots.length===2,bad);
  const errors=['bootstrap_magic','bootstrap_namespace','bootstrap_geometry','bootstrap_reserved','bootstrap_crc','bootstrap_commit','bootstrap_root','bootstrap_reference','bootstrap_generation','bootstrap_actions','bootstrap_asset_identity'];
  for(const [i,r] of s.roots.entries()){
   eq(r,['sector','valid','sequence','error']);need(r.sector===i&&typeof r.valid==='boolean',bad);if(r.sequence!==null)uint64(r.sequence);
   need(r.valid?r.sequence!==null&&r.sequence!=='0'&&r.error===null:errors.includes(r.error),bad);
  }
  const valid=s.roots.filter(r=>r.valid);need(valid.length>0&&(valid.length!==2||valid[0].sequence!==valid[1].sequence),bad);
  const selected=valid.reduce((x,y)=>uint64(x.sequence)>uint64(y.sequence)?x:y);
  need(s.sector===selected.sector&&s.sequence===selected.sequence&&uint64(s.sequence)>=uint64(s.minimum_sequence)&&s.degraded_roots===(valid.length!==2)&&s.fallback_from_newer===s.roots.some(r=>!r.valid&&r.sequence!==null&&uint64(r.sequence)>uint64(s.sequence)),bad);
  need(Array.isArray(c.objects)&&c.objects.length===4,bad);const actions=new Set(),slots=new Set();
  for(const o of c.objects){
   eq(o,['slot','generation','action_id','bytes','file_sha256','frames','payload_offset']);uint64(o.generation);
   need(Number.isInteger(o.slot)&&o.slot>=0&&o.slot<5&&!slots.has(o.slot)&&o.generation!=='0'&&IDS.includes(o.action_id)&&!actions.has(o.action_id),bad);
   const asset=m.manifest.actions[o.action_id];need(o.bytes===asset.bytes&&o.bytes<=NATIVE400_BOOT_LAYOUT.stride-4096&&o.file_sha256===asset.sha256&&o.frames===m.package.content.timing[o.action_id].frames&&o.payload_offset===8192+o.slot*NATIVE400_BOOT_LAYOUT.stride+4096,bad);actions.add(o.action_id);slots.add(o.slot);
  }
  return map;
 }
 return {inspect,validateMap};
}
