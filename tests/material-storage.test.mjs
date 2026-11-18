import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,statSync,chmodSync,symlinkSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {createSimulation} from '../packages/simulator/session.mjs';
import {createMaterialManager,saveMaterials} from '../packages/runtime/materials.mjs';
import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';
import {makeMaterialPicker,simulationRequest} from '../packages/ui/index.mjs';
async function setup(t,mode='simulation') {
 const directory=mkdtempSync(join(tmpdir(),'mat-'));let hub;
 const start=async()=>hub=await startOrAttach({directory,deviceMode:mode,simulationFactory:createSimulation});await start();
 t.after(async()=>{await hub.close();rmSync(directory,{recursive:true,force:true});});
 const state=()=>hub.client.request('GET','/v1/status');
 const input=async(id='sim_A',variant='sim_360')=>{const d=(await state()).devices.find(d=>d.device_id===id),c=d.material.candidates.find(c=>c.variant_id===variant);return {service_instance_id:hub.instanceId,device_id:id,expected_revision:d.material.revision,character_id:c.character_id,variant_id:c.variant_id,manifest_sha256:c.manifest_sha256};};
 return {directory,state,input,start,get hub(){return hub;},save:body=>hub.client.request('POST','/v1/materials/selection',body)};
}
test('material storage: restart restores per-device selection and CAS, not playback or instance',async t=>{
 const s=await setup(t);const a=await s.input(),b=await s.input('sim_B','sim_240');
 await s.save(a);await s.save(b);const path=join(s.directory,'materials.simulation.json');assert.equal(statSync(path).mode&0o777,0o600);
 await s.hub.close();await s.start();const state=await s.state();
 assert.equal(state.devices[0].material.selection.variant_id,'sim_360');assert.equal(state.devices[1].material.selection.variant_id,'sim_240');
 assert.equal(state.devices[0].material.revision,'1');assert.equal(state.devices[0].actual,null);assert.equal(state.simulation.time_ms,0);
 await assert.rejects(s.save(a),{status:409});
 const fresh=await s.input();const results=await Promise.allSettled([s.save(fresh),s.save({...fresh,variant_id:'sim_240',manifest_sha256:(await s.input('sim_A','sim_240')).manifest_sha256})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
test('material storage: invalid writes preserve file, assignment, and observed playback',async t=>{
 const s=await setup(t);await s.save(await s.input());const before=await s.state(),path=join(s.directory,'materials.simulation.json'),saved=readFileSync(path,'utf8');
 const input=await s.input();
 for(const extra of [{device_id:'unknown'},{manifest_sha256:'b'.repeat(64)},{variant_id:'missing'},{required_actions:[0]},{service_instance_id:'old'}])await assert.rejects(s.save({...input,...extra}));
 const bad=await s.input('sim_A','sim_360');bad.device_id='sim_B';bad.expected_revision='0';await assert.rejects(s.save(bad),{status:400});
 assert.equal(readFileSync(path,'utf8'),saved);assert.deepEqual(await s.state(),before);
});
test('material storage: disk failure leaves memory and revision untouched; recovery permits save',()=>{
 const directory=mkdtempSync(join(tmpdir(),'mat-fail-'));const sim=createSimulation({instanceId:'test'});
 try {let fail=true;const manager=createMaterialManager(directory,sim.materialProfiles(),{save:()=>{if(fail)throw new Error('disk');}});
 const before=manager.view('sim_A'),c=before.candidates[0],input={service_instance_id:'test',device_id:'sim_A',expected_revision:'0',...{character_id:c.character_id,variant_id:c.variant_id,manifest_sha256:c.manifest_sha256}};
 assert.throws(()=>manager.confirm(input,'test'),{code:'storage_failed'});assert.deepEqual(manager.view('sim_A'),before);fail=false;assert.equal(manager.confirm(input,'test').revision,'1');
 }finally{sim.stop();rmSync(directory,{recursive:true,force:true});}
});
test('material storage: corrupt, oversized, unsafe and symlink state fail closed, never overwrite',async t=>{
 const s=await setup(t);await s.hub.close();const path=join(s.directory,'materials.simulation.json');
 for(const text of ['bad',JSON.stringify({schemaVersion:1}),JSON.stringify({schemaVersion:1,records:[{}]}),'x'.repeat(131073)]){writeFileSync(path,text,{mode:0o600});await assert.rejects(s.start());assert.equal(readFileSync(path,'utf8'),text);}
 writeFileSync(path,JSON.stringify({schemaVersion:1,records:[]}));chmodSync(path,0o644);await assert.rejects(s.start(),/unsafe/);rmSync(path);
 const target=join(s.directory,'target');writeFileSync(target,'unchanged',{mode:0o600});symlinkSync(target,path);await assert.rejects(s.start(),/unsafe/);assert.equal(readFileSync(target,'utf8'),'unchanged');
});
test('material storage: disabled mode never creates or reads simulation preferences',async t=>{
 const s=await setup(t,'disabled');const path=join(s.directory,'materials.simulation.json');assert.equal(existsSync(path),false);
 await assert.rejects(s.save({}),{status:404});await s.hub.close();writeFileSync(path,'bad',{mode:0o600});await s.start();assert.deepEqual((await s.state()).devices,[]);assert.equal(readFileSync(path,'utf8'),'bad');
});
test('material storage: changed capability/catalog retains saved preference as unsupported',()=>{
 const directory=mkdtempSync(join(tmpdir(),'mat-change-')),sim=createSimulation({instanceId:'test'}),profile=sim.materialProfiles();
 try{const m=createMaterialManager(directory,profile),c=m.view('sim_A').candidates[0];m.confirm({service_instance_id:'test',device_id:'sim_A',expected_revision:'0',character_id:c.character_id,variant_id:c.variant_id,manifest_sha256:c.manifest_sha256},'test');
 profile.devices[0].caps.display.width=100;profile.devices[0].caps.display.height=100;
 const after=createMaterialManager(directory,profile).view('sim_A');assert.equal(after.status,'unsupported');assert.equal(after.selection.variant_id,'sim_360');assert.equal(after.candidates.length,0);
 }finally{sim.stop();rmSync(directory,{recursive:true,force:true});}
});
test('material UI and host: explicit draft/save, independent devices, same-origin proxy and refresh conflict',async t=>{
 const s=await setup(t);let route;createHostPlugin(s.hub.client)({effect(fn){t.after(fn());},webServer:{register(r){route=r;return()=>{};}}});
 const server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}/dsh-pet-hub`;const status=await fetch(`${base}/status`).then(r=>r.json());
 let draft='',action;const h=(tag,props,...children)=>({tag,props,children});
 const Picker=makeMaterialPicker({createElement:h,useState:()=>[draft,value=>{draft=value;}]});const props={device:status.devices[0],act:a=>{action=a;},pending:false};
 const nodes=tree=>[tree,...tree.children.flat(Infinity).filter(c=>c&&typeof c==='object').flatMap(nodes)];
 let tree=Picker(props);assert.equal(nodes(tree).find(n=>n.tag==='button').props.disabled,true);
 nodes(tree).find(n=>n.tag==='select').props.onChange({target:{value:'sim_character:sim_360'}});tree=Picker(props);nodes(tree).find(n=>n.tag==='button').props.onClick();
 const body=simulationRequest(status,'client',action,'id').body;
 const post=(body,origin)=>fetch(`${base}/materials/selection`,{method:'POST',headers:{'Content-Type':'application/json','X-Pet-Hub':'1',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 assert.equal((await post(body,'http://invalid.test')).status,403);assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,409);
 const after=await fetch(`${base}/status`).then(r=>r.json());assert.equal(after.devices[0].material.selection.variant_id,'sim_360');assert.equal(after.devices[1].material.selection,null);
 assert.equal(nodes(Picker({...props,pending:true})).find(n=>n.tag==='fieldset').props.disabled,true);
 assert.ok(!JSON.stringify(after).includes('materials.simulation.json'));
});

test('material storage: real atomic rename failure returns 503 without success or temp leakage',async t=>{
 const s=await setup(t),before=await s.state(),path=join(s.directory,'materials.simulation.json');
 mkdirSync(path,{mode:0o700});await assert.rejects(s.save(await s.input()),{status:503});
 assert.deepEqual(await s.state(),before);assert.ok(!readdirSync(s.directory).some(n=>n.endsWith('.tmp')));
 rmSync(path,{recursive:true});await s.save(await s.input());assert.equal((await s.state()).devices[0].material.revision,'1');
});

test('material storage: persisted output cannot exceed restore size limit',()=>{
 const directory=mkdtempSync(join(tmpdir(),'mat-size-')),path=join(directory,'materials.simulation.json');
 try{saveMaterials(path,[]);const before=readFileSync(path,'utf8');assert.throws(()=>saveMaterials(path,['x'.repeat(131072)]),{code:'capacity_exceeded'});assert.equal(readFileSync(path,'utf8'),before);assert.deepEqual(readdirSync(directory),['materials.simulation.json']);}finally{rmSync(directory,{recursive:true,force:true});}
});
