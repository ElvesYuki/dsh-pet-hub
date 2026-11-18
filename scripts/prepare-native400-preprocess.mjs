import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,readSync,writeSync,rmSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {Pet4Decoder} from '../packages/core/pet4.mjs';import {makePalette,to565,rgb565} from '../packages/core/pet4-encode.mjs';
import {outputPath} from './prepare-native400-review.mjs';import {cropRgba400,decodeSource} from './prepare-native400-samples.mjs';
import {preprocessFrame,PREPROCESS_TIERS,summarizePreprocess} from './native400-preprocess.mjs';import {preprocessPage} from './native400-preprocess-page.mjs';
const BASE_SHA='db185f3020000b1bea6d1bd380ba39bfc8f0ab24e9fd3d1a6a29b87160769ca8',IDS=[0,48,67,3],PROFILE='native400-candidate-v1';
const RGB=Array.from({length:65536},(_,i)=>rgb565(i)),need=(v,s)=>{if(!v)throw new Error(s);},digest=()=>createHash('sha256');
function writeAll(fd,b){let at=0;while(at<b.length){const n=writeSync(fd,b,at,b.length-at);need(n>0,'short_write');at+=n;}}
function readFrame(fd,index){const b=Buffer.alloc(480000);let at=0;while(at<b.length){const n=readSync(fd,b,at,b.length-at,index*b.length+at);need(n>0,'short_frame');at+=n;}return b;}
function validateBaseline(root,m){for(const a of m.actions){const b=readRegular(root,a.id+'.pet',8388608);need(b.length===a.bytes&&sha256(b)===a.sha256,'baseline_changed');}}

/** Write only experiment metadata/HTML/CSV; overwrite is reserved for regenerating this newly produced review. */
export function writePreprocessReport(directory,manifest,{overwrite=false}={}){
 const dest=resolve(directory);need(dest.startsWith(resolve('.cache')+'/')&&manifest.schema==='native400-preprocess-review/1'&&manifest.baseline_manifest_sha256===BASE_SHA&&manifest.validation?.all_frames_crc_and_pixel_hashes===true,'validated_cache_experiment_required');
 manifest.summary=summarizePreprocess(manifest);
 const csvCell=v=>'"'+String(v).replaceAll('"','""')+'"',rows=[['action_id','name','tier','frames','fps','baseline_bytes','candidate_bytes','bytes_saved','saved_percent','within_legacy_limit','palette_colors','additional_max_channel_error','peak_error_frame','sha256']];
 for(const a of manifest.actions)for(const v of a.variants)rows.push([a.id,a.name,v.label,a.frames,a.fps,a.baseline.bytes,v.bytes,v.bytes_saved,v.saved_percent.toFixed(6),v.within_legacy_limit,v.actual_palette_colors,v.additional_max_channel_error,v.peak_error_frame??'',v.sha256]);
 for(const [name,contents] of [['summary.csv','\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'],['summary.json',JSON.stringify(manifest.summary,null,2)],['manifest.json',JSON.stringify(manifest,null,2)],['index.html',preprocessPage(manifest)]])writeFileSync(join(dest,name),contents,{flag:overwrite?'w':'wx'});
 return manifest.summary;
}
function verifyVariant(baseBytes,bytes,record,sourceFile){
 const base=new Pet4Decoder(baseBytes,{profile:PROFILE}),candidate=new Pet4Decoder(bytes,{profile:PROFILE});need(base.frames===record.frames&&candidate.frames===record.frames&&candidate.fps===24,'timing_changed');
 const ih=digest(),rh=digest(),baseIndex=digest(),baseRgb=digest(),error=[0,0,0],sourceError=[0,0,0],baseSourceError=[0,0,0];
 let changed=0,foreground=0,sourceForeground=0,maxError=0,worstFrame=0,worstMean=-1;const fd=openSync(sourceFile,'r');
 try{for(let f=0;f<record.frames;f++){
  const a=base.decode(f),b=candidate.decode(f),source=readFrame(fd,f);ih.update(b.indices);rh.update(b.rgb565);baseIndex.update(a.indices);baseRgb.update(a.rgb565);let frameSum=0,frameForeground=0;
  for(let p=0;p<160000;p++){
   const old=a.rgb565[2*p]|a.rgb565[2*p+1]<<8,now=b.rgb565[2*p]|b.rgb565[2*p+1]<<8,s=3*p,sourceBlack=(source[s]|source[s+1]|source[s+2])===0;
   if(sourceBlack)need(now===0,'source_black_changed');else sourceForeground++;
   if(old||now){foreground++;frameForeground++;}if(old!==now)changed++;
   const ar=RGB[old],br=RGB[now];for(let c=0;c<3;c++){
    const e=Math.abs(ar[c]-br[c]);error[c]+=e;frameSum+=e;maxError=Math.max(maxError,e);
    if(!sourceBlack){sourceError[c]+=Math.abs(source[s+c]-br[c]);baseSourceError[c]+=Math.abs(source[s+c]-ar[c]);}
   }
  }
  const mean=frameSum/Math.max(1,frameForeground);if(mean>worstMean){worstMean=mean;worstFrame=f;}
 }}finally{closeSync(fd);}
 const ihash=ih.digest('hex'),rhash=rh.digest('hex');need(ihash===record.index_sha256&&rhash===record.expected_rgb565_sha256,'candidate_pixel_hash');
 need(baseIndex.digest('hex')===record.base_index_sha256&&baseRgb.digest('hex')===record.base_rgb565_sha256,'baseline_pixel_hash');
 for(const f of [record.frames-1,0,Math.min(12,record.frames-1),Math.floor(record.frames/2),record.frames-1])candidate.decode(f);
 return {index_sha256:ihash,rgb565_sha256:rhash,additional_foreground_mae_rgb:error.map(n=>n/Math.max(1,foreground)),additional_max_channel_error:maxError,changed_foreground_fraction:changed/Math.max(1,foreground),source_foreground_mae_rgb:sourceError.map(n=>n/Math.max(1,sourceForeground)),base_source_foreground_mae_rgb:baseSourceError.map(n=>n/Math.max(1,sourceForeground)),worst_error_frame:worstFrame,verification:'independent_js_all_frames_crc_index_rgb565_size_sha_seeks_and_source_black'};
}

