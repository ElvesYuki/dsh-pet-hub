import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,realpathSync,writeFileSync,readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createMaterialStore} from '../packages/runtime/material-store.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {createSimulation} from '../packages/simulator/session.mjs';
import {materialDirectory} from '../packages/simulator/material-fixture.mjs';
import {pet4Fixture} from './fixtures/pet4.mjs';
import {crc32} from '../packages/core/pet4.mjs';
import {sha256,importMaterials} from '../packages/runtime/material-import.mjs';
import {MaterialPlayback} from '../packages/core/material-playback.mjs';
const pause=()=>new Promise(r=>setTimeout(r,5));
function fixture(t,large=false){const root=realpathSync(mkdtempSync(join(tmpdir(),'store-'))),f=materialDirectory(join(root,'source'));if(large){const e=f.index.variants[1];e.manifest.codec='PET4';e.manifest.actions.forEach((a,i)=>{const b=pet4Fixture(360,34);b.writeUInt16LE(i,12);b.writeUInt32LE(crc32(b.subarray(4,528)),528);writeFileSync(join(f.options.directory,e.files[i].path),b);a.bytes=b.length;a.sha256=sha256(b);});f.options=f.commit();}t.after(()=>rmSync(root,{recursive:true,force:true}));return {...f,root};}
async function waitReady(s){for(let i=0;i<1000;i++){const state=await s.hub.client.request('GET','/v1/status');if(state.catalog.phase==='failed')throw new Error(state.catalog.error);if(state.catalog.phase==='ready'&&state.devices[0].material.candidates.some(c=>c.character_id==='imported'))return state;await pause();}throw new Error('ready timeout');}
async function setup(t,large=false){const f=fixture(t,large),directory=join(f.root,'runtime');const hub=await startOrAttach({directory,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...f.options,mode:'streaming'}});t.after(()=>hub.close());let n=0;
 const state=()=>hub.client.request('GET','/v1/status');
 const select=async(id,variant)=>{const d=(await state()).devices.find(d=>d.device_id===id),c=d.material.candidates.find(c=>c.character_id==='imported'&&c.variant_id===variant);return hub.client.request('POST','/v1/materials/selection',{service_instance_id:hub.instanceId,device_id:id,expected_revision:d.material.revision,character_id:c.character_id,variant_id:c.variant_id,manifest_sha256:c.manifest_sha256});};
 const advance=async ms=>hub.client.request('POST','/v1/simulation/control',{service_instance_id:hub.instanceId,client_id:'test',request_id:`r${++n}`,expected_revision:(await state()).simulation.revision,operation:'advance',ms});
 return {...f,directory,hub,state,select,advance};}
