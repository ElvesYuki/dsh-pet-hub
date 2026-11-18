import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { startOrAttach, createHubClient } from '../packages/runtime/index.mjs';
import { createSimulation } from '../packages/simulator/session.mjs';
import { createHostPlugin } from '../apps/dsh-plugin/index.mjs';
import { hubViewModel, simulationRequest, renderHubPanel } from '../packages/ui/index.mjs';
async function setup(t, deviceMode='simulation') {
  const directory=mkdtempSync(join(tmpdir(),'s2-'));
  const hub=await startOrAttach({directory,deviceMode,simulationFactory:deviceMode==='simulation'?createSimulation:undefined});
  t.after(async()=>{await hub.close();rmSync(directory,{recursive:true,force:true});});
  const client=createHubClient(directory);
  const status=()=>client.request('GET','/v1/status');
  const intent=(overrides={})=>client.request('POST','/v1/simulation/intent',{device_id:'sim_A',intent_id:'manual1',client_id:'test',service_instance_id:hub.instanceId,expected_revision:'0',kind:'manual',action_id:11,...overrides});
  const control=async(operation,extra={})=>client.request('POST','/v1/simulation/control',{operation,request_id:`control_${++n}`,client_id:'test',service_instance_id:hub.instanceId,expected_revision:(await status()).simulation.revision,...extra});
  let n=0;return {directory,hub,client,status,intent,control};
}
const device=(status,id='sim_A')=>status.devices.find(d=>d.device_id===id);

