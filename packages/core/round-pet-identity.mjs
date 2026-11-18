import {parseLayeredJson} from './layered-character-json.mjs';
import {requireThat as need,keys,digest,id,bounded,clone,same} from './protocol.mjs';
import {MaterialCatalog} from './materials.mjs';
import {NATIVE360,native360Asset} from './native360-profile.mjs';

export const ROUND_PET_PROFILE='round-pet-native360/1';
export const ROUND_PET_RECIPE='pet-package-v1-canonical-json';
export const ROUND_PET_NAMESPACE_TEXT='round-pet/whale/native360/pet4/tile20/key12/v1';
const semantics=Object.freeze({idle:0,touch:4,thinking:1,working:11,result:43,success:58,waiting:7,error:55});
const exact=(v,fields)=>{keys(v,fields);need(Object.keys(v).length===fields.length,'invalid_round_pet_metadata');};
const unicode=s=>{for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=s.charCodeAt(++i);need(next>=0xdc00&&next<=0xdfff,'invalid_round_pet_json');}else need(n<0xdc00||n>0xdfff,'invalid_round_pet_json');}};
/** Candidate recipe domain: scalar Unicode, ASCII object keys, safe integer numbers, array order.
 * Hashing is injected; this core performs no file/network/crypto or license discovery. */
export function roundPetCanonical(value){
 let nodes=0;
 const visit=(v,depth)=>{
  need(depth<=16&&++nodes<=20000,'round_pet_resource_limit');
  if(typeof v==='string'){unicode(v);return JSON.stringify(v);}
  if(typeof v==='number'){need(Number.isSafeInteger(v)&&!Object.is(v,-0),'invalid_round_pet_json');return String(v);}
  if(v===null||typeof v==='boolean')return String(v);
  need(v&&typeof v==='object'&&(Array.isArray(v)||[null,Object.prototype].includes(Object.getPrototypeOf(v))),'invalid_round_pet_json');
  if(Array.isArray(v))return '['+Array.from(v,x=>visit(x,depth+1)).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>{need(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k),'invalid_round_pet_json');return JSON.stringify(k)+':'+visit(v[k],depth+1);}).join(',')+'}';
 };return visit(value,0);
}
/** Fatal UTF-8 / decoded duplicate keys first, then reject float/exponent/-0 lexical aliases. */
export function parseRoundPetJson(bytes){
 let result;try{result=parseLayeredJson(bytes);}catch(cause){throw Object.assign(new Error('invalid_round_pet_json',{cause}),{code:'invalid_round_pet_json'});}
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 const tokens=text.match(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/gs)??[];
 for(const token of tokens)if(token[0]!=='"')need(/^(?:0|[1-9]\d*|-[1-9]\d*)$/.test(token)&&Number.isSafeInteger(Number(token)),'invalid_round_pet_json');
 roundPetCanonical(result);return result;
}
export function validateRoundPetApproval(a){
 exact(a,['schema_version','profile','namespace','firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256','action_ids','license_ref','approval_id','credits','source_kind','usage']);
 need(a.schema_version===1&&a.profile===ROUND_PET_PROFILE&&a.namespace===NATIVE360.namespace,'round_pet_approval_required');
 for(const field of ['firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256'])digest(a[field]);
 need(Array.isArray(a.action_ids)&&a.action_ids.length===46,'round_pet_action_set');let previous=-1;
 for(const n of a.action_ids){bounded(n,0,77);need(n>previous,'round_pet_action_set');previous=n;}
 id(a.approval_id);need(typeof a.license_ref==='string'&&a.license_ref.trim().length>0&&a.license_ref.length<=256,'license_not_approved');
 need(Array.isArray(a.credits)&&a.credits.length>0&&a.credits.length<=16&&a.credits.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=256)&&new Set(a.credits).size===a.credits.length,'license_not_approved');
 need(['original-test','reviewed-upstream'].includes(a.source_kind)&&a.usage==='offline-validation','license_not_approved');roundPetCanonical(a);return clone(a);
}
/** Validates typed P/M/N plus an independently supplied approval. sourceSha256 is derived from
 * selected source bytes at import; on recovery the pinned approval is required again. No trust by self-hash. */
export function roundPetMetadata({package:pkg,catalog,approval,sourceSha256,hash}){
 need(typeof hash==='function');roundPetCanonical(pkg);roundPetCanonical(catalog);approval=validateRoundPetApproval(approval);
 exact(pkg,['hash_recipe','sha256','content']);need(pkg.hash_recipe===ROUND_PET_RECIPE,'unsupported_round_pet_recipe');digest(pkg.sha256);
 const c=pkg.content;exact(c,['schema_version','catalog','media_profile','timing','semantics','source_manifest_sha256']);need(c.schema_version===1,'unsupported_round_pet_recipe');
 digest(sourceSha256);need(c.source_manifest_sha256===sourceSha256&&sourceSha256===approval.source_manifest_sha256,'source_manifest_changed');
 const P=hash(roundPetCanonical(c));need(P===pkg.sha256&&P===approval.firmware_package_sha256,'package_integrity_failed');
 const m=c.catalog;exact(m,['character_id','variant_id','codec','display','actions','license_ref']);
 exact(catalog,['character_id','variant_id','codec','display','actions','license_ref','sha256']);need(catalog.sha256===P&&same({...m,sha256:P},catalog),'export_catalog_mismatch');
 const M=hash(roundPetCanonical(m));need(M===approval.hub_manifest_sha256,'manifest_integrity_failed');need(hash(ROUND_PET_NAMESPACE_TEXT)===NATIVE360.namespace,'namespace_integrity_failed');
 need(m.license_ref===approval.license_ref,'license_not_approved');const manifest={...clone(m),sha256:M};new MaterialCatalog([manifest]);
 need(m.codec==='PET4'&&same(m.display,{width:360,height:360,shape:'circle',pixel_format:'RGB565'}),'incompatible_asset');
 need(Array.isArray(m.actions)&&same(m.actions.map(a=>a.id),approval.action_ids),'round_pet_action_set');for(const a of m.actions)native360Asset(a);
 exact(c.media_profile,['container','codec_flag','key_interval','tile_rows','fps','frame_limit']);need(same(c.media_profile,{container:'PET4',codec_flag:1,key_interval:12,tile_rows:20,fps:24,frame_limit:360}),'incompatible_asset');
 exact(c.semantics,Object.keys(semantics));need(same(c.semantics,semantics)&&Object.values(semantics).every(n=>approval.action_ids.includes(n)),'round_pet_semantics');
 need(Array.isArray(c.timing)&&c.timing.length===46,'timing_mismatch');
 for(let i=0;i<c.timing.length;i++){const t=c.timing[i];exact(t,['id','width','height','fps','frames','index_sha256']);digest(t.index_sha256);need(t.id===m.actions[i].id&&t.width===360&&t.height===360&&t.fps===24&&t.frames===241,'timing_mismatch');}
 const index={schemaVersion:1,variants:[{manifest:clone(m),files:m.actions.map(a=>({action_id:a.id,path:`${a.id}.pet`}))}]},indexText=roundPetCanonical(index)+'\n',I=hash(indexText);
 return {manifest,index,indexText,indexSha256:I,identity:{profile:ROUND_PET_PROFILE,namespace:NATIVE360.namespace,firmware_package_sha256:P,hub_manifest_sha256:M,source_manifest_sha256:sourceSha256,index_sha256:I},package:clone(pkg),catalog:clone(catalog),approval};
}
