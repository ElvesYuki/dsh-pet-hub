import test from 'node:test';
import assert from 'node:assert/strict';
import { lab, hash, clearEvidence, readEvidence } from './fixtures/s1.mjs';
import { MAX_U64, uint64, increment, frame, capabilities } from '../packages/core/protocol.mjs';
import { LegacySlot } from '../packages/core/scheduler.mjs';
let rejected = [];
test.beforeEach(() => { clearEvidence(); rejected = []; });
test.afterEach(t => { if (process.env.PETHUB_SIM_EVIDENCE === '1') t.diagnostic(JSON.stringify({ case: t.name.match(/^SIM-\d+/)?.[0] ?? t.name, name: t.name, layer: 'simulated', rejected, evidence: readEvidence() })); });
const reject = (fn, code) => assert.throws(fn, error => { if (error.code === code) rejected.push(code); return error.code === code; });
const row = (l,id = 'A') => l.hub.summary().devices.find(d => d.device_id === id);
const intent = (overrides = {}) => ({ intent_id: 'intent_1', client_id: 'plugin', service_instance_id: 'H1', expected_revision: '0', kind: 'manual', action_id: 11, ...overrides });

test('SIM-01 unauthenticated discovery and self-asserted identity do not connect', () => {
  const l = lab(), before = l.hub.summary();
  l.hub.discover({ candidate_id: 'candidate', authenticated: true, device_id: 'A' });
  const { hello } = l.connect(); // establish a genuine connection, then prove the forged retry has zero effect
  const connected = l.hub.summary();
  reject(() => l.hub.connect(hello,{ authenticated: true }), 'identity_conflict');
  assert.deepEqual(l.hub.summary(),connected); assert.equal(before.devices[0].connection,'offline');
  assert.equal(l.hub.summary().discovered[0].status,'discovered');
  reject(() => l.devices.A.device.connect('U','H1',{}),'identity_conflict');
});
test('SIM-02 authenticated reconnect changes session; spoofed device cannot overwrite', () => {
  const l = lab(), a = l.connect(), b = l.connect();
  assert.notEqual(a.ctx.session_id,b.ctx.session_id); const before = l.hub.summary();
  reject(() => l.hub.connect(b.hello,l.devices.B.deviceProof),'identity_conflict');
  assert.deepEqual(l.hub.summary(),before); reject(() => l.hub.heartbeat(a.ctx,'1'),'stale_session');
  assert.equal(l.hub.heartbeat(b.ctx,'1'),true);
});
test('SIM-03 protocol, malformed sequences, byte/depth/unknown fields fail closed', () => {
  const l = lab(), a = l.connect(), before = l.hub.summary();
  reject(() => l.hub.connect({ ...a.hello, protocol: 'bridge/v4' },l.devices.A.deviceProof),'unsupported_protocol');
  reject(() => l.hub.connect({ ...a.hello, required_unknown: 1 },l.devices.A.deviceProof),'invalid_message');
  for (const seq of ['01','-1',1,'18446744073709551616']) reject(() => l.hub.heartbeat(a.ctx,seq),'invalid_message');
  reject(() => frame({ text: 'x'.repeat(16385) }),'invalid_message');
  let deep = {}; for(let i=0;i<10;i++) deep={ child:deep }; reject(() => frame(deep),'invalid_message');
  assert.deepEqual(l.hub.summary(),before);
});
test('SIM-04 capacity mismatch never rescales or downgrades', () => {
  const l = lab(), a = l.acquire(), cmd = l.command(); l.send(a,cmd);
  l.devices.B.device.caps.display.width=175;
  const b=l.acquire('B'); reject(() => l.send(b,l.command()),'incompatible_asset');
  l.devices.B.device.caps.display.width=240; l.devices.B.device.caps.codecs=['PET3'];
  reject(() => l.send(b,l.command()),'incompatible_asset'); assert.equal(l.devices.B.device.snapshot().desired,null);
  assert.equal(row(l).desired,11); assert.equal(capabilities({...l.caps,extensions:{future_sensor:true}}).inputs.includes('imu'),false);
});
test('SIM-05 another instance of same controller cannot steal live lease', () => {
  const l=lab(), a=l.acquire(); const other=l.devices.A.device.connect('C','H2',l.devices.A.controllerProof);
  reject(() => l.devices.A.device.acquire(other,'op2','1'),'lease_busy');
  l.devices.A.device.set(a.ctx,a.grant,l.command()); assert.equal(l.devices.A.device.snapshot().controlled,true);
});
test('SIM-06 failed durable grant and dropped response do not double-increment epoch', () => {
  const l=lab(), {ctx}=l.connect(), d=l.devices.A.device, s=l.devices.A.deviceStore;
  s.failNext=true; reject(()=>d.acquire(ctx,'op1','0'),'storage_failed'); assert.equal(s.read().control_epoch,'0'); assert.equal(d.snapshot().controlled,false);
  let granted; l.queue.send(()=>{granted=d.acquire(ctx,'op1','0');}); l.queue.flush();
  // Response is dropped; request is retried with identical operation identity.
  l.queue.send(()=>{throw new Error('not delivered');},{drop:true}); assert.deepEqual(l.queue.flush(),[]);
  const retry=d.acquire(ctx,'op1','0'); assert.deepEqual(retry,granted); assert.equal(s.writes,1);
});
test('SIM-07 renew is volatile, expired operations cannot resurrect, H1 stays fenced', () => {
  const l=lab(), a=l.acquire(), d=l.devices.A.device, s=l.devices.A.deviceStore, writes=s.writes;
  l.clock.advance(5000); a.grant=d.renew(a.ctx,a.grant); assert.equal(s.writes,writes);
  l.clock.advance(15000); reject(()=>d.set(a.ctx,a.grant,l.command()),'lease_expired');
  reject(()=>d.acquire(a.ctx,a.operationId,'0'),'lease_expired');
  const ctx=d.connect('C','H2',l.devices.A.controllerProof), b=d.acquire(ctx,'op2','1');
  reject(()=>d.set(a.ctx,a.grant,l.command()),'stale_control'); assert.equal(b.control_epoch,'2');
  reject(()=>d.acquire(a.ctx,'old_new_op','1'),'lease_busy');
});
test('SIM-08 device, hub, session restarts invalidate transient state', () => {
  const l=lab(), a=l.acquire(), cmd=l.command(); l.play(a,cmd); const oldReport=l.devices.A.device.report();
  l.restartHub(); assert.equal(row(l).connection,'offline'); assert.equal(row(l).desired,null);
  const re=l.connect(); reject(()=>l.devices.A.device.set(a.ctx,a.grant,cmd),'stale_session');
  reject(()=>l.hub.report(a.ctx,oldReport),'stale_session');
  l.devices.A.device.reboot(); reject(()=>l.devices.A.device.acquire(re.ctx,'new','1'),'stale_boot');
  const current=l.connect(); l.devices.A.device.disconnect(current.ctx); reject(()=>l.devices.A.device.acquire(current.ctx,'new','1'),'stale_session');
});
test('SIM-09 uint64 precision and overflow stay exact', () => {
  assert.equal(uint64('9007199254740993'),9007199254740993n); assert.equal(increment('9007199254740993'),'9007199254740994');
  reject(()=>increment(String(MAX_U64)),'sequence_exhausted');
  const l=lab(), s=l.devices.A.deviceStore, data=s.read(); s.commit(data.revision,{...data,control_epoch:'9007199254740993'});
  const a=l.acquire(); assert.equal(a.grant.control_epoch,'9007199254740994');
  l.send(a,l.command(11,'9007199254740993')); reject(()=>l.send(a,l.command(11,'9007199254740992')),'stale_revision');
});
test('SIM-10 command retries are idempotent, conflicting payload rejected', () => {
  const l=lab(), a=l.acquire(), cmd=l.command(); l.play(a,cmd); l.clock.advance(1000); const before=l.devices.A.device.snapshot();
  l.devices.A.device.set(a.ctx,a.grant,cmd); assert.deepEqual(l.devices.A.device.snapshot(),before);
  const reordered=Object.fromEntries(Object.entries(cmd).reverse()); l.devices.A.device.set(a.ctx,a.grant,reordered);
  const conflict={...cmd,action_id:58,asset_sha256:l.actions.find(x=>x.id===58).sha256}; reject(()=>l.devices.A.device.set(a.ctx,a.grant,conflict),'idempotency_conflict');
});
test('SIM-11 accepted and verified never start playback timing', () => {
  const l=lab(), a=l.acquire(), cmd=l.command(), d=l.devices.A.device;
  l.send(a,cmd); l.hub.report(a.ctx,d.report()); l.clock.advance(10000); d.verify(cmd.command_id,l.assets.get(11)); l.hub.report(a.ctx,d.report());
  assert.equal(row(l).started,null); assert.equal(row(l).actual,null); d.submitFrame(a.ctx,a.grant,cmd.command_id); l.hub.report(a.ctx,d.report()); assert.equal(row(l).started,10000);
});
test('SIM-12 duplicate/late reports never reset timing or revive terminal target', () => {
  const l=lab(),a=l.acquire(),cmd=l.command(),d=l.devices.A.device; l.play(a,cmd); const first=d.report();
  assert.equal(l.hub.report(a.ctx,first),true); l.clock.advance(1000); assert.equal(l.hub.report(a.ctx,first),false);
  l.hub.report(a.ctx,d.report()); assert.equal(row(l).started,0);
  const failed={...d.report(),phase:'failed'}; l.hub.report(a.ctx,failed); assert.equal(l.hub.report(a.ctx,d.report()),false); assert.equal(row(l).phase,'failed');
});
test('SIM-13 swapped A/B reports and heartbeats cannot cross device identity', () => {
  const l=lab(),a=l.acquire(),b=l.acquire('B'),ca=l.command(11,'1','same'),cb=l.command(11,'1','same'); l.play(a,ca); l.send(b,cb);
  const report=l.devices.A.device.report(), before=row(l,'B'); reject(()=>l.hub.report(b.ctx,report),'stale_control');
  reject(()=>l.hub.heartbeat({...a.ctx,device_id:'B'},'1'),'stale_binding'); assert.deepEqual(row(l,'B'),before);
});
test('SIM-14 delayed old targets are rejected and actual stays until latest is ready', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device; l.play(a,l.command(0)); const oldActual=d.snapshot().actual;
  const one=l.command(11,'2'),two=l.command(58,'3'),three=l.command(43,'4'); l.send(a,one); const old=d.report();
  l.queue.send(()=>l.hub.report(a.ctx,old),{delay:100,copies:2}); l.send(a,two); l.send(a,three); l.clock.advance(100);
  assert.ok(l.queue.flush({reverse:true}).every(x=>x.code==='stale_revision')); reject(()=>l.hub.expect(a.ctx,one,a.grant),'stale_revision'); assert.deepEqual(d.snapshot().actual,oldActual);
  reject(()=>d.verify(one.command_id,l.assets.get(11)),'stale_revision'); d.verify(three.command_id,l.assets.get(43)); l.hub.report(a.ctx,d.report()); d.submitFrame(a.ctx,a.grant,three.command_id); l.hub.report(a.ctx,d.report()); assert.equal(row(l).actual,43);
});
test('SIM-15 synthetic length/digest/format corruption preserves previous actual', () => {
  for(const offset of [-1,0,4,5,6]) {
    const l=lab(),a=l.acquire(),d=l.devices.A.device; l.play(a,l.command(0)); const cmd=l.command(11,'2'); l.send(a,cmd);
    let bytes=new Uint8Array(l.assets.get(11)); if(offset===-1) bytes=bytes.slice(1); else bytes[offset]^=1;
    reject(()=>d.verify(cmd.command_id,bytes),'asset_integrity_failed'); assert.equal(d.snapshot().actual.action_id,0); assert.equal(d.snapshot().phase,'failed');
  }
});
test('SIM-16 four-slot cache evicts LRU while protecting actual and one pending download', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device; let rev=1;
  for(const action of [0,11,58,4]) { const cmd=l.command(action,String(rev++)); l.play(a,cmd); }
  const actual=d.snapshot().actual.asset_sha256, oldest=l.actions.find(x=>x.id===0).sha256;
  const cmd=l.command(43,String(rev++)); l.send(a,cmd); assert.equal(d.snapshot().downloading,cmd.command_id); assert.equal(d.snapshot().cache.length,4);
  assert.equal(l.hub.heartbeat(a.ctx,'1'),true); d.verify(cmd.command_id,l.assets.get(43));
  assert.equal(d.snapshot().cache.includes(actual),true); assert.equal(d.snapshot().cache.includes(oldest),false); assert.equal(d.snapshot().cache.length,4);
});
test('SIM-17 heartbeats use fresh sequence only and exact timeout boundaries', () => {
  const l=lab(),{ctx}=l.connect(); l.hub.heartbeat(ctx,'1'); l.clock.advance(15000); assert.equal(row(l).connection,'online');
  assert.equal(l.hub.heartbeat(ctx,'1'),false); l.clock.advance(1); assert.equal(row(l).connection,'stale');
  l.clock.advance(14999); assert.equal(row(l).connection,'stale'); l.clock.advance(1); assert.equal(row(l).connection,'offline');
  l.hub.heartbeat(ctx,'2'); assert.equal(row(l).connection,'online');
});
test('SIM-18 idle is connected, source failure grace only affects auto mode', () => {
  const l=lab(),s=l.scheduler(); s.source('connected',null); assert.equal(s.desired(),0); assert.equal(s.summary().source_status,'connected');
  s.source('connected','working'); s.source('unavailable'); l.clock.advance(2000); assert.equal(s.desired(),11); l.clock.advance(1); assert.equal(s.desired(),0);
  s.source('connected','success'); assert.equal(s.desired(),58); s.submit(intent()); s.source('unavailable'); l.clock.advance(10000); assert.equal(s.desired(),11);
});
test('SIM-19 manual intent survives source changes; touch dedupe/cooldown restores latest intent', () => {
  const l=lab(),s=l.scheduler(); s.submit(intent()); s.source('connected','success'); assert.equal(s.desired(),11);
  assert.equal(s.touch('tap1'),true); assert.equal(s.touch('tap1'),false); assert.equal(s.touch('tap2'),false); assert.equal(s.desired(),4);
  s.submit(intent({intent_id:'intent2',expected_revision:'1',action_id:58})); l.clock.advance(10040); assert.equal(s.desired(),58);
  assert.equal(s.touch('tap3'),true); l.clock.advance(10040); s.submit(intent({intent_id:'intent3',expected_revision:'2',kind:'auto'})); assert.equal(s.desired(),58);
});
test('SIM-20 expired lease forbids new control without erasing cached playback', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device; l.play(a,l.command()); l.clock.advance(15000);
  reject(()=>d.set(a.ctx,a.grant,l.command(58,'2')),'lease_expired'); assert.equal(d.snapshot().controlled,false); assert.equal(d.snapshot().actual.action_id,11);
  reject(()=>l.hub.report(a.ctx,d.report()),'lease_expired');
});
test('SIM-21 reboot clears PSRAM/actual, offline registry cannot pretend playing', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device; l.play(a,l.command()); d.reboot(); l.clock.advance(30001);
  assert.deepEqual(d.snapshot().cache,[]); assert.equal(d.snapshot().actual,null); assert.equal(row(l).connection,'offline');
  l.connect(); assert.equal(row(l).actual,null); assert.equal(row(l).started,null);
});
test('SIM-22 revocation commit is idempotent; lost receipt remains unconfirmed', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device,s=l.devices.A.deviceStore; l.hub.freeze('A'); const before=s.writes;
  const receipt=d.revoke(a.ctx,'revoke1','1'); assert.deepEqual(d.revoke(a.ctx,'revoke1','1'),receipt); assert.equal(s.writes,before+1);
  reject(()=>d.connect('C','H2',l.devices.A.controllerProof),'stale_binding');
  reject(()=>l.hub.confirmRevocation('A',receipt),'revocation_unconfirmed'); assert.equal(row(l).binding,'pending_revocation');
  l.hub.confirmRevocation('A',receipt,r=>r===receipt); assert.equal(row(l).binding,'revoked');
});
test('SIM-23 local offline forget is not device revocation and blocks old connection', () => {
  const l=lab(),{hello}=l.connect(); l.hub.freeze('A','forget_pending'); reject(()=>l.hub.connect(hello,l.devices.A.deviceProof),'stale_binding');
  assert.equal(l.devices.A.deviceStore.read().revoked,false); assert.equal(row(l).binding,'forget_pending');
});
test('SIM-24 discovery cannot bind, unknown URLs cannot enter asset requests', () => {
  const l=lab(),a=l.acquire(),before=l.hub.summary().devices;
  l.hub.discover({candidate_id:'mdns_changed',host:'untrusted.local'}); l.hub.discover({candidate_id:'mdns_conflict',host:'another.local'});
  assert.deepEqual(l.hub.summary().devices,before);
  reject(()=>l.send(a,{...l.command(),url:'http://untrusted.local/private'}),'invalid_message'); assert.equal(l.devices.A.device.snapshot().desired,null);
});
test('SIM-25 legacy fixture never produces authenticated identity/heartbeat/playing', () => {
  const legacy=new LegacySlot(); legacy.attach('legacy_slot','external'); const result=legacy.observe('11 3 -1\n',true);
  assert.equal(result.phase,'legacy_acknowledged'); assert.equal(result.identity,'unverified'); assert.equal(result.heartbeat,null); assert.equal('device_id' in result,false);
});
test('SIM-26 legacy second device/writer and implicit protocol downgrade rejected', () => {
  const legacy=new LegacySlot(); legacy.attach('legacy_slot','external'); reject(()=>legacy.attach('second_device','external'),'unsupported_protocol'); reject(()=>legacy.attach('legacy_slot','hub'),'lease_busy');
  const l=lab(),{hello}=l.connect(); reject(()=>l.hub.connect({...hello,protocol:'v4'},l.devices.A.deviceProof),'unsupported_protocol');
});
test('SIM-27 freezing binding defeats queued playing and download cancellation races', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device,cmd=l.command(); l.send(a,cmd); d.verify(cmd.command_id,l.assets.get(11)); const report=d.report();
  l.queue.send(()=>l.hub.report(a.ctx,report),{delay:1}); l.hub.freeze('A'); d.cancel(a.ctx,a.grant,cmd.command_id);
  l.clock.advance(1); assert.equal(l.queue.flush()[0].code,'stale_binding'); reject(()=>l.hub.expect(a.ctx,l.command(58,'2'),a.grant),'stale_binding');
  reject(()=>d.submitFrame(a.ctx,a.grant,cmd.command_id),'invalid_message'); assert.equal(row(l).actual,null);
});
test('SIM-28 competing clients share CAS intention and idempotency without reset on detach', () => {
  const l=lab(),s=l.scheduler(),request=intent(); const first=s.submit(request); assert.deepEqual(s.submit(request),first);
  reject(()=>s.submit(intent({client_id:'standalone',action_id:58})),'revision_conflict'); reject(()=>s.submit({...request,action_id:58}),'idempotency_conflict');
  assert.equal(s.desired(),11); // no client-owned teardown API exists
  s.submit(intent({intent_id:'next',client_id:'standalone',expected_revision:'1',action_id:58})); assert.equal(s.desired(),58);
});
test('SIM-29 durable mapping CAS survives hub restart without queue or lease replay', () => {
  const l=lab(),a=l.acquire(),revision=l.store.read().revision; l.hub.mapping('A',revision,{character_id:'fixture_character'});
  reject(()=>l.hub.mapping('A',revision,{character_id:'other'}),'revision_conflict'); l.play(a,l.command()); l.restartHub();
  assert.equal(l.store.read().bindings.A.mapping.character_id,'fixture_character'); assert.equal(row(l).desired,null); assert.equal(row(l).controlled,false);
  const s=l.scheduler('H2'); reject(()=>s.submit(intent()),'stale_session'); assert.equal(s.desired(),0);
});
test('SIM-30 explicit allowlist summary never leaks supplied secrets/private state', () => {
  const l=lab(),a=l.acquire(); l.play(a,l.command()); l.hub.discover({candidate_id:'x',secret:'SECRET',task:'TASK',ssid:'SSID',url:'http://leak'});
  const summary=l.hub.summary(), text=JSON.stringify(summary);
  for(const privateValue of ['SECRET','TASK','SSID','http://','identity_ref','lease_id']) assert.equal(text.includes(privateValue),false);
  assert.equal(summary.synthetic,true); assert.equal(row(l).binding,'bound'); assert.equal(row(l).connection,'online'); assert.equal(row(l).controlled,true); assert.equal(row(l).phase,'playing');
});

