import {mkdirSync,copyFileSync,writeFileSync,rmSync,constants} from 'node:fs';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';import {Pet4Decoder} from '../packages/core/pet4.mjs';import {outputPath} from './prepare-native400-review.mjs';import {MERGED_RECIPE} from './merge-native400-candidates.mjs';
export const COMPACT_RECIPE='native400-compact-approved-v1';
const LIMIT=5865472,IDS=Array.from({length:78},(_,i)=>i),PIPELINE='source400-flat-smoothing-bounded-temporal-palette-hc12-v1';
const need=(v,s)=>{if(!v)throw new Error(s);},digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);

/** Normalize exactly the reviewed compact artifacts. Explicit approval is bound to the complete review manifest bytes. */
export function planCompactRelease(baseRaw,reviewRaw,{approvedReviewSha256,approveVisuals=false}={}){
 need(digest(approvedReviewSha256)&&sha256(reviewRaw)===approvedReviewSha256,'review_approval_sha');need(approveVisuals===true,'visual_approval_required');
 const b=JSON.parse(baseRaw),r=JSON.parse(reviewRaw);
 need(b.profile==='native400-candidate-v1'&&b.recipe===MERGED_RECIPE&&b.license_ref==='dsh-pet-nc-86181ce','compact_base');
 need(r.schema==='native400-preprocess-review/1'&&r.profile===b.profile&&r.license_ref===b.license_ref&&r.baseline_manifest_sha256===sha256(baseRaw),'compact_parent_binding');
 need(JSON.stringify(r.geometry)===JSON.stringify(b.geometry)&&JSON.stringify(b.geometry)===JSON.stringify({crop:[124,-6,400,400],display:[466,466],offset:[33,33],extra_mask:false}),'compact_geometry');
 need(r.actions?.map(a=>a.id).join(',')===IDS.join(',')&&b.actions?.map(a=>a.id).join(',')===IDS.join(','),'compact_actions');
 need(r.tiers?.length===1&&r.tiers[0].key==='compact'&&r.tiers[0].spatial===18&&r.tiers[0].temporal===5&&r.tiers[0].colorCap===128&&r.tiers[0].colorRatio===0.75,'compact_tier');
 need(r.validation?.all_frames_crc_and_pixel_hashes===true&&r.validation.actions===78&&r.validation.variants===78&&r.validation.candidate_frames===18675,'compact_review_proof');
 const actions=r.actions.map((a,i)=>{
  const old=b.actions[i];need(a.name===old.name&&a.source_sha256===old.source_sha256&&a.frames===old.frames&&a.frames===(a.id===42?118:241)&&a.fps===24,'compact_source_timing');
  need(a.baseline?.sha256===old.sha256&&a.baseline.bytes===old.bytes&&a.baseline.index_sha256===old.index_sha256&&a.baseline.rgb565_sha256===old.rgb565_sha256,'compact_original_identity');
  need(a.variants?.length===1,'compact_variant');const v=a.variants[0];
  need(v.key==='compact'&&v.recipe===PIPELINE&&v.parameters?.spatial===18&&v.parameters.temporal===5&&v.parameters.max_colors===Math.max(2,Math.min(128,Math.floor(a.baseline.palette_colors*0.75))),'compact_parameters');
  need(Number.isSafeInteger(v.bytes)&&v.bytes>0&&v.bytes<=LIMIT&&v.within_legacy_limit===true&&v.bytes_saved===old.bytes-v.bytes,'compact_size');
  need(v.verification==='independent_js_all_frames_crc_index_rgb565_size_sha_seeks_and_source_black','compact_pixel_proof');
  for(const d of [a.source_sha256,v.sha256,v.index_sha256,v.rgb565_sha256])need(digest(d),'compact_digest');
  return {id:a.id,name:a.name,source_sha256:a.source_sha256,width:400,height:400,fps:24,frames:a.frames,duration_seconds:a.frames/24,bytes:v.bytes,sha256:v.sha256,index_sha256:v.index_sha256,rgb565_sha256:v.rgb565_sha256,
   original_bytes:old.bytes,original_sha256:old.sha256,original_rgb565_sha256:old.rgb565_sha256,compression_recipe:v.recipe,preprocess_parameters:v.parameters,actual_palette_colors:v.actual_palette_colors,index_order:v.index_order,extra_keyframes:v.extra_keyframes,
   verified_lossless_rgb565:v.rgb565_sha256===old.rgb565_sha256,lossless_rgb565:v.rgb565_sha256===old.rgb565_sha256,exceeds_legacy_device_asset_limit:false,
   additional_foreground_mae_rgb:v.additional_foreground_mae_rgb,additional_max_channel_error:v.additional_max_channel_error,changed_foreground_fraction:v.changed_foreground_fraction,source_foreground_mae_rgb:v.source_foreground_mae_rgb,baseline_source_foreground_mae_rgb:v.base_source_foreground_mae_rgb,worst_error_frame:v.worst_error_frame,...(Number.isInteger(v.peak_error_frame)?{peak_error_frame:v.peak_error_frame,peak_error_pixel:v.peak_error_pixel}:{}),verification:v.verification};
 });
 return {schema:'native400-compact-approved/1',status:'user_visual_approved_host_candidate_not_device_approved',profile:b.profile,recipe:COMPACT_RECIPE,license_ref:b.license_ref,catalog_sha256:b.catalog_sha256,geometry:b.geometry,palette:b.palette,pet4:b.pet4,compression:b.compression,independent_index_validation:true,parent_manifest_sha256:sha256(baseRaw),review_manifest_sha256:sha256(reviewRaw),replaced_action_ids:IDS,
  visual_approval:{approved:true,date:'2026-11-02',scope:'all78_compact_visual_review',review_manifest_sha256:sha256(reviewRaw),action_ids:IDS},legacy_limit_bytes:LIMIT,total_bytes:actions.reduce((n,a)=>n+a.bytes,0),actions};
}
function verifyFile(root,name,a){const bytes=readRegular(root,name,8388608);need(bytes.length===a.bytes&&sha256(bytes)===a.sha256,'compact_asset_integrity');return bytes;}
function inspectTiles(bytes,a){new Pet4Decoder(bytes,{profile:'native400-candidate-v1'});const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),base=532+4*(2*a.frames+1);let maximum=0,extra=0;
 for(let f=0;f<a.frames;f++){let at=base+view.getUint32(532+4*f,true),end=base+view.getUint32(532+4*(f+1),true);if(bytes[at]===0&&f%12!==0)extra++;at++;for(let tile=0;tile<20;tile++){need(at+2<=end,'compact_tile');const n=view.getUint16(at,true);at+=2;need(n>0&&n<=8047&&at+n<=end,'compact_tile');maximum=Math.max(maximum,n);at+=n;}need(at===end,'compact_frame_end');}
 need(extra===a.extra_keyframes,'compact_key_count');return maximum;
}
/** Copy into a new flat cache directory; never overwrites originals or existing outputs. Failure removes only its own incomplete directory. */
export function finalizeCompact(input,review,output,approval){
 const root=resolve(input),source=resolve(review),dest=outputPath(process.cwd(),output),baseRaw=readRegular(root,'manifest.json',1048576),m=planCompactRelease(baseRaw,readRegular(source,'manifest.json',1048576),approval),old=JSON.parse(baseRaw);
 for(const a of old.actions)verifyFile(root,a.id+'.pet',a);
 for(const a of m.actions)a.max_packed_tile_bytes=inspectTiles(verifyFile(source,a.id+'-compact.pet',a),a);
 mkdirSync(dirname(dest),{recursive:true,mode:0o700});mkdirSync(dest,{mode:0o700});
 try{for(const a of m.actions){copyFileSync(join(source,a.id+'-compact.pet'),join(dest,a.id+'.pet'),constants.COPYFILE_EXCL);verifyFile(dest,a.id+'.pet',a);}const raw=JSON.stringify(m,null,2);writeFileSync(join(dest,'manifest.json'),raw,{flag:'wx'});return {directory:dest,manifest_sha256:sha256(raw),actions:m.actions.length,total_bytes:m.total_bytes};}catch(e){rmSync(dest,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,review,output,approvedReviewSha256,approval]=process.argv.slice(2);need(input&&review&&output&&approval==='--approve-visuals','explicit_inputs_and_visual_approval_required');console.log(JSON.stringify(finalizeCompact(input,review,output,{approvedReviewSha256,approveVisuals:true})));
}
