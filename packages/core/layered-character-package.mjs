import {layeredRequire as need,layeredKeys as keys,layeredEqual as equal} from './layered-character-json.mjs';
import {layeredProfileIds,layeredBehaviorBaseline,layeredRigParts,layeredDrawOrder,layeredCanvas,layeredTouch,layeredPose} from './layered-character-profiles.mjs';
export const layeredLimits=Object.freeze({json:262144,dataJson:524288,files:72,textures:64,textureBytes:4194304,totalBytes:67108864,decodedBytes:33554432});
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const strings=(v,max=16)=>Array.isArray(v)&&v.length>0&&v.length<=max&&v.every(s=>text(s,128))&&new Set(v).size===v.length;
/** Metadata-only manifest validation; binary integrity and PNG decoding are separate runtime checks. */
export function validateLayeredManifest(m,{supportedProfiles=layeredProfileIds,allowedArtworkLicenses=[]}={}){
 keys(m,['format','format_version','character_id','variant_id','version','canvas','entrypoints','files','requires','license']);
 need(m.format==='dsh-layered-character'&&m.format_version===1,'invalid_format');
 need([m.character_id,m.variant_id,m.version].every(identifier));need(equal(m.canvas,layeredCanvas),'invalid_rig');
 keys(m.entrypoints,['rig','behavior','provenance']);need(equal(m.entrypoints,{rig:'rig',behavior:'behavior',provenance:'provenance'}),'invalid_reference');
 need(Array.isArray(supportedProfiles)&&supportedProfiles.length<=64&&Array.isArray(m.requires)&&m.requires.length===layeredProfileIds.length&&new Set(m.requires).size===m.requires.length&&m.requires.every(id=>layeredProfileIds.includes(id)&&supportedProfiles.includes(id)),'unsupported_profile');
 keys(m.license,['code_license','artwork_license_ref','credits','modifications'],'license_unresolved');
 need(Array.isArray(allowedArtworkLicenses)&&allowedArtworkLicenses.length<=64&&m.license.code_license==='MIT'&&identifier(m.license.artwork_license_ref)&&allowedArtworkLicenses.includes(m.license.artwork_license_ref)&&strings(m.license.credits)&&text(m.license.modifications,2048),'license_unresolved');
 need(Array.isArray(m.files)&&m.files.length>=4&&m.files.length<=layeredLimits.files,'resource_limit');
 const ids=new Set(),paths=new Set(),textureHashes=new Set();let total=0,jsonTotal=0,textures=0;
 for(const f of m.files){
  need(f!==null&&typeof f==='object'&&!Array.isArray(f));
  keys(f,f.kind==='png'?['id','path','kind','bytes','sha256','width','height']:['id','path','kind','bytes','sha256']);
  need(identifier(f.id)&&!ids.has(f.id)&&typeof f.path==='string'&&!paths.has(f.path),'invalid_reference');ids.add(f.id);paths.add(f.path);
  need(digest(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0);total+=f.bytes;need(total<=layeredLimits.totalBytes,'resource_limit');
  if(f.kind==='png'){
   need(f.path===`textures/${f.sha256}.png`&&!textureHashes.has(f.sha256),'invalid_reference');textureHashes.add(f.sha256);textures++;
   need(f.width===360&&f.height===360,'invalid_texture');need(f.bytes<=layeredLimits.textureBytes&&textures<=layeredLimits.textures,'resource_limit');
  }else{
   need(f.kind==='json'&&['rig','behavior','provenance'].includes(f.id)&&f.path===f.id+'.json','invalid_reference');
   jsonTotal+=f.bytes;need(f.bytes<=layeredLimits.json&&jsonTotal<=layeredLimits.dataJson,'resource_limit');
  }
 }
 need(['rig.json','behavior.json','provenance.json'].every(p=>paths.has(p)),'invalid_reference');
 const decoded=textures*360*360*4;need(decoded<=layeredLimits.decodedBytes,'resource_limit');
 return {texture_count:textures,declared_bytes:total,decoded_rgba_bytes:decoded};
}
/** Complete v1 document contract, without filesystem, hashing, DOM or executable profiles. */
export function validateLayeredDocuments(m,rig,behavior,provenance,options){
 const stats=validateLayeredManifest(m,options),textures=new Set(m.files.filter(f=>f.kind==='png').map(f=>f.id)),used=new Set();
 const texture=id=>{need(textures.has(id),'invalid_reference');used.add(id);};
 keys(rig,['parts','draw_order','texture_bindings','face_slots','pose_overrides','touch','reference_texture'],'invalid_rig');
 need(Array.isArray(rig.parts)&&rig.parts.length===21,'invalid_rig');const parts=new Map();
 for(const p of rig.parts){keys(p,['id','parent','pivot','rest_translation','rest_scale','texture_id'],'invalid_rig');need(identifier(p.id)&&!parts.has(p.id),'invalid_rig');parts.set(p.id,p);texture(p.texture_id);}
 for(const p of rig.parts){const seen=new Set();let node=p;while(node){need(!seen.has(node.id),'invalid_rig');seen.add(node.id);if(node.parent===null)break;need(parts.has(node.parent),'invalid_rig');node=parts.get(node.parent);}}
 for(const [id,parent,pivot] of layeredRigParts){const p=parts.get(id);need(p&&p.parent===parent&&equal(p.pivot,pivot)&&equal(p.rest_translation,[0,0])&&equal(p.rest_scale,[1,1]),'invalid_rig');}
 need(equal(rig.draw_order,layeredDrawOrder)&&equal(rig.touch,layeredTouch),'invalid_rig');
 keys(rig.texture_bindings,layeredRigParts.map(p=>p[0]),'invalid_reference');for(const [id,resource] of Object.entries(rig.texture_bindings))need(parts.get(id)?.texture_id===resource,'invalid_reference');
 keys(rig.face_slots,['eyes','brows','mouth'],'invalid_reference');
 for(const [group,states] of Object.entries({eyes:['open','half','closed','smile','open_edge'],brows:['neutral','relaxed','raised'],mouth:['closed','smile','small','open','round']})){keys(rig.face_slots[group],states,'invalid_reference');Object.values(rig.face_slots[group]).forEach(texture);}
 need(rig.face_slots.eyes.open===parts.get('eyes').texture_id&&rig.face_slots.brows.neutral===parts.get('brows').texture_id&&rig.face_slots.mouth.closed===parts.get('mouth').texture_id,'invalid_reference');
 keys(rig.pose_overrides,['wave'],'invalid_rig');const wave=rig.pose_overrides.wave;keys(wave,[...Object.keys(layeredPose),'down_texture_id','up_texture_id'],'invalid_rig');
 need(Object.entries(layeredPose).every(([k,v])=>equal(wave[k],v))&&wave.down_texture_id===parts.get('arm_right').texture_id,'invalid_rig');texture(wave.down_texture_id);texture(wave.up_texture_id);texture(rig.reference_texture);
 need(used.size===textures.size,'invalid_reference');
 need(equal(behavior,layeredBehaviorBaseline),'unsupported_profile');
 keys(provenance,['artwork_license_ref','credits','modifications','method','sources'],'license_unresolved');
 need(provenance.artwork_license_ref===m.license.artwork_license_ref&&equal(provenance.credits,m.license.credits)&&provenance.modifications===m.license.modifications&&['synthetic','manual','ai_assisted'].includes(provenance.method),'license_unresolved');
 need(Array.isArray(provenance.sources)&&provenance.sources.length>0&&provenance.sources.length<=16,'license_unresolved');const sourceIds=new Set();
 for(const s of provenance.sources){keys(s,['id','sha256'],'license_unresolved');need(identifier(s.id)&&!sourceIds.has(s.id)&&digest(s.sha256),'license_unresolved');sourceIds.add(s.id);}
 return {...stats,profile_count:layeredProfileIds.length,parts:parts.size};
}
