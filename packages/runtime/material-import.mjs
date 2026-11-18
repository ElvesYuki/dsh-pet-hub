import {approvedProfile} from '../core/material-profile.mjs';
import {openSync,closeSync,readSync,fstatSync,lstatSync,realpathSync,constants} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {Pet4Decoder} from '../core/pet4.mjs';
import {MaterialCatalog} from '../core/materials.mjs';
import {keys,requireThat,digest} from '../core/protocol.mjs';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function manifestDigest(value) {
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return sha256(JSON.stringify(canonical(value)));
}
export function verifySim2(bytes,action,manifest) {
  if(!(bytes instanceof Uint8Array)||bytes.length!==18||sha256(bytes)!==action.sha256||bytes.length!==action.bytes)return false;
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return String.fromCharCode(...bytes.slice(0,4))==='SIM2'&&v.getUint16(4)===manifest.display.width&&v.getUint16(6)===manifest.display.height&&v.getUint32(8)===action.id&&v.getUint32(12)===1;
}
export function readRegular(root,relative,limit) {
  requireThat(typeof relative==='string'&&!isAbsolute(relative)&&relative.length<=240&&!relative.includes('\\'),'unsafe_asset_path');
  const parts=relative.split('/');requireThat(parts.every(p=>p&&p!=='.'&&p!=='..'),'unsafe_asset_path');
  let path=root;for(const p of parts){path=join(path,p);requireThat(!lstatSync(path).isSymbolicLink(),'unsafe_asset_path');}
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const stat=fstatSync(fd);requireThat(stat.isFile()&&stat.size<=limit,'asset_size_limit');
    const bytes=Buffer.allocUnsafe(stat.size);let size=0;
    while(size<bytes.length){const n=readSync(fd,bytes,size,Math.min(65536,bytes.length-size),null);requireThat(n>0,'asset_changed');size+=n;}
    requireThat(readSync(fd,Buffer.alloc(1),0,1,null)===0,'asset_changed');return bytes;
  } finally {closeSync(fd);}
}
/** Explicit trusted local import only. No browser path input and no upstream imports/execution. */
export function importMaterials({directory,indexSha256,approvedLicenses=[],approvedPet4Profiles=[]}) {
  digest(indexSha256);const root=resolve(directory);requireThat(!lstatSync(root).isSymbolicLink()&&lstatSync(root).isDirectory(),'unsafe_asset_path');
  requireThat(realpathSync(root)===root,'unsafe_asset_path');
  const raw=readRegular(root,'index.json',262144);requireThat(sha256(raw)===indexSha256,'index_integrity_failed');
  const index=JSON.parse(raw);keys(index,['schemaVersion','variants']);requireThat(index.schemaVersion===1&&Array.isArray(index.variants)&&index.variants.length>0&&index.variants.length<=32);
  const manifests=[],assets=new Map();let total=0;
  for(const entry of index.variants){
    keys(entry,['manifest','files']);const m=structuredClone(entry.manifest);keys(m,['character_id','variant_id','codec','display','actions','license_ref','package_schema','semantics','pet4_profile']);
    requireThat(approvedLicenses.includes(m.license_ref),'license_not_approved');requireThat(['SIM2','PET4'].includes(m.codec),'unsupported_asset_codec');
    m.sha256=manifestDigest(m);new MaterialCatalog([m]);approvedProfile(m,approvedPet4Profiles);
    requireThat(Array.isArray(entry.files)&&entry.files.length===m.actions.length);
    const seen=new Set();
    for(const file of entry.files){keys(file,['action_id','path']);const action=m.actions.find(a=>a.id===file.action_id);requireThat(action&&!seen.has(file.action_id));seen.add(file.action_id);
      const bytes=readRegular(root,file.path,8388608);total+=bytes.length;requireThat(total<=33554432,'catalog_size_limit');
      requireThat(bytes.length===action.bytes&&sha256(bytes)===action.sha256,'asset_integrity_failed');requireThat(verifyMaterial(bytes,action,m,{approvedPet4Profiles}),'asset_format_failed');assets.set(action.sha256,Buffer.from(bytes));
    }
    manifests.push(m);
  }
  new MaterialCatalog(manifests);
  return {manifests:structuredClone(manifests),hasAsset(hash){return assets.has(hash);},readAsset(hash){const bytes=assets.get(hash);requireThat(bytes,'unknown_asset');return new Uint8Array(bytes);}};
}

/** Full-frame validation; no frame array retained. Returns a separate on-demand player. */
export function inspectPet4(bytes,{hashes=true,player=true,profile='legacy'}={}) {
  const decoder=new Pet4Decoder(bytes,{profile}),indices=hashes?createHash('sha256'):null,rgb=hashes?createHash('sha256'):null;
  const indexBuffer=hashes?new Uint8Array(decoder.width*decoder.height):undefined,rgbBuffer=hashes||player?new Uint8Array(decoder.width*decoder.height*2):undefined;
  for(let i=0;i<decoder.frames;i++){decoder.decodeInto(i,hashes?{indices:indexBuffer,rgb565:rgbBuffer}:{});if(hashes){indices.update(indexBuffer);rgb.update(rgbBuffer);}}
  const detail={width:decoder.width,height:decoder.height,frames:decoder.frames,fps:decoder.fps,...(hashes?{index_sha256:indices.digest('hex'),rgb565_sha256:rgb.digest('hex')}:{})};
  if(!player)return detail;
  return {...detail,frame(index){decoder.decodeInto(index,{rgb565:rgbBuffer});return {frame_index:index,rgb565_sha256:sha256(rgbBuffer),width:decoder.width,height:decoder.height};},
    pixels(index){const own=new Uint8Array(decoder.width*decoder.height*2);decoder.decodeInto(index,{rgb565:own});return own;}};
}
export function verifyMaterial(bytes,action,manifest,options) {
  if(bytes.length!==action.bytes||sha256(bytes)!==action.sha256)return false;
  if(manifest.codec==='SIM2'){if(manifest.package_schema===2)requireThat(action.fps===24&&action.frames===1,'timing_mismatch');return verifySim2(bytes,action,manifest);}
  if(manifest.codec!=='PET4')return false;
  const profile=approvedProfile(manifest,options?.approvedPet4Profiles);const detail=inspectPet4(bytes,{...options,profile});
  if(manifest.package_schema===2)requireThat(detail.fps===action.fps&&detail.frames===action.frames,'timing_mismatch');
  requireThat(detail.width===manifest.display.width&&detail.height===manifest.display.height&&manifest.display.pixel_format==='RGB565','pet4_manifest_geometry');
  return detail;
}