/** Generate only a new cache experiment. Original library is hash-checked before and after; no device/runtime writes. */
export async function preparePreprocess(input,review,output,library,{actionIds=IDS,tierKeys=PREPROCESS_TIERS.map(t=>t.key)}={}){
 need(Array.isArray(actionIds)&&actionIds.length>0&&actionIds.length<=78&&new Set(actionIds).size===actionIds.length&&actionIds.every(id=>Number.isInteger(id)&&id>=0&&id<78),'experiment_action_ids');
 need(Array.isArray(tierKeys)&&tierKeys.length>0&&new Set(tierKeys).size===tierKeys.length&&tierKeys.every(k=>PREPROCESS_TIERS.some(t=>t.key===k)),'experiment_tiers');
 const tiers=tierKeys.map(k=>PREPROCESS_TIERS.find(t=>t.key===k));
 const root=resolve(input),sourceRoot=resolve(review),raw=readRegular(root,'manifest.json',1048576),base=JSON.parse(raw);
 need(sha256(raw)===BASE_SHA&&base.profile===PROFILE&&base.license_ref==='dsh-pet-nc-86181ce'&&base.actions.length===78,'frozen_baseline');validateBaseline(root,base);
 const reviewManifest=JSON.parse(readRegular(sourceRoot,'review-data.json',1048576));need(reviewManifest.catalog_sha256===base.catalog_sha256,'source_catalog');
 for(const id of actionIds){const a=base.actions.find(a=>a.id===id),s=reviewManifest.actions.find(a=>a.id===id);need(s&&s.source_sha256===a.source_sha256&&s.frame_count===a.frames&&a.frames===(id===42?118:241)&&s.fps==='24/1'&&sha256(readRegular(sourceRoot,`media/${id}.webm`,67108864))===a.source_sha256,'source_identity');}
 const dest=outputPath(process.cwd(),output);mkdirSync(dest,{recursive:true,mode:0o700});mkdirSync(join(dest,'media'),{mode:0o700});
 const manifest={schema:'native400-preprocess-review/1',status:'lossy_experiments_visual_review_pending_not_merged',baseline_manifest_sha256:BASE_SHA,profile:PROFILE,license_ref:base.license_ref,geometry:base.geometry,tiers,comparison:'actual PET4 bytes vs approved merged baseline; RGB errors additionally vs original cropped source',actions:[]};
 const saveProgress=()=>writeFileSync(join(dest,'progress.json'),JSON.stringify(manifest,null,2));
 for(const id of actionIds){
  const original=base.actions.find(a=>a.id===id),baseBytes=readRegular(root,id+'.pet',8388608),paletteColors=new Set(Array.from({length:256},(_,i)=>baseBytes.readUInt16LE(12+2*i))).size;
  console.log('SOURCE',id,original.name,'baseline',original.bytes,'colors',paletteColors);
  const sourceFile=join(dest,`.source-${id}.rgb`),sfd=openSync(sourceFile,'wx');let count;
  try{count=await decodeSource(join(sourceRoot,`media/${id}.webm`),rgba=>writeAll(sfd,cropRgba400(rgba)));}finally{closeSync(sfd);}need(count===original.frames,'source_frames');
  copyFileSync(join(root,id+'.pet'),join(dest,`${id}-base.pet`));
  writeFileSync(join(dest,'media',`${id}-base.js`),`window.__n400Register(${JSON.stringify(id+'-base')},${JSON.stringify(baseBytes.toString('base64'))});`);
  const action={id,name:original.name,frames:original.frames,fps:24,source_sha256:original.source_sha256,baseline:{bytes:baseBytes.length,sha256:original.sha256,index_sha256:original.index_sha256,rgb565_sha256:original.rgb565_sha256,palette_colors:paletteColors},variants:[]};
  for(const tier of tiers){
   const key=id+'-'+tier.key,maxColors=Math.max(2,Math.min(tier.colorCap,Math.floor(paletteColors*tier.colorRatio))),filtered=join(dest,`.filtered-${key}.rgb`),ffd=openSync(filtered,'wx'),sourceFd=openSync(sourceFile,'r'),hist=new Uint32Array(65536);let previous=null;
   try{for(let f=0;f<original.frames;f++){const pixels=preprocessFrame(readFrame(sourceFd,f),tier,previous);writeAll(ffd,pixels);for(let p=0;p<480000;p+=3)hist[to565(pixels[p],pixels[p+1],pixels[p+2])]++;previous=pixels;}}finally{closeSync(ffd);closeSync(sourceFd);}
   const {palette,lookup}=makePalette(hist,{maxColors}),indicesFile=`.indices-${key}.raw`,ifd=openSync(join(dest,indicesFile),'wx'),filteredFd=openSync(filtered,'r'),ih=digest(),rh=digest();
   try{for(let f=0;f<original.frames;f++){const rgb=readFrame(filteredFd,f),indices=Buffer.alloc(160000),pixels=Buffer.alloc(320000);for(let p=0;p<160000;p++){const s=3*p,k=lookup[to565(rgb[s],rgb[s+1],rgb[s+2])];indices[p]=k;pixels.writeUInt16LE(palette[k],2*p);}ih.update(indices);rh.update(pixels);writeAll(ifd,indices);}}finally{closeSync(ifd);closeSync(filteredFd);}
   const expectedRgb=rh.digest('hex'),jobFile=join(dest,`.job-${key}.json`),resultFile=`.encoded-${key}.json`,outFile=key+'.pet';
   writeFileSync(jobFile,JSON.stringify({frames:original.frames,palette:Array.from(palette),indices_file:indicesFile,index_sha256:ih.digest('hex'),output_file:outFile,result_file:resultFile}),{flag:'wx'});
   console.log('ENCODE',key,'spatial',tier.spatial,'temporal',tier.temporal,'colors',maxColors);
   const r=spawnSync('python3',['-B','scripts/encode-native400-preprocess.py','--job',jobFile,'--library',library],{stdio:'inherit'});need(r.status===0,'hc12_encode_failed');
   const encoded=JSON.parse(readFileSync(join(dest,resultFile))),bytes=readRegular(dest,outFile,16777216);need(bytes.length===encoded.bytes&&sha256(bytes)===encoded.sha256,'encoded_integrity');
   const proof=verifyVariant(baseBytes,bytes,{...encoded,frames:original.frames,expected_rgb565_sha256:expectedRgb,base_index_sha256:original.index_sha256,base_rgb565_sha256:original.rgb565_sha256},sourceFile);
   const record={key:tier.key,label:tier.label,recipe:'source400-flat-smoothing-bounded-temporal-palette-hc12-v1',parameters:{spatial:tier.spatial,temporal:tier.temporal,max_colors:maxColors},actual_palette_colors:new Set(palette).size,...encoded,...proof,bytes_saved:baseBytes.length-bytes.length,saved_percent:100*(baseBytes.length-bytes.length)/baseBytes.length,within_legacy_limit:bytes.length<=5865472};action.variants.push(record);
   writeFileSync(join(dest,'media',key+'.js'),`window.__n400Register(${JSON.stringify(key)},${JSON.stringify(bytes.toString('base64'))});`);
   for(const file of [filtered,join(dest,indicesFile),jobFile,join(dest,resultFile)])rmSync(file);
   console.log('VERIFIED',key,bytes.length,'saved',record.saved_percent.toFixed(2)+'%','foreground error',proof.additional_foreground_mae_rgb.map(n=>n.toFixed(3)).join('/'));saveProgress();
  }
  manifest.actions.push(action);rmSync(sourceFile);saveProgress();
 }
 validateBaseline(root,base);need(sha256(readRegular(root,'manifest.json',1048576))===BASE_SHA,'baseline_manifest_changed');
 manifest.validation={actions:manifest.actions.length,variants:manifest.actions.reduce((n,a)=>n+a.variants.length,0),candidate_frames:manifest.actions.reduce((n,a)=>n+a.frames*a.variants.length,0),baseline_files_unchanged:78,all_frames_crc_and_pixel_hashes:true,not_merged:true};
 writePreprocessReport(dest,manifest);rmSync(join(dest,'progress.json'));
 return {directory:dest,actions:manifest.validation.actions,variants:manifest.validation.variants,frames:manifest.validation.candidate_frames};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){need([6,7].includes(process.argv.length)&&(!process.argv[6]||process.argv[6]==='all-compact'),'baseline_review_new_output_library_and_optional_all_compact_required');console.log(await preparePreprocess(...process.argv.slice(2,6),process.argv[6]?{actionIds:Array.from({length:78},(_,i)=>i),tierKeys:['compact']}:{}));}
