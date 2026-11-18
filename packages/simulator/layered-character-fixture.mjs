import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {crc32} from '../core/pet4.mjs';
import {layeredRigParts,layeredDrawOrder,layeredCanvas,layeredTouch,layeredPose,layeredProfileIds,layeredBehaviorDefaults} from '../core/layered-character-profiles.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export const layeredJsonBytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
export function layeredPngChunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;}
/** Original geometric test texture, no character art. filter selects standard PNG row filters 0–4. */
export function syntheticLayeredPng({filter=0}={}){
 const rgba=Buffer.alloc(518400);for(let y=60;y<300;y++)for(let x=100;x<260;x++)rgba.set([x%256,y%256,90,255],(y*360+x)*4);
 const rows=Buffer.alloc(518760),paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<360;y++){rows[y*1441]=filter;for(let i=0;i<1440;i++){const v=rgba[y*1440+i],a=i>=4?rgba[y*1440+i-4]:0,b=y?rgba[(y-1)*1440+i]:0,c=y&&i>=4?rgba[(y-1)*1440+i-4]:0,predict=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);rows[y*1441+i+1]=(v-predict)&255;}}
 const header=Buffer.alloc(13);header.writeUInt32BE(360);header.writeUInt32BE(360,4);header[8]=8;header[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),layeredPngChunk('IHDR',header),layeredPngChunk('IDAT',deflateSync(rows)),layeredPngChunk('IEND',Buffer.alloc(0))]);return {png,rgba};
}
/** In-memory complete contract fixture. A single shared geometric texture intentionally exercises dedup. */
export function createLayeredFixture(){
 const texture=syntheticLayeredPng().png,sha=hash(texture),id='geometry',files=new Map([[`textures/${sha}.png`,texture]]);
 const license={code_license:'MIT',artwork_license_ref:'synthetic-mit',credits:['dsh-pet-hub synthetic fixture'],modifications:'Original geometric fixture, no character artwork.'};
 const rig={parts:layeredRigParts.map(([part,parent,pivot])=>({id:part,parent,pivot:[...pivot],rest_translation:[0,0],rest_scale:[1,1],texture_id:id})),draw_order:[...layeredDrawOrder],texture_bindings:Object.fromEntries(layeredRigParts.map(([part])=>[part,id])),face_slots:{eyes:Object.fromEntries(['open','half','closed','smile','open_edge'].map(k=>[k,id])),brows:Object.fromEntries(['neutral','relaxed','raised'].map(k=>[k,id])),mouth:Object.fromEntries(['closed','smile','small','open','round'].map(k=>[k,id]))},pose_overrides:{wave:{...structuredClone(layeredPose),down_texture_id:id,up_texture_id:id}},touch:structuredClone(layeredTouch),reference_texture:id};
 const behavior=layeredBehaviorDefaults(),provenance={artwork_license_ref:license.artwork_license_ref,credits:[...license.credits],modifications:license.modifications,method:'synthetic',sources:[{id:'original_geometry',sha256:sha}]};
 for(const [name,value] of Object.entries({rig,behavior,provenance}))files.set(name+'.json',layeredJsonBytes(value));
 const manifest={format:'dsh-layered-character',format_version:1,character_id:'synthetic',variant_id:'native360',version:'v1',canvas:structuredClone(layeredCanvas),entrypoints:{rig:'rig',behavior:'behavior',provenance:'provenance'},files:[{id,path:`textures/${sha}.png`,kind:'png',bytes:texture.length,sha256:sha,width:360,height:360},...['rig','behavior','provenance'].map(id=>{const b=files.get(id+'.json');return {id,path:id+'.json',kind:'json',bytes:b.length,sha256:hash(b)};})].sort((a,b)=>a.id.localeCompare(b.id)),requires:[...layeredProfileIds],license};
 return {manifest,rig,behavior,provenance,files};
}
/** Rebuild JSON bytes and integrity descriptors after an intentional negative-test document edit. */
export function sealLayeredFixture(fixture){
 for(const id of ['rig','behavior','provenance']){const b=layeredJsonBytes(fixture[id]);fixture.files.set(id+'.json',b);const f=fixture.manifest.files.find(f=>f.id===id);f.bytes=b.length;f.sha256=hash(b);}
 const manifestBytes=layeredJsonBytes(fixture.manifest);return {manifestBytes,files:fixture.files,expectedManifestSha256:hash(manifestBytes),allowedArtworkLicenses:['synthetic-mit']};
}
