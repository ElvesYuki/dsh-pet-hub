import test from 'node:test';import assert from 'node:assert/strict';
import {lab} from './fixtures/s1.mjs';import {Pet4Decoder,decodeLz4} from '../packages/core/pet4.mjs';import {pet4Fixture} from './fixtures/pet4.mjs';import {inspectPet4,verifyMaterial,sha256,readRegular} from '../packages/runtime/material-import.mjs';
import {VirtualClock,FaultQueue} from '../packages/simulator/index.mjs';import {createSimulation} from '../packages/simulator/session.mjs';import {mkdtempSync,realpathSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runReplayEndurance} from '../packages/simulator/replay-endurance.mjs';
const reject=(fn,code)=>assert.throws(fn,{code});
test('command window: 3000 commands retain actual/cache, stale evicted replay cannot reset/download',()=>{
 const l=lab(),a=l.acquire(),d=l.devices.A.device,first=l.command(0,'1','first');l.play(a,first);const actual=d.snapshot().actual;let last;
 for(let n=2;n<=3000;n++){last=l.command(n%2?11:58,String(n),`cmd_${n}`);d.set(a.ctx,a.grant,last);}
 assert.equal(d.resources().command_receipts,256);assert.equal(d.resources().command_revision,'3000');assert.deepEqual(d.snapshot().actual,actual);assert.ok(d.snapshot().cache.includes(actual.asset_sha256));
 const before=d.snapshot();reject(()=>d.set(a.ctx,a.grant,first),'stale_revision');d.set(a.ctx,a.grant,last);assert.deepEqual(d.snapshot(),before);reject(()=>d.set(a.ctx,a.grant,{...last,action_id:0,asset_sha256:first.asset_sha256}),'idempotency_conflict');
 reject(()=>d.set(a.ctx,a.grant,{...last,command_id:'bad',revision:'3001',url:'unsafe'}),'invalid_message');assert.equal(d.resources().command_receipts,256);assert.deepEqual(d.snapshot(),before);
 d.verify(last.command_id,l.assets.get(last.action_id));d.submitFrame(a.ctx,a.grant,last.command_id);assert.equal(d.snapshot().actual.command_id,last.command_id);assert.equal(d.snapshot().started,0);
});
test('intent window: beyond256 accepts new CAS; cached replay has no side effects, evicted one rejected',()=>{
 const l=lab(),s=l.scheduler();let last;for(let n=1;n<=2000;n++){last={intent_id:`i${n}`,client_id:'ui',service_instance_id:'H1',expected_revision:String(n-1),kind:'manual',action_id:n%2?11:58};s.submit(last);}
 assert.equal(s.resources().intent_receipts,256);const before=s.summary();assert.equal(s.submit(last).revision,'2000');assert.deepEqual(s.summary(),before);reject(()=>s.submit({...last,action_id:4}),'idempotency_conflict');reject(()=>s.submit({...last,intent_id:'i1',expected_revision:'0'}),'revision_conflict');assert.deepEqual(s.summary(),before);
});
test('acquire receipt: 600 epochs, persisted-failure atomicity and changed expected epoch conflict',()=>{
 const l=lab(),{ctx}=l.connect(),d=l.devices.A.device,store=l.devices.A.deviceStore;let grant;
 for(let n=0;n<600;n++){
  const before=store.writes;if(n===260){const state=d.resources();store.failNext=true;reject(()=>d.acquire(ctx,`op${n}`,String(n)),'storage_failed');assert.deepEqual(d.resources(),state);assert.equal(store.writes,before);}
  grant=d.acquire(ctx,`op${n}`,String(n));assert.equal(grant.control_epoch,String(n+1));assert.equal(d.resources().acquire_receipts,1);assert.deepEqual(d.acquire(ctx,`op${n}`,String(n)),grant);reject(()=>d.acquire(ctx,`op${n}`,String(n+1)),'idempotency_conflict');
  l.clock.advance(1);grant=d.renew(ctx,grant);assert.deepEqual(d.acquire(ctx,`op${n}`,String(n)),grant);assert.equal(store.writes,before+1);d.release(ctx,grant);
 }
 const writes=store.writes;reject(()=>d.acquire(ctx,'op0','0'),'stale_control');assert.equal(store.writes,writes);assert.equal(d.resources().acquire_receipts,1);d.reboot();assert.equal(d.resources().acquire_receipts,0);assert.equal(d.resources().sessions,0);reject(()=>d.acquire(ctx,'new','600'),'stale_boot');
});
test('session recycling: protect live lease owner, reject evicted/unauthenticated contexts',()=>{
 const l=lab(),a=l.acquire(),d=l.devices.A.device;let old;for(let n=0;n<60;n++){const c=d.connect('C',`other${n}`,l.devices.A.controllerProof);if(n===0)old=c;}
 assert.equal(d.resources().sessions,16);reject(()=>d.acquire(old,'old','1'),'stale_session');const before=d.resources();reject(()=>d.connect('C','fake',{}),'identity_conflict');assert.deepEqual(d.resources(),before);d.set(a.ctx,a.grant,l.command());assert.equal(d.snapshot().controlled,true);
 l.clock.advance(15000);d.connect('C','after_expiry',l.devices.A.controllerProof);reject(()=>d.acquire(a.ctx,'old_owner','1'),'stale_session');
});
test('sequenced touch: 1500 events retain256, consume cooldown events, reject conflict/mode bypass',()=>{
 const l=lab(),s=l.scheduler();s.source('connected','working');assert.equal(s.touch('t1',10,'1'),true);assert.equal(s.touch('t2',10,'2'),false);l.clock.advance(1000);assert.equal(s.touch('t2',10,'2'),false);assert.equal(s.desired(),11);
 for(let n=3;n<=1500;n++){assert.equal(s.touch(`t${n}`,10,String(n)),true);l.clock.advance(1000);}
 assert.equal(s.resources().touch_receipts,256);assert.equal(s.resources().event_seq,'1500');assert.equal(s.touch('t1',10,'1'),false);assert.equal(s.touch('late',10,'1499'),false);assert.equal(s.desired(),11);
 const before=s.resources();reject(()=>s.touch('t1500',11,'1500'),'idempotency_conflict');reject(()=>s.touch('t1500',10,'1501'),'idempotency_conflict');reject(()=>s.touch('bad',10,'01'),'invalid_message');reject(()=>s.touch('unsequenced',10),'invalid_message');assert.deepEqual(s.resources(),before);
 s.submit({intent_id:'manual',client_id:'ui',service_instance_id:'H1',expected_revision:'0',kind:'manual',action_id:58});assert.equal(s.touch('max',10,'18446744073709551615'),true);l.clock.advance(1000);assert.equal(s.desired(),58);assert.equal(s.touch('max_late',10,'18446744073709551615'),false);
});
test('legacy touch cannot safely forget event IDs: bounded failure rather than replay',()=>{
 const l=lab(),s=l.scheduler();for(let n=0;n<256;n++){assert.equal(s.touch(`t${n}`,1),true);l.clock.advance(1000);}assert.equal(s.touch('t0',1),false);reject(()=>s.touch('overflow',1),'capacity_exceeded');reject(()=>s.touch('switch_mode',1,'257'),'invalid_message');assert.equal(s.resources().touch_receipts,256);
});
test('diagnostic histories remain bounded; queue backpressure and clock overflow still reject',()=>{
 const clock=new VirtualClock({historyLimit:64}),q=new FaultQueue(clock);for(let n=0;n<5000;n++){clock.advance(1000);q.send(()=>n);q.flush();}
 assert.deepEqual(clock.historyStats(),{recorded:5000,retained:64,dropped:4936});assert.deepEqual(q.historyStats(),{recorded:10000,retained:1024,dropped:8976,pending:0});assert.equal(clock.now(),5000000);
 for(let n=0;n<128;n++)q.send(()=>null,{delay:10000,copies:8});reject(()=>q.send(()=>null),'capacity_exceeded');assert.equal(q.historyStats().pending,1024);const noHistory=new VirtualClock({historyLimit:0});noHistory.advance(Number.MAX_SAFE_INTEGER);reject(()=>noHistory.advance(1),'invalid_message');assert.equal(noHistory.timeline.length,0);
});
test('PET4 reusable decode preserves CRC, independent defaults and transferred pixel outputs',()=>{
 const bytes=pet4Fixture(360,13),d=new Pet4Decoder(bytes),indices=new Uint8Array(360*360),rgb=new Uint8Array(360*360*2),expected=inspectPet4(bytes);
 for(const index of [12,0,1,5,12]){const into=d.decodeInto(index,{indices,rgb565:rgb});assert.equal(into.indices,indices);assert.equal(into.rgb565,rgb);assert.equal(sha256(rgb),expected.frame(index).rgb565_sha256);}
 const saved=d.decode(0);saved.indices.fill(99);saved.rgb565.fill(99);assert.equal(d.decode(0).indices[0],0);reject(()=>d.decodeInto(0,{indices:new Uint8Array(1)}),'pet4_output');reject(()=>d.decodeInto(0,{rgb565:new Uint8Array(1)}),'pet4_output');
 const player=inspectPet4(bytes,{hashes:false}),own=player.pixels(2),sent=structuredClone(own,{transfer:[own.buffer]});assert.equal(own.byteLength,0);assert.equal(sha256(sent),expected.frame(2).rgb565_sha256);assert.equal(player.frame(2).rgb565_sha256,expected.frame(2).rgb565_sha256);
 const metadata=inspectPet4(bytes,{hashes:false,player:false});assert.equal(metadata.frames,13);assert.equal(metadata.frame,undefined);assert.equal(metadata.index_sha256,undefined);
 const out=new Uint8Array(5);assert.equal(decodeLz4(Uint8Array.from([0x50,1,2,3,4,5]),5,out),out);assert.deepEqual([...out],[1,2,3,4,5]);reject(()=>decodeLz4(new Uint8Array(5),5,new Uint8Array(4)),'lz4_output');
});
test('CRC-only full validation still rejects late corruption even with recomputed asset SHA',()=>{
 const bytes=pet4Fixture(240,13);bytes[532+4*14+4*12]^=1;const action={id:0,bytes:bytes.length,sha256:sha256(bytes)},m={codec:'PET4',display:{width:240,height:240,pixel_format:'RGB565'}};reject(()=>verifyMaterial(bytes,action,m,{hashes:false,player:false}),'pet4_frame_crc');reject(()=>inspectPet4(bytes),'pet4_frame_crc');
});
test('bounded file reader returns exact partial-block content and rejects size/link violations',()=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'reader-')));try{const bytes=Buffer.alloc(65536+17,0x49);writeFileSync(join(root,'file'),bytes);assert.deepEqual(readRegular(root,'file',bytes.length),bytes);reject(()=>readRegular(root,'file',bytes.length-1),'asset_size_limit');symlinkSync(join(root,'file'),join(root,'link'));reject(()=>readRegular(root,'link',bytes.length),'unsafe_asset_path');writeFileSync(join(root,'empty'),'');assert.equal(readRegular(root,'empty',10).length,0);}finally{rmSync(root,{recursive:true,force:true});}
});
test('assembled simulation exceeds core256 manual commands without resurrecting evicted intent',()=>{
 const s=createSimulation({instanceId:'endurance'});try{let first;
 for(let n=0;n<650;n++){const before=s.snapshot(),d=before.devices[0],intent={service_instance_id:'endurance',client_id:'ui',intent_id:`i${n}`,device_id:'sim_A',expected_revision:d.intent_revision,kind:'manual',action_id:n%2?11:58};if(n===0)first=intent;s.intent(intent);s.control({service_instance_id:'endurance',client_id:'clock',request_id:`c${n}`,expected_revision:s.snapshot().revision,operation:'advance',ms:400});}
 const before=s.snapshot();reject(()=>s.intent(first),'revision_conflict');assert.deepEqual(s.snapshot(),before);assert.equal(s.requestResources().entries,128);assert.equal(before.devices[0].intent_revision,'650');assert.equal(before.devices[0].phase,'playing');
 }finally{s.stop();}
});
test('endurance harness bounds reports and clears only lease-scoped command receipts',()=>{
 const report=runReplayEndurance({steps:300,acquisitions:300});assert.equal(report.commands,600);assert.equal(report.acquisitions,600);assert.equal(report.virtual_ms,9000000);assert.equal(report.clock_history.retained,1024);for(const d of report.resources){assert.equal(d.command_phase.command_receipts,256);assert.equal(d.device.command_receipts,0);assert.equal(d.device.acquire_receipts,1);assert.equal(d.scheduler.intent_receipts,256);assert.equal(d.scheduler.touch_receipts,256);}
});
