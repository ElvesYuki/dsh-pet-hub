import { readFileSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MaterialCatalog, MaterialAssignments } from '../core/materials.mjs';
import { keys, requireThat } from '../core/protocol.mjs';
import { privatePath } from './paths.mjs';

export function saveMaterials(path, records) {
  const data = JSON.stringify({schemaVersion:1,records}); requireThat(Buffer.byteLength(data)<=131072,'capacity_exceeded');
  const temp = `${path}.${randomUUID()}.tmp`; let fd;
  try {
    fd = openSync(temp, 'wx', 0o600); writeFileSync(fd, data); fsyncSync(fd); closeSync(fd); fd=undefined;
    renameSync(temp,path);
  } finally {
    if(fd!==undefined) closeSync(fd);
    try { unlinkSync(temp); } catch(e) { if(e.code!=='ENOENT')throw e; }
  }
}
export function createMaterialManager(directory, profile, { save = saveMaterials } = {}) {
  const path = join(directory,'materials.simulation.json'); let records=[];
  try {
    privatePath(path,'file'); requireThat(lstatSync(path).size<=131072);
    const data=JSON.parse(readFileSync(path,'utf8')); keys(data,['schemaVersion','records']); requireThat(data.schemaVersion===1 && Array.isArray(data.records)); records=data.records;
  } catch(e) { if(e.code!=='ENOENT')throw e; }
  const catalog=new MaterialCatalog(profile.manifests), devices=new Map(profile.devices.map(d=>[d.device_id,d.caps]));
  const assignments=new MaterialAssignments(catalog,{records,persist:next=>{
    try { save(path,next); } catch { throw Object.assign(new Error('storage_failed'),{code:'storage_failed'}); }
  }});
  function view(deviceId) {
    const caps=devices.get(deviceId); requireThat(caps,'unknown_device');
    const resolved=assignments.resolve(deviceId,caps);
    const candidates=[...new Set(profile.manifests.map(m=>m.character_id))].flatMap(character=>catalog.recommend(caps,character,profile.requiredActions).candidates).filter(c=>c.manifest.package_schema!==2);
    const recommendation={candidates,recommended:candidates[0]};
    return {synthetic:true,display:caps.display,revision:resolved.revision,status:resolved.status,selection:resolved.selection,
      candidates:recommendation.candidates.map(c=>({character_id:c.manifest.character_id,variant_id:c.manifest.variant_id,manifest_sha256:c.manifest.sha256,width:c.manifest.display.width,height:c.manifest.display.height,codec:c.manifest.codec,playable:profile.hasAsset?c.manifest.actions.every(a=>profile.hasAsset(a.sha256)):false,presentation:c.presentation})),
      recommended:recommendation.recommended?.manifest.variant_id ?? null};
  }
  return {view, references() {
    let disk=[];
    try{privatePath(path,'file');requireThat(lstatSync(path).size<=131072);const data=JSON.parse(readFileSync(path,'utf8'));keys(data,['schemaVersion','records']);requireThat(data.schemaVersion===1&&Array.isArray(data.records));disk=new MaterialAssignments(catalog,{records:data.records}).records();}catch(e){if(e.code!=='ENOENT')throw e;}
    return [...new Set([...assignments.records(),...disk].map(r=>r.selection?.manifest_sha256).filter(Boolean))].sort();
  }, resolve(deviceId) { const caps=devices.get(deviceId); requireThat(caps,'unknown_device'); return {...assignments.resolve(deviceId,caps),caps}; }, confirm(input,instanceId) {
    keys(input,['service_instance_id','device_id','expected_revision','character_id','variant_id','manifest_sha256']);
    requireThat(input.service_instance_id===instanceId,'stale_session'); const caps=devices.get(input.device_id); requireThat(caps,'unknown_device');
    requireThat(catalog.get(input.character_id,input.variant_id).package_schema!==2,'activation_required');
    assignments.confirm({...input,required_actions:profile.requiredActions},caps); return view(input.device_id);
  }};
}
