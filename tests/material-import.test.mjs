import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,symlinkSync,truncateSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {materialDirectory} from '../packages/simulator/material-fixture.mjs';
import {importMaterials,sha256,verifySim2} from '../packages/runtime/material-import.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {createSimulation} from '../packages/simulator/session.mjs';
import {MaterialPlayback} from '../packages/core/material-playback.mjs';
function fixture(t){const root=realpathSync(mkdtempSync(join(tmpdir(),'imp-')));t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,...materialDirectory(join(root,'assets'))};}
const error=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('import: pinned index, per-file bytes and canonical metadata; verified snapshots cannot mutate',t=>{
 const f=fixture(t),bundle=importMaterials(f.options),m=bundle.manifests[0],action=m.actions[0];
 assert.ok(verifySim2(bundle.readAsset(action.sha256),action,m));bundle.readAsset(action.sha256)[0]=0;
 writeFileSync(join(f.options.directory,f.index.variants[0].files[0].path),'changed');assert.ok(verifySim2(bundle.readAsset(action.sha256),action,m));
 const again=fixture(t);assert.deepEqual(importMaterials(again.options).manifests,bundle.manifests);
});
test('import: wrong trust digest, license, codec, path escape and duplicate variant reject',t=>{
 const f=fixture(t);error(()=>importMaterials({...f.options,indexSha256:'0'.repeat(64)}),'index_integrity_failed');error(()=>importMaterials({...f.options,approvedLicenses:[]}),'license_not_approved');
 f.index.variants[0].files[0].path='../outside';error(()=>importMaterials(f.commit()),'unsafe_asset_path');
 f.index.variants[0].files[0].path='/absolute';error(()=>importMaterials(f.commit()),'unsafe_asset_path');
 f.index.variants[0].manifest.codec='OTHER';error(()=>importMaterials(f.commit()),'unsupported_asset_codec');
 const d=fixture(t);d.index.variants.push(d.index.variants[0]);error(()=>importMaterials(d.commit()),'duplicate_variant');
});
test('import: symlink files/root and excessive file/index size refuse',t=>{
 const f=fixture(t),path=join(f.options.directory,f.index.variants[0].files[0].path),target=join(f.root,'target');writeFileSync(target,readFileSync(path));rmSync(path);symlinkSync(target,path);error(()=>importMaterials(f.options),'unsafe_asset_path');
 const alias=join(f.root,'alias');symlinkSync(f.options.directory,alias);error(()=>importMaterials({...f.options,directory:alias}),'unsafe_asset_path');
 rmSync(path);writeFileSync(path,'');truncateSync(path,8388609);error(()=>importMaterials(f.options),'asset_size_limit');
 writeFileSync(join(f.options.directory,'index.json'),'x'.repeat(262145));error(()=>importMaterials(f.options),'asset_size_limit');
});
test('import: hash/length and valid-hash malformed SIM2 header reject',t=>{
 const f=fixture(t),entry=f.index.variants[0],action=entry.manifest.actions[0],path=join(f.options.directory,entry.files[0].path),bytes=readFileSync(path);
 bytes[0]=0;writeFileSync(path,bytes);error(()=>importMaterials(f.options),'asset_integrity_failed');
 action.sha256=sha256(bytes);error(()=>importMaterials(f.commit()),'asset_format_failed');
 action.bytes++;error(()=>importMaterials(f.commit()),'asset_integrity_failed');
});
async function running(t){const f=fixture(t),directory=join(f.root,'runtime');let hub;
 const start=async()=>hub=await startOrAttach({directory,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:f.options});await start();t.after(()=>hub.close());
 const state=()=>hub.client.request('GET','/v1/status');
 const select=async(device_id,variant_id)=>{const d=(await state()).devices.find(d=>d.device_id===device_id),c=d.material.candidates.find(c=>c.character_id==='imported'&&c.variant_id===variant_id);return hub.client.request('POST','/v1/materials/selection',{service_instance_id:hub.instanceId,device_id,expected_revision:d.material.revision,character_id:c.character_id,variant_id:c.variant_id,manifest_sha256:c.manifest_sha256});};
 let n=0;const control=async(operation,extra={})=>hub.client.request('POST','/v1/simulation/control',{service_instance_id:hub.instanceId,client_id:'test',request_id:`r${++n}`,expected_revision:(await state()).simulation.revision,operation,...extra});
 return {...f,directory,start,state,select,control,get hub(){return hub;}};
}
test('assembly: A360/B240 separate manifests, verified before first simulated frame, source updates',async t=>{
 const s=await running(t);await s.select('sim_A','native_360');await s.select('sim_B','native_240');
 assert.equal((await s.state()).devices[0].material_playback.phase,'accepted');await s.control('advance',{ms:300});let state=await s.state();assert.equal(state.devices[0].material_playback.phase,'verified');assert.equal(state.devices[0].material_playback.actual,null);
 await s.control('advance',{ms:100});state=await s.state();assert.equal(state.devices[0].material_playback.actual.variant_id,'native_360');assert.equal(state.devices[1].material_playback.actual.variant_id,'native_240');
 await s.control('source',{status:'connected',state:'working'});await s.control('advance',{ms:400});assert.equal((await s.state()).devices[0].material_playback.actual.action_id,11);
 const old=await s.state();await s.hub.client.request('POST','/v1/simulation/intent',{device_id:'sim_A',intent_id:'manual',client_id:'test',service_instance_id:s.hub.instanceId,expected_revision:old.devices[0].intent_revision,kind:'manual',action_id:58});
 await s.control('advance',{ms:400});const after=await s.state();assert.equal(after.devices[0].material_playback.actual.action_id,58);assert.equal(after.devices[1].material_playback.actual.action_id,11);

});
test('assembly: switch cancels old pending, offline fences frames, reconnect and restart reassemble',async t=>{
 const s=await running(t);await s.select('sim_A','native_360');await s.control('advance',{ms:300});await s.select('sim_A','native_240');await s.control('advance',{ms:100});assert.equal((await s.state()).devices[0].material_playback.actual,null);
 await s.control('advance',{ms:300});assert.equal((await s.state()).devices[0].material_playback.actual.variant_id,'native_240');
 await s.select('sim_A','native_360');await s.control('offline',{device_id:'sim_A'});await s.control('advance',{ms:1000});assert.equal((await s.state()).devices[0].material_playback.phase,'offline');
 await s.control('reconnect',{device_id:'sim_A'});await s.control('advance',{ms:400});assert.equal((await s.state()).devices[0].material_playback.actual.variant_id,'native_360');
 await s.hub.close();await s.start();assert.equal((await s.state()).devices[0].material_playback.actual,null);await s.control('advance',{ms:400});assert.equal((await s.state()).devices[0].material_playback.actual.variant_id,'native_360');
});
test('assembly: verification failure preserves previous actual and does not fake playing',()=>{
 let now=0,selected={status:'compatible',revision:'1',caps:{schema_version:2,codecs:['SIM2'],display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},presentation_modes:['exact'],cache:{playback_bytes:100,persistent:null},max_asset_bytes:100},manifest:{character_id:'c',variant_id:'v',sha256:'a'.repeat(64),codec:'SIM2',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},actions:[{id:0,bytes:18,sha256:'a'.repeat(64)}]},presentation:{mode:'exact',x:0,y:0}};let valid=true;
 const p=new MaterialPlayback({clock:{now:()=>now},resolve:()=>selected,readAsset:()=>new Uint8Array(18),verifyAsset:()=>valid}),ctx={online:true,session:'s',actionId:0,intentRevision:'0'};
 p.tick('A',ctx);now=400;p.tick('A',ctx);const actual=p.snapshot('A').actual;valid=false;selected={...selected,revision:'2'};p.tick('A',ctx);now=800;p.tick('A',ctx);assert.equal(p.snapshot('A').phase,'failed');assert.deepEqual(p.snapshot('A').actual,actual);assert.equal(p.snapshot('B').actual,null);
});
test('import: disabled mode rejects options; attached owner rejects differing imports before reading',async t=>{
 const s=await running(t);await assert.rejects(startOrAttach({directory:s.directory,materialImport:s.options}),/requires simulation/);
 await assert.rejects(startOrAttach({directory:s.directory,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...s.options,indexSha256:'0'.repeat(64)}}),/differs/);
 assert.ok(!(JSON.stringify(await s.state())).includes(s.options.directory));
});

test('assembly: changed trusted catalog preserves old preference as unsupported; bad import never overwrites',async t=>{
 const s=await running(t);await s.select('sim_A','native_360');await s.hub.close();const saved=readFileSync(join(s.directory,'materials.simulation.json'),'utf8');
 s.index.variants[1].manifest.license_ref='synthetic-new';const changed=s.commit();s.options.indexSha256=changed.indexSha256;s.options.approvedLicenses.push('synthetic-new');
 await s.start();assert.equal((await s.state()).devices[0].material.status,'unsupported');assert.equal((await s.state()).devices[0].material_playback.actual,null);await s.hub.close();
 s.options.indexSha256='0'.repeat(64);await assert.rejects(s.start(),{code:'index_integrity_failed'});assert.equal(readFileSync(join(s.directory,'materials.simulation.json'),'utf8'),saved);
});