test('store: >32MiB PET4 pack imports in worker while IPC responds; both devices decode independently',async t=>{
 const s=await setup(t,true);assert.ok(s.index.variants.flatMap(v=>v.manifest.actions).reduce((n,a)=>n+a.bytes,0)>33554432);
 let polls=0,validating=0;for(;;){const state=await s.state();polls++;if(state.catalog.phase==='ready')break;assert.notEqual(state.catalog.phase,'failed');validating++;await pause();}assert.ok(validating>0);assert.ok(polls>1);
 const ready=await waitReady(s);assert.ok(ready.catalog.validated_bytes>33554432);assert.equal(ready.catalog.retained_library_bytes,0);assert.ok(ready.catalog.peak_asset_bytes<=8388608);
 await s.select('sim_A','native_360');
 await s.select('sim_B','native_240');await s.advance(400);let state=await s.state();assert.equal(state.devices[0].material_playback.phase,'playing');assert.equal(state.devices[0].material_playback.actual.decoded_frame.width,360);assert.equal(state.devices[1].material_playback.actual.variant_id,'native_240');
 await s.advance(100);state=await s.state();assert.equal(state.devices[0].material_playback.actual.decoded_frame.frame_index,2);assert.ok(state.catalog.decoder_count<=2);
 assert.ok(!JSON.stringify(state).includes(s.options.directory));
});
test('store: cancellation rejects ready, cleans staging and stops all worker promises',async t=>{
 const f=fixture(t),store=createMaterialStore(f.root,f.options);await store.close();await assert.rejects(store.ready);assert.equal(store.snapshot().phase,'closed');assert.deepEqual(readdirSync(join(f.root,'material-store')),[]);
});
test('store: failed hash publishes nothing, retains existing preference bytes and serves status',async t=>{
 const f=fixture(t),directory=join(f.root,'runtime');mkdirSync(directory,{mode:0o700});const path=join(directory,'materials.simulation.json'),prefs=JSON.stringify({schemaVersion:1,records:[]});writeFileSync(path,prefs,{mode:0o600});
 const a=f.index.variants[0].files[0];writeFileSync(join(f.options.directory,a.path),'bad');const hub=await startOrAttach({directory,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...f.options,mode:'streaming'}});t.after(()=>hub.close());
 let state;for(let i=0;i<500;i++){state=await hub.client.request('GET','/v1/status');if(state.catalog.phase==='failed')break;await pause();}
 assert.equal(state.catalog.phase,'failed');assert.equal(state.devices[0].material.selection,null);assert.equal(readFileSync(path,'utf8'),prefs);
 await hub.close();assert.deepEqual(readdirSync(join(directory,'material-store')),[]);
});
test('store: successful CAS is revalidated; corrupt cache is not overwritten or trusted',async t=>{
 const f=fixture(t),s=createMaterialStore(f.root,f.options),bundle=await s.ready;await s.close();const a=bundle.manifests[0].actions[0],path=join(f.root,'material-store',f.options.indexSha256,'blobs',a.sha256);writeFileSync(path,'corrupt',{mode:0o600});
 const again=createMaterialStore(f.root,f.options);await assert.rejects(again.ready);await again.close();assert.equal(readFileSync(path,'utf8'),'corrupt');
});
test('store: corrupted playback asset fails without replacing observed actual or saved selection',async t=>{
 const s=await setup(t);await waitReady(s);await s.select('sim_A','native_240');await s.advance(400);const before=(await s.state()).devices[0].material_playback.actual;
 const a=s.index.variants[0].manifest.actions.find(a=>a.id===11);writeFileSync(join(s.directory,'material-store',s.options.indexSha256,'blobs',a.sha256),'bad',{mode:0o600});
 const state=await s.state();await s.hub.client.request('POST','/v1/simulation/intent',{device_id:'sim_A',client_id:'test',intent_id:'manual',service_instance_id:s.hub.instanceId,expected_revision:state.devices[0].intent_revision,kind:'manual',action_id:11});await s.advance(400);
 const after=await s.state();assert.equal(after.devices[0].material_playback.phase,'failed');assert.deepEqual(after.devices[0].material_playback.actual,before);assert.equal(after.devices[0].material.selection.variant_id,'native_240');
});
test('async playback: late verification/first-frame cannot commit after a newer selection or disconnect',async()=>{
 let now=0,revision='1';const pending=[];const m={character_id:'c',variant_id:'v',sha256:'a'.repeat(64),codec:'PET4',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},actions:[{id:0,bytes:18,sha256:'a'.repeat(64)}]};
 const p=new MaterialPlayback({clock:{now:()=>now},resolve:()=>({status:'compatible',revision,manifest:m,caps:{schema_version:1,codecs:['PET4'],display:m.display,max_asset_bytes:100}}),prepare:()=>new Promise(r=>pending.push(r))}),ctx={online:true,session:'s',actionId:0,intentRevision:'0'};
 p.tick('A',ctx);now=400;p.tick('A',ctx);revision='2';p.tick('A',ctx);pending.shift()({fps:24,frames:1,frame:()=>({frame_index:0})});await p.settle();assert.equal(p.snapshot('A').phase,'accepted');assert.equal(p.snapshot('A').actual,null);
 now=800;p.tick('A',ctx);pending.shift()({fps:24,frames:1,frame:()=>new Promise(r=>pending.push(r))});await p.settle();p.tick('A',ctx);p.tick('A',{online:false});pending.shift()({frame_index:0});await p.settle();assert.equal(p.snapshot('A').phase,'offline');assert.equal(p.snapshot('A').actual,null);
});
test('store: duplicate imported/base IDs fail activation without modifying preferences',async t=>{
 const f=fixture(t);f.index.variants[0].manifest.character_id='sim_character';f.index.variants[0].manifest.variant_id='sim_240';f.options=f.commit();
 const hub=await startOrAttach({directory:join(f.root,'runtime'),deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...f.options,mode:'streaming'}});t.after(()=>hub.close());let state;
 for(let i=0;i<500;i++){state=await hub.client.request('GET','/v1/status');if(state.catalog.phase==='failed')break;await pause();}assert.equal(state.catalog.error,'activation_failed');assert.equal(state.devices[0].material.selection,null);
});
test('store: shutdown rejects outstanding worker RPCs',async t=>{
 const f=fixture(t),store=createMaterialStore(f.root,f.options);t.after(()=>store.close());const bundle=await store.ready,m=bundle.manifests[0],a=m.actions[0];
 // SIM2 has no decoder frame API, but queued prepare/release requests still have bounded lifecycle.
 const pending=bundle.prepare('sim_A',a,m);const rejected=assert.rejects(pending,/store_closed/);await store.close();await rejected;assert.equal(store.snapshot().phase,'closed');
});
test('streaming host/UI: catalog status passes the proxy and renders background progress without paths',async t=>{
 const {createHostPlugin}=await import('../apps/dsh-plugin/index.mjs'),{hubViewModel,renderHubPanel}=await import('../packages/ui/index.mjs');
 const s=await setup(t);await waitReady(s);let route;createHostPlugin(s.hub.client)({effect(fn){t.after(fn());},webServer:{register(r){route=r;return()=>{};}}});
 const http=await import('node:http'),server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const state=await fetch(`http://127.0.0.1:${server.address().port}/dsh-pet-hub/status`).then(r=>r.json());assert.equal(state.catalog.phase,'ready');
 const model=hubViewModel({...state,catalog:{phase:'validating',validated_assets:3,validated_bytes:1048576}}),tree=renderHubPanel((tag,props,...children)=>({tag,props,children}),model);
 assert.ok(JSON.stringify(tree).includes('后台校验中'));assert.ok(!JSON.stringify(state).includes(s.directory));
});
