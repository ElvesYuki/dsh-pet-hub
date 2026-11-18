import test from 'node:test';
import assert from 'node:assert/strict';
import {endpointHold} from './fixtures/native400-endpoint-hold.mjs';
import {status,send,command,until} from './fixtures/native400-controls-test-support.mjs';
import {createNative400PetBridge} from '../packages/runtime/native400-pet-bridge.mjs';
import {encodeTcp} from '../packages/core/native400-tcp.mjs';
const pause=()=>new Promise(r=>setTimeout(r,30));

test('END01 arbitration is explicit; event and observed-local defaults remain',()=>{
 const a=createNative400PetBridge();assert.equal(a.snapshot().mode,'event');assert.equal(a.snapshot().arbitration,'observed-local');
 assert.throws(()=>createNative400PetBridge({arbitration:'endpoint-arbitrated'}));
 assert.throws(()=>createNative400PetBridge({mode:'hold-state',arbitration:'endpoint-arbitrated',priority:()=> 'clear'}));
 assert.throws(()=>createNative400PetBridge({arbitration:'unknown'}));
});
test('END02 long touch crosses four bounded renewals, EOF presents latest working request',async t=>{
 const q=await endpointHold(t);await q.poll();await q.present();const token=q.model.touch(),touchStamp=q.beginCycle();
 await q.advance(3000);q.value('working',2);await q.poll();await q.advance(14500);
 assert.equal(q.b.snapshot().phase,'ready');assert.equal(q.model.tick().token,token);assert.equal(q.model.target.origin,'touch');
 const deferred=q.peer.acks.filter(a=>a.code===3);assert.ok(deferred.length>=4);assert.ok(deferred.every(a=>a.token==='0'));assert.ok(q.peer.records.some(r=>r.type===4));
 const v=await status(q.x);assert.equal(v.transport.phase,'open');assert.equal(v.transport.frame0_history,null);assert.equal(v.verified,null);assert.equal(v.current_display,'unknown');
 assert.equal(q.playback.eof(touchStamp),true);assert.equal(q.model.target.action,11);assert.equal(q.model.target.seq,deferred.at(-1).seq);await q.present();
 assert.equal((await status(q.x)).transport.frame0_history.action,11);assert.equal(q.model.touchDone(token),false);await q.close();
});
test('END03 cancellation during touch preserves local until EOF then local',async t=>{
 const q=await endpointHold(t);await q.poll();const touch=q.model.touch();await q.advance(3000);await q.b.close();await pause();
 assert.equal((await status(q.x)).shared.desired,null);assert.equal(q.model.target.origin,'touch');assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
for(const [name,options,invalidate] of [
 ['HTTP failure',{},q=>q.httpStatus(503)],['closed source',{},q=>q.source.close()],
 ['page budget',{sessionMs:10000},()=>{}],['observation budget',{sourceMs:10000},()=>{}]
])test(`END withdrawal ${name} cannot revive remote at touch EOF`,async t=>{
 const q=await endpointHold(t,options);await q.poll();const touch=q.model.touch();await q.advance(3000,{poll:false});invalidate(q);await q.poll();
 assert.equal((await status(q.x)).shared.desired,null);assert.equal(q.model.tick().origin,'touch');assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
test('END08 manual takeover during touch is neither overwritten nor cancelled',async t=>{
 const q=await endpointHold(t);await q.poll();const touch=q.model.touch();await send(q.x,command(await status(q.x),11));await pause();q.value('thinking',2);await q.poll();
 assert.equal((await status(q.x)).shared.desired.action,11);assert.notEqual(q.b.snapshot().phase,'ready');assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.action,11);
});
for(const mode of ['paused','down'])test(`END ${mode} permits authorized cleanup but refuses BASE`,async t=>{
 const q=await endpointHold(t);await q.poll();const touch=q.model.touch();if(mode==='paused')q.x.window.pause();else q.x.window.networkLink(2,false);await q.peer.closed;
 await assert.rejects(send(q.x,command(await status(q.x),11)),e=>e.status===409);await q.poll();assert.equal((await status(q.x)).shared.desired,null);
 assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
test('END11 lost local ACK confirms exact renewal body without extending deadline',async t=>{
 let lost=false;const bodies=[];const q=await endpointHold(t,{wrap:c=>({request:async(...a)=>{const v=await c.request(...a);if(a[0]==='POST'){bodies.push(structuredClone(a[2]));if(lost){lost=false;throw Error('lost ack');}}return v;}})});
 await q.poll();const touch=q.model.touch();q.f.time=3000;lost=true;await q.poll();assert.equal(q.b.snapshot().phase,'unknown');const reads=q.requests;await q.poll();assert.equal(q.requests,reads);
 q.f.time=3100;await q.b.confirm();assert.deepEqual(bodies[1],bodies[2]);assert.equal((await status(q.x)).shared.desired.remaining_ms,4900);assert.equal((await status(q.x)).transport.frame0_history,null);
 assert.equal(q.model.touchDone(touch),true);await q.present();
});
test('END12 true target expiry during touch is not revived by fresh unchanged source',async t=>{
 const q=await endpointHold(t);await q.poll();const touch=q.model.touch();await q.advance(5000,{poll:false});await q.poll();assert.equal(q.b.snapshot().phase,'expired');assert.equal((await status(q.x)).revision,'1');
 assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
for(const autoRecover of [true,false])test(`END reconnect retains touch, autoRecover=${autoRecover} uses original remaining lease only`,async t=>{
 const q=await endpointHold(t,{autoRecover});await q.poll();const touch=q.model.touch();await q.advance(1000,{poll:false});const old=q.peer;
 q.x.window.networkLink(2,false);await old.closed;q.f.time=1200;q.x.window.networkLink(3,true);await q.connect();await status(q.x);await pause();
 const v=await status(q.x);assert.equal(v.shared.desired.remaining_ms,3800);assert.equal(v.revision,'1');assert.equal(q.model.target.token,touch);
 assert.equal(q.model.disconnect(old.g),false);assert.equal(q.model.touchDone(touch),true);
 assert.equal(q.model.target.origin,autoRecover?'remote':'local');if(autoRecover){assert.equal(q.model.target.action,1);await q.present();}else assert.equal(q.peer.records.filter(r=>r.type===2).length,0);
});
test('END15 late prior request receipt and old touch completion cannot replace latest intent',async t=>{
 const q=await endpointHold(t);await q.poll();const stale=q.frame(),firstTouch=q.model.touch();q.value('working',2);await q.poll();
 q.peer.socket.write(encodeTcp(stale));await pause();assert.equal((await status(q.x)).transport.frame0_history,null);assert.equal((await status(q.x)).transport.phase,'open');
 assert.ok(q.model.touchDone(firstTouch));await q.present();const secondTouch=q.model.touch();assert.equal(q.model.touchDone(firstTouch),false);assert.equal(q.model.target.token,secondTouch);
});
test('END16 same-action renewal preserves playback and needs an actual new cycle frame0 for latest request',async t=>{
 const q=await endpointHold(t);await q.poll();await q.present();const before={...q.model.target},stamp=q.playback.stamp();assert.ok(q.playback.advanceFrame(stamp,73));await q.advance(3000);
 assert.deepEqual(q.model.target,before);assert.deepEqual(q.playback.stamp(),stamp);assert.equal(q.playback.framePosition,73);assert.equal(q.playback.needsStart(),false);assert.notEqual(q.model.request(before.token),before.seq);assert.equal((await status(q.x)).transport.frame0_history,null);
 assert.equal(q.playback.presented(stamp),null);q.f.time=3001;await q.present({newCycle:true});assert.equal(q.model.target.token,before.token);assert.equal(q.playback.framePosition,0);assert.equal((await status(q.x)).verified,null);
});
test('END17 expired old target cannot autoRecover through new connection',async t=>{
 const q=await endpointHold(t);await q.poll();const touch=q.model.touch();q.x.window.networkLink(2,false);await q.peer.closed;q.f.time=5500;q.x.window.networkLink(3,true);await q.connect();await status(q.x);await pause();
 assert.equal((await status(q.x)).shared.desired,null);assert.equal(q.peer.records.filter(r=>r.type===2).length,0);assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
test('END18 CAS race after controls read cannot overwrite or cancel a manual target',async t=>{
 let intercept=false,raw;const q=await endpointHold(t,{wrap:c=>{raw=c;return {request:async(...a)=>{const v=await c.request(...a);if(intercept&&a[0]==='GET'){intercept=false;await c.request('POST','/v1/node-control/command',command(v,11));}return v;}};}});
 await q.poll();const touch=q.model.touch();q.f.time=3000;intercept=true;await q.poll();await pause();assert.equal((await status(q.x)).revision,'2');assert.equal((await status(q.x)).shared.desired.action,11);assert.ok(raw);assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.action,11);
});
test('END19 exact lost-ACK confirmation cannot cancel later manual takeover',async t=>{
 let lost=false;const q=await endpointHold(t,{wrap:c=>({request:async(...a)=>{const v=await c.request(...a);if(lost&&a[0]==='POST'){lost=false;throw Error('lost ACK');}return v;}})});
 await q.poll();q.model.touch();q.f.time=3000;lost=true;await q.poll();await send(q.x,command(await status(q.x),11));await q.b.confirm();assert.equal((await status(q.x)).shared.desired.action,11);assert.equal((await status(q.x)).revision,'3');assert.notEqual(q.b.snapshot().phase,'ready');
});
test('END20 lane source window remains independent of long page and observation windows',async t=>{
 const q=await endpointHold(t,{sessionMs:120000,sourceMs:120000});q.x.window.networkLink(2,false);await q.peer.closed;q.f.time=54000;q.x.window.networkLink(3,true);await q.connect();const touch=q.model.touch();await q.poll();const v=await status(q.x);
 assert.equal(v.shared.limits.source_window_ms,6000);assert.ok(v.remaining_ms>60000);assert.equal(v.revision,'0');assert.ok(q.model.touchDone(touch));assert.equal(q.model.target.origin,'local');
});
test('END21 pre-renewal pending draw is consumed without a false latest request receipt',async t=>{
 const q=await endpointHold(t);await q.poll();const stamp=q.beginCycle();await q.advance(3000);const latest=q.model.request(stamp.intent.token);
 assert.equal(q.playback.presented(stamp,{drawAt:2999}),null);q.f.time=3001;assert.equal(q.playback.presented(stamp),null);assert.equal((await status(q.x)).transport.frame0_history,null);
 const r=await q.present({newCycle:true});assert.equal(r.seq,latest);assert.equal(q.playback.presented(stamp),null);
});
test('END22 repeated renewals preserve active source and frame marker without manufacturing frame0',async t=>{
 const q=await endpointHold(t);await q.poll();const stale=await q.present(),stamp=q.playback.stamp();assert.ok(q.playback.advanceFrame(stamp,90));
 await q.advance(9500);assert.deepEqual(q.playback.stamp(),stamp);assert.equal(q.playback.framePosition,90);assert.equal(q.playback.needsStart(),false);assert.ok(q.peer.records.filter(r=>r.type===2).length>=4);assert.equal((await status(q.x)).transport.phase,'open');assert.equal((await status(q.x)).transport.frame0_history,null);
 q.peer.socket.write(encodeTcp(stale));await pause();assert.equal((await status(q.x)).transport.frame0_history,null);const latest=q.model.request(stamp.intent.token),r=await q.present({newCycle:true});assert.equal(r.seq,latest);assert.equal(q.model.target.token,stamp.intent.token);
});
test('END23 reconnect retains old deadline but invalidates old playback source and stamp',async t=>{
 const q=await endpointHold(t);await q.poll();await q.present();const oldStamp=q.playback.stamp();await q.advance(1000,{poll:false});q.x.window.networkLink(2,false);await q.peer.closed;q.f.time=1200;q.x.window.networkLink(3,true);await q.connect();await pause();
 assert.equal((await status(q.x)).shared.desired.remaining_ms,3800);assert.equal(q.playback.current(oldStamp),false);assert.equal(q.playback.presented(oldStamp),null);assert.notEqual(q.model.target.token,oldStamp.intent.token);await q.present();assert.notEqual(q.playback.stamp().source,oldStamp.source);
});
test('END24 unknown same-action renewal confirms exact body without resetting playback or producing a receipt',async t=>{
 let lost=false;const bodies=[];const q=await endpointHold(t,{wrap:c=>({request:async(...a)=>{const v=await c.request(...a);if(a[0]==='POST'){bodies.push(structuredClone(a[2]));if(lost){lost=false;throw Error('lost ACK');}}return v;}})});
 await q.poll();await q.present();const stamp=q.playback.stamp();q.f.time=3000;lost=true;await q.poll();assert.equal(q.b.snapshot().phase,'unknown');const count=q.peer.records.filter(r=>r.type===2).length;q.f.time=3100;await q.b.confirm();await pause();
 assert.deepEqual(bodies[1],bodies[2]);assert.equal(q.peer.records.filter(r=>r.type===2).length,count);assert.equal((await status(q.x)).shared.desired.remaining_ms,4900);assert.deepEqual(q.playback.stamp(),stamp);assert.equal(q.playback.presented(stamp),null);assert.equal((await status(q.x)).transport.frame0_history,null);await q.present({newCycle:true});
});
