import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {join} from 'node:path';
import {offlinePKI} from './fixtures/offline-pki.mjs';
import {executionLab} from './fixtures/round-pet-execution-lab.mjs';
const pki=offlinePKI({parent:process.env.HUB_TEST_TMPDIR});test.after(()=>{pki.close();assert.equal(pki.resources().exists,false);});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code),ids=s=>s.executor.snapshot().inventory.entries.map(e=>e.asset.id).sort((a,b)=>a-b);
const available=(s,id)=>s.row().inventory.actions.find(a=>a.action_id===id).offline_available;
async function prepared(t,opts){const s=await executionLab(t,pki,opts);await s.manual();assert.equal((await s.load()).source,'network');await s.download();await s.verify();return s;}
async function saving(t,opts){const s=await prepared(t,opts);await s.frame();await s.save({victim_action_id:1});return s;}
test('A6-01 initial authenticated inventory comes from recovered model root, with independent clocks',async t=>{
 const s=await executionLab(t,pki);assert.equal(s.deviceClock.now()-s.f.clock.now(),700000);assert.deepEqual(ids(s),[0,1,4,11]);assert.equal(s.row().inventory.root_seq,s.executor.snapshot().inventory.root_seq);assert.equal(s.row().inventory.known,true);for(const id of ids(s))assert.equal(available(s,id),true);assert.equal(available(s,43),false);assert.equal(s.row().actual,null);assert.ok(s.validations()>0);
});
test('A6-02 cached RAM playback verifies without network but only submit confirms playing',async t=>{
 const s=await executionLab(t,pki);await s.manual(11);assert.equal(s.row().playback.phase,'accepted');assert.equal((await s.load()).source,'flash_ram');await s.verify();assert.equal(s.row().playback.phase,'verified');assert.equal(s.row().actual,null);const token=s.executor.prepareFrame();assert.equal(s.row().actual,null);s.executor.submitFrame(token);await s.flush();assert.equal(s.row().playback.phase,'playing');assert.equal(s.row().actual.action_id,11);assert.equal(s.resources().received_bytes,0);err(()=>s.executor.submitFrame(token),'stale_task');
});
test('A6-03 disk download is not verified or a frame; model SHA/CRC precedes confirmation',async t=>{
 const s=await executionLab(t,pki);await s.manual();await s.load();await s.download();assert.equal(s.row().playback.phase,'downloading');assert.equal(s.row().actual,null);assert.equal(s.executor.snapshot().working.verified,false);err(()=>s.executor.prepareFrame(),'invalid_phase');await s.verify();assert.equal(s.row().playback.phase,'verified');assert.equal(s.row().actual,null);await s.frame();assert.equal(s.row().actual.action_id,43);assert.equal(s.resources().received_bytes,s.f.media.asset.length);assert.equal(s.executor.resources().actor.encoded_buffers,1);
});
test('A6-04 model rejects corrupted downloaded bytes and reports failed without actual or saved',async t=>{
 const s=await executionLab(t,pki);await s.manual();await s.load();await s.download({mutate:b=>{b[b.length-1]^=1;return b;}});err(()=>s.executor.verify(),'asset_integrity_failed');await s.flush();assert.equal(s.row().playback.phase,'failed');assert.equal(s.row().actual,null);assert.equal(s.row().storage.length,0);assert.equal(s.executor.resources().actor.encoded_buffers,0);
});
test('A6-05 staging remains unavailable; incomplete commit cannot publish or acknowledge save',async t=>{
 const s=await saving(t);assert.equal(s.row().storage.length,0);s.executor.writeSave(100);assert.equal(s.executor.snapshot().inventory.root_seq,'4');assert.equal(available(s,43),false);err(()=>s.executor.commitSave(),'asset_incomplete');assert.equal(s.executor.resources().operation,1);assert.equal(s.executor.resources().outbox,0);s.writeAll();await s.commit();assert.equal(s.row().storage[0].status,'saved');assert.equal(s.row().inventory.known,false);assert.equal(s.row().actual.action_id,43);
});
test('A6-06 root commit alone changes inventory; queried eviction and historical saved stay separate',async t=>{
 const s=await saving(t);s.writeAll();await s.commit();assert.deepEqual(ids(s),[0,4,11,43]);assert.equal(s.row().storage[0].root_seq,'5');await s.inventory();assert.equal(available(s,43),true);assert.equal(available(s,1),false);assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().storage[0].object_generation,'5');
});
test('A6-07 model EMPTY bootstraps 0 then 4 through real download/verify/save transactions',async t=>{
 const s=await executionLab(t,pki,{seed:[]});assert.equal(s.row().inventory.root_state,'EMPTY');err(()=>s.a.manual(11,s.f.deadline()),'unsafe_cache_write');for(const id of [0,4]){await s.manual(id);await s.load();await s.download();await s.verify();await s.save();s.writeAll();await s.commit();await s.inventory();assert.equal(available(s,id),true);}assert.equal(s.row().inventory.root_state,'OFFLINE_READY');assert.equal(s.row().inventory.root_seq,'2');assert.deepEqual(ids(s),[0,4]);assert.equal(s.row().actual,null);
});
test('A6-08 cached touch holds one Flash read lease and no fabricated RAM slot',async t=>{
 const s=await executionLab(t,pki);await s.manual(0);await s.load();await s.verify();await s.frame();await s.manual(4);assert.equal((await s.load()).source,'flash_stream');await s.verify();await s.frame();assert.equal(s.executor.resources().actor.encoded_buffers,1);assert.equal(s.executor.resources().actor.stream_leases,1);assert.equal(s.row().actual.action_id,4);assert.equal(s.resources().received_bytes,0);
});
for(const [n,stage,write] of [[9,'before_payload',true],[10,'after_payload',true],[11,'before_object_header',false],[12,'after_object_header',false]])test(`A6-${String(n).padStart(2,'0')} ${stage} failure preserves old root and never reports saved`,async t=>{
 let armed=false;const s=await saving(t,{fault:x=>{if(armed&&x===stage)throw new Error('injected');}});if(!write)s.writeAll();armed=true;err(()=>write?s.executor.writeSave():s.executor.commitSave(),'storage_failed');armed=false;await s.flush();assert.equal(s.row().storage[0].status,'failed');assert.equal(s.row().inventory.known,true);assert.deepEqual(ids(s),[0,1,4,11]);await s.disconnect();s.executor.reboot();await s.connect();await s.step();await s.flush();assert.equal(s.row().inventory.root_seq,'4');assert.equal(available(s,43),false);assert.equal(s.executor.resources().actor.flash.pending,0);
});
for(const [n,stage,persisted] of [[13,'before_root_marker',false],[14,'after_root_marker',true]])test(`A6-${n} ${stage} is unknown until fresh recovered inventory, without replaying save`,async t=>{
 let armed=false;const s=await saving(t,{fault:x=>{if(armed&&x===stage)throw new Error('injected');}});s.writeAll();armed=true;err(()=>s.executor.commitSave(),'storage_commit_unknown');armed=false;await s.flush();assert.equal(s.row().storage[0].status,'outcome_unknown');assert.equal(s.row().inventory.known,false);assert.equal(s.executor.snapshot().inventory.known,false);err(()=>s.a.save(s.f.deadline(),{victim_action_id:1}),'storage_outcome_unknown');await s.disconnect();s.executor.reboot();await s.connect();await s.step();await s.flush();assert.equal(available(s,43),persisted);assert.equal(s.row().inventory.root_seq,persisted?'5':'4');assert.equal(s.row().desired,null);assert.equal(s.row().actual.is_current,false);assert.equal(s.executor.snapshot().actual,null);assert.equal(s.row().storage[0].status,'outcome_unknown');assert.equal(s.executor.resources().operation,0);
});
test('A6-15 readback I/O after marker is unknown and recovers the committed root',async t=>{
 let armed=false,readback=false;const s=await saving(t,{fault:x=>{if(armed&&x==='after_root_marker')readback=true;if(readback&&x==='before_root_read')throw new Error('injected-read');}});s.writeAll();armed=true;err(()=>s.executor.commitSave(),'storage_commit_unknown');armed=readback=false;await s.flush();await s.disconnect();s.executor.reboot();await s.connect();await s.step();await s.flush();assert.equal(available(s,43),true);assert.equal(s.row().storage[0].status,'outcome_unknown');
});
test('A6-16 corrupt newer object falls back in model but hub rejects a confirmed root rollback',async t=>{
 const s=await saving(t);s.writeAll();await s.commit();await s.inventory();const slot=s.executor.snapshot().inventory.entries.find(e=>e.asset.id===43).slot;await s.disconnect();s.medium.damageObject(slot,o=>o.data[0]^=1);s.executor.reboot();assert.equal(s.executor.snapshot().inventory.root_seq,'4');await s.connect();await s.step();await assert.rejects(s.flush());assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);assert.equal(s.row().inventory.known,false);assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().storage[0].status,'saved');
});
test('A6-17 invalid nonerased roots block recovery without formatting or fake inventory',async t=>{
 const s=await executionLab(t,pki);await s.disconnect();for(const i of [0,1])s.medium.damageRoot(i,r=>r.valid=false);err(()=>s.executor.reboot(),'flash_recovery_failed');assert.equal(s.executor.snapshot().inventory.known,false);assert.equal(s.medium.resources().object_records,4);assert.equal(s.medium.resources().root_records,2);
});
test('A6-18 storage I/O during recovery does not pretend an older valid root is safe',async t=>{
 let armed=false;const s=await executionLab(t,pki,{fault:x=>{if(armed&&x==='before_payload_read')throw Object.assign(new Error('I/O'),{code:'fixture_io'});}});await s.disconnect();armed=true;err(()=>s.executor.reboot(),'fixture_io');assert.equal(s.executor.snapshot().inventory.known,false);armed=false;s.executor.reboot();assert.equal(s.executor.snapshot().inventory.known,true);assert.deepEqual(ids(s),[0,1,4,11]);
});
test('A6-19 cancellation during staging releases pending object without publishing a new root',async t=>{
 const s=await saving(t);s.executor.writeSave(100);s.executor.deferSave();await s.flush();assert.equal(s.row().storage[0].status,'deferred');s.a.cancel(s.f.deadline());assert.equal((await s.step()).control.kind,'playback.cancel');await s.flush();assert.equal(s.executor.resources().actor.flash.pending,0);assert.equal(s.executor.snapshot().phase,'cancelled');err(()=>s.executor.commitSave(),'stale_task');await s.inventory();assert.deepEqual(ids(s),[0,1,4,11]);assert.equal(available(s,43),false);assert.equal(s.row().storage.some(r=>r.status==='saved'),false);
});
test('A6-20 superseded frame token cannot resurrect an older target',async t=>{
 const s=await prepared(t),late=s.executor.prepareFrame();await s.manual(55);const staleLoad=await s.load();await s.manual(11);err(()=>s.executor.submitFrame(late),'stale_task');await s.load();err(()=>s.executor.supply(staleLoad.ticket,s.f.media.asset),'stale_task');await s.verify();await s.frame();assert.equal(s.row().actual.action_id,11);assert.equal(s.row().desired.action_id,11);assert.equal(s.row().storage.length,0);
});
test('A6-21 lost saved receipt is reconciled by inventory only, not synthetic saved or replay',async t=>{
 const s=await saving(t);s.writeAll();s.executor.commitSave();assert.equal(s.executor.resources().outbox,1);assert.equal(s.row().storage.length,0);await s.disconnect();s.executor.reboot();await s.connect();await s.step();await s.flush();assert.equal(s.row().inventory.root_seq,'5');assert.equal(available(s,43),true);assert.equal(s.row().storage.length,0);assert.equal(s.row().desired,null);assert.equal(s.executor.resources().actor.encoded_buffers,0);
});
test('A6-22 independent device lease expiry blocks late frame and Flash writes',async t=>{
 const s=await prepared(t),late=s.executor.prepareFrame(),grant=s.peer.grant;s.deviceClock.advance(15000);err(()=>s.executor.submitFrame(late),'lease_expired');assert.equal(s.executor.snapshot().actual,null);assert.equal(s.row().actual,null);assert.equal(s.f.clock.now(),0);err(()=>s.executor.writeSave(),'lease_expired');s.executor.setControl(grant,s.deviceClock.now()+1000);err(()=>s.executor.submitFrame(late),'stale_task');assert.equal(s.executor.resources().actor.frame_tickets,0);await s.manual(11);await s.load();await s.verify();const unobserved=s.executor.prepareFrame();s.deviceClock.advance(15000);s.executor.setControl(grant,s.deviceClock.now()+1000);err(()=>s.executor.submitFrame(unobserved),'stale_task');assert.equal(s.executor.snapshot().actual,null);
});
test('A6-23 host suspend denies the next exchange and observed link failure fences model work',async t=>{
 const s=await prepared(t),late=s.executor.prepareFrame();s.f.power.emit('suspend');await assert.rejects(s.step());assert.equal(s.a.snapshot().assemblyReview.phase,'suspended');assert.equal(s.executor.resources().context,false);err(()=>s.executor.submitFrame(late),'stale_session');assert.equal(s.executor.resources().actor.frame_tickets,0);s.f.power.emit('resume');assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);
});
test('A6-24 explicit link loss cancels a partial download and stale supply cannot resume it',async t=>{
 const s=await executionLab(t,pki);await s.manual();await s.load();const r=await s.step();await s.peer.segment(0,32767,r.read_permit);await s.disconnect();err(()=>s.executor.supply(s.f.media.asset),'stale_session');assert.equal(s.executor.resources().actor.encoded_buffers,0);assert.equal(s.executor.resources().outbox,0);s.executor.reboot();await s.connect();await s.step();await s.flush();assert.equal(s.row().actual,null);assert.equal(s.row().desired,null);
});
test('A6-25 close releases the medium claim, worker, pins and owned IPC without erasing Flash',async t=>{
 const s=await saving(t);s.writeAll();await s.commit();await s.close();assert.equal(s.medium.resources().owner,false);assert.equal(s.medium.resources().object_records,5);assert.equal(s.executor.resources().outbox,0);assert.equal(s.a.resources().catalog.worker_alive,false);assert.equal((await s.a.lifecycle.list()).entries[0].protected,false);assert.equal(existsSync(join(s.f.directory,'hub.sock')),false);assert.equal(existsSync(join(s.f.directory,'service.json')),false);
});
test('A6-26 queued observations are bounded and a rejected extra query changes no model state',async t=>{
 const s=await executionLab(t,pki),before=s.executor.snapshot().inventory;for(let i=0;i<16;i++)s.executor.receive({kind:'query.inventory',dispatch_id:`q_${i}`,payload:{query_id:`inventory_${i}`}});err(()=>s.executor.receive({kind:'query.inventory',dispatch_id:'q_17',payload:{query_id:'inventory_17'}}),'queue_full');assert.equal(s.executor.resources().outbox,16);assert.deepEqual(s.executor.snapshot().inventory,before);await s.disconnect();assert.equal(s.executor.resources().outbox,0);
});
test('A6-27 mismatched package or control cannot reach the execution actor',async t=>{
 const s=await executionLab(t,pki),target={command_id:'wrong',revision:'1',character_id:s.f.media.manifest.character_id,variant_id:s.f.media.manifest.variant_id,manifest_sha256:s.f.media.manifest.sha256,action_id:43,asset_sha256:s.f.media.F};for(const payload of [{target,control:s.peer.grant,package_ref:{...s.f.media.packageRef,firmware_package_sha256:'a'.repeat(64)}},{target,control:{...s.peer.grant,lease_id:'wrong'},package_ref:s.f.media.packageRef}])err(()=>s.executor.receive({kind:'playback.set',dispatch_id:'bad',payload}),'stale_control');assert.equal(s.executor.snapshot().desired,null);assert.equal(s.executor.resources().outbox,0);
});
test('A6-28 saving holds the last valid frame; only a fresh submit resumes with a new refresh',async t=>{
 const s=await prepared(t);await s.frame();const first=s.row().playback.first_frame_seq,refresh=s.row().actual.refresh_generation,late=s.executor.prepareFrame();await s.save({victim_action_id:1});err(()=>s.executor.submitFrame(late),'stale_task');s.writeAll();await s.commit();s.a.query('display',s.f.deadline());await s.step();await s.flush();assert.equal(s.row().display_state,'held_last_valid');assert.equal(s.row().maintenance,'saving');await s.frame();assert.equal(s.row().display_state,'playing');assert.equal(s.row().playback.first_frame_seq,first);assert.ok(BigInt(s.row().actual.refresh_generation)>BigInt(refresh));assert.equal(s.row().maintenance,'none');
});
test('A6-29 sequential root commits evict old saved content while preserving history',async t=>{
 const s=await saving(t);s.writeAll();await s.commit();await s.inventory();await s.manual(55);await s.load();await s.download();await s.verify();await s.frame();await s.save({victim_action_id:43});s.writeAll();await s.commit();await s.inventory();assert.deepEqual(ids(s),[0,4,11,55]);assert.equal(available(s,43),false);assert.equal(available(s,55),true);assert.deepEqual(s.row().storage.map(r=>[r.action_id,r.root_seq]),[[43,'5'],[55,'6']]);assert.equal(s.row().actual.action_id,55);
});
test('A6-30 executor stays outside production candidate and service remains default-off transport',async t=>{
 const s=await executionLab(t,pki),status=await s.hub.client.request('GET','/v1/status');assert.equal(status.capabilities.deviceTransport,false);assert.equal(status.assemblyReview.production_listener,false);assert.deepEqual(status.devices,[]);assert.equal(existsSync('dist/packages/simulator/round-pet-executor.mjs'),false);assert.equal(s.executor.snapshot().synthetic,true);assert.equal(s.executor.snapshot().model,'native360-resources/1');
});
