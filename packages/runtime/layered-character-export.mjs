import {existsSync,mkdirSync,mkdtempSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {resolve,relative,join,dirname,isAbsolute,sep} from 'node:path';import {createHash} from 'node:crypto';
import {layeredRequire as need,parseLayeredJson,layeredEqual as equal} from '../core/layered-character-json.mjs';
import {layeredLimits} from '../core/layered-character-package.mjs';
import {layeredRigParts,layeredDrawOrder,layeredCanvas,layeredTouch,layeredPose,layeredProfileIds,layeredBehaviorDefaults} from '../core/layered-character-profiles.mjs';
import {layeredDirectoryRoot,readLayeredFile,verifyLayeredBundle,verifyLayeredDirectory} from './layered-character-validator.mjs';
import {decodeLayeredPng} from './layered-character-png.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value);
const faceOverrides={head:'head_clean',eyes:'eyes_open',brows:'brows_neutral',mouth:'mouth_closed',fringe_left:'fringe_left',fringe_right:'fringe_right',side_left:'side_left',side_right:'side_right',hair_cap:'hair_cap'};
const faceGroups={eyes:['open','half','closed','smile','open_edge'],brows:['neutral','relaxed','raised'],mouth:['closed','smile','small','open','round']};
const faceIds=['head_clean','eyes_open','mouth_closed','eyes_open_edge','brows_neutral','fringe_left','fringe_right','side_left','side_right','hair_cap','eyes_half','eyes_closed','eyes_smile','brows_relaxed','brows_raised','mouth_smile','mouth_small','mouth_open','mouth_round'];
const within=(parent,path)=>{const rel=relative(parent,path);return rel===''||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel));};
/** Export the current audited authoring contract into a NEW repo .cache envelope.
 * Expected source digests/license/method/identity are explicit. Original PNG bytes stay unchanged.
 * io is an optional trusted host I/O adapter for fault testing, never accepted by the CLI/package.
 * Returns only after validated package publication; errors preserve existing outputs and inputs.
 */
