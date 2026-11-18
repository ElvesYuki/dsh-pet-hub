import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,mkdirSync,writeFileSync,readFileSync,readdirSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createStoreLifecycle} from '../packages/runtime/store-lifecycle.mjs';
import {createMaterialStore} from '../packages/runtime/material-store.mjs';
import {materialDirectory} from '../packages/simulator/material-fixture.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';import {createSimulation} from '../packages/simulator/session.mjs';
const pause=()=>new Promise(r=>setTimeout(r,5));
function fixture(t){const root=realpathSync(mkdtempSync(join(tmpdir(),'life-')));t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,...materialDirectory(join(root,'source'))};}
async function built(f,options=f.options){const s=createMaterialStore(f.root,options);try{return await s.ready;}finally{await s.close();}}
const cleanup=(life,list,ids)=>life.cleanup({expected_revision:list.revision,entry_ids:ids});
test('lifecycle: persistent version metadata and selection/actual/pending protection across restart',async t=>{
 const f=fixture(t),bundle=await built(f);let refs={};const life=createStoreLifecycle(f.root,{references:()=>refs});
 let list=await life.list();assert.equal(list.entries.length,1);assert.equal(list.entries[0].protected,false);assert.equal(list.entries[0].manifest_count,2);assert.ok(list.used_bytes>288);
 for(const reason of ['selected','actual','pending']){refs={[reason]:[bundle.manifests[0].sha256]};list=await life.list();assert.ok(list.entries[0].reasons.includes(reason));await assert.rejects(cleanup(life,list,[f.options.indexSha256]),{code:'protected_version'});}
 refs={};list=await life.list();await cleanup(life,list,[f.options.indexSha256]);assert.equal((await life.list()).entries.length,0);
});
test('lifecycle: unresolved refs and legacy/bad metadata fail closed; no protected item deleted in batch',async t=>{
 const f=fixture(t);await built(f);const store=join(f.root,'material-store'),legacy='b'.repeat(64);mkdirSync(join(store,legacy),{mode:0o700});
 const life=createStoreLifecycle(f.root,{references:()=>({selected:['c'.repeat(64)]})});let list=await life.list();assert.ok(list.entries.every(e=>e.protected));await assert.rejects(cleanup(life,list,list.entries.map(e=>e.entry_id)),{code:'protected_version'});assert.equal(readdirSync(store).length,2);
 const without=createStoreLifecycle(f.root);list=await without.list();assert.equal(list.entries.find(e=>e.entry_id===legacy).protected,true);
 await assert.rejects(cleanup(without,list,[f.options.indexSha256,legacy]),{code:'protected_version'});assert.ok(existsSync(join(store,f.options.indexSha256)));
});
test('lifecycle: current catalog and active stage protected; orphan stage explicitly cleaned',async t=>{
 const f=fixture(t),life=createStoreLifecycle(f.root),store=createMaterialStore(f.root,f.options,life);await store.ready;let list=await life.list();assert.ok(list.entries[0].reasons.includes('active_catalog'));await store.close();
 const orphan='.staging-11111111-1111-1111-1111-111111111111',active='.staging-22222222-2222-2222-2222-222222222222';
 for(const name of [orphan,active]){mkdirSync(join(f.root,'material-store',name),{mode:0o700});writeFileSync(join(f.root,'material-store',name,'part'),'x',{mode:0o600});}
 life.beginStage(active,'d'.repeat(64));list=await life.list();assert.ok(list.entries.find(e=>e.entry_id===active).reasons.includes('active_validation'));assert.equal(list.entries.find(e=>e.entry_id===orphan).protected,false);
 await cleanup(life,list,[orphan]);assert.ok(existsSync(join(f.root,'material-store',active)));life.finishStage(active);life.endCatalog('d'.repeat(64));
});
test('lifecycle: stale tree or changed refs reject old revision without deleting',async t=>{
 const f=fixture(t),bundle=await built(f);let refs={};const life=createStoreLifecycle(f.root,{references:()=>refs});let list=await life.list();refs={actual:[bundle.manifests[0].sha256]};await assert.rejects(cleanup(life,list,[f.options.indexSha256]),{code:'revision_conflict'});refs={};list=await life.list();writeFileSync(join(f.root,'material-store',f.options.indexSha256,'extra'),'x',{mode:0o600});await assert.rejects(cleanup(life,list,[f.options.indexSha256]),{code:'revision_conflict'});assert.ok(existsSync(join(f.root,'material-store',f.options.indexSha256)));
});
test('lifecycle: quota includes versions, orphan data and reservations; insufficient admission writes no version',async t=>{
 const f=fixture(t),life=createStoreLifecycle(f.root,{quotaBytes:1}),store=createMaterialStore(f.root,f.options,life);await assert.rejects(store.ready,/quota_exceeded/);await store.close();assert.deepEqual(readdirSync(join(f.root,'material-store')),[]);
 const admitted=createStoreLifecycle(f.root,{quotaBytes:100});let list=await admitted.list();const name='.staging-33333333-3333-3333-3333-333333333333';mkdirSync(join(f.root,'material-store',name),{mode:0o700});admitted.beginStage(name,f.options.indexSha256);await admitted.reserve(name,80);list=await admitted.list();assert.equal(list.reserved_bytes,80);await assert.rejects(admitted.reserve(name,101),{code:'quota_exceeded'});assert.equal((await admitted.list()).reserved_bytes,80);
 writeFileSync(join(f.root,'material-store',name,'part'),Buffer.alloc(20),{mode:0o600});list=await admitted.list();assert.equal(list.used_bytes,20);assert.equal(list.reserved_bytes,60);
 admitted.finishStage(name);admitted.endCatalog(f.options.indexSha256);assert.equal((await admitted.list()).reserved_bytes,0);
});
test('lifecycle: symlink outside store and invalid cleanup paths refuse without touching sentinel',async t=>{
 const f=fixture(t);await built(f);const outside=join(f.root,'sentinel');writeFileSync(outside,'safe',{mode:0o600});symlinkSync(outside,join(f.root,'material-store','link'));
 const life=createStoreLifecycle(f.root),list=await life.list();assert.equal(list.valid,false);await assert.rejects(cleanup(life,list,[f.options.indexSha256]),{code:'unsafe_store'});assert.equal(readFileSync(outside,'utf8'),'safe');
 rmSync(join(f.root,'material-store','link'));const safe=await life.list();for(const path of ['../sentinel','/tmp','bad'])await assert.rejects(cleanup(life,safe,[path]),{code:'invalid_cleanup'});
});
test('lifecycle: removed versions do not modify private material preference file',async t=>{
 const f=fixture(t);await built(f);const sentinel=join(f.root,'materials.simulation.json');writeFileSync(sentinel,'leave-alone',{mode:0o600});const life=createStoreLifecycle(f.root),list=await life.list();await cleanup(life,list,[f.options.indexSha256]);assert.equal(readFileSync(sentinel,'utf8'),'leave-alone');
});
test('service: offline unknown-device selection protects archived version; proxy/UI cleanup CAS',async t=>{
 const f=fixture(t),bundle=await built(f),runtime=f.root;
 // A valid saved assignment to a device not present in this session must still pin its archived pack.
 const archived=f.options.indexSha256,m=bundle.manifests[0];writeFileSync(join(runtime,'materials.simulation.json'),JSON.stringify({schemaVersion:1,records:[{device_id:'offline_C',revision:'1',selection:{character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,required_actions:[0]}}]}),{mode:0o600});
 f.index.variants.forEach(v=>{v.manifest.character_id='new_role';});const next=f.commit();const hub=await startOrAttach({directory:runtime,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...next,mode:'streaming'}});t.after(()=>hub.close());
 const list=()=>hub.client.request('GET','/v1/materials/versions');let state;for(let i=0;i<500;i++){state=await hub.client.request('GET','/v1/status');if(state.catalog.phase==='ready')break;await pause();}
 let repository=(await list()).repository;assert.ok(repository.entries.find(e=>e.entry_id===archived).reasons.includes('selected'));
 await assert.rejects(hub.client.request('POST','/v1/materials/cleanup',{service_instance_id:hub.instanceId,expected_revision:repository.revision,entry_ids:[archived]}),{status:409});
 const {createHostPlugin}=await import('../apps/dsh-plugin/index.mjs');let route;createHostPlugin(hub.client)({effect(fn){t.after(fn());},webServer:{register(r){route=r;return()=>{};}}});const http=await import('node:http'),server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}/dsh-pet-hub/materials`;const response=await fetch(`${url}/versions`).then(r=>r.json());assert.ok(response.repository);assert.ok(!JSON.stringify(response).includes(runtime));
 const post=(body,origin)=>fetch(`${url}/cleanup`,{method:'POST',headers:{'Content-Type':'application/json','X-Pet-Hub':'1',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 const request={service_instance_id:hub.instanceId,expected_revision:response.repository.revision,entry_ids:[archived]};assert.equal((await post(request,'http://invalid.test')).status,403);assert.equal((await post(request)).status,409);
});
test('quota: existing versions deny a second import until an explicit safe cleanup frees space',async t=>{
 const f=fixture(t);await built(f);const free=createStoreLifecycle(f.root),first=await free.list(),quota=first.used_bytes;
 f.index.variants.forEach(v=>{v.manifest.character_id='archive2';});const next=f.commit();
 const blocked=createMaterialStore(f.root,next,createStoreLifecycle(f.root,{quotaBytes:quota}));await assert.rejects(blocked.ready,/quota_exceeded/);await blocked.close();assert.equal((await free.list()).entries.length,1);
 await cleanup(free,await free.list(),[f.options.indexSha256]);const retry=createMaterialStore(f.root,next,createStoreLifecycle(f.root,{quotaBytes:quota}));try{await retry.ready;}finally{await retry.close();}assert.equal((await free.list()).entries.length,1);
});
test('lifecycle: crash trash retains manifest protection; cleanup serialization exposes busy until complete',async t=>{
 const {renameSync}=await import('node:fs');const f=fixture(t),bundle=await built(f),trash='.trash-44444444-4444-4444-4444-444444444444';renameSync(join(f.root,'material-store',f.options.indexSha256),join(f.root,'material-store',trash));
 let refs={selected:[bundle.manifests[0].sha256]},gate=null,release;
 const life=createStoreLifecycle(f.root,{references:async()=>{if(gate)await gate;return refs;}});let list=await life.list();assert.ok(list.entries[0].reasons.includes('selected'));await assert.rejects(cleanup(life,list,[trash]),{code:'protected_version'});
 refs={};list=await life.list();gate=new Promise(r=>{release=r;});const deleting=cleanup(life,list,[trash]);for(let i=0;i<100&&!life.busy;i++)await pause();assert.equal(life.busy,true);release();await deleting;assert.equal(life.busy,false);assert.equal((await life.list()).entries.length,0);
});
