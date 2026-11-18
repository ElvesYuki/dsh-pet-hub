import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import http from 'node:http';import vm from 'node:vm';
import {RoundPetObservations} from '../packages/core/round-pet-observations.mjs';
import {publicObservationView} from '../packages/core/observation-view.mjs';
import {observationFixture,observationVersions} from '../packages/simulator/round-pet-observation-fixture.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';
import {hubViewModel,renderHubPanel,simulationRequest} from '../packages/ui/index.mjs';
const clone=structuredClone,err=(fn,code)=>assert.throws(fn,e=>e.code===code),h=(tag,props,...children)=>({tag,props,children});
function setup(t,overrides){const f=observationFixture(overrides);t.after(()=>f.close());return f;}
const row=f=>f.model.snapshot().devices[0];
const play=(f,c=f.sent())=>{f.ingest(f.playback(c,'verified'));f.ingest(f.playback(c,'playing','2'));return c;};
function inventory(f,{query='inventory_query',seq='1',root='4',ids=[0,4,1,11]}={}){f.query('inventory',query);const r=f.inventory(query,seq,root,ids);f.ingest(r);return r;}
function saved(f,c=f.sent(),operation='save_one',seq='1',root='5'){f.model.expectSave(f.context,operation,c);const r=f.storage(c,operation,seq,'saved',root);f.ingest(r);return r;}
function directory(t){const p=realpathSync(mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'a3-')));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
async function service(t){let f;const options={directory:directory(t),observationReview:{id:'a3-original-v1',create({instanceId}){f=observationFixture({instanceId});return f.model;}}};const hub=await startOrAttach(options);t.after(()=>hub.close());return {hub,options,get f(){return f;}};}
async function proxy(t,client){let route,dispose;createHostPlugin(client)({effect(fn){dispose=fn();t.after(()=>dispose());},webServer:{register(value){route=value;return()=>{};}}});const server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});return {base:`http://127.0.0.1:${server.address().port}/dsh-pet-hub`,dispose};}

