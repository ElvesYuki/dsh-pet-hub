import {roundPetCanonical as C,parseRoundPetJson} from './round-pet-identity.mjs';
import {parseLayeredJson} from './layered-character-json.mjs';
import {requireThat as need,keys,bounded,digest,id,clone,same} from './protocol.mjs';
import {MaterialCatalog} from './materials.mjs';
import {NATIVE400} from './material-profile.mjs';

export const NATIVE400_IDENTITY_PROFILE='round-pet-native400-offline/1';
export const NATIVE400_RECIPE='pet-package-native400-v1-canonical-json';
export const NATIVE400_NAMESPACE_TEXT='round-pet/whale/native400/pet4/tile20/key12/offline-v1';
export const NATIVE400_OFFLINE_NAMESPACE='dd0f19bfdc4bed608ddf18baf095fd6c8b53217bbb59d8f0238e51460e2c0ff8';
const IDS=Array.from({length:78},(_,i)=>i),LIMIT=5865472;
const SEMANTICS={idle:0,touch:4,thinking:1,working:11,result:43,success:58,waiting:7,error:55};
const MEDIA={container:'PET4',codec_flag:1,key_interval:12,tile_rows:20,fps:24,frame_limit:241,extra_keyframes:true};
const exact=(v,fields)=>{keys(v,fields);need(Object.keys(v).length===fields.length,'invalid_native400_metadata');};
const frames=id=>id===42?118:241;
function asset(a){exact(a,['id','bytes','sha256']);bounded(a.id,0,77);bounded(a.bytes,544,LIMIT);digest(a.sha256);}
function timing(t,i){exact(t,['id','width','height','fps','frames','index_sha256','rgb565_sha256','extra_keyframes']);need(t.id===i&&t.width===400&&t.height===400&&t.fps===24&&t.frames===frames(i),'timing_mismatch');digest(t.index_sha256);digest(t.rgb565_sha256);bounded(t.extra_keyframes,0,t.frames-Math.ceil(t.frames/12));}
function shape(pkg,catalog,hash){
 need(typeof hash==='function','invalid_native400_metadata');C(pkg);C(catalog);
 exact(pkg,['hash_recipe','sha256','content']);need(pkg.hash_recipe===NATIVE400_RECIPE,'unsupported_native400_recipe');digest(pkg.sha256);
 const c=pkg.content;exact(c,['schema_version','profile','namespace_scope','namespace','catalog','media_profile','timing','semantics','source_manifest_sha256','source_index_sha256']);
 need(c.schema_version===1&&c.profile===NATIVE400_IDENTITY_PROFILE&&c.namespace_scope==='offline-candidate'&&c.namespace===NATIVE400_OFFLINE_NAMESPACE,'unsupported_native400_profile');
 need(hash(NATIVE400_NAMESPACE_TEXT)===NATIVE400_OFFLINE_NAMESPACE,'namespace_integrity_failed');digest(c.source_manifest_sha256);digest(c.source_index_sha256);
 const m=c.catalog;exact(m,['character_id','variant_id','codec','pet4_profile','display','actions','license_ref']);
 need(m.codec==='PET4'&&m.pet4_profile===NATIVE400&&same(m.display,{width:400,height:400,shape:'circle',pixel_format:'RGB565'}),'incompatible_asset');
 need(Array.isArray(m.actions)&&same(m.actions.map(a=>a.id),IDS),'native400_action_set');for(const a of m.actions)asset(a);
 need(same(c.media_profile,MEDIA),'incompatible_asset');need(same(c.semantics,SEMANTICS),'round_pet_semantics');
 need(Array.isArray(c.timing)&&c.timing.length===78,'timing_mismatch');c.timing.forEach(timing);
 const P=hash(C(c)),M=hash(C(m));need(pkg.sha256===P,'package_integrity_failed');
 exact(catalog,[...Object.keys(m),'sha256']);need(same(catalog,{...m,sha256:P}),'export_catalog_mismatch');
 const manifest={...clone(m),sha256:M};new MaterialCatalog([manifest]);return {c,manifest,P,M};
}
/** Pure bounded normalization from selected original source/index bytes. Returns a candidate,
 * never an approval, firmware identity, installed namespace or verified media receipt. */