export function exportLayeredCharacterPackage({repoRoot,masterDirectory,masterManifestSha256,expressionDirectory,expressionManifestSha256,raisedArmDirectory,raisedArmManifestSha256,raisedArmSha256,characterId,variantId,version,licenseRef,method,output,io={writeFileSync,renameSync}}={}){
 need([masterManifestSha256,expressionManifestSha256,raisedArmManifestSha256,raisedArmSha256].every(hash),'integrity_failed');
 need([characterId,variantId,version,licenseRef].every(id)&&['synthetic','manual','ai_assisted'].includes(method),'invalid_format');
 need(io&&typeof io.writeFileSync==='function'&&typeof io.renameSync==='function','invalid_format');
 need(typeof output==='string'&&output.length>0,'invalid_reference');
 const root=layeredDirectoryRoot(repoRoot),out=resolve(root,output),segments=relative(root,out).split('/');
 need(segments[0]==='.cache'&&segments.length>=2&&segments.every(p=>p&&p!=='.'&&p!=='..'),'invalid_reference');
 const parent=layeredDirectoryRoot(dirname(out));need(!existsSync(out),'output_exists');
 const master=layeredDirectoryRoot(masterDirectory),face=layeredDirectoryRoot(expressionDirectory),raised=layeredDirectoryRoot(raisedArmDirectory);
 need(![master,face,raised].some(p=>within(p,out)||within(out,p)),'invalid_reference');
 const records=[];let inputBytes=0;
 const read=(directory,file,logicalId,expected,limit=4194304)=>{need(hash(expected),'integrity_failed',logicalId);need(inputBytes<layeredLimits.totalBytes,'resource_limit');const bytes=readLayeredFile(directory,file,Math.min(limit,layeredLimits.totalBytes-inputBytes));inputBytes+=bytes.length;need(sha(bytes)===expected,'integrity_failed',logicalId);records.push({directory,file,id:logicalId,sha256:expected,limit});return bytes;};
 const readManifest=(directory,logicalId,expected)=>parseLayeredJson(read(directory,'manifest.json',logicalId,expected,262144));
 const m=readManifest(master,'master_manifest',masterManifestSha256),f=readManifest(face,'expression_manifest',expressionManifestSha256),w=readManifest(raised,'raised_arm_manifest',raisedArmManifestSha256);
 need([m,f,w].every(v=>v&&typeof v==='object'&&!Array.isArray(v)),'invalid_format');
 need(m.license_ref===licenseRef&&f.license_ref===licenseRef&&w.license_ref===licenseRef&&equal(m.credits,f.credits)&&equal(m.credits,w.credits),'license_unresolved');
 need(f.master_manifest_sha256===masterManifestSha256&&f.source_sha256===m.source_sha256&&f.verification?.original_eye_png_unchanged===true&&w.original_master_manifest_sha256===masterManifestSha256,'integrity_failed');
 need(equal(w.canvas,[360,360])&&equal(w.root_transform,[1,0,0,1,0,0])&&w.replaced_part==='arm_right'&&equal(w.pivot_canvas_px,layeredPose.shoulder),'invalid_rig');
 const layout=parseLayeredJson(read(master,'layout.json','master_layout',m.layout_sha256,262144));
 need(layout&&typeof layout==='object'&&!Array.isArray(layout),'invalid_format');
 need(layout.version===1&&equal(layout.canvas,[360,360])&&layout.source_sha256===m.source_sha256&&equal(layout.draw_order,m.draw_order)&&equal(layout.draw_order,layeredDrawOrder),'invalid_rig');
 need(Array.isArray(layout.parts)&&layout.parts.length===21&&Array.isArray(m.parts)&&m.parts.length===21,'invalid_rig');
 const original=new Map();
 for(const [part,parentPart,pivot] of layeredRigParts){const lp=layout.parts.find(p=>p?.id===part),mp=m.parts.find(p=>p?.id===part);need(lp&&lp.parent===parentPart&&equal(lp.pivot,pivot)&&mp&&mp.file===part+'.png'&&equal(mp.canvas,[360,360])&&equal(mp.offset,[0,0])&&mp.parent===parentPart&&equal(mp.pivot,pivot),'invalid_rig');const bytes=read(master,mp.file,'master_'+part,mp.sha256);decodeLayeredPng(bytes);original.set(part,{bytes,source:'master_'+part});}
 const reference={bytes:read(master,'source.png','reference_png',m.source_sha256),source:'reference_png'};decodeLayeredPng(reference.bytes);
 need(Array.isArray(f.assets)&&f.assets.length===19&&new Set(f.assets.map(a=>a?.id)).size===19&&equal(f.overrides,faceOverrides),'invalid_reference');
 const assets=new Map();for(const assetId of faceIds){const a=f.assets.find(a=>a?.id===assetId);need(a&&a.file===assetId+'.png'&&equal(a.canvas,[360,360])&&equal(a.offset,[0,0]),'invalid_reference');const bytes=read(face,a.file,'face_'+assetId,a.sha256);decodeLayeredPng(bytes);assets.set(assetId,{bytes,source:'face_'+assetId});}
 need(sha(assets.get('eyes_open').bytes)===sha(original.get('eyes').bytes),'integrity_failed','eyes_open');
 const arm={bytes:read(raised,'arm-raised.png','raised_arm_png',raisedArmSha256),source:'raised_arm_png'};decodeLayeredPng(arm.bytes);
 const textures=new Map();
 const register=({bytes,source})=>{const digest=sha(bytes);if(!textures.has(digest))textures.set(digest,{bytes,sources:new Set()});textures.get(digest).sources.add(source);return digest;};
 const parts=layeredRigParts.map(([part,parentPart,pivot])=>({id:part,parent:parentPart,pivot:[...pivot],rest_translation:[0,0],rest_scale:[1,1],texture_id:register(faceOverrides[part]?assets.get(faceOverrides[part]):original.get(part))}));
 const faceSlots=Object.fromEntries(Object.entries(faceGroups).map(([group,states])=>[group,Object.fromEntries(states.map(state=>[state,register(assets.get(group+'_'+state))]))]));
 const rig={parts,draw_order:[...layeredDrawOrder],texture_bindings:Object.fromEntries(parts.map(p=>[p.id,p.texture_id])),face_slots:faceSlots,pose_overrides:{wave:{...structuredClone(layeredPose),down_texture_id:parts.find(p=>p.id==='arm_right').texture_id,up_texture_id:register(arm)}},touch:structuredClone(layeredTouch),reference_texture:register(reference)};
 const modifications=method==='synthetic'?'Original geometric authoring fixture; no character artwork.':'Local noncommercial layered adaptation of the existing character; clean face/hair, expressions, silent mouth shapes and raised-arm candidate. Not endorsed by the original creators.';
 const license={code_license:'MIT',artwork_license_ref:licenseRef,credits:structuredClone(m.credits),modifications};
 const sources=records.filter(r=>['master_manifest','master_layout','expression_manifest','raised_arm_manifest','reference_png','raised_arm_png'].includes(r.id)).map(r=>({id:r.id,sha256:r.sha256}));
 const documents={rig,behavior:layeredBehaviorDefaults(),provenance:{artwork_license_ref:licenseRef,credits:structuredClone(m.credits),modifications,method,sources}};
 const files=new Map();for(const [name,value] of Object.entries(documents))files.set(name+'.json',json(value));
 const descriptors=Object.keys(documents).map(name=>{const bytes=files.get(name+'.json');return {id:name,path:name+'.json',kind:'json',bytes:bytes.length,sha256:sha(bytes)};});
 for(const [digest,{bytes}] of textures){const path=`textures/${digest}.png`;files.set(path,bytes);descriptors.push({id:digest,path,kind:'png',bytes:bytes.length,sha256:digest,width:360,height:360});}
 descriptors.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const manifest={format:'dsh-layered-character',format_version:1,character_id:characterId,variant_id:variantId,version,canvas:structuredClone(layeredCanvas),entrypoints:{rig:'rig',behavior:'behavior',provenance:'provenance'},files:descriptors,requires:[...layeredProfileIds],license};
 const manifestBytes=json(manifest),manifestDigest=sha(manifestBytes),verificationOptions={expectedManifestSha256:manifestDigest,allowedArtworkLicenses:[licenseRef]};
 verifyLayeredBundle({manifestBytes,files,...verificationOptions});
 let stage=null,claimed=false,committed=false;
 try{
  stage=mkdtempSync(join(parent,'.layered-export-'));mkdirSync(join(stage,'textures'),{mode:0o700});
  for(const [path,bytes] of files)io.writeFileSync(join(stage,path),bytes,{flag:'wx',mode:0o600});io.writeFileSync(join(stage,'manifest.json'),manifestBytes,{flag:'wx',mode:0o600});
  const verification=verifyLayeredDirectory({directory:stage,...verificationOptions});
  for(const r of records)need(sha(readLayeredFile(r.directory,r.file,r.limit))===r.sha256,'integrity_failed',r.id);
  const receipt={status:'exported_validated_not_loaded',manifest_sha256:manifestDigest,verification,inputs:records.map(({id,sha256})=>({id,sha256})),textures:[...textures].sort(([a],[b])=>a<b?-1:1).map(([digest,t])=>({id:digest,sha256:digest,bytes:t.bytes.length,sources:[...t.sources].sort(),normalization:'none_original_bytes'})),bindings:{parts:rig.texture_bindings,face_slots:faceSlots,wave:rig.pose_overrides.wave,reference_texture:rig.reference_texture}};
  try{mkdirSync(out,{mode:0o700});}catch(error){if(error.code==='EEXIST'){const conflict=new Error('output_exists',{cause:error});conflict.code='output_exists';throw conflict;}throw error;}claimed=true;io.writeFileSync(join(out,'receipt.json'),json(receipt),{flag:'wx',mode:0o600});
  io.renameSync(stage,join(out,'package'));committed=true;
  return {output:relative(root,out),package_directory:relative(root,join(out,'package')),manifest_sha256:manifestDigest,verification};
 }catch(error){
  if(!committed){try{if(stage)rmSync(stage,{recursive:true,force:true});if(claimed)rmSync(out,{recursive:true,force:true});}catch(cleanupError){throw new AggregateError([error,cleanupError],'export_cleanup_failed',{cause:error});}}
  throw error;
 }
}