test('A3-01 state golden separates local intent, remote playback and display evidence',t=>{
 const f=setup(t),c=f.command(),golden=JSON.parse(readFileSync(new URL('../docs/protocol/vectors/round-pet-a3-state-v1.json',import.meta.url)));
 for(const step of golden.steps){if(step.event==='request')f.request(c);else if(step.event==='sent')f.model.sent(f.context,c,f.grant);else if(step.event==='display')f.ingest(f.display());else f.ingest(f.playback(c,step.event,String(golden.steps.indexOf(step))));const r=row(f);assert.equal(r.request_status,step.request_status);assert.equal(r.playback?.phase??null,step.playback_phase);assert.equal(r.actual?.action_id??null,step.actual_action);}
});
test('A3-02 default attestation boundary rejects booleans and unverified observations',t=>{
 const f=setup(t,{verifyObservation:undefined}),c=f.sent();err(()=>f.model.ingest(f.context,f.playback(c,'accepted'),true),'unverified_observation');assert.equal(row(f).playback,null);
});
test('A3-03 opaque proof is bound to the exact record and full context',t=>{
 const f=setup(t),c=f.sent(),r=f.playback(c,'accepted'),p=f.attest(r);r.elapsed_ms=1;err(()=>f.model.ingest(f.context,r,p),'unverified_observation');err(()=>f.model.ingest({...f.context,controller_id:'other'},r,f.attest(r)),'stale_session');assert.equal(row(f).playback,null);
});
test('A3-04 missing/old stream versions are diagnostic, never implicitly saved-capable',t=>{
 const f=setup(t);f.reopen({},{});assert.equal(row(f).connection,'diagnostic');assert.equal(row(f).inventory.known,false);err(()=>f.request(),'stale_session');assert.equal(publicObservationView(f.model.snapshot()).devices[0].controlled,false);
});
test('A3-05 unknown fields, versions and malformed records leave projection unchanged',t=>{
 const f=setup(t),c=f.sent(),before=f.model.snapshot();for(const r of [{...f.playback(c,'accepted'),schema_version:2},{...f.playback(c,'accepted'),verified:true},{...f.playback(c,'accepted'),report_seq:9007199254740992},{...f.playback(c,'accepted'),type:'touch.event'},{...f.playback(c,'accepted'),extra:'x'.repeat(4097)}])assert.throws(()=>f.ingest(r));assert.deepEqual(f.model.snapshot(),before);
});
test('A3-06 uint64 stream high water stays precise above 2^53 and ignores replay',t=>{
 const f=setup(t),c=f.sent(),r=f.playback(c,'accepted','9007199254740993');assert.equal(f.ingest(r),true);assert.equal(f.ingest({...r,report_seq:'9007199254740992'}),false);assert.equal(f.ingest({...r,report_seq:'9007199254740993'}),false);assert.equal(f.ingest({...r,report_seq:'9007199254740994'}),true);
});
test('A3-07 terminal and superseded targets cannot be revived by late playing',t=>{
 const f=setup(t),c=play(f);f.ingest(f.playback(c,'cancelled','3'));err(()=>f.ingest(f.playback(c,'playing','4')),'terminal_observation');const newer=f.sent(f.command(11,'2'));err(()=>f.ingest(f.playback(c,'accepted','5')),'stale_revision');assert.equal(row(f).desired.action_id,newer.action_id);assert.equal(row(f).playback,null);
});
test('A3-08 old boot/session/service/binding reports are rejected without advancing sequence',t=>{
 const f=setup(t),c=f.sent(),r=f.playback(c,'accepted');for(const key of ['boot_id','session_id','service_instance_id','binding_id']){const ctx={...f.context,[key]:'old'};err(()=>f.model.ingest(ctx,r,f.attest(r,ctx)),'stale_session');}assert.equal(f.ingest(r),true);
});
test('A3-09 local sent and remote playback require current control; readonly reports do not renew it',t=>{
 const f=setup(t),c=f.request();f.setControl(false);err(()=>f.model.sent(f.context,c,f.grant),'stale_control');assert.equal(row(f).request_status,'requested');f.setControl(true);f.model.sent(f.context,c,f.grant);f.setControl(false);err(()=>f.ingest(f.playback(c,'accepted')),'stale_control');inventory(f);assert.equal(row(f).inventory.known,true);assert.equal(row(f).controlled,false);
});
test('A3-10 verified and HTTP-like success cannot manufacture first-frame evidence',t=>{
 const f=setup(t),c=f.sent();err(()=>f.ingest(f.playback(c,'playing')),'first_frame_unverified');f.ingest(f.playback(c,'verified'));err(()=>f.ingest({...f.playback(c,'playing','2'),first_frame:null}),'invalid_message');assert.equal(row(f).actual,null);assert.equal(row(f).playback.phase,'verified');
});
test('A3-11 repeated playing keeps first-frame identity and rejects elapsed rollback',t=>{
 const f=setup(t),c=play(f);f.ingest({...f.playback(c,'playing','3'),elapsed_ms:12});err(()=>f.ingest({...f.playback(c,'playing','4'),elapsed_ms:11}),'stale_refresh');err(()=>f.ingest({...f.playback(c,'playing','4'),first_frame:{refresh_generation:'2',first_frame_seq:'2'}}),'stale_refresh');assert.equal(row(f).playback.elapsed_ms,12);
});
test('A3-12 local touch display does not change latest base or create a command',t=>{
 const f=setup(t),c=play(f);f.ingest(f.display(4,'1',{origin:'local',source_command:null}));const newer=f.sent(f.command(11,'2'));assert.equal(row(f).actual.action_id,4);assert.equal(row(f).actual.origin,'local');assert.equal(row(f).desired.action_id,newer.action_id);assert.equal(f.model.resources().commands,2);assert.equal(row(f).playback,null);assert.equal(c.action_id,0);
});
test('A3-13 stale remote display event cannot replace a local picture after a new target',t=>{
 const f=setup(t);play(f);f.ingest(f.display(4,'1',{origin:'local',source_command:null}));f.sent(f.command(11,'2'));err(()=>f.ingest(f.display(0,'2',{refresh_generation:'2'})),'stale_revision');assert.equal(row(f).actual.action_id,4);
});
test('A3-14 display stream independently fences old refresh generations and frames',t=>{
 const f=setup(t);f.sent();f.ingest(f.display(0,'1',{refresh_generation:'9007199254740993',frame_seq:'2'}));err(()=>f.ingest(f.display(0,'2',{refresh_generation:'9007199254740992',frame_seq:'99'})),'stale_refresh');err(()=>f.ingest(f.display(0,'2',{refresh_generation:'9007199254740993',frame_seq:'1'})),'stale_refresh');assert.equal(row(f).actual.frame_seq,'2');
});
test('A3-15 maintenance freezes a confirmed picture; repeated held frame cannot advance elapsed',t=>{
 const f=setup(t);f.sent();const held=f.display(0,'1',{maintenance:'saving',display_state:'held_last_valid',elapsed_ms:23});f.ingest(held);err(()=>f.ingest({...held,display_seq:'2',elapsed_ms:24}),'maintenance_elapsed');f.ingest({...held,display_seq:'2'});assert.equal(row(f).display_state,'held_last_valid');assert.equal(row(f).actual.elapsed_ms,23);
});
test('A3-16 local wall-clock advance and verified report cannot imply continued animation',t=>{
 const f=setup(t),c=f.sent();f.ingest(f.playback(c,'verified'));assert.equal(row(f).display_state,'unknown');f.ingest(f.display(0,'1',{maintenance:'loading',display_state:'held_last_valid',elapsed_ms:31}));f.clock.advance(10000);assert.equal(row(f).actual.elapsed_ms,31);assert.equal(row(f).display_state,'held_last_valid');
});
test('A3-17 reconnect snapshot may show historical target without replaying old playback success',t=>{
 const f=setup(t),c=play(f),old=f.context;f.model.disconnect(old);f.reopen({boot_id:'boot_next'});assert.equal(row(f).desired,null);f.query('display','new_query');f.ingest(f.display(0,'1',{kind:'snapshot',query_id:'new_query',source_command:c}));assert.equal(row(f).actual.is_current,true);assert.equal(row(f).playback,null);err(()=>f.model.ingest(old,f.playback(c,'playing','5'),true),'stale_session');
});
test('A3-18 snapshot query is single-use, replaceable and bounded by virtual deadline',t=>{
 const f=setup(t);f.query('inventory','old_query');f.query('inventory','new_query');err(()=>f.ingest(f.inventory('old_query')),'stale_query');f.clock.advance(2000);err(()=>f.ingest(f.inventory('new_query')),'query_expired');f.query('inventory','fresh_query');f.ingest(f.inventory('fresh_query'));err(()=>f.ingest(f.inventory('fresh_query','2')),'stale_query');assert.equal(f.model.resources().queries,0);
});
test('A3-19 disconnect retains historical actual but invalidates current offline availability',t=>{
 const f=setup(t);f.sent();f.ingest(f.display());inventory(f);f.model.disconnect(f.context);const r=row(f);assert.equal(r.actual.action_id,0);assert.equal(r.actual.is_current,false);assert.equal(r.inventory.actions[0].offline_available,null);assert.equal(r.inventory.actions[0].last_confirmed_available,true);
});
test('A3-20 external session revocation is sticky until a new trusted open',t=>{
 const f=setup(t);inventory(f);f.setSession(false);assert.equal(row(f).connection,'offline');f.setSession(true);assert.equal(row(f).connection,'offline');err(()=>f.ingest(f.inventory()),'stale_session');f.reopen();assert.equal(row(f).connection,'online');assert.equal(row(f).inventory.known,false);
 let broken=false;const g=setup(t,{sessionCurrent(){if(broken)throw new Error('bad metadata');return true;}});broken=true;assert.throws(()=>row(g),/bad metadata/);broken=false;assert.equal(row(g).connection,'offline');
});
test('A3-21 late saved is historical and never activates the superseded target',t=>{
 const f=setup(t),c=f.sent();f.model.expectSave(f.context,'save_old',c);f.sent(f.command(11,'2'));f.ingest(f.storage(c,'save_old'));const r=row(f);assert.equal(r.desired.action_id,11);assert.equal(r.actual,null);assert.equal(r.playback,null);assert.equal(r.storage[0].action_id,0);assert.equal(r.storage[0].status,'saved');
});
test('A3-22 saved requires a tracked operation and explicit durable root commit evidence',t=>{
 const f=setup(t),c=f.sent(),r=f.storage(c);err(()=>f.ingest(r),'stale_operation');f.model.expectSave(f.context,'save_one',c);for(const commit of [null,{...r.commit,evidence:'download_done'},{...r.commit,object_generation:'6'}])assert.throws(()=>f.ingest({...r,commit}));assert.equal(row(f).storage.length,0);assert.equal(f.ingest(r),true);
});
test('A3-23 full inventory replaces atomically and malformed/partial defaults leave old facts intact',t=>{
 const f=setup(t);inventory(f);const before=row(f).inventory;f.query('inventory','q2');const bad=f.inventory('q2','2','5',[1,11]);assert.throws(()=>f.ingest(bad));assert.deepEqual(row(f).inventory,before);const valid=f.inventory('q2','2','5',[0,4]);f.ingest(valid);assert.equal(row(f).inventory.actions.find(a=>a.action_id===11).offline_available,false);
});
test('A3-24 same namespace with old file SHA is not current approved material availability',t=>{
 const f=setup(t);f.query('inventory','q');const r=f.inventory('q');r.active[0].asset_sha256='b'.repeat(64);f.ingest(r);assert.equal(row(f).inventory.actions[0].offline_available,false);f.query('inventory','q2');err(()=>f.ingest({...r,inventory_seq:'2',query_id:'q2',namespace:'c'.repeat(64)}),'invalid_observation');
});
test('A3-25 eviction updates availability even while saved history remains true',t=>{
 const f=setup(t),c=f.sent(f.command(11));saved(f,c);inventory(f,{root:'5'});inventory(f,{query:'q2',seq:'2',root:'6',ids:[0,4,1,43]});assert.equal(row(f).storage[0].status,'saved');assert.equal(row(f).inventory.actions.find(a=>a.action_id===11).offline_available,false);
});
test('A3-26 newer saved root invalidates old inventory query and requires a fresh root snapshot',t=>{
 const f=setup(t),c=f.sent();inventory(f);f.query('inventory','before_commit');saved(f,c);assert.equal(row(f).inventory.known,false);err(()=>f.ingest(f.inventory('before_commit','2','5')),'stale_query');inventory(f,{query:'after_commit',seq:'2',root:'5'});assert.equal(row(f).inventory.known,true);
});
test('A3-27 outcome_unknown fences preexisting queries; recovery does not fabricate saved',t=>{
 const f=setup(t),c=f.sent();inventory(f);f.query('inventory','old');f.model.expectSave(f.context,'save_one',c);f.ingest(f.storage(c,'save_one','1','outcome_unknown'));assert.equal(row(f).inventory.known,false);err(()=>f.ingest(f.inventory('old','2')),'stale_query');inventory(f,{query:'recovery',seq:'2'});assert.equal(row(f).inventory.known,true);assert.equal(row(f).storage[0].status,'outcome_unknown');
});
test('A3-28 old saved root cannot invalidate or replace a newer authenticated inventory',t=>{
 const f=setup(t),c=f.sent();inventory(f,{root:'8'});saved(f,c,'save_one','1','5');assert.equal(row(f).inventory.root_seq,'8');assert.equal(row(f).inventory.known,true);assert.equal(row(f).storage[0].root_seq,'5');
});
test('A3-29 persistent root rollback and same-sequence content conflict are refused',t=>{
 const f=setup(t);inventory(f);f.query('inventory','q');err(()=>f.ingest(f.inventory('q','2','3',[0,4])),'stale_root');err(()=>f.ingest(f.inventory('q','2','4',[0,4])),'root_conflict');const same=f.inventory('q','2');same.active.reverse();f.ingest(same);assert.equal(row(f).inventory.known,true);
});
test('A3-30 invalid root reports explicitly unknown, not an empty available cache',t=>{
 const f=setup(t);inventory(f);f.query('inventory','unknown');f.ingest({...f.inventory('unknown','2'),known:false,root_seq:null,root_state:null,active:[]});assert.equal(row(f).inventory.known,false);assert.equal(row(f).inventory.actions[0].offline_available,null);assert.equal(row(f).inventory.actions[0].last_confirmed_available,true);
});
test('A3-31 playback/display/storage/inventory counters are independent',t=>{
 const f=setup(t),c=f.sent();f.ingest(f.playback(c,'verified','99'));f.ingest(f.display());saved(f,c);inventory(f,{root:'5'});assert.equal(row(f).actual.action_id,0);assert.equal(row(f).storage.length,1);assert.equal(row(f).inventory.known,true);
});
test('A3-32 command/operation/history/query resources remain bounded; pending operations protected',t=>{
 const f=setup(t);for(let n=1;n<=300;n++)f.sent(f.command(0,String(n)));assert.equal(f.model.resources().commands,256);const c=f.command(0,'300');for(let n=0;n<64;n++)f.model.expectSave(f.context,`save_${n}`,c);err(()=>f.model.expectSave(f.context,'overflow',c),'capacity_exceeded');for(let n=0;n<64;n++)f.ingest(f.storage(c,`save_${n}`,String(n+1),'failed'));f.model.expectSave(f.context,'new_op',c);assert.equal(f.model.resources().operations,64);assert.equal(f.model.resources().history,16);for(let n=0;n<50;n++){f.query('display',`d_${n}`);f.query('inventory',`i_${n}`);}assert.equal(f.model.resources().queries,2);
});
test('A3-33 changed binding clears cross-binding history and root high water',t=>{
 const f=setup(t);f.sent();f.ingest(f.display());saved(f);inventory(f,{root:'5'});f.reopen({binding_id:'new_binding',binding_epoch:'2'});assert.equal(row(f).actual,null);assert.equal(row(f).storage.length,0);assert.equal(row(f).inventory.root_seq,null);inventory(f,{root:'0',ids:[]});assert.equal(row(f).inventory.root_seq,'0');
});
test('A3-34 callback reentry and async attestation cannot mutate or defer a report',t=>{
 let f;f=setup(t,{verifyObservation(){f.model.close();return true;}});const c=f.sent();err(()=>f.ingest(f.playback(c,'accepted')),'observation_busy');assert.equal(f.model.resources().closed,false);assert.equal(row(f).playback,null);
 const a=setup(t,{verifyObservation:async()=>{throw new Error('async misuse');}}),command=a.sent();err(()=>a.ingest(a.playback(command,'accepted')),'invalid_observation_callback');assert.equal(row(a).playback,null);
});
test('A3-35 close clears in-memory observations and is idempotent',t=>{
 const f=setup(t);saved(f);inventory(f,{root:'5'});f.model.close();f.model.close();assert.deepEqual(f.model.resources(),{closed:true,commands:0,operations:0,history:0,queries:0});err(()=>f.model.snapshot(),'closed');
});
test('A3-36 shared public contract drops nested private fields and rejects contradictory freshness',t=>{
 const f=setup(t);f.sent();f.ingest(f.display());const s=f.model.snapshot();s.token='PRIVATE';s.devices[0].context='PRIVATE';s.devices[0].actual.secret='PRIVATE';const view=publicObservationView(s);assert.ok(!JSON.stringify(view).includes('PRIVATE'));view.devices[0].actual.action_id=11;assert.equal(row(f).actual.action_id,0);s.devices[0].connection='offline';assert.throws(()=>publicObservationView(s));
 const bad=f.model.snapshot();bad.devices[0].storage=[{operation_id:'bad',action_id:0,revision:'1',status:'saved',root_seq:null,object_generation:null,is_current:true}];assert.throws(()=>publicObservationView(bad));assert.equal(hubViewModel({observationReview:bad}).observationError,true);
});
test('A3-37 temporary UDS status exposes only the synthetic review, transport stays disabled',async t=>{
 const s=await service(t);s.f.sent();s.f.ingest(s.f.display());const status=await s.hub.client.request('GET','/v1/status');assert.equal(status.phase,'A3-observation-review');assert.equal(status.capabilities.deviceTransport,false);assert.deepEqual(status.devices,[]);assert.equal(status.observationReview.devices[0].actual.action_id,0);const text=JSON.stringify(status.observationReview);for(const privateValue of ['fixture_binding','fixture_lease','fixture_session',s.options.directory])assert.ok(!text.includes(privateValue));await assert.rejects(s.hub.client.request('POST','/v1/observations',{verified:true}),e=>e.status===404);
});
test('A3-38 host proxy passes read-only review and rejects observation writes',async t=>{
 const s=await service(t),p=await proxy(t,s.hub.client);const body=await fetch(p.base+'/status').then(r=>r.json());assert.equal(body.observationReview.synthetic,true);assert.equal(body.instanceId,undefined);assert.equal((await fetch(p.base+'/observations',{method:'POST',headers:{'Content-Type':'application/json','X-Pet-Hub':'1'},body:'{}'})).status,404);p.dispose();assert.equal((await s.hub.client.request('GET','/v1/status')).phase,'A3-observation-review');
});
test('A3-39 shared UI renders maintenance/history/unknown without controls or clock extrapolation',t=>{
 const f=setup(t);f.sent();f.ingest(f.display(0,'1',{maintenance:'saving',display_state:'held_last_valid',elapsed_ms:24}));saved(f);const status={deviceMode:'disabled',source:{mode:'disabled',status:'unavailable'},observationReview:f.model.snapshot()},view=hubViewModel(status),tree=renderHubPanel(h,view),text=JSON.stringify(tree);for(const label of ['离线候选','动画已暂停','24ms','保存历史不保证当前库存','当前性未知'])assert.ok(text.includes(label));assert.equal(view.devices.length,0);const candidate=tree.children.find(c=>c?.props?.['aria-label']==='单设备观察离线候选');assert.ok(candidate);assert.ok(!JSON.stringify(candidate).includes('"tag":"button"'));f.clock.advance(500);assert.equal(row(f).actual.elapsed_ms,24);
});
test('A3-40 default service has no review and spoofed devices cannot enable simulation actions',async t=>{
 const hub=await startOrAttach({directory:directory(t)});t.after(()=>hub.close());const s=await hub.client.request('GET','/v1/status');assert.equal(s.observationReview,undefined);const f=setup(t),model=hubViewModel({...s,devices:[{synthetic:true}],observationReview:f.model.snapshot()});assert.deepEqual(model.devices,[]);assert.throws(()=>simulationRequest(s,'client',{type:'intent'},'id'),/simulation_disabled/);assert.equal(hubViewModel({observationReview:{synthetic:false}}).observationReview,null);
});
test('A3-41 only IPC winner creates review owner; identity mismatch refuses attach',async t=>{
 const s=await service(t),first=s.f;let created=0;const attached=await startOrAttach({...s.options,observationReview:{id:'a3-original-v1',create(){created++;return first.model;}}});assert.equal(attached.role,'attached');assert.equal(created,0);await attached.close();assert.equal(first.model.resources().closed,false);await assert.rejects(startOrAttach({...s.options,observationReview:{...s.options.observationReview,id:'different'}}),/differs/);await s.hub.close();assert.equal(first.model.resources().closed,true);
});
test('A3-42 incompatible modes and invalid factory view fail closed with owner cleanup',async t=>{
 let closed=0;const option={id:'bad',create(){return {snapshot:()=>({token:'PRIVATE'}),close(){closed++;}};}};const dir=directory(t);await assert.rejects(startOrAttach({directory:dir,observationReview:option,source:{mode:'page'}}),/isolated/);assert.equal(closed,0);await assert.rejects(startOrAttach({directory:dir,observationReview:option}),/invalid_observation_view/);assert.equal(closed,1);
});
test('A3-43 built client includes review renderer, registers settings and aborts on unmount',()=>{
 let loaded,effect,signal,Component;const React={createElement:h,useState:v=>[v,()=>{}],useEffect:fn=>{effect=fn;}};
 const source=readFileSync('dist/client.js','utf8');assert.ok(source.includes('renderObservationPanel'));vm.runInNewContext(source,{window:{__ModuleLoader__:{load(v){loaded=v;}}},AbortController,crypto:globalThis.crypto,fetch:(_url,{signal:s})=>{signal=s;return new Promise(()=>{});},setTimeout,clearTimeout});const plugin=loaded.factory(()=>React);plugin.apply({slots:{inject(_name,g){[...g()];},register(_meta,C){Component=C;return()=>{};}}});Component();const release=effect();assert.equal(signal.aborted,false);release();assert.equal(signal.aborted,true);
});
test('A3-44 core-generated query IDs cannot resurrect a replaced or consumed query',t=>{
 const f=setup(t),old=f.model.query(f.context,'inventory'),next=f.model.query(f.context,'inventory');assert.notEqual(old,next);err(()=>f.ingest(f.inventory(old)),'stale_query');f.ingest(f.inventory(next));const another=f.model.query(f.context,'inventory');assert.notEqual(another,next);err(()=>f.ingest(f.inventory(next,'2')),'stale_query');f.ingest(f.inventory(another,'2'));assert.equal(f.model.resources().queries,0);
});
test('A3-45 late pre-maintenance refresh cannot unfreeze a held picture without a new generation',t=>{
 const f=setup(t);f.sent();f.ingest(f.display(0,'1',{maintenance:'saving',display_state:'held_last_valid'}));err(()=>f.ingest(f.display(0,'2',{frame_seq:'2'})),'stale_refresh');assert.equal(row(f).display_state,'held_last_valid');f.ingest(f.display(0,'2',{refresh_generation:'2',frame_seq:'2'}));assert.equal(row(f).display_state,'playing');
});
test('A3-46 same-root storage and inventory must agree on the exact object generation',t=>{
 const f=setup(t),c=f.sent();saved(f,c);f.query('inventory','q');const bad=f.inventory('q','1','5');bad.active[0].object_generation='4';err(()=>f.ingest(bad),'root_conflict');assert.equal(row(f).inventory.known,false);f.ingest(f.inventory('q','1','5'));assert.equal(row(f).inventory.known,true);
 const g=setup(t),cmd=g.sent();inventory(g);g.model.expectSave(g.context,'save_one',cmd);err(()=>g.ingest(g.storage(cmd,'save_one','1','saved','4')),'root_conflict');assert.equal(row(g).storage.length,0);assert.equal(row(g).inventory.known,true);
});