export function native400SourceCandidate({sourceBytes,indexBytes,hash}){
 need(typeof hash==='function','invalid_native400_metadata');let source;
 try{source=parseLayeredJson(sourceBytes,1048576);}catch{need(false,'invalid_native400_source');}
 const index=parseRoundPetJson(indexBytes);exact(index,['schemaVersion','variants']);need(index.schemaVersion===1&&Array.isArray(index.variants)&&index.variants.length===1,'invalid_native400_source');
 const v=index.variants[0];exact(v,['manifest','files']);const host=v.manifest;
 exact(host,['package_schema','pet4_profile','character_id','variant_id','codec','license_ref','display','semantics','actions']);
 need(host.package_schema===2&&host.pet4_profile===NATIVE400&&host.codec==='PET4'&&same(host.display,{width:400,height:400,shape:'circle',pixel_format:'RGB565'})&&same(host.semantics,SEMANTICS),'incompatible_asset');
 need(source.schema==='native400-compact-approved/1'&&source.profile===NATIVE400&&source.recipe==='native400-compact-approved-v1'&&source.license_ref===host.license_ref,'invalid_native400_source');
 need(same(source.geometry,{crop:[124,-6,400,400],display:[466,466],offset:[33,33],extra_mask:false}),'incompatible_asset');
 need(source.visual_approval?.approved===true&&source.visual_approval.review_manifest_sha256===source.review_manifest_sha256&&same(source.visual_approval.action_ids,IDS),'native400_visual_review_required');digest(source.review_manifest_sha256);
 need(Array.isArray(source.actions)&&same(source.actions.map(a=>a.id),IDS)&&Array.isArray(host.actions)&&same(host.actions.map(a=>a.id),IDS),'native400_action_set');
 need(Array.isArray(v.files)&&v.files.length===78,'native400_action_set');
 const actions=[],times=[];
 for(let i=0;i<78;i++){
  const h=host.actions[i],s=source.actions[i],f=v.files[i];exact(h,['id','bytes','sha256','fps','frames','loop']);exact(f,['action_id','path']);
  need(f.action_id===i&&f.path===`${i}.pet`,'unsafe_asset_path');
  need(h.fps===24&&h.frames===frames(i)&&s.id===i&&s.width===400&&s.height===400&&s.fps===24&&s.frames===frames(i),'timing_mismatch');
  need(['loop','once_hold','once_idle'].includes(h.loop)&&h.bytes===s.bytes&&h.sha256===s.sha256,'invalid_native400_source');
  digest(s.source_sha256);const a={id:i,bytes:s.bytes,sha256:s.sha256};asset(a);actions.push(a);
  const t={id:i,width:400,height:400,fps:24,frames:s.frames,index_sha256:s.index_sha256,rgb565_sha256:s.rgb565_sha256,extra_keyframes:s.extra_keyframes};timing(t,i);times.push(t);
 }
 const catalog={character_id:host.character_id,variant_id:host.variant_id,codec:'PET4',pet4_profile:NATIVE400,display:clone(host.display),actions,license_ref:host.license_ref};
 const content={schema_version:1,profile:NATIVE400_IDENTITY_PROFILE,namespace_scope:'offline-candidate',namespace:NATIVE400_OFFLINE_NAMESPACE,catalog,media_profile:clone(MEDIA),timing:times,semantics:clone(SEMANTICS),source_manifest_sha256:hash(sourceBytes),source_index_sha256:hash(indexBytes)};
 const pkg={hash_recipe:NATIVE400_RECIPE,sha256:hash(C(content)),content},exported={...clone(catalog),sha256:pkg.sha256};
 const {manifest,P,M}=shape(pkg,exported,hash);
 return {package:pkg,catalog:exported,identity:{profile:NATIVE400_IDENTITY_PROFILE,namespace_scope:'offline-candidate',namespace:NATIVE400_OFFLINE_NAMESPACE,firmware_package_sha256:P,hub_manifest_sha256:M,source_manifest_sha256:content.source_manifest_sha256,source_index_sha256:content.source_index_sha256},hostManifestSha256:hash(C(host)),manifest};
}
/** Independent caller-trusted offline usage decision, not inferred from source provenance. */
export function validateNative400Approval(a){
 exact(a,['schema_version','profile','namespace_scope','namespace','firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256','source_index_sha256','action_ids','license_ref','approval_id','credits','source_kind','usage']);
 need(a.schema_version===1&&a.profile===NATIVE400_IDENTITY_PROFILE&&a.namespace_scope==='offline-candidate'&&a.namespace===NATIVE400_OFFLINE_NAMESPACE,'round_pet_approval_required');
 for(const k of ['firmware_package_sha256','hub_manifest_sha256','source_manifest_sha256','source_index_sha256'])digest(a[k]);
 need(same(a.action_ids,IDS),'native400_action_set');id(a.approval_id);
 need(typeof a.license_ref==='string'&&a.license_ref.trim().length>0&&a.license_ref.length<=256,'license_not_approved');
 need(Array.isArray(a.credits)&&a.credits.length>0&&a.credits.length<=16&&a.credits.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=256)&&new Set(a.credits).size===a.credits.length,'license_not_approved');
 need(['original-test','reviewed-upstream'].includes(a.source_kind)&&a.usage==='offline-validation','license_not_approved');C(a);return clone(a);
}
/** Checks P/M/N and origin digests against a separately provided approval; no file/device I/O. */
export function native400Metadata({package:pkg,catalog,approval,sourceSha256,sourceIndexSha256,hash}){
 approval=validateNative400Approval(approval);const {c,manifest,P,M}=shape(pkg,catalog,hash);
 need(c.source_manifest_sha256===sourceSha256&&sourceSha256===approval.source_manifest_sha256&&c.source_index_sha256===sourceIndexSha256&&sourceIndexSha256===approval.source_index_sha256,'source_manifest_changed');
 need(P===approval.firmware_package_sha256,'package_integrity_failed');need(M===approval.hub_manifest_sha256,'manifest_integrity_failed');need(manifest.license_ref===approval.license_ref,'license_not_approved');
 const index={schemaVersion:1,variants:[{manifest:clone(c.catalog),files:c.catalog.actions.map(a=>({action_id:a.id,path:`${a.id}.pet`}))}]},indexText=C(index)+'\n';
 return {manifest,index,indexText,indexSha256:hash(indexText),identity:{profile:NATIVE400_IDENTITY_PROFILE,namespace_scope:'offline-candidate',namespace:NATIVE400_OFFLINE_NAMESPACE,firmware_package_sha256:P,hub_manifest_sha256:M,source_manifest_sha256:sourceSha256,source_index_sha256:sourceIndexSha256,index_sha256:hash(indexText)},package:clone(pkg),catalog:clone(catalog),approval};
}
