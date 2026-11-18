import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,readFileSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {roleDirectory} from '../packages/simulator/role-fixture.mjs';
import {MaterialCatalog} from '../packages/core/materials.mjs';import {roleFrame} from '../packages/core/role-package.mjs';
import {manifestDigest,importMaterials} from '../packages/runtime/material-import.mjs';
import {createMaterialStore} from '../packages/runtime/material-store.mjs';import {createStoreLifecycle} from '../packages/runtime/store-lifecycle.mjs';
import {createRoleRuntime} from '../packages/runtime/role-runtime.mjs';import {saveMaterials} from '../packages/runtime/materials.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';import {createSimulation} from '../packages/simulator/session.mjs';
const pause=()=>new Promise(r=>setTimeout(r,5));
function fixture(t){const root=realpathSync(mkdtempSync(join(tmpdir(),'role-')));t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,...roleDirectory(join(root,'source'))};}
async function waitJob(roles){for(let i=0;i<1000;i++){const s=roles.snapshot();if(s.job&&!s.job.running)return s;await pause();}throw new Error('job timeout');}
async function runtime(t){const f=fixture(t),simulation=createSimulation({instanceId:'test'});let roles;const lifecycle=createStoreLifecycle(f.root,{references:()=>({activated:roles?.references()??[]})}),importer=createMaterialStore(f.root,f.options,lifecycle);const bundle=await importer.ready;await importer.close();let failSave=false;
 roles=createRoleRuntime(f.root,{simulation,lifecycle,approvedLicenses:f.options.approvedLicenses,persist:(...args)=>{if(failSave)throw new Error('disk failed');return saveMaterials(...args);}});t.after(async()=>{await roles.close();simulation.stop();});
 const target=(device_id='sim_A',side=360)=>{const m=bundle.manifests.find(m=>m.display.width===side);return {device_id,expected_revision:roles.snapshot().devices.find(d=>d.device_id===device_id).activation.revision,version_id:f.options.indexSha256,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256};};
 let n=0;const control=(operation,extra={})=>simulation.control({service_instance_id:'test',client_id:'test',request_id:`r${++n}`,expected_revision:simulation.snapshot().revision,operation,...extra});
 return {...f,roles,simulation,lifecycle,bundle,target,control,failSave:()=>{failSave=true;}};
}
test('role package: contract validation, full semantic references, hash covers timing/mapping/loop',t=>{
 const f=fixture(t),m=f.index.variants[0].manifest,manifest={...m,sha256:manifestDigest(m)};new MaterialCatalog([manifest]);
 for(const mutate of [x=>delete x.semantics.touch,x=>x.semantics.working=999,x=>x.actions[0].loop='once_idle',x=>x.actions[1].loop='unknown',x=>x.actions[1].frames=0]){const x=structuredClone(manifest);mutate(x);assert.throws(()=>new MaterialCatalog([x]));}
 for(const mutate of [x=>x.semantics.working=300,x=>x.actions[1].fps=12,x=>x.actions[1].loop='loop']){const x=structuredClone(m);mutate(x);assert.notEqual(manifestDigest(x),manifest.sha256);}
 f.index.variants[0].manifest.actions[1].fps=12;assert.throws(()=>importMaterials(f.commit()),{code:'timing_mismatch'});
});
test('role frame: fps/duration loop boundaries, hold last, once-to-idle does not restart',()=>{
 const m={semantics:{idle:10},actions:[{id:10,fps:2,frames:3,loop:'loop'},{id:20,fps:4,frames:2,loop:'once_hold'},{id:30,fps:4,frames:2,loop:'once_idle'}]};
 assert.equal(roleFrame(m,10,1499).frame_index,2);assert.equal(roleFrame(m,10,1500).frame_index,0);assert.deepEqual(roleFrame(m,20,500),{action_id:20,frame_index:1,completed:true});
 assert.equal(roleFrame(m,30,499).action_id,30);assert.deepEqual(roleFrame(m,30,500),{action_id:10,frame_index:0,completed:true});assert.equal(roleFrame(m,30,2000).action_id,10);
});
test('activation: custom semantic IDs, per-device isolation, once rules and manual/auto switching',async t=>{
 const s=await runtime(t);s.roles.start(s.target());let state=await waitJob(s.roles);assert.equal(state.job.phase,'active');assert.equal(state.devices[0].actual.action_id,100);assert.equal(state.devices[1].actual,null);
 s.roles.start(s.target('sim_B',240));await waitJob(s.roles);
 s.control('source',{status:'connected',state:'working'});await s.roles.tick();state=s.roles.snapshot();assert.equal(state.devices[0].actual.action_id,200);assert.equal(state.devices[1].actual.action_id,200);
 s.control('advance',{ms:100});await s.roles.tick();state=s.roles.snapshot();assert.equal(state.devices[0].actual.action_id,100);assert.equal(state.devices[0].phase,'completed');
 s.roles.intent({device_id:'sim_A',expected_revision:'0',kind:'manual',action_id:300});await s.roles.tick();s.control('advance',{ms:100});await s.roles.tick();state=s.roles.snapshot();assert.equal(state.devices[0].actual.action_id,300);assert.equal(state.devices[1].actual.action_id,100);
 s.roles.intent({device_id:'sim_A',expected_revision:'1',kind:'auto'});await s.roles.tick();assert.equal(s.roles.snapshot().devices[0].actual.action_id,200);
});
test('activation: failed persist/cancel/stale CAS leave pointer and previous actual untouched',async t=>{
 const s=await runtime(t);s.roles.start(s.target());await waitJob(s.roles);const before=s.roles.snapshot().devices[0],file=readFileSync(join(s.root,'role-activations.json'),'utf8');
 s.failSave();s.roles.start(s.target('sim_A',240));let state=await waitJob(s.roles);assert.equal(state.job.phase,'failed');assert.equal(state.job.error,'storage_failed');assert.deepEqual(state.devices[0].activation,before.activation);assert.deepEqual(state.devices[0].actual,before.actual);assert.equal(readFileSync(join(s.root,'role-activations.json'),'utf8'),file);await s.roles.tick();assert.equal(s.roles.snapshot().devices[0].phase,'playing');
 const job=s.roles.start(s.target('sim_A',240));s.roles.cancel(job.job_id);state=await waitJob(s.roles);assert.equal(state.job.phase,'cancelled');assert.ok(!readdirSync(join(s.root,'material-store')).some(n=>n.startsWith('.staging-')));assert.deepEqual(state.devices[0].activation,before.activation);
 assert.throws(()=>s.roles.start({...s.target(),expected_revision:'0'}),{code:'revision_conflict'});
});
test('activation: restart restores only confirmed pointer and revalidates pack; cleanup keeps it protected',async t=>{
 const s=await runtime(t);s.roles.start(s.target());await waitJob(s.roles);await s.roles.close();
 const restored=createRoleRuntime(s.root,{simulation:s.simulation,lifecycle:s.lifecycle,approvedLicenses:s.options.approvedLicenses});t.after(()=>restored.close());await restored.restore();const r=restored.snapshot().devices[0];assert.equal(r.activation.revision,'1');assert.equal(r.actual.action_id,100);assert.equal(r.mode,'auto');assert.equal(r.intent_revision,'0');
 const list=await s.lifecycle.list();assert.ok(list.entries[0].protected);
});
test('service: asynchronous role activation IPC, old instance rejection and semantic source assembly',async t=>{
 const f=fixture(t),hub=await startOrAttach({directory:f.root,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...f.options,mode:'streaming'}});t.after(()=>hub.close());const state=()=>hub.client.request('GET','/v1/status');
 let st;for(let i=0;i<1000;i++){st=await state();if(st.catalog.phase==='ready')break;await pause();}
 const list=(await hub.client.request('GET','/v1/materials/versions')).repository,p=list.entries[0].packages.find(p=>p.display.width===360),body={service_instance_id:hub.instanceId,device_id:'sim_A',expected_revision:'0',version_id:f.options.indexSha256,...p};delete body.display;
 await assert.rejects(hub.client.request('POST','/v1/roles/activate',{...body,service_instance_id:'old'}),{status:409});const job=await hub.client.request('POST','/v1/roles/activate',body);assert.ok(job.job_id);
 for(let i=0;i<1000;i++){st=await state();if(st.roles.job&&!st.roles.job.running)break;await pause();}assert.equal(st.roles.job.phase,'active');assert.equal(st.roles.devices[0].actual.action_id,100);
 const repo=(await hub.client.request('GET','/v1/materials/versions')).repository;assert.ok(repo.entries[0].reasons.includes('activated'));
 await assert.rejects(hub.client.request('POST','/v1/materials/cleanup',{service_instance_id:hub.instanceId,expected_revision:repo.revision,entry_ids:[f.options.indexSha256]}),{status:409});
});
test('activation: source/session changes during first-frame preparation cannot commit stale candidate',async t=>{
 const f=fixture(t),simulation=createSimulation({instanceId:'race'});let roles;
 const lifecycle=createStoreLifecycle(f.root,{references:()=>({activated:roles?.references()??[]})}),base=createMaterialStore(f.root,f.options,lifecycle),bundle=await base.ready;await base.close();let injected=false,resolveFrame,waiting=false;
 const factory=(...args)=>injected?{ready:Promise.resolve({...bundle,prepare:async()=>({fps:24,frames:1,frame:()=>new Promise(r=>{waiting=true;resolveFrame=r;})})}),snapshot:()=>({}),close:async()=>{}}:createMaterialStore(...args);
 roles=createRoleRuntime(f.root,{simulation,lifecycle,approvedLicenses:f.options.approvedLicenses,storeFactory:factory});t.after(async()=>{await roles.close();simulation.stop();});
 const target=side=>{const m=bundle.manifests.find(m=>m.display.width===side);return {device_id:'sim_A',expected_revision:roles.snapshot().devices[0].activation.revision,version_id:f.options.indexSha256,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256};};
 roles.start(target(360));await waitJob(roles);const before=roles.snapshot().devices[0],saved=readFileSync(join(f.root,'role-activations.json'),'utf8');injected=true;
 roles.start(target(240));for(let i=0;i<1000&&!waiting;i++)await pause();assert.equal(waiting,true);assert.deepEqual(roles.snapshot().devices[0].actual,before.actual);
 simulation.control({service_instance_id:'race',client_id:'x',request_id:'newsource',expected_revision:simulation.snapshot().revision,operation:'source',status:'connected',state:'working'});resolveFrame({frame_index:0});let result=await waitJob(roles);assert.equal(result.job.error,'activation_conflict');assert.equal(readFileSync(join(f.root,'role-activations.json'),'utf8'),saved);await roles.tick();assert.equal(roles.snapshot().devices[0].actual.action_id,200);
 waiting=false;roles.start(target(240));for(let i=0;i<1000&&!waiting;i++)await pause();simulation.control({service_instance_id:'race',client_id:'x',request_id:'off',expected_revision:simulation.snapshot().revision,operation:'offline',device_id:'sim_A'});resolveFrame({frame_index:0});result=await waitJob(roles);assert.equal(result.job.phase,'failed');assert.deepEqual(result.devices[0].activation,before.activation);
});
test('role PET4: actual binary frame count/fps must match contracted timing before import',async t=>{
 const {pet4Fixture}=await import('./fixtures/pet4.mjs'),{writeFileSync}=await import('node:fs'),{sha256}=await import('../packages/runtime/material-import.mjs');const f=fixture(t),entry=f.index.variants[0],bytes=pet4Fixture(240,3);entry.manifest.codec='PET4';
 for(let i=0;i<entry.manifest.actions.length;i++){const a=entry.manifest.actions[i];a.bytes=bytes.length;a.sha256=sha256(bytes);a.frames=3;writeFileSync(join(f.options.directory,entry.files[i].path),bytes);}
 importMaterials(f.commit());entry.manifest.actions[0].frames=2;assert.throws(()=>importMaterials(f.commit()),{code:'timing_mismatch'});
});
test('role reconnect: invalidate old manual intent and resume current auto semantic, never replay old command',async t=>{
 const s=await runtime(t);s.roles.start(s.target());await waitJob(s.roles);s.roles.intent({device_id:'sim_A',expected_revision:'0',kind:'manual',action_id:300});await s.roles.tick();
 s.control('source',{status:'connected',state:'working'});s.control('offline',{device_id:'sim_A'});await s.roles.tick();assert.equal(s.roles.snapshot().devices[0].phase,'offline');
 s.control('reconnect',{device_id:'sim_A'});await s.roles.tick();const d=s.roles.snapshot().devices[0];assert.equal(d.mode,'auto');assert.equal(d.actual.action_id,200);assert.equal(d.intent_revision,'2');assert.throws(()=>s.roles.intent({device_id:'sim_A',expected_revision:'1',kind:'manual',action_id:300}),{code:'revision_conflict'});
});
test('service restart: confirmed cached role restores even when original import source is missing',async t=>{
 const f=fixture(t);let hub;const start=async()=>hub=await startOrAttach({directory:f.root,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...f.options,mode:'streaming'}});await start();t.after(()=>hub.close());
 const status=()=>hub.client.request('GET','/v1/status');let st;for(let i=0;i<1000;i++){st=await status();if(st.catalog.phase==='ready')break;await pause();}
 const repo=(await hub.client.request('GET','/v1/materials/versions')).repository,p=repo.entries[0].packages.find(x=>x.display.width===360);await hub.client.request('POST','/v1/roles/activate',{service_instance_id:hub.instanceId,device_id:'sim_A',expected_revision:'0',version_id:f.options.indexSha256,character_id:p.character_id,variant_id:p.variant_id,manifest_sha256:p.manifest_sha256});
 for(let i=0;i<1000;i++){st=await status();if(st.roles.job&&!st.roles.job.running)break;await pause();}assert.equal(st.roles.job.phase,'active');await hub.close();rmSync(join(f.options.directory,'index.json'));await start();
 for(let i=0;i<1000;i++){st=await status();if(st.catalog.phase==='failed'&&st.roles.devices[0].actual)break;await pause();}
 assert.equal(st.catalog.phase,'failed');assert.equal(st.roles.devices[0].activation.revision,'1');assert.equal(st.roles.devices[0].actual.action_id,100);
});
test('role auto: source loss retains semantic for the existing 2s grace, then goes idle',async t=>{
 const s=await runtime(t);s.roles.start(s.target());await waitJob(s.roles);s.control('source',{status:'connected',state:'working'});await s.roles.tick();
 s.control('source',{status:'unavailable',state:null});await s.roles.tick();s.control('advance',{ms:2000});await s.roles.tick();assert.equal(s.roles.snapshot().devices[0].requested_action,200);
 s.control('advance',{ms:1});await s.roles.tick();assert.equal(s.roles.snapshot().devices[0].requested_action,100);
});
test('activation: cancellation after pointer commit cannot close the new active worker',async t=>{
 const f=fixture(t),simulation=createSimulation({instanceId:'commit'});let roles,releaseClose,closingOld=false,created=0;
 const lifecycle=createStoreLifecycle(f.root,{references:()=>({activated:roles?.references()??[]})}),base=createMaterialStore(f.root,f.options,lifecycle),bundle=await base.ready;await base.close();
 const factory=(...args)=>{const store=createMaterialStore(...args);if(created++!==0)return store;return {...store,close:async()=>{closingOld=true;await new Promise(r=>{releaseClose=r;});await store.close();}};};
 roles=createRoleRuntime(f.root,{simulation,lifecycle,approvedLicenses:f.options.approvedLicenses,storeFactory:factory});t.after(async()=>{releaseClose?.();await roles.close();simulation.stop();});
 const target=side=>{const m=bundle.manifests.find(m=>m.display.width===side);return {device_id:'sim_A',expected_revision:roles.snapshot().devices[0].activation.revision,version_id:f.options.indexSha256,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256};};
 roles.start(target(360));await waitJob(roles);const job=roles.start(target(240));for(let i=0;i<1000&&!closingOld;i++)await pause();assert.equal(closingOld,true);
 assert.equal(roles.snapshot().devices[0].activation.revision,'2');assert.throws(()=>roles.cancel(job.job_id),{code:'activation_committed'});releaseClose();await waitJob(roles);await roles.tick();assert.equal(roles.snapshot().job.phase,'active');assert.equal(roles.snapshot().devices[0].phase,'playing');
});
test('activation: incomplete version registration is rejected without repairing metadata',async t=>{
 const s=await runtime(t),path=join(s.root,'material-store',s.options.indexSha256,'version.json');rmSync(path);s.roles.start(s.target());const state=await waitJob(s.roles);assert.equal(state.job.phase,'failed');assert.equal(state.job.error,'unknown_metadata');assert.equal(state.devices[0].activation.revision,'0');assert.throws(()=>readFileSync(path),{code:'ENOENT'});
});