test('S1 regression: renewed grant and report stream survive original expiry without timing reset', () => {
  const l=lab(),a=l.acquire(),d=l.devices.A.device,cmd=l.command(); l.play(a,cmd);
  l.clock.advance(5000); a.grant=d.renew(a.ctx,a.grant); l.hub.control(a.ctx,a.grant);
  l.clock.advance(5000); a.grant=d.renew(a.ctx,a.grant); l.hub.control(a.ctx,a.grant);
  l.clock.advance(6000); assert.equal(l.hub.report(a.ctx,d.report()),true); assert.equal(row(l).started,0);
  l.hub.expect(a.ctx,cmd,a.grant); assert.equal(row(l).started,0);
});
test('S1 regression: independently valid digest cannot hide malformed synthetic header', () => {
  for (const offset of [0,4,5,6]) {
    const l=lab(),a=l.acquire(),d=l.devices.A.device; l.play(a,l.command(0));
    const bytes=new Uint8Array(l.assets.get(11)); bytes[offset]^=1;
    const digest=hash(bytes); d.manifest.actions.find(x=>x.id===11).sha256=digest;
    const cmd={...l.command(11,'2'),asset_sha256:digest}; d.set(a.ctx,a.grant,cmd);
    reject(()=>d.verify(cmd.command_id,bytes),'asset_integrity_failed'); assert.equal(d.snapshot().actual.action_id,0);
  }
});
test('S1 regression: source begins unavailable and stale-session revocation replay rejected', () => {
  const l=lab(); assert.equal(l.scheduler().summary().source_status,'unavailable');
  const a=l.acquire(),d=l.devices.A.device; const receipt=d.revoke(a.ctx,'operation','1');
  reject(()=>d.revoke({...a.ctx,session_id:'spoof'},'operation','1'),'stale_binding');
  assert.deepEqual(d.revoke(a.ctx,'operation','1'),receipt);
});

test('S1 bounds and packaging: fixture auth cannot be serialized into candidate runtime', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const l=lab();
  for(let n=0;n<128;n++) l.hub.discover({candidate_id:`candidate_${n}`});
  reject(()=>l.hub.discover({candidate_id:'overflow'}),'capacity_exceeded');
  const before=l.hub.summary(); const copy=l.hub.summary(); copy.devices[0].binding='revoked'; assert.deepEqual(l.hub.summary(),before);
  const {hello}=l.connect(); reject(()=>l.hub.connect(hello,JSON.parse(JSON.stringify(l.devices.A.deviceProof))),'identity_conflict');
  assert.equal(existsSync('dist/packages/simulator/index.mjs'),false);
  assert.equal(readFileSync('packages/core/registry.mjs','utf8').includes('node:'),false);
});
