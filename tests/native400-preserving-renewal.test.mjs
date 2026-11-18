import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {records,renewalRig as F,verifyRenewalPins,verifyRenewalTrace} from './fixtures/native400-preserving-renewal.mjs';
import {tcpHex} from '../packages/core/native400-tcp.mjs';
const golden=JSON.parse(readFileSync('docs/protocol/vectors/native400-preserving-renewal-endpoint-v1.json','utf8')),pins=JSON.parse(readFileSync('docs/protocol/vectors/native400-tcp26-manager-pins.json','utf8'));

test('RENEW01 frozen C++ 24 steps match updated device/playback oracle AND actual host bytes',()=>{verifyRenewalPins(pins);assert.equal(verifyRenewalTrace(golden).rows,24);verifyRenewalPins(pins);});
test('RENEW02 changed host-core pins are refused',()=>{const bad=structuredClone(pins);bad.files['packages/core/native400-tcp-control.mjs']='00'.repeat(32);assert.throws(()=>verifyRenewalPins(bad));});
test('RENEW03 corrupted C++ transcript bytes or source lifecycle are refused',()=>{for(const field of ['output','source']){const bad=structuredClone(golden),row=bad.rows.find(r=>r.label==='renew');row[field]=field==='output'?row.output.slice(0,-2)+'ff':999;assert.throws(()=>verifyRenewalTrace(bad));}});
test('RENEW04 same action keeps start stamp/source/cycle/mail/frame and separates latest request',()=>{
 const f=F();const first=f.base();f.receive(first);const s=f.ready();f.playback.advanceFrame(s,120);assert.ok(f.playback.presented(s));f.time=3000;const next=f.base();const ack=f.receive(next);
 assert.equal(ack.token,s.intent.token);assert.equal(f.model.target.seq,first.seq);assert.equal(f.model.request(ack.token),next.seq);assert.deepEqual(f.playback.stamp(),s);assert.equal(f.playback.framePosition,120);assert.equal(f.playback.needsStart(),false);assert.equal(f.playback.presented(s),null);
});
for(const relation of ['older','equal','newer'])test(`RENEW pending draw ${relation} than renewal acceptance is conservative`,()=>{
 const f=F();f.receive(f.base());const s=f.ready();f.time=3000;const next=f.base();f.receive(next);f.time=3001;
 const drawAt=relation==='older'?2999:relation==='equal'?3000:3001,r=f.playback.presented(s,{drawAt});assert.equal(!!r,relation==='newer');if(r)assert.equal(r.seq,next.seq);
 assert.equal(f.playback.presented(s,{drawAt:3001}),null); // Even a rejected old valid draw consumed this source cycle.
});
test('RENEW08 initial new token/source allows same ms draw but not earlier decode',()=>{
 const f=F();f.time=10;f.receive(f.base());const s=f.ready();assert.equal(f.playback.presented(s,{drawAt:9}),null);assert.ok(f.playback.presented(s,{drawAt:10}));assert.equal(f.playback.presented(s),null);
});
test('RENEW09 invalid stamp/non-frame0/draw flag/future time does not consume valid frame0',()=>{
 const f=F();f.receive(f.base());const s=f.ready();for(const key of ['cycle','source','mail','transport']){const bad=structuredClone(s);bad[key]=typeof bad[key]==='string'?'999':999;assert.equal(f.playback.presented(bad),null);}assert.equal(f.playback.presented(s,{frame:1}),null);assert.equal(f.playback.presented(s,{drawCurrent:false}),null);assert.equal(f.playback.presented(s,{drawAt:1}),null);assert.ok(f.playback.presented(s));
});
test('RENEW10 each loop requires fresh prepare yet same request does not repeat Presented',()=>{
 const f=F();f.receive(f.base());const s=f.ready();assert.ok(f.playback.presented(s));assert.ok(f.playback.eof(s));const next=f.playback.begin();assert.equal(f.model.prepared,null);assert.equal(f.playback.decoded(next),false);assert.ok(f.playback.verified(next,records.find(r=>r.action===11).asset_sha256));const bound=f.playback.bind(next,'8',8);assert.ok(bound);assert.ok(f.playback.decoded(bound));assert.equal(f.playback.presented(bound),null);assert.equal(f.playback.presented(s),null);
});
test('RENEW11 rejected same-ms draw waits for next loop and then reports latest sequence once',()=>{
 const f=F();f.receive(f.base());const s=f.ready();f.time=3000;const request=f.base();f.receive(request);assert.equal(f.playback.presented(s),null);f.time=3001;assert.equal(f.playback.presented(s),null);assert.ok(f.playback.eof(s));const next=f.ready('8');const r=f.playback.presented(next);assert.equal(r.seq,request.seq);assert.equal(f.playback.presented(next),null);
});
test('RENEW12 malformed SHA and TTL never update latest command or its acceptance time',()=>{
 const f=F();f.receive(f.base());const s=f.ready();f.time=10;assert.equal(f.receive(f.base(11,5000,'ff'.repeat(32))).code,19);assert.equal(f.receive(f.base(11,0)).code,20);assert.equal(f.receive(f.base(11,60001)).code,20);assert.equal(f.model.request(s.intent.token),s.intent.seq);assert.ok(f.playback.presented(s,{drawAt:0}));
});
test('RENEW13 same seq replay does not renew deadline; conflict does not mutate current request',()=>{
 const f=F();const raw=f.base(11,100);f.receive(raw);const s=f.ready();f.time=50;assert.equal(f.receive(raw).replay,true);const changed={...raw,payload:raw.payload.slice()};changed.payload[4]^=1;assert.equal(f.receive(changed).code,18);assert.equal(f.model.request(s.intent.token),raw.seq);f.time=100;assert.equal(f.model.tick().origin,'local');assert.equal(f.playback.presented(s),null);
});
test('RENEW14 BASE leases and replayed PING cannot extend session',()=>{
 const f=F();f.receive(f.base(11,60000));const ping=f.other(4);f.time=100;f.receive(ping);f.time=9000;assert.ok(f.receive(ping).replay);f.receive(f.base(11,60000));f.time=10100;assert.equal(f.model.tick().origin,'local');assert.equal(f.model.connected,false);
});
for(const exit of ['cancel','expiry','disconnect','new-session','action'])test(`RENEW old playback invalid after ${exit}`,()=>{
 const f=F();f.receive(f.base(11,100));const s=f.ready();if(exit==='cancel')f.receive(f.other(3));if(exit==='expiry'){f.time=100;f.model.tick();}if(exit==='disconnect')f.model.disconnect(f.generation);if(exit==='new-session'){const g=f.model.connect();f.model.receive({...f.open,session:'18'},g);}if(exit==='action')f.receive(f.base(1));assert.equal(f.playback.current(s),false);assert.equal(f.playback.presented(s),null);assert.equal(f.model.request(s.intent.token),'0');
});
test('RENEW20 explicit cancel then same BASE creates new playback while old source stays invalid',()=>{
 const f=F();f.receive(f.base());const s=f.ready();f.receive(f.other(3));f.receive(f.base());assert.notEqual(f.model.target.token,s.intent.token);assert.equal(f.model.prepare(s.intent.token,'7',records.find(r=>r.action===11).asset_sha256),false);assert.equal(f.playback.eof(s),false);const next=f.ready('8');assert.equal(next.intent.seq,f.model.request(next.intent.token));assert.ok(f.playback.presented(next));
});
