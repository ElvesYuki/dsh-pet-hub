import {approvedProfile} from '../core/material-profile.mjs';
import {parentPort,workerData} from 'node:worker_threads';
import {mkdirSync,lstatSync,realpathSync,openSync,closeSync,fstatSync,readSync,writeSync,fsyncSync,renameSync,rmSync,existsSync,constants,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {MaterialCatalog} from '../core/materials.mjs';
import {keys,requireThat,digest,id} from '../core/protocol.mjs';
import {readRegular,sha256,manifestDigest,verifyMaterial} from './material-import.mjs';
import {privatePath} from './paths.mjs';
import {roundPetMaterialProfile} from './round-pet-material-profiles.mjs';
import {inspectRoundPetBlob} from './round-pet-reader.mjs';
const {options,stage,store}=workerData;
const manifests=[],records=new Map(),players=new Map();let reserveResolve;let final,peakAssetBytes=0,processed=0,total=0,validatedFrames=0;
let roundPet=null;const material=options.roundPet?roundPetMaterialProfile(options.roundPet.profile):null,roundPetProofs=new Map(),blobProofs=new Map();
function sourcePath(root,relative){
 requireThat(typeof relative==='string'&&!isAbsolute(relative)&&relative.length<=240&&!relative.includes('\\'),'unsafe_asset_path');const parts=relative.split('/');requireThat(parts.every(p=>p&&p!=='.'&&p!=='..'),'unsafe_asset_path');let path=root;for(const p of parts){path=join(path,p);requireThat(!lstatSync(path).isSymbolicLink(),'unsafe_asset_path');}return path;
}
function copyAsset(source,dest,action){
 const src=openSync(source,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let out;try{
  const stat=fstatSync(src);requireThat(stat.isFile()&&stat.size===action.bytes&&stat.size<=8388608,'asset_size_limit');if(dest)out=openSync(dest,'wx',0o600);
  const block=Buffer.alloc(65536),hash=createHash('sha256');let count=0;
  for(;;){const n=readSync(src,block,0,block.length,null);if(!n)break;count+=n;requireThat(count<=action.bytes,'asset_changed');hash.update(block.subarray(0,n));let written=0;if(out!==undefined)while(written<n)written+=writeSync(out,block,written,n-written);}
  requireThat(count===action.bytes&&hash.digest('hex')===action.sha256,'asset_integrity_failed');if(out!==undefined)fsyncSync(out);
 }finally{closeSync(src);if(out!==undefined)closeSync(out);}
}
function metrics(){const m=process.memoryUsage();return {peak_asset_bytes:peakAssetBytes,retained_library_bytes:0,decoder_count:players.size,worker_heap_bytes:m.heapUsed,worker_array_buffer_bytes:m.arrayBuffers};}
async function build(){try{
 digest(options.indexSha256);requireThat(Array.isArray(options.approvedLicenses));
 const root=resolve(options.directory);requireThat(realpathSync(root)===root&&!lstatSync(root).isSymbolicLink()&&lstatSync(root).isDirectory(),'unsafe_asset_path');
 if(options.roundPet){
  roundPet=material.fromRecord(options.roundPet.record,options.roundPet.approval);
  if(!options.cachedOnly)requireThat(material.recordText(material.readSource(root,options.roundPet.approval))===material.recordText(roundPet),'source_manifest_changed');
 }
 const raw=roundPet&&!options.cachedOnly?Buffer.from(roundPet.indexText):readRegular(root,'index.json',262144);requireThat(sha256(raw)===options.indexSha256&&(!roundPet||raw.equals(Buffer.from(roundPet.indexText))),'index_integrity_failed');const index=JSON.parse(raw);keys(index,['schemaVersion','variants']);requireThat(index.schemaVersion===1&&Array.isArray(index.variants)&&index.variants.length>0&&index.variants.length<=32);
 final=join(store,options.indexSha256);const cached=existsSync(final);if(options.cachedOnly)requireThat(cached&&root===final,'unknown_version');if(cached){privatePath(final,'directory');privatePath(join(final,'blobs'),'directory');}
 // Preflight all metadata before reserving disk or copying a single asset.
 const planned=index.variants.map(entry=>{
   keys(entry,['manifest','files']);const m=structuredClone(entry.manifest);keys(m,['character_id','variant_id','codec','display','actions','license_ref','package_schema','semantics','pet4_profile']);
   requireThat(options.approvedLicenses.includes(m.license_ref),'license_not_approved');requireThat(['PET4','SIM2'].includes(m.codec),'unsupported_asset_codec');m.sha256=manifestDigest(m);new MaterialCatalog([m]);approvedProfile(m,options.approvedPet4Profiles);
   requireThat(Array.isArray(entry.files)&&entry.files.length===m.actions.length);const seen=new Set();for(const f of entry.files){keys(f,['action_id','path']);const a=m.actions.find(a=>a.id===f.action_id);requireThat(a&&!seen.has(a.id));seen.add(a.id);if(!options.cachedOnly)sourcePath(root,f.path);}
   return m;
 });new MaterialCatalog(planned);
 const descriptor=JSON.stringify({schemaVersion:1,index_sha256:options.indexSha256,manifests:planned});
 if(options.cachedOnly)requireThat(existsSync(join(final,'version.json')),'unknown_metadata');
 const unique=new Map();let declared=0;for(const m of planned)for(const a of m.actions){declared+=a.bytes;requireThat(a.bytes<=8388608&&declared<=536870912,'catalog_disk_limit');requireThat(!unique.has(a.sha256)||unique.get(a.sha256)===a.bytes,'invalid_asset_metadata');unique.set(a.sha256,a.bytes);}
 const metadataBytes=Buffer.byteLength(descriptor)+raw.length;
 let reservation=[...unique.values()].reduce((n,v)=>n+v,0)+metadataBytes;
 if(cached){
   for(const [file,expected] of [['index.json',raw],['version.json',Buffer.from(descriptor)]])if(existsSync(join(final,file))){privatePath(join(final,file),'file');requireThat(readRegular(final,file,file==='index.json'?262144:1048576).equals(expected),'unknown_metadata');}
   reservation=(existsSync(join(final,'index.json'))?0:raw.length)+(existsSync(join(final,'version.json'))?0:Buffer.byteLength(descriptor));
 }
 const admitted=new Promise(resolve=>{reserveResolve=resolve;});parentPort.postMessage({type:'reserve',bytes:reservation});const approval=await admitted;requireThat(approval.approved,approval.error??'quota_exceeded');
 mkdirSync(join(stage,'blobs'),{mode:0o700});
 const progress={phase:'validating',validated_assets:0,validated_bytes:0};parentPort.postMessage({type:'progress',...progress});
 for(const entry of index.variants){
  keys(entry,['manifest','files']);const m=structuredClone(entry.manifest);keys(m,['character_id','variant_id','codec','display','actions','license_ref','package_schema','semantics','pet4_profile']);requireThat(options.approvedLicenses.includes(m.license_ref),'license_not_approved');requireThat(['PET4','SIM2'].includes(m.codec),'unsupported_asset_codec');
  m.sha256=manifestDigest(m);new MaterialCatalog([m]);approvedProfile(m,options.approvedPet4Profiles);requireThat(Array.isArray(entry.files)&&entry.files.length===m.actions.length);const seen=new Set();
  for(const file of entry.files){
   keys(file,['action_id','path']);const a=m.actions.find(a=>a.id===file.action_id);requireThat(a&&!seen.has(a.id));seen.add(a.id);digest(a.sha256);requireThat(a.bytes<=8388608,'asset_size_limit');total+=a.bytes;requireThat(total<=536870912,'catalog_disk_limit');
   const source=options.cachedOnly?null:sourcePath(root,file.path),target=join(cached?final:stage,'blobs',a.sha256);
   if(cached){privatePath(target,'file');if(roundPet&&!options.cachedOnly)copyAsset(source,null,a);}
   else if(!existsSync(target))copyAsset(source,target,a);else if(roundPet)copyAsset(source,null,a);
   let proof,assetBytes;
   if(roundPet){
    const timing=roundPet.package.content.timing.find(t=>t.id===a.id),known=roundPetProofs.get(a.sha256),result=inspectRoundPetBlob(target,a.bytes,bytes=>{
     if(known){requireThat(bytes.length===a.bytes&&sha256(bytes)===a.sha256,'asset_integrity_failed');material.matchTiming(known,timing);return known;}
     const detail=material.verifyAsset(bytes,a,timing);roundPetProofs.set(a.sha256,detail);return detail;
    });proof=result.detail;blobProofs.set(a.sha256,result.fingerprint);assetBytes=a.bytes;
   }else{const bytes=readRegular(cached?final:stage,`blobs/${a.sha256}`,8388608);proof=verifyMaterial(bytes,a,m,{hashes:false,player:false,approvedPet4Profiles:options.approvedPet4Profiles});assetBytes=bytes.length;}
   requireThat(proof,'asset_integrity_failed');validatedFrames+=proof.frames??1;peakAssetBytes=Math.max(peakAssetBytes,assetBytes);
   records.set(`${m.sha256}:${a.id}`,{action:a,manifest:m});processed++;
   parentPort.postMessage({type:'progress',phase:'validating',validated_assets:processed,validated_bytes:total,validated_frames:validatedFrames,...metrics()});
  }
  manifests.push(m);
 }
 new MaterialCatalog(manifests);
 if(roundPet&&!options.cachedOnly)requireThat(material.recordText(material.readSource(root,options.roundPet.approval))===material.recordText(roundPet),'source_manifest_changed');
 else requireThat(sha256(readRegular(root,'index.json',262144))===options.indexSha256,'index_integrity_failed');
 for(const [file,data] of [['index.json',raw],['version.json',descriptor]]){const target=join(cached?final:stage,file);if(!existsSync(target)){const fd=openSync(target,'wx',0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}}
 if(cached)rmSync(stage,{recursive:true,force:true});else renameSync(stage,final);
 parentPort.postMessage({type:'ready',manifests,...(roundPet?{blob_proofs:Object.fromEntries(blobProofs)}:{}),...metrics()});
}catch(e){rmSync(stage,{recursive:true,force:true});parentPort.postMessage({type:'failed',error:e.code??'import_failed'});}}
parentPort.on('message',message=>{
 if(message.type==='reservation'){reserveResolve?.(message);return;}
 const {requestId,op,deviceId,token}=message;
 try{
  id(deviceId);let result;
  if(op==='release'){players.delete(deviceId);result=true;}
  else if(op==='prepare'){
   const record=records.get(`${message.manifestSha}:${message.actionId}`);requireThat(record&&record.action.sha256===message.hash,'unknown_asset');
   requireThat(players.has(deviceId)||players.size<2,'capacity_exceeded');players.delete(deviceId);
   privatePath(join(final,'blobs',message.hash),'file');const bytes=readRegular(final,`blobs/${message.hash}`,8388608);peakAssetBytes=Math.max(peakAssetBytes,bytes.length);
   const proof=roundPet?material.verifyAsset(bytes,record.action,roundPet.package.content.timing.find(t=>t.id===record.action.id),{player:true}):verifyMaterial(bytes,record.action,record.manifest,{hashes:false,approvedPet4Profiles:options.approvedPet4Profiles});requireThat(proof,'asset_integrity_failed');players.set(deviceId,{token,proof});
   result=typeof proof.frame==='function'?{frames:proof.frames,fps:proof.fps}:record.manifest.package_schema===2?{frames:1,fps:24}:true;
  }else if(op==='pixels'){
   const p=players.get(deviceId);requireThat(p&&p.token===token,'stale_player');requireThat(typeof p.proof.pixels==='function','pixels_unavailable');
   const rgb=p.proof.pixels(message.frameIndex);requireThat(rgb.length<=400*400*2,'preview_size_limit');
   parentPort.postMessage({type:'reply',requestId,result:rgb,...metrics()},[rgb.buffer]);return;
  }else if(op==='frame'){
   const p=players.get(deviceId);requireThat(p&&p.token===token,'stale_player');if(p.proof===true){requireThat(message.frameIndex===0,'invalid_frame');result={frame_index:0,synthetic_sample:true};}else result=p.proof.frame(message.frameIndex);
  }else throw new Error('invalid_operation');
  parentPort.postMessage({type:'reply',requestId,result,...metrics()});
 }catch(e){parentPort.postMessage({type:'reply',requestId,error:e.code??'decode_failed',...metrics()});}
});

void build();