test('S2 default mode has no devices, simulation writes unavailable, real-source combination refused',async t=>{
  const s=await setup(t,'disabled'); const before=await s.status();
  assert.deepEqual(before.devices,[]);assert.equal(before.synthetic,false);assert.equal(before.capabilities.deviceTransport,false);
  await assert.rejects(s.intent(),{status:404});
  await assert.rejects(startOrAttach({directory:s.directory,deviceMode:'simulation',simulationFactory:createSimulation}),/differs/);
  await assert.rejects(startOrAttach({directory:s.directory,deviceMode:'simulation',simulationFactory:createSimulation,source:{mode:'http',base:'http://127.0.0.1:1/dsh-pet-7340'}}),/invalid simulation/);
});
test('S2 two IPC clients attach to same instance without constructing a second actor set',async t=>{
  const s=await setup(t);const other=await startOrAttach({directory:s.directory,deviceMode:'simulation',simulationFactory:()=>{throw new Error('must not initialize');}});
  assert.equal(other.role,'attached');assert.equal(other.instanceId,s.hub.instanceId);await other.close();
  const state=await s.status();assert.equal(state.devices.length,2);assert.equal(state.synthetic,true);assert.equal(state.capabilities.deviceTransport,false);
  assert.equal(state.simulation.time_ms,0);assert.equal((await s.status()).simulation.time_ms,0);
});
test('S2 accepted target differs from actual until verified/frame events run; devices isolated',async t=>{
  const s=await setup(t);await s.intent();let state=await s.status();
  assert.equal(device(state).desired,11);assert.equal(device(state).actual,null);assert.equal(device(state).phase,'accepted');assert.equal(device(state,'sim_B').desired,0);
  await s.control('advance',{ms:300});state=await s.status();assert.equal(device(state).phase,'verified');assert.equal(device(state).actual,null);
  await s.control('advance',{ms:100});state=await s.status();assert.equal(device(state).phase,'playing');assert.equal(device(state).actual,11);assert.equal(device(state,'sim_B').actual,0);
  await s.control('advance',{ms:16000});assert.equal(device(await s.status()).controlled,true);
});
test('S2 duplicate intents/time advance execute once, stale CAS and changed payload reject',async t=>{
  const s=await setup(t);await s.intent();const before=await s.status();await s.intent();assert.deepEqual(await s.status(),before);
  await assert.rejects(s.intent({intent_id:'manual2'}),{status:409});await assert.rejects(s.intent({action_id:58}),{status:409});
  const request={operation:'advance',ms:1000,request_id:'advance1',client_id:'client',service_instance_id:s.hub.instanceId,expected_revision:before.simulation.revision};
  await s.client.request('POST','/v1/simulation/control',request);await s.client.request('POST','/v1/simulation/control',request);
  assert.equal((await s.status()).simulation.time_ms,1000);
  await assert.rejects(s.client.request('POST','/v1/simulation/control',{...request,ms:2000}),{status:409});
});
test('S2 offline/reconnect keep observed actual separate, do not replay manual intent',async t=>{
  const s=await setup(t);await s.intent();await s.control('advance',{ms:1000});await s.control('offline',{device_id:'sim_A'});
  let state=await s.status();assert.equal(device(state).connection,'offline');assert.equal(device(state).controlled,false);assert.equal(device(state).actual,11);
  await assert.rejects(s.intent({intent_id:'offline_request',expected_revision:'1'}),{status:400});
  await s.control('advance',{ms:16000});await s.control('reconnect',{device_id:'sim_A'});state=await s.status();assert.equal(device(state).desired,0);assert.equal(device(state).actual,null);assert.equal(device(state).mode,'auto');
});
test('S2 synthetic source honors manual override and source grace, never contacts pet',async t=>{
  const s=await setup(t);await s.intent();await s.control('source',{status:'connected',state:'success'});let state=await s.status();
  assert.equal(device(state).desired,11);assert.equal(device(state,'sim_B').desired,58);assert.equal(state.source.mode,'simulation');
  await s.control('source',{status:'unavailable',state:null});await s.control('advance',{ms:2000});assert.equal(device(await s.status(),'sim_B').desired,58);
  await s.control('advance',{ms:100});assert.equal(device(await s.status(),'sim_B').desired,0);assert.equal(device(await s.status()).desired,11);
});
test('S2 invalid fields/unknown devices/old service instances leave state untouched',async t=>{
  const s=await setup(t),before=await s.status();
  for(const change of [{url:'http://example.invalid'},{service_instance_id:'old'},{device_id:'real_board'},{action_id:999}]) await assert.rejects(s.intent(change));
  assert.deepEqual(await s.status(),before);
  await s.hub.close();const newer=await startOrAttach({directory:s.directory,deviceMode:'simulation',simulationFactory:createSimulation});t.after(()=>newer.close());
  await assert.rejects(createHubClient(s.directory).request('POST','/v1/simulation/intent',{device_id:'sim_A',intent_id:'x',client_id:'client',service_instance_id:s.hub.instanceId,expected_revision:'0',kind:'manual',action_id:11}),{status:409});
});
test('S2 separate client processes compete on a single device CAS, without duplicate dispatch',async t=>{
  const s=await setup(t);
  const run=input=>new Promise((resolve,reject)=>{
    const code=`import {createHubClient} from './packages/runtime/client.mjs';let text='';for await(const chunk of process.stdin)text+=chunk;const input=JSON.parse(text);try{await createHubClient(input.directory).request('POST','/v1/simulation/intent',input.body);console.log('200');}catch(e){console.log(e.status);}`;
    const child=spawn(process.execPath,['--input-type=module','--eval',code],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.on('error',reject);child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error('child failed')));child.stdin.end(JSON.stringify(input));
  });
  const body={device_id:'sim_A',intent_id:'compete',client_id:'one',service_instance_id:s.hub.instanceId,expected_revision:'0',kind:'manual',action_id:11};
  const results=await Promise.all([run({directory:s.directory,body}),run({directory:s.directory,body:{...body,client_id:'two',action_id:58}})]);
  assert.deepEqual(results.sort(),['200','409']);assert.equal(device(await s.status()).intent_revision,'1');assert.equal((await s.status()).simulation.revision,'1');
});
test('S2 proxy serializes allowlist, preserves conflict errors and disallows cross-origin writes',async t=>{
  const s=await setup(t);let route,dispose;createHostPlugin(s.client)({effect(fn){dispose=fn();},webServer:{register(value){route=value;return()=>{route=null;};}}});
  const server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}/dsh-pet-hub`;
  const state=await fetch(`${base}/status`).then(r=>r.json());assert.equal('instanceId' in state,false);assert.equal(state.serviceInstanceId,s.hub.instanceId);
  const request=simulationRequest(state,'browser',{type:'intent',device_id:'sim_A',kind:'manual',action_id:11},'request');
  const post=(body,headers={})=>fetch(`${base}/simulation/intent`,{method:'POST',headers:{'Content-Type':'application/json','X-Pet-Hub':'1',...headers},body:JSON.stringify(body)});
  assert.equal((await post(request.body,{Origin:'http://elsewhere.invalid'})).status,403);assert.equal((await post(request.body)).status,200);
  assert.equal((await post({...request.body,intent_id:'new',action_id:58})).status,409);
  const text=JSON.stringify(await fetch(`${base}/status`).then(r=>r.json()));for(const forbidden of ['identity_ref','lease_id','Authorization','asset_sha256','service.json'])assert.equal(text.includes(forbidden),false);
  const model=hubViewModel(await fetch(`${base}/status`).then(r=>r.json()));assert.equal(model.simulation,true);assert.equal(model.devices.length,2);
  const tree=renderHubPanel((tag,props,...children)=>({tag,props,children}),model);assert.ok(JSON.stringify(tree).includes('模拟模式 · 非实物'));
  dispose();assert.equal((await s.status()).devices.length,2);
});

test('S2 explicit replay of same action restarts only for a new accepted intent',async t=>{
  const s=await setup(t);await s.intent();await s.control('advance',{ms:1000});let state=await s.status();assert.equal(device(state).started,400);
  await s.intent({intent_id:'replay',expected_revision:'1'});state=await s.status();assert.equal(device(state).phase,'accepted');assert.equal(device(state).started,null);
  await s.control('advance',{ms:1000});state=await s.status();assert.equal(device(state).started,1400);
});
test('S2 rejects extra fields and bounds replay window without halting; evicted retries fail CAS',async t=>{
  const s=await setup(t),before=await s.status();
  await assert.rejects(s.control('advance',{ms:1000,device_id:'sim_A'}),{status:400});
  await assert.rejects(s.intent({kind:'auto'}),{status:400});assert.deepEqual(await s.status(),before);
  const first={service_instance_id:s.hub.instanceId,client_id:'window',request_id:'first',expected_revision:before.simulation.revision,operation:'advance',ms:1};await s.client.request('POST','/v1/simulation/control',first);
  for(let i=0;i<160;i++)await s.control('advance',{ms:1});
  const full=await s.status();assert.equal(full.simulation.time_ms,161);await assert.rejects(s.client.request('POST','/v1/simulation/control',first),{status:409});assert.deepEqual(await s.status(),full);
  const last={...first,request_id:'last',expected_revision:full.simulation.revision};await s.client.request('POST','/v1/simulation/control',last);const after=await s.status();await s.client.request('POST','/v1/simulation/control',last);assert.deepEqual(await s.status(),after);await assert.rejects(s.client.request('POST','/v1/simulation/control',{...last,ms:2}),{status:409});
});
test('S2 evicted manual retry cannot hit scheduler replay and dispatch an old action again',async t=>{
 const s=await setup(t);await s.intent();for(let i=0;i<130;i++)await s.control('advance',{ms:1});const before=await s.status();await assert.rejects(s.intent(),{status:409});assert.deepEqual(await s.status(),before);
});
