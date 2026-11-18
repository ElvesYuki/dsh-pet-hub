import {mkdirSync,copyFileSync,writeFileSync,rmSync,constants} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {outputPath} from './prepare-native400-review.mjs';

export const MERGED_RECIPE='native400-merged-approved-compression-v1';
const BASE_RECIPE='native400-rgb8-black-median-cut256-nearest-lz4hc12-v1';
const REPLACEMENTS=[5,17,19,20,23,35,40,48,66,67,70,76];
const COLORS=[5,20,35,40,48,66,67];
const LIMIT=5865472;
const need=(v,message)=>{if(!v)throw new Error(message);};

/** Bind the reviewed candidate bytes and explicit color approval to the original library. Throws before writing on mismatch. */
export function planMerge(baseRaw,candidateRaw,{approvedCandidateSha256,approveColorChanges=false}={}){
 need(sha256(candidateRaw)===approvedCandidateSha256,'candidate_approval_sha');
 need(approveColorChanges===true,'color_approval_required');
 const base=JSON.parse(baseRaw),candidate=JSON.parse(candidateRaw);
 need(base.profile==='native400-candidate-v1'&&base.recipe===BASE_RECIPE&&base.license_ref==='dsh-pet-nc-86181ce','base_profile');
 need(candidate.schema==='native400-compression-candidates/1'&&candidate.profile===base.profile&&candidate.license_ref===base.license_ref&&candidate.source_recipe===base.recipe&&candidate.legacy_limit_bytes===LIMIT,'candidate_profile');
 need(candidate.source_manifest_sha256===sha256(baseRaw)&&candidate.source_catalog_sha256===base.catalog_sha256,'candidate_source_binding');
 need(base.actions?.map(a=>a.id).join(',')===Array.from({length:78},(_,i)=>i).join(',')&&candidate.actions?.map(a=>a.id).join(',')===REPLACEMENTS.join(','),'candidate_actions');
 const replacements=new Map(candidate.actions.map(a=>[a.id,a]));
 const actions=base.actions.map(original=>{
  const a=replacements.get(original.id)??original;
  if(replacements.has(a.id)){
   need(a.original_sha256===original.sha256&&a.original_rgb565_sha256===original.rgb565_sha256&&a.original_bytes===original.bytes,'replacement_identity');
   for(const key of ['source_sha256','name','width','height','fps','frames','duration_seconds'])need(a[key]===original[key],'replacement_geometry_timing_source');
   const lossless=!COLORS.includes(a.id);
   need(a.lossless_rgb565===lossless&&a.verified_lossless_rgb565===lossless&&(a.rgb565_sha256===original.rgb565_sha256)===lossless,'replacement_lossless_claim');
   need(a.verification==='all_frames_crc_index_rgb_sha_and_size'&&a.within_legacy_limit===true,'replacement_verification');
  }
  need(Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes<=LIMIT&&a.exceeds_legacy_device_asset_limit===false,'asset_limit');
  need(a.width===400&&a.height===400&&a.fps===24&&a.frames===(a.id===42?118:241),'asset_geometry_timing');
  for(const key of ['sha256','index_sha256','rgb565_sha256','source_sha256'])need(/^[a-f0-9]{64}$/.test(a[key]),'asset_digest');
  return {...a};
 });
 return {...base,schema:'native400-merged-candidate/1',recipe:MERGED_RECIPE,status:'user_color_approved_host_candidate_not_device_approved',parent_manifest_sha256:sha256(baseRaw),replacement_manifest_sha256:sha256(candidateRaw),replaced_action_ids:REPLACEMENTS,color_approval:{scope:'additional_color_changes_vs_m2_only',approved:true,date:'2026-10-30',action_ids:COLORS,candidate_manifest_sha256:sha256(candidateRaw)},legacy_limit_bytes:LIMIT,total_bytes:actions.reduce((n,a)=>n+a.bytes,0),actions};
}

/** Write a new cache library only; verifies all input/copy hashes and removes only its own incomplete output on failure. */
export function mergeCandidates(input,candidates,output,approval){
 const root=resolve(input),replacementRoot=resolve(candidates),dest=outputPath(process.cwd(),output);
 const m=planMerge(readRegular(root,'manifest.json',1048576),readRegular(replacementRoot,'manifest.json',1048576),approval);
 const source=a=>REPLACEMENTS.includes(a.id)?replacementRoot:root;
 const verify=(directory,a)=>{const b=readRegular(directory,a.id+'.pet',8388608);need(b.length===a.bytes&&sha256(b)===a.sha256,'asset_integrity');};
 for(const a of m.actions)verify(source(a),a);
 mkdirSync(dirname(dest),{recursive:true,mode:0o700});mkdirSync(dest,{mode:0o700});
 try{
  for(const a of m.actions){copyFileSync(join(source(a),a.id+'.pet'),join(dest,a.id+'.pet'),constants.COPYFILE_EXCL);verify(dest,a);}
  const raw=JSON.stringify(m,null,2);writeFileSync(join(dest,'manifest.json'),raw,{flag:'wx'});
  return {directory:dest,manifest_sha256:sha256(raw),actions:m.actions.length,total_bytes:m.total_bytes,replaced:m.replaced_action_ids};
 }catch(e){rmSync(dest,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,candidates,output,digest,approval]=process.argv.slice(2);
 need(input&&candidates&&output&&digest&&approval==='--approve-color-changes','explicit_inputs_and_color_approval_required');
 console.log(JSON.stringify(mergeCandidates(input,candidates,output,{approvedCandidateSha256:digest,approveColorChanges:true})));
}
