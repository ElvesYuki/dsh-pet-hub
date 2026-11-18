import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
import {Native360DeviceModel} from '../packages/core/native360-device.mjs';
import {MemoryNative360Flash} from '../packages/simulator/native360-flash.mjs';
import {native360Caps,native360Manifest,native360SyntheticVerify,native360SyntheticBytes} from '../packages/simulator/native360-fixture.mjs';
import {observationFixture} from '../packages/simulator/round-pet-observation-fixture.mjs';
import {validateRootCheckpoint,assessRootRecovery} from '../packages/core/round-pet-root-checkpoint.mjs';
import {assemblyFixture} from './fixtures/round-pet-assembly-lab.mjs';
import {offlinePKI} from './fixtures/offline-pki.mjs';import {executionLab} from './fixtures/round-pet-execution-lab.mjs';
const pki=offlinePKI({parent:process.env.HUB_TEST_TMPDIR});test.after(()=>{pki.close();assert.equal(pki.resources().exists,false);});
const clone=structuredClone,err=(fn,code)=>assert.throws(fn,e=>e.code===code);
const ctx=(session='s1',service='owner1')=>({device_id:'D',binding_id:'B',binding_epoch:'1',boot_id:'same_boot',session_id:session,controller_id:'C',service_instance_id:service});
function local(t,{fault=()=>{}}={}){const medium=new MemoryNative360Flash({fault}),manifest=native360Manifest();let validations=0;const d=new Native360DeviceModel({caps:native360Caps(),manifest,medium,clock:{now:()=>0},create:true,verifyAsset:(b,a)=>{validations++;return native360SyntheticVerify(b,a);}});t.after(()=>d.close());const command=(id=0,revision='1')=>({command_id:`manual_${revision}`,revision,character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id:id,asset_sha256:manifest.actions.find(a=>a.id===id).sha256});const prepare=(id=0,revision='1')=>{const w=d.request(command(id,revision)),r=d.load(w);if(r.source==='network')d.supply(w,native360SyntheticBytes(id));d.verify(w);return w;};return {d,medium,command,prepare,validations:()=>validations};}
function observations(t,overrides={}){const f=observationFixture(overrides);t.after(()=>f.close());return f;}
function confirmRoot(f,seq='4',ids=[0,4,1,11]){f.query('inventory','q');f.ingest(f.inventory('q','1',seq,ids));return f.model.rootCheckpoint();}
async function ready(t,options){const s=await executionLab(t,pki,options);await s.manual(43);await s.load();await s.download();await s.verify();await s.frame();return s;}
async function saved(t){const s=await ready(t);await s.save({victim_action_id:1});s.writeAll();await s.commit();return s;}
async function negotiate(s){assert.equal((await s.step()).control.kind,'query.inventory');await s.flush();s.a.acquire(s.f.deadline());await s.step();await s.flush();}
test('A7-01 new authenticated context resets revision without reboot, Flash scan or losing held pixels',t=>{
 const s=local(t);s.d.beginSession(ctx());const w=s.prepare();s.d.submitFrame(s.d.prepareFrame(w));s.d.beginSave(w);s.d.writeSave(w);s.d.commitSave(w);const root=s.d.snapshot().inventory,count=s.validations(),late=s.d.prepareFrame(w);assert.equal(s.d.beginSession(ctx('s2','owner2')),true);assert.deepEqual(s.d.snapshot().inventory,root);assert.equal(s.validations(),count);assert.equal(s.d.snapshot().actual.command_id,'manual_1');assert.equal(s.d.snapshot().display_state,'held_last_valid');err(()=>s.d.submitFrame(late),'stale_task');const next=s.prepare(0,'1');assert.notEqual(next,w);assert.equal(s.d.snapshot().desired.revision,'1');
});
test('A7-02 same-context open is idempotent and does not clear live frame or revision protection',t=>{
 const s=local(t);s.d.beginSession(ctx());const w=s.prepare(),frame=s.d.prepareFrame(w);assert.equal(s.d.beginSession(clone(ctx())),false);s.d.submitFrame(frame);err(()=>s.d.request(s.command(11,'0')),'stale_revision');
});
test('A7-03 new session cancels partial stage and old work while keeping the root',t=>{
 const s=local(t);s.d.beginSession(ctx());const w=s.prepare();s.d.beginSave(w);s.d.writeSave(w,100);s.d.beginSession(ctx('s2'));assert.equal(s.d.resources().save_tasks,0);assert.equal(s.d.snapshot().inventory.root_seq,'0');assert.equal(s.d.resources().flash.pending,0);err(()=>s.d.commitSave(w),'stale_task');assert.equal(s.medium.resources().owner,true);
});
test('A7-04 new session cannot heal marker uncertainty or reset the storage root',t=>{
 let armed=false;const s=local(t,{fault:x=>{if(armed&&x==='after_root_marker')throw new Error('injected');}});s.d.beginSession(ctx());const w=s.prepare();s.d.beginSave(w);s.d.writeSave(w);armed=true;err(()=>s.d.commitSave(w),'storage_commit_unknown');armed=false;s.d.beginSession(ctx('s2'));assert.equal(s.d.snapshot().inventory.known,false);assert.equal(s.d.snapshot().maintenance,'blocked');err(()=>s.d.request(s.command()),'storage_commit_unknown');
});
test('A7-05 malformed context cannot discard current work',t=>{
 const s=local(t);s.d.beginSession(ctx());s.prepare();const before=s.d.snapshot();for(const bad of [{...ctx(),extra:1},{...ctx(),binding_epoch:1},{...ctx(),session_id:''}])assert.throws(()=>s.d.beginSession(bad));assert.deepEqual(s.d.snapshot(),before);
});
test('A7-06 root checkpoint roundtrip is private state and never counts as current inventory',t=>{
 const f=observations(t),cp=confirmRoot(f),next=observations(t,{rootCheckpoint:JSON.parse(JSON.stringify(cp))});assert.equal(next.model.snapshot().devices[0].inventory.known,false);assert.equal(next.model.inventoryState().known,false);assert.deepEqual(next.model.rootCheckpoint(),cp);for(const key of ['control','desired','token','session_id','service_instance_id'])assert.ok(!JSON.stringify(cp).includes(key));
});
test('A7-07 saved advances checkpoint floor before a complete newer inventory exists',t=>{
 const f=observations(t);confirmRoot(f);const target=f.sent(f.command(43));f.model.expectSave(f.context,'op',target);f.ingest(f.storage(target,'op','1','saved','5'));const cp=f.model.rootCheckpoint();assert.equal(cp.floor_seq,'5');assert.equal(cp.root.root_seq,'4');const next=observations(t,{rootCheckpoint:cp});next.query('inventory','q');err(()=>next.ingest(next.inventory('q','1','4')),'stale_root');assert.equal(next.model.rootCheckpoint().floor_seq,'5');assert.equal(cp.floor_commit.object_generation,'5');next.query('inventory','new');const wrong=next.inventory('new','2','5',[0,4,1,43]);wrong.active.find(a=>a.action_id===43).object_generation='5';wrong.active.find(a=>a.action_id===43).asset_sha256='b'.repeat(64);err(()=>next.ingest(wrong),'root_conflict');const {schema_version,type,inventory_seq,query_id,known,...root}=wrong;assert.equal(assessRootRecovery(cp,{...cp,root,floor_commit:null}).reason,'root_conflict');const incomplete=clone(cp);incomplete.floor_commit=null;err(()=>validateRootCheckpoint(incomplete),'invalid_root_checkpoint');
});
test('A7-08 restored same-sequence conflicting root is rejected rather than overwritten',t=>{
 const f=observations(t),cp=confirmRoot(f),next=observations(t,{rootCheckpoint:cp});next.query('inventory','q');const r=next.inventory('q');r.active[2].asset_sha256='b'.repeat(64);err(()=>next.ingest(r),'root_conflict');assert.deepEqual(next.model.rootCheckpoint(),cp);
});
test('A7-09 checkpoint codec rejects malformed authority and preserves exact uint64 floors',t=>{
 const f=observations(t),cp=confirmRoot(f);for(const change of [c=>c.extra=1,c=>c.namespace='a'.repeat(64),c=>c.floor_seq=5,c=>c.floor_seq='3',c=>c.root.active[0].object_generation='5',c=>c.root.active.push(c.root.active[0]),c=>c.root.root_state='EMPTY',c=>c.binding.extra='x']){const c=clone(cp);change(c);assert.throws(()=>validateRootCheckpoint(c));}cp.floor_seq=cp.root.root_seq='18446744073709551615';assert.equal(validateRootCheckpoint(cp).floor_seq,cp.floor_seq);assert.equal(validateRootCheckpoint(cp).root.root_seq,cp.floor_seq);
});
test('A7-10 checkpoint binds device, binding and epoch but permits a new owner/session',t=>{
 const f=observations(t),cp=confirmRoot(f);for(const k of ['device_id','binding_id','binding_epoch']){const c=clone(cp);c.binding[k]=k==='binding_epoch'?'2':'other';assert.throws(()=>observationFixture({rootCheckpoint:c}),e=>e.code==='root_checkpoint_binding_mismatch');}const next=observations(t,{rootCheckpoint:cp,instanceId:'new_owner'});assert.equal(next.model.rootCheckpoint().floor_seq,'4');
});
test('A7-11 maintenance review never enables writes or mutates the approved floor',t=>{
 const f=observations(t),cp=confirmRoot(f),low=clone(cp);low.floor_seq=low.root.root_seq='3';low.root.active=low.root.active.filter(a=>a.object_generation!=='4');const before=clone(cp),r=assessRootRecovery(cp,low);assert.equal(r.reason,'root_rollback');assert.equal(r.can_write,false);assert.equal(r.floor_seq,'4');assert.deepEqual(cp,before);assert.equal(assessRootRecovery(cp,cp).can_write,false);assert.equal(assessRootRecovery(cp,{...cp,floor_seq:'0',root:null}).reason,'inventory_unknown');
});
test('A7-12 real new hub owner accepts manual_1 on the same running device actor',async t=>{
 const s=await ready(t),old=clone(s.peer.context),oldFrame=s.executor.prepareFrame(),count=s.validations(),root=s.executor.snapshot().inventory;const result=await s.restartHub();assert.equal(result.phase,'disabled');assert.notEqual(s.peer.context.service_instance_id,old.service_instance_id);assert.equal(s.peer.context.boot_id,old.boot_id);assert.equal(s.validations(),count);assert.deepEqual(s.executor.snapshot().inventory,root);assert.equal(s.executor.snapshot().display_state,'held_last_valid');err(()=>s.executor.submitFrame(oldFrame),'lease_expired');await negotiate(s);const target=await s.manual(11);assert.equal(target.revision,'1');await s.load();await s.verify();await s.frame();assert.equal(s.row().actual.action_id,11);
});
test('A7-13 old-context callbacks cannot inject control or disconnect the new session',async t=>{
 const s=await ready(t),old=clone(s.peer.context),grant=clone(s.peer.grant);await s.restartHub();await negotiate(s);err(()=>s.executor.setControl(grant,s.deviceClock.now()+1000,old),'stale_session');err(()=>s.executor.receive({kind:'query.inventory',payload:{query_id:'late'},dispatch_id:'late'},old),'stale_session');assert.equal(s.executor.disconnect(old),false);assert.equal(s.executor.resources().context,true);await s.manual(11);assert.equal(s.row().desired.action_id,11);
});
test('A7-14 temporary serialized checkpoint preserves saved floor across owner restart before query',async t=>{
 const s=await saved(t),cp=s.a.rootCheckpoint();assert.equal(cp.floor_seq,'5');assert.equal(cp.root.root_seq,'4');await s.restartHub();const file=JSON.parse(readFileSync(join(s.f.root,'root-checkpoint.json'),'utf8'));assert.equal(file.floor_seq,'5');assert.equal(s.row().inventory.known,false);await negotiate(s);assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().storage.length,0);assert.equal(s.row().desired,null);
});
test('A7-15 new owner still blocks a physical-model root rollback and exposes a stable reason',async t=>{
 const s=await saved(t);await s.inventory();const cp=s.a.rootCheckpoint(),slot=s.executor.snapshot().inventory.entries.find(e=>e.asset.id===43).slot;s.medium.damageObject(slot,o=>o.data[0]^=1);s.executor.reboot();assert.equal(s.executor.snapshot().inventory.root_seq,'4');await s.restartHub({checkpoint:cp});await s.step();await assert.rejects(s.flush());assert.equal(s.a.snapshot().assemblyReview.error,'stale_root');assert.equal(s.row().inventory.known,false);assert.equal(s.a.rootCheckpoint().floor_seq,'5');assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);s.medium.damageObject(slot,o=>o.data.set(s.f.media.asset));s.executor.reboot();await s.disconnect();await s.a.enableReview();await s.connect();await s.step();await s.flush();assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().inventory.known,true);assert.equal(s.a.rootCheckpoint().floor_seq,'5');assert.equal(s.row().desired,null);
});
test('A7-16 a new authenticated session reports unknown storage without rebooting it healthy',async t=>{
 let armed=false;const s=await ready(t,{fault:x=>{if(armed&&x==='before_root_marker')throw new Error('injected');}});await s.save({victim_action_id:1});s.writeAll();armed=true;err(()=>s.executor.commitSave(),'storage_commit_unknown');armed=false;await s.flush();const count=s.validations();await s.restartHub();await s.step();await s.flush();assert.equal(s.validations(),count);assert.equal(s.row().inventory.known,false);assert.equal(s.executor.snapshot().inventory.known,false);err(()=>s.a.manual(0,s.f.deadline()),'inventory_unconfirmed');
});
test('A7-17 deferred cancel before commit preserves the old root and rejects late commit',async t=>{
 const s=await ready(t);await s.save({victim_action_id:1});s.executor.writeSave(100);s.executor.deferSave();await s.flush();s.a.cancel(s.f.deadline());await s.step();await s.flush();err(()=>s.executor.commitSave(),'stale_task');await s.inventory();assert.equal(s.row().inventory.root_seq,'4');assert.equal(s.row().storage.some(r=>r.status==='saved'),false);
});
test('A7-18 committed root and queued saved survive a later cancel in the same exchange sequence',async t=>{
 const s=await ready(t);await s.save({victim_action_id:1});s.executor.deferSave();await s.flush();s.writeAll();s.executor.commitSave();s.a.cancel(s.f.deadline());await s.step();await s.flush();await s.inventory();assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().storage.at(-1).status,'saved');assert.equal(s.executor.snapshot().phase,'cancelled');
});
test('A7-19 cancellation after unknown commit does not fabricate a cancellation acknowledgement',async t=>{
 let armed=false;const s=await ready(t,{fault:x=>{if(armed&&x==='after_root_marker')throw new Error('injected');}});await s.save({victim_action_id:1});s.executor.deferSave();await s.flush();s.writeAll();armed=true;err(()=>s.executor.commitSave(),'storage_commit_unknown');armed=false;await s.flush();s.a.cancel(s.f.deadline());await assert.rejects(s.step(),e=>e.code==='storage_commit_unknown');assert.equal(s.executor.resources().outbox,0);assert.equal(s.row().storage.at(-1).status,'outcome_unknown');assert.equal(s.executor.snapshot().inventory.known,false);
});
test('A7-20 an old saved report cannot confirm an operation in a new hub context',async t=>{
 const s=await ready(t);await s.save({victim_action_id:1});s.writeAll();s.executor.commitSave();const old=s.executor.take();await s.restartHub();await negotiate(s);await assert.rejects(s.step({observation:{...old,dispatch_id:null}}));assert.equal(s.row().storage.length,0);assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);
});
test('A7-21 a different checkpoint cannot attach to a running owner or start another source',async t=>{
 const s=await executionLab(t,pki),starts=s.f.power.starts;await assert.rejects(s.f.start({rootCheckpoint:s.a.rootCheckpoint()}),/differs/);assert.equal(s.f.power.starts,starts);assert.equal(s.a.resources().catalog.worker_alive,true);const other=assemblyFixture(t,pki),cp=s.a.rootCheckpoint(),owner=await other.start({rootCheckpoint:cp});cp.floor_seq='0';cp.root=null;cp.floor_commit=null;await owner.roundPetAssembly.ready;assert.equal(owner.roundPetAssembly.rootCheckpoint().floor_seq,'4');
});
test('A7-22 IPC cannot import checkpoints, lower floors, rebind or enable production transport',async t=>{
 const s=await executionLab(t,pki);for(const path of ['/v1/root-checkpoint','/v1/recovery/reset','/v1/recovery/rebind'])await assert.rejects(s.hub.client.request('POST',path,{}),e=>e.status===404);const status=await s.hub.client.request('GET','/v1/status');assert.equal(status.capabilities.deviceTransport,false);assert.ok(!JSON.stringify(status).includes('floor_seq'));assert.equal(status.assemblyReview.production_listener,false);
});
test('A7-23 matching checkpoint data does not bypass a fresh authenticated inventory or control',async t=>{
 const s=await executionLab(t,pki);await s.restartHub();err(()=>s.a.manual(0,s.f.deadline()),'inventory_unconfirmed');await s.step();await s.flush();assert.equal(s.row().inventory.known,true);assert.equal(s.row().controlled,false);assert.equal(s.row().playback,null);const cp=s.a.rootCheckpoint();cp.binding.device_id='other_device';await assert.rejects(s.restartHub({checkpoint:cp}));assert.equal(s.a.snapshot().assemblyReview.error,'root_checkpoint_binding_mismatch');assert.equal(s.a.resources().managed.sessions.sessions,0);
});
test('A7-24 restart and close reclaim all owned resources while preserving the model medium',async t=>{
 const s=await executionLab(t,pki);await s.restartHub();await negotiate(s);await s.close();assert.equal(s.medium.resources().owner,false);assert.equal(s.medium.resources().object_records,4);assert.equal(s.a.resources().catalog.worker_alive,false);assert.equal((await s.a.lifecycle.list()).entries[0].protected,false);assert.equal(existsSync(join(s.f.directory,'service.json')),false);
});
