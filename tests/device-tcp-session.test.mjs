import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createECDH, createHash, createPrivateKey, randomBytes, sign} from 'node:crypto';
import {once} from 'node:events';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {connect, createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {decodeVpc1, encodeVpc1, VPC1_KIND as playbackKind} from '../packages/core/playback-wire.mjs';
import {openDeviceBindingIndex} from '../packages/runtime/device-binding-index.mjs';
import {createBootKeychain} from '../packages/runtime/device-keychain.mjs';
import {createDesktopStatusSources} from '../packages/runtime/device-status-sources.mjs';
import {createDesktopDeviceLan, selectDeviceLanAddress} from '../packages/runtime/desktop-device-lan.mjs';
import {startDesktopTaskMotion, startTaskSource} from '../packages/runtime/desktop-task-motion.mjs';
import {decodeUsbStatusReport} from '../packages/runtime/usb-status-subscription.mjs';
import {createDeviceTcpAdapter} from '../packages/runtime/device-tcp-session.mjs';
import {armDeviceTcpOverUsb, createDeviceTcpTrust, setDeviceLanDiscoveryOverUsb} from '../packages/runtime/device-tcp-trust.mjs';
import {openDeviceLanPins} from '../packages/runtime/device-lan-pin.mjs';
import {VPL1, createVpl1Framer, decodeVpl1Status, openVpl1, sealVpl1, vpl1Frame, vpl1Keys, vpl1Tag,
  vpl1Transcript} from '../packages/runtime/device-tcp-wire.mjs';
import {minimalStatusV2} from './fixtures/device-status-fixture.mjs';

const peer = process.env.ROUND_PET_VPL1_PEER_BIN;
const peerV2 = process.env.ROUND_PET_VPL1_V2_PEER_BIN;
const pushPeer = process.env.ROUND_PET_VPL1_PUSH_PEER_BIN;
const identity = '10/112233445566';
const hex = value => Buffer.from(value, 'hex');

function privateFixture(n) {
  const scalar = Buffer.concat([Buffer.alloc(31), Buffer.of(n)]);
  const ec = createECDH('prime256v1');
  ec.setPrivateKey(scalar);
  const publicKey = ec.getPublicKey();
  const privateKey = createPrivateKey({format: 'jwk', key: {kty: 'EC', crv: 'P-256', d: scalar.toString('base64url'),
    x: publicKey.subarray(1, 33).toString('base64url'), y: publicKey.subarray(33).toString('base64url')}});
  return {ref: 'synthetic-key-ref', publicKey, signTranscript: bytes =>
    sign('sha256', bytes, {key: privateKey, dsaEncoding: 'ieee-p1363'})};
}

function makeTrust(t, {pin = 7, mismatchedController = false, controller = privateFixture(11),
  keychain = {lookup: ref => ref === controller.ref ? mismatchedController ? privateFixture(12) : controller : undefined}} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'vpl1-index-'));
  t.after(() => rmSync(directory, {force: true, recursive: true}));
  const store = openDeviceBindingIndex({directory, create: true});
  t.after(() => store.close());
  const record = {phase: 'bound', keyRef: controller.ref, target: {
    device: '01'.repeat(16), controller: '02'.repeat(16), binding: '03'.repeat(16),
    epoch: '4', keySha256: createHash('sha256').update(controller.publicKey).digest('hex'),
  }};
  const {revision} = store.commit('0', record);
  const trust = createDeviceTcpTrust({store, keychain, revision, usbIdentity: identity, devicePublicKey: privateFixture(pin).publicKey});
  return {store, trust, controller};
}

function vectorFile() {
  return JSON.parse(readFileSync(new URL('../docs/protocol/vectors/device-tcp.json', import.meta.url)));
}

test('VPL1 shared vectors match framing, transcript, directional keys, status and unchanged VPC1', () => {
  const v = vectorFile();
  const full = decodeVpl1Status(hex(v.status_full));
  assert.deepEqual(full, {session: 1, sequence: 1, value: {schema: 1, version: '0.1.31-l-battery-usb-pair-test', slot: 'ota_1',
    battery: {present: true, usbPower: true, percent: 83, mv: 4187, flow: 'charging', phase: 'cc'},
    sensors: {touch: {state: 'down', last: [0, 465]}, motion: {accelerationMg: [-4000, 23, 4000], rotationMdps: [-256000, 0, 256000]}}}});
  const minimal = decodeVpl1Status(hex(v.status_minimal));
  assert.equal(minimal.sequence, 2);
  assert.equal(minimal.value.battery, null);
  assert.equal(minimal.value.sensors, null);
  const noTouch = hex(v.status_full);
  noTouch[2] &= ~2;
  assert.deepEqual(decodeVpl1Status(Buffer.concat([noTouch.subarray(0, 50), noTouch.subarray(56)])).value.sensors.touch,
    {state: 'unknown', last: null});
  const t = vpl1Transcript(hex(v.device_hello_body), hex(v.hub_auth_prefix));
  assert.deepEqual(t, hex(v.transcript_sha256));
  const keys = vpl1Keys(hex(v.ecdh_test_secret), t);
  assert.deepEqual(keys.fromDevice, hex(v.k_device_to_hub));
  assert.deepEqual(keys.toDevice, hex(v.k_hub_to_device));
  const serial = Buffer.of(1, 0, 0, 0);
  assert.deepEqual(vpl1Tag(keys.fromDevice, 'device-finish', t, serial), hex(v.device_finish_session1));
  assert.deepEqual(vpl1Tag(keys.toDevice, 'hub-finish', t, serial), hex(v.hub_finish_session1));
  const record = sealVpl1(VPL1.status, 3, hex(v.status_full), hex(v.record_test_key));
  assert.deepEqual(record, hex(v.record_status_counter3));
  assert.deepEqual(openVpl1(record, 3, hex(v.record_test_key)), hex(v.status_full));
  for (const field of ['legacy_ping_session1_seq1', 'legacy_pong_session1_seq1'])
    assert.deepEqual(Buffer.from(encodeVpc1(decodeVpc1(hex(v[field])))), hex(v[field]));
  if (peer) execFileSync(peer, ['vectors', ...['status_full', 'status_minimal', 'record_status_counter3', 'device_hello_body',
    'hub_auth_prefix', 'transcript_sha256', 'ecdh_test_secret', 'k_device_to_hub', 'k_hub_to_device'].map(key => v[key])],
  {timeout: 5000});
});

test('VPL1 framing is bounded and authenticated records reject gaps, duplicates and altered bytes', () => {
  const key = Buffer.alloc(32);
  const packet = sealVpl1(VPL1.control, 1, Buffer.alloc(24), key), packets = [];
  const framer = createVpl1Framer();
  framer.push(packet.subarray(0, 7), assert.fail);
  assert.throws(() => framer.finish(), {code: 'vpl1_truncated'});
  framer.push(Buffer.concat([packet.subarray(7), packet]), (type, frame) => packets.push([type, frame]));
  assert.deepEqual(packets, [[VPL1.control, packet], [VPL1.control, packet]]);
  framer.finish();
  assert.throws(() => framer.push(hex('56504c310112ffff'), assert.fail), {code: 'vpl1_length'});
  assert.throws(() => openVpl1(packet, 2, key), {code: 'vpl1_record'});
  packet[15] ^= 1;
  assert.throws(() => openVpl1(packet, 1, key), {code: 'vpl1_record'});
  assert.throws(() => vpl1Frame(VPL1.status, Buffer.alloc(113)), {code: 'vpl1_length'});
  assert.throws(() => createVpl1Framer(2).push(vpl1Frame(VPL1.status, Buffer.alloc(49)), assert.fail),
    {code: 'vpl1_length'});
});

test('VPL1 uses the existing key reference and rejects USB ARM receipts without an attributed command', async t => {
  const {trust, store} = makeTrust(t);
  const wrong = makeTrust(t, {mismatchedController: true}).trust;
  const signal = new AbortController().signal;
  const recovery = [privateFixture(7).publicKey, privateFixture(8).publicKey];
  for (const publicKey of recovery) {
    const line = '@VP8_VPCNET1 ARMED key=' + publicKey.toString('hex') + '\n';
    let wrote = false;
    const actual = await armDeviceTcpOverUsb({exchangeDesktop(request, {beforeWrite, match}) {
      assert.equal(request.toString(), 'VPCNET1 ARM 192.168.4.2 18551\n');
      beforeWrite();
      assert.equal(match(line), undefined);
      assert.equal(match('@VP8_VPCNET1 QUEUED\n'), undefined);
      return match(line);
    }}, {address: '192.168.4.2', port: 18551}, signal, () => { wrote = true; });
    assert.equal(wrote, true);
    assert.deepEqual(actual, publicKey);
  }
  const bytes = Buffer.alloc(45, 2);
  assert.equal((await trust.sign(bytes, signal)).length, 64);
  await assert.rejects(wrong.sign(bytes, signal), {code: 'vpl1_controller_key'});
  store.commit('1', null);
  assert.throws(() => trust.assertCurrent(), {code: 'vpl1_binding_changed'});
});

function fakeClock() {
  let now = 0;
  const tasks = new Map();
  return {now: () => now,
    schedule(fn, delay) {
      const id = Symbol();
      tasks.set(id, {fn, at: now + delay});
      return id;
    },
    unschedule: id => tasks.delete(id),
    to(target) {
      for (;;) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        const [id, task] = next;
        now = task.at;
        tasks.delete(id);
        task.fn();
      }
      now = target;
    }};
}

async function eventually(predicate, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    const current = predicate();
    if (current) return current;
    await delay(5);
  }
  assert.fail('missing expected loopback event');
}

async function runPeer(t, adapter, controller, count, binary = peer, mode = binary === pushPeer ? 'tcp' : 'device') {
  const sockets = [];
  const server = createServer(socket => {
    sockets.push(socket);
    adapter.accept(socket);
  });
  server.listen({host: '127.0.0.1', port: 0});
  await once(server, 'listening');
  const child = spawn(binary, [mode, String(server.address().port),
    controller.publicKey.toString('hex'), String(count)]);
  let output = '', completed = false;
  child.stdout.setEncoding('utf8').on('data', bytes => { output += bytes; });
  child.stderr.pipe(process.stderr, {end: false});
  const done = once(child, 'close').then(([code]) => { completed = true; return {code, output}; });
  t.after(async () => {
    const serverClosed = new Promise(resolve => server.close(resolve));
    if (!completed) child.kill();
    await adapter.close();
    await Promise.all([serverClosed, done]);
  });
  return {sockets, done};
}

for (const [statusVersion, binary] of [[1, peer], [2, peerV2]]) {
  test(`VPL1 Status v${statusVersion} shares Play and Ping sequence, switches to USB at 6s, closes at 9s and recovers`,
    {skip: !binary, timeout: 12000}, async t => {
    const clock = fakeClock(), life = new AbortController(), {trust, controller} = makeTrust(t);
    let fallbackRead, readings = 0, missed = false;
    const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal, clock,
      usbAttachment: () => 'usb-fixture', usbStatus: () => ({sameUsbTarget: true, usbBusy: false}),
      async read(signal) {
        readings++;
        fallbackRead = signal;
        await new Promise(resolve => signal.addEventListener('abort', resolve, {once: true}));
        signal.throwIfAborted();
      }});
    const probes = [], replies = [];
    const adapter = createDeviceTcpAdapter({trust, statusVersion, usbIdentity: identity, now: clock.now, attach(options) {
      const endpoint = sources.attach({...options, probe(id) {
        probes.push([clock.now(), id]);
        options.probe(id);
      }});
      return {disconnect: endpoint.disconnect, receive(id, value) {
        replies.push([clock.now(), id]);
        if (!missed) return endpoint.receive(id, value);
      }};
    }});
    const {done} = await runPeer(t, adapter, controller, 2, binary);
    const firstStatus = await eventually(() => sources.snapshot().networkStatus);
    if (statusVersion === 2) assert.deepEqual(firstStatus.device, {
      version: '0.1.32-l-battery-usb-pair-test', slot: 'ota_1', busy: true, selected: false,
    });
    assert.equal(adapter.snapshot().session, 1);
    assert.equal((await sources.battery.sample('online', life.signal)).status, 'network_active');
    adapter.setAction(0, 4, 1000);
    const firstFrame = await eventually(() => adapter.snapshot().firstFrame);
    assert.deepEqual(firstFrame, {session: 1, sequence: 2, action: 4, role: 0, displaySequence: 1});

    missed = true; // Withhold verified Status at the telemetry boundary. Real C++ Pong still traverses TCP.
    clock.to(3000);
    await eventually(() => replies.length === 2);
    clock.to(5999);
    assert.ok(sources.snapshot().networkStatus);
    clock.to(6000);
    await eventually(() => replies.length === 3);
    assert.equal(adapter.snapshot().session, 1);
    assert.deepEqual(probes, [[0, 1], [3000, 2], [6000, 3]]);
    assert.equal(sources.snapshot().usbPresent, true);
    const pending = sources.battery.sample('fallback', life.signal);
    await eventually(() => fallbackRead);
    assert.equal(fallbackRead.aborted, false);
    clock.to(8999);
    assert.equal(adapter.snapshot().session, 1);
    missed = false;
    clock.to(9000);
    assert.equal(adapter.snapshot().session, null);
    assert.equal(adapter.snapshot().firstFrame, null);
    await eventually(() => sources.snapshot().networkStatus);
    assert.equal(adapter.snapshot().session, 2);
    assert.equal(fallbackRead.aborted, true);
    assert.deepEqual(await pending, {status: 'network_active'});
    assert.deepEqual(await sources.battery.sample('reconnected', life.signal), {status: 'network_active'});
    assert.equal(readings, 1);
    trust.revoke();
    assert.equal(sources.snapshot().usbPresent, true);
    assert.deepEqual(await done, {code: 0, output: 'open=2 close=2 display=1\n'});
    await adapter.close();
    life.abort();
  });
}

test('real C++ VPL1 peers fail fixed public-key mismatch and provide no telemetry after EOF', {skip: !peer, timeout: 12000}, async t => {
  for (const pin of [8, 7]) await t.test(pin === 7 ? 'socket closes immediately' : 'wrong pinned key', async t => {
    const {trust, controller} = makeTrust(t, {pin});
    const lifetime = new AbortController();
    const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: lifetime.signal, usbAttachment: () => undefined,
      usbStatus: () => ({}), read: assert.fail});
    const adapter = createDeviceTcpAdapter({trust, statusVersion: 1, attach: sources.attach});
    const {sockets, done} = await runPeer(t, adapter, controller, 1);
    if (pin === 7) {
      await eventually(() => sources.snapshot().networkStatus);
      sockets[0].end();
    }
    assert.match((await done).output, pin === 7 ? /open=1 close=1/ : /open=0 close=0/);
    await eventually(() => sources.snapshot().usbPresent === false && adapter.snapshot().session === null);
    lifetime.abort();
  });
});

test('C++ VPL1 verifies a real isolated macOS Keychain controller signature', {
  skip: !(peerV2 || peer) || process.platform !== 'darwin' || process.env.ROUND_PET_VPL1_KEYCHAIN !== '1', timeout: 20000,
}, async t => {
  const directory = join('/private/tmp', 'device-enrollment-' + randomBytes(16).toString('hex'));
  mkdirSync(directory, {mode: 0o700});
  t.after(() => rmSync(directory, {force: true, recursive: true}));
  const helper = join(directory, 'keychain-helper');
  execFileSync('/usr/bin/xcrun', ['clang', '-fobjc-arc', '-Wall', '-Wextra', '-Werror', '-Wno-deprecated-declarations',
    '-framework', 'Foundation', '-framework', 'Security', '-o', helper, 'native/device-keychain.m'], {timeout: 10000});
  chmodSync(helper, 0o700);
  writeFileSync(join(directory, 'keychain-unlock'), randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'});
  const keychain = createBootKeychain(directory);
  await keychain.init();
  const controller = await keychain.prepare({device: '01'.repeat(16)});
  const {trust} = makeTrust(t, {controller, keychain});
  const life = new AbortController();
  const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal, usbAttachment: () => undefined,
    usbStatus: () => ({}), read: assert.fail});
  const adapter = createDeviceTcpAdapter({trust, statusVersion: peerV2 ? 2 : 1, attach: sources.attach, signal: life.signal});
  const {done} = await runPeer(t, adapter, controller, 1, peerV2 ?? peer);
  await eventually(() => sources.snapshot().networkStatus);
  assert.equal(adapter.snapshot().session, 1);
  life.abort();
  assert.equal(sources.snapshot().networkStatus, undefined);
  assert.match((await done).output, /open=1 close=1/);
});

test('only a new authenticated boot resets the session floor and retired boots cannot replace it', {
  skip: !peer, timeout: 12000,
}, async t => {
  const {trust, controller} = makeTrust(t);
  const adapter = createDeviceTcpAdapter({trust, statusVersion: 0});
  const {sockets, done} = await runPeer(t, adapter, controller, 8);
  for (let i = 0; i < 8; i++) {
    const session = i === 7 ? 1 : i + 1;
    await eventually(() => sockets.length === i + 1 && adapter.snapshot().session === session);
    if (i < 7) {
      sockets[i].destroy();
      await eventually(() => adapter.snapshot().session === null);
    }
  }
  const retired = await runPeer(t, adapter, controller, 1);
  assert.match((await retired.done).output, /open=0 close=0/);
  assert.equal(adapter.snapshot().session, 1);
  adapter.setAction(0, 4, 1000);
  assert.equal((await eventually(() => adapter.snapshot().firstFrame)).sequence, 1);
  sockets[7].destroy();
  assert.match((await done).output, /open=8 close=8 display=1/);
});

test('daily listener waits for matching USB and serves proactive Status v2 after verified ARM, then drains on enrollment exit',
  {skip: !pushPeer, timeout: 12000}, async t => {
    const {trust, controller} = makeTrust(t);
    const enrolled = new AbortController(), queried = new AbortController();
    const arm = Promise.withResolvers(), pinned = Promise.withResolvers(), warnings = [];
    const lan = createDesktopDeviceLan({address: '127.0.0.1', port: 0}, {fixture: true,
      wait: (_, value, options) => delay(12, value, {...options, ref: true}), report: message => warnings.push(message)});
    t.after(() => lan.close());
    let attached = false, usbWaits = 0;
    const provider = createDesktopStatusSources({usbIdentity: identity, lifetime: queried.signal,
      usbAttachment: () => attached ? 'usb' : undefined, usbStatus: () => ({}), read: assert.fail});
    lan.connectTelemetry({usbIdentity: identity, signal: queried.signal, attach: provider.attach,
      usbReady() { usbWaits++; return attached; }});
    assert.equal(lan.address(), null);
    lan.connectEnrollment({signal: enrolled.signal, owner: {
      lanUsbIdentity: identity,
      status: () => ({phase: 'bound', instanceId: 'enrolled', revision: '9'}),
      lanArm(input) { arm.resolve(input); return pinned.promise; },
    }});
    await eventually(() => usbWaits >= 2);
    assert.equal(lan.address(), null);
    attached = true;
    const request = await arm.promise;
    assert.deepEqual(request, {address: '127.0.0.1', instanceId: 'enrolled', revision: '9', port: lan.address().port});
    const early = connect(request.port, request.address);
    const earlyClose = once(early, 'close');
    let earlyBytes = 0;
    early.on('data', bytes => { earlyBytes += bytes.length; });
    await earlyClose;
    assert.equal(earlyBytes, 0);
    pinned.resolve({status: 'ok', trust});
    await Promise.resolve();
    attached = false; // Once armed, USB availability no longer gates this process pin.
    if (peerV2) {
      const older = spawn(peerV2, ['device', String(request.port), controller.publicKey.toString('hex'), '1']);
      const closer = once(older, 'close');
      let output = '';
      older.stdout.setEncoding('utf8').on('data', text => { output += text; });
      assert.deepEqual(await closer, [0, null]);
      assert.equal(output, 'open=0 close=0 display=0\n');
    }
    const child = spawn(pushPeer, ['tcp', String(request.port), controller.publicKey.toString('hex'), '1'],
      {stdio: ['ignore', 'ignore', 'inherit']});
    const exit = once(child, 'close');
    t.after(() => { if (child.exitCode == null) child.kill(); });
    await eventually(() => provider.snapshot().networkStatus);
    assert.equal(provider.snapshot().networkStatus.device.slot, 'ota_1');
    assert.deepEqual(await provider.battery.sample('online', queried.signal), {status: 'network_active'});
    enrolled.abort();
    await lan.close();
    assert.equal(lan.address(), null);
    assert.equal(trust.signal.aborted, true);
    assert.equal(provider.snapshot().usbPresent, false);
    assert.deepEqual(await exit, [0, null]);
    assert.deepEqual(warnings, []);
    provider.close();
  });

test('daily listener fails closed for wrong USB or occupied port without opening the serial provisioning path', async t => {
  const external = createServer();
  const ready = once(external, 'listening');
  external.listen({host: '127.0.0.1', port: 0});
  await ready;
  t.after(() => new Promise(resolve => external.close(resolve)));
  for (const usbIdentity of ['different', identity]) {
    const life = new AbortController(), reported = Promise.withResolvers();
    const lan = createDesktopDeviceLan({address: '127.0.0.1', port: external.address().port},
      {fixture: true, report: message => reported.resolve(message)});
    const owner = {lanUsbIdentity: identity, lanArm: assert.fail, status: () => ({phase: 'bound'})};
    lan.connectEnrollment({owner, signal: life.signal});
    lan.connectTelemetry({usbIdentity, attach: assert.fail, usbReady: () => true, signal: life.signal});
    assert.match(await reported.promise, /USB remains usable/);
    await lan.close();
    assert.equal(lan.address(), null);
    life.abort();
  }
  assert.equal(external.listening, true);
});

test('listener closure waits for an in-flight ARM and revokes late trust', {timeout: 8000}, async t => {
  const {trust} = makeTrust(t);
  const life = new AbortController(), sent = Promise.withResolvers(), pending = Promise.withResolvers();
  const lan = createDesktopDeviceLan({address: '127.0.0.1', port: 0}, {fixture: true, report: assert.fail});
  lan.connectEnrollment({owner: {lanUsbIdentity: identity, status: () => ({phase: 'bound'}),
    lanArm(_, {signal}) { sent.resolve(signal); return pending.promise; }}, signal: life.signal});
  lan.connectTelemetry({usbIdentity: identity, attach: assert.fail, usbReady: () => true, signal: life.signal});
  const armSignal = await sent.promise;
  let finished = false;
  life.abort();
  const closing = lan.close().then(() => { finished = true; });
  assert.equal(armSignal.aborted, true);
  await Promise.resolve();
  assert.equal(finished, false);
  pending.resolve({status: 'ok', trust});
  await closing;
  assert.equal(trust.signal.aborted, true);
  assert.equal(lan.address(), null);
});

test('discovery selects one private IPv4 and waits on ambiguous or absent interfaces', () => {
  const address = value => ({family: 'IPv4', address: value, internal: false, cidr: value + '/24', netmask: '255.255.255.0'});
  const first = address('192.168.10.12'), changed = address('192.168.10.34');
  assert.deepEqual(selectDeviceLanAddress([first, address('203.0.113.2')]), {address: first.address, netmask: first.netmask});
  assert.deepEqual(selectDeviceLanAddress([changed]), {address: changed.address, netmask: changed.netmask});
  assert.equal(selectDeviceLanAddress([first, changed]), null);
  assert.equal(selectDeviceLanAddress([{...first, internal: true}]), null);
  assert.equal(selectDeviceLanAddress(), null);
});

test('discovery withdraws the listener and reannounces on the chosen interface without replacing USB trust', {timeout: 8000}, async t => {
  const {trust} = makeTrust(t);
  const life = new AbortController(), published = [];
  const endpoint = {family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', cidr: '127.0.0.1/8'};
  let entries = [], arms = 0, usbReady = true;
  const lan = createDesktopDeviceLan({address: '', port: 0, discoveryInterface: 'lo0'}, {fixture: true,
    interfaces: () => ({lo0: entries}), report: assert.fail,
    wait: (_, value, options) => delay(15, value, {...options, ref: true}), async publish(input) {
      const registration = {input, active: true};
      published.push(registration);
      return {live: () => registration.active, async close() { registration.active = false; }};
    }});
  t.after(() => lan.close());
  lan.connectEnrollment({owner: {lanUsbIdentity: identity, status: () => ({phase: 'bound'}),
    lanArm(input) { assert.equal(input.address, endpoint.address); arms++; return {status: 'ok', trust}; }}, signal: life.signal});
  lan.connectTelemetry({usbIdentity: identity, attach: assert.fail, usbReady: () => usbReady, signal: life.signal});
  assert.equal(lan.address(), null);
  entries = [endpoint];
  await eventually(() => published.length === 1);
  assert.equal(arms, 1);
  assert.equal(published[0].input.interfaceName, 'lo0');
  assert.equal(published[0].input.port, lan.address().port);
  assert.match(published[0].input.instance, /^DSH Pet Hub [a-f0-9]{16}$/);

  const {port} = lan.address();
  const socket = connect(port, endpoint.address);
  let socketError;
  socket.on('error', error => { socketError = error; });
  const socketClosed = new Promise(resolve => socket.once('close', resolve));
  await once(socket, 'connect');
  usbReady = false;
  entries = [];
  await socketClosed;
  assert.ok(!socketError || socketError.code === 'ECONNRESET');
  await eventually(() => !published[0].active && lan.address() === null);
  assert.equal(lan.actionTarget(), undefined);
  assert.equal(trust.signal.aborted, false);

  entries = [endpoint];
  await eventually(() => published.length === 2);
  assert.equal(published[1].input.instance, published[0].input.instance);
  assert.equal(arms, 1);
  published[1].active = false; // Simulate an unexpected Bonjour child exit.
  await eventually(() => published.length === 3);
  assert.equal(published[2].input.port, lan.address().port);
  assert.equal(lan.actionTarget(), undefined);
  life.abort();
  await lan.close();
  assert.equal(published[2].active, false);
  assert.equal(lan.address(), null);
  assert.equal(trust.signal.aborted, true);
});

function sequencePair(session, sequence) {
  const out = Buffer.alloc(8);
  out.writeUInt32LE(session);
  out.writeUInt32LE(sequence, 4);
  return out;
}

test('LAN discovery resumes only an immutable USB pin with a durable confirmation', t => {
  const {store} = makeTrust(t), binding = store.read(), point = privateFixture(7).publicKey;
  const directory = mkdtempSync(join(tmpdir(), 'vpl1-pins-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const pins = openDeviceLanPins(directory, identity);
  assert.throws(() => pins.confirm(binding, point), {code: 'device_lan_pin_changed'});
  pins.prepare(binding, point);
  const reopened = openDeviceLanPins(directory, identity);
  assert.equal(reopened.load(binding), null);
  assert.throws(() => reopened.prepare(binding, privateFixture(8).publicKey), {code: 'device_lan_pin_changed'});
  reopened.confirm(binding, point);
  assert.deepEqual(openDeviceLanPins(directory, identity).load(binding), point);
  assert.equal(openDeviceLanPins(directory, '20/112233445566').load(binding), null);
  assert.equal(reopened.load({...binding, revision: '2'}), null);
  reopened.withdraw(binding);
  assert.equal(pins.load(binding), null);
  pins.prepare(binding, point);
  pins.confirm(binding, point);
  assert.deepEqual(reopened.load(binding), point);
});

test('discovery enable and disable require the matching USB reply and validate the exact device key digest', async () => {
  const point = privateFixture(7).publicKey;
  let before = 0;
  for (const key of [point, null]) {
    const operation = key ? 'ENABLE ' + createHash('sha256').update(point).digest('hex') : 'DISABLE';
    const status = key ? 'enabled' : 'disabled';
    await setDeviceLanDiscoveryOverUsb({exchangeDesktop(wire, {beforeWrite, match}) {
      const [, id, suffix] = /^VPCNET1 DISCOVERY ([a-f0-9]{8}) (.+)\n$/.exec(wire.toString());
      assert.equal(suffix, operation);
      beforeWrite();
      const other = id === 'ffffffff' ? '00000000' : 'ffffffff';
      assert.equal(match(`@VP8_VPCNET1 DISCOVERY id=${other} status=${status}\n`), undefined);
      return match(`@VP8_VPCNET1 DISCOVERY id=${id} status=${status}\n`);
    }}, key, new AbortController().signal, () => before++);
  }
  assert.equal(before, 2);
  await assert.rejects(setDeviceLanDiscoveryOverUsb({exchangeDesktop: () => 'busy'}, point, new AbortController().signal),
    {code: 'vpl1_discovery_rejected'});
});

test('confirmed discovery starts the listener after restart with no USB', {timeout: 8000}, async t => {
  const {trust, controller} = makeTrust(t);
  const life = new AbortController(), published = Promise.withResolvers();
  const endpoint = {family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', cidr: '127.0.0.1/8'};
  const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal,
    usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
  const lan = createDesktopDeviceLan({address: '', port: 0, discoveryInterface: 'lo0'}, {fixture: true,
    interfaces: () => ({lo0: [endpoint]}), report: assert.fail, async publish({port}) {
      published.resolve(port);
      return {live: () => true, async close() {}};
    }});
  t.after(() => lan.close());
  lan.connectEnrollment({owner: {lanUsbIdentity: identity, status: assert.fail, lanLoad: () => trust,
    lanArm: assert.fail}, signal: life.signal});
  lan.connectTelemetry({usbIdentity: identity, attach: sources.attach, usbReady: assert.fail, signal: life.signal});
  const port = await published.promise;
  assert.equal(port, lan.address().port);
  if (pushPeer) {
    const child = spawn(pushPeer, ['tcp', String(port), controller.publicKey.toString('hex'), '1']);
    const exited = once(child, 'close');
    t.after(async () => { if (child.exitCode === null) child.kill(); await exited; });
    await eventually(() => sources.snapshot().networkStatus);
    assert.ok(lan.actionTarget());
    await lan.close();
    assert.equal(sources.snapshot().usbPresent, false);
    assert.deepEqual(await exited, [0, null]);
  }
});

test('push mode authenticates, only ACKs fresh new statuses and falls back at the 6/9 second deadlines', {timeout: 10000}, async t => {
  const clock = fakeClock(), {trust, store} = makeTrust(t), life = new AbortController();
  const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal, clock,
    usbAttachment: () => 'usb', usbStatus: () => ({sameUsbTarget: true}),
    read: () => ({status: 'ok'})});
  const adapter = createDeviceTcpAdapter({trust, pushStatus: true, attach: sources.attach, ...clock});
  const server = createServer(adapter.accept);
  const serverReady = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await serverReady;
  t.after(async () => {
    await adapter.close();
    await new Promise(resolve => server.close(resolve));
    life.abort();
  });
  const socket = connect(server.address().port, '127.0.0.1');
  const eof = once(socket, 'close');
  const frames = [], framer = createVpl1Framer(2);
  socket.on('data', bytes => framer.push(bytes, (type, frame) => frames.push({type, frame})));
  const next = () => eventually(() => frames.shift());
  const {target} = store.read().record;
  const ephemeral = createECDH('prime256v1');
  const hello = Buffer.alloc(194);
  for (const [i, field] of ['device','controller','binding'].entries()) hello.set(hex(target[field]), i * 16);
  hello.writeBigUInt64LE(BigInt(target.epoch), 48);
  hello.set(hex(target.keySha256),56);
  hello.writeBigUInt64LE(66n,88);
  hello.fill(8,96,128);
  hello.set(ephemeral.generateKeys(),128);
  hello[193]=4;
  socket.write(vpl1Frame(VPL1.hello, hello));
  const auth = await next();
  assert.equal(auth.type, VPL1.auth);
  assert.equal(auth.frame[105], 3);
  const transcript = vpl1Transcript(hello, auth.frame.subarray(8,106));
  const keys = vpl1Keys(ephemeral.computeSecret(auth.frame.subarray(40,105)), transcript);
  const serial = sequencePair(1,0).subarray(0,4);
  const deviceAuth = Buffer.concat([Buffer.from('VPL1/device-auth'),transcript,serial]);
  socket.write(vpl1Frame(VPL1.deviceFinish, Buffer.concat([serial, privateFixture(7).signTranscript(deviceAuth),
    vpl1Tag(keys.fromDevice,'device-finish',transcript,serial)])));
  const finish = await next();
  assert.equal(finish.type,VPL1.hubFinish);
  assert.deepEqual(finish.frame.subarray(8),vpl1Tag(keys.toDevice,'hub-finish',transcript,serial));
  let tx = 1;
  socket.write(sealVpl1(VPL1.ready,tx,serial,keys.fromDevice));
  const status = (seq,version) => socket.write(sealVpl1(VPL1.status,++tx,
    Buffer.concat([sequencePair(1,seq),minimalStatusV2(version,1)]),keys.fromDevice));
  status(1,'0.1.40');
  const firstAck = await next();
  assert.equal(firstAck.type,VPL1.statusAck);
  assert.deepEqual(openVpl1(firstAck.frame,1,keys.toDevice),sequencePair(1,1));
  clock.to(3000);
  status(2,'0.1.41');
  await eventually(() => sources.snapshot().networkStatus?.device.version==='0.1.41');
  clock.to(6000);
  status(3,'0.1.42');
  await eventually(() => sources.snapshot().networkStatus?.device.version==='0.1.42');
  assert.equal(frames.length,0);
  clock.to(9000);
  const later = await next();
  assert.equal(later.type,VPL1.statusAck);
  assert.deepEqual(openVpl1(later.frame,2,keys.toDevice),sequencePair(1,3));
  clock.to(11999);
  assert.ok(sources.snapshot().networkStatus);
  clock.to(12000);
  assert.equal(sources.snapshot().networkStatus,undefined);
  assert.deepEqual(await sources.battery.sample('fallback',life.signal),{status:'ok'});
  clock.to(14999);
  assert.equal(adapter.snapshot().session,1);
  clock.to(15000);
  await eof;
  assert.equal(adapter.snapshot().session,null);
  assert.equal(frames.length,0);
});

test('shared proactive vectors decode Status, authenticate ACK and match USB subscription lines', () => {
  const vectors = JSON.parse(readFileSync(new URL('../docs/protocol/vectors/device-status-push.json', import.meta.url)));
  assert.equal(vectors.device_hello_capabilities, '04');
  assert.equal(vectors.hub_auth_mode, '03');
  assert.deepEqual(sealVpl1(VPL1.statusAck,1,hex(vectors.ack_first_payload),hex(vectors.ack_test_key)),
    hex(vectors.ack_first_record));
  assert.equal(decodeVpl1Status(hex(vectors.status_first_tcp),2).sequence,1);
  assert.equal(decodeVpl1Status(hex(vectors.status_first_tcp),2).value.busy,true);
  assert.equal(vectors.usb_subscribe,'STATUS3_SUB 4a01c0de\n');
  assert.equal(vectors.usb_unsubscribe,'STATUS3_UNSUB 4a01c0de\n');
  const {sequence,status} = decodeUsbStatusReport(vectors.usb_first_report.trimEnd().replace(/^@VP8_STATUS3_PUSH /,''),'4a01c0de',0);
  assert.equal(sequence,1);
  assert.equal(status.selected,true);
});

test('firmware C++ proactive session returns Play Accepted/Presented independently of Status ACK', {skip: !pushPeer}, async t => {
  const {trust,controller} = makeTrust(t), life = new AbortController();
  const sources = createDesktopStatusSources({usbIdentity:identity, lifetime:life.signal,
    usbAttachment: () => undefined,usbStatus: () => ({}), read: assert.fail});
  const adapter = createDeviceTcpAdapter({trust,pushStatus:true,attach:sources.attach,signal:life.signal});
  const {done} = await runPeer(t,adapter,controller,1,pushPeer);
  await eventually(() => sources.snapshot().networkStatus);
  adapter.setAction(0,4,1300);
  const first = await eventually(() => adapter.snapshot().firstFrame);
  assert.deepEqual(first,{session:1,sequence:1,action:4,role:0,displaySequence:1});
  await adapter.close();
  assert.deepEqual(await done,{code:0,output:'open=1 close=1 display=1\n'});
  life.abort();
});

for (const stage of ['pending', 'claimed']) {
  const reconnect = stage === 'pending';
  test(`firmware C++ reports Expired for a ${stage} action and accepts fresh commands ${reconnect ? 'after reconnect' : 'in the same session'}`,
    {skip: !pushPeer, timeout: 10000}, async t => {
      const clock = fakeClock(), {trust, controller} = makeTrust(t), life = new AbortController();
      t.after(() => life.abort());
      const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal, clock,
        usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
      const adapter = createDeviceTcpAdapter({trust, pushStatus: true, attach: sources.attach, signal: life.signal, ...clock});
      const {sockets, done} = await runPeer(t, adapter, controller, reconnect ? 2 : 1, pushPeer, `tcp-expiry-${stage}`);
      await eventually(() => sources.snapshot().networkStatus);
      const first = adapter.actionTarget();
      const ticket = {session: 1, sequence: 1, role: 0, action: 2};
      assert.equal(first.play(0, 2, 1500), true);
      const accepted = await eventually(() => adapter.snapshot().lastReceipt);
      assert.deepEqual(accepted, {...ticket, phase: 'accepted', kind: playbackKind.accepted, value: 0});
      assert.equal(adapter.snapshot().firstFrame, null);

      if (!reconnect) {
        clock.to(1500);
        assert.equal(adapter.snapshot().action.phase, 'expired');
        assert.deepEqual(adapter.snapshot().lastReceipt, accepted);
      }
      const expired = await eventually(() => {
        const receipt = adapter.snapshot().lastReceipt;
        if (receipt?.phase !== 'accepted') return receipt;
      }, 650);
      assert.deepEqual(expired, {...ticket, phase: 'expired', kind: playbackKind.expired, value: 0});
      assert.equal(adapter.snapshot().action.phase, 'expired');
      assert.equal(adapter.snapshot().firstFrame, null);
      assert.equal(adapter.actionTarget(), first);

      if (reconnect) {
        sockets[0].destroy();
        await eventually(() => adapter.snapshot().session === 2 && adapter.actionTarget());
        assert.equal(adapter.snapshot().firstFrame, null);
        assert.equal(first.play(0, 2, 1500), false);
      }
      const target = adapter.actionTarget(), session = reconnect ? 2 : 1;
      for (const [action, displaySequence] of [[43, 1], [3, 2]]) {
        assert.equal(target.play(0, action, 1500), true);
        assert.deepEqual(await eventually(() => adapter.snapshot().firstFrame),
          {session, sequence: displaySequence + (reconnect ? 0 : 1), role: 0, action, displaySequence});
      }
      await adapter.close();
      assert.deepEqual(await done, {code: 0, output: `open=${session} close=${session} display=2 late=1\n`});
    });
}

test('draining the listener keeps authentication and requires a fresh play after reconnect',
  {skip: !pushPeer, timeout: 12000}, async t => {
    const {trust, controller} = makeTrust(t), life = new AbortController();
    const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal,
      usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
    const adapter = createDeviceTcpAdapter({trust, pushStatus: true, attach: sources.attach, signal: life.signal});
    const {done} = await runPeer(t, adapter, controller, 2, pushPeer);
    t.after(() => life.abort());
    const old = await eventually(() => adapter.actionTarget());
    assert.equal(old.play(0, 41, 1500), true);
    assert.equal((await eventually(() => adapter.snapshot().firstFrame)).session, 1);

    await adapter.disconnect();
    assert.equal(trust.signal.aborted, false);
    assert.equal(old.play(0, 42, 1500), false);
    await eventually(() => adapter.snapshot().session === 2 && adapter.actionTarget());
    assert.equal(adapter.snapshot().firstFrame, null);
    assert.equal(adapter.actionTarget().play(0, 43, 1500), true);
    assert.deepEqual(await eventually(() => adapter.snapshot().firstFrame),
      {session: 2, sequence: 1, action: 43, role: 0, displaySequence: 2});
    await adapter.close();
    assert.deepEqual(await done, {code: 0, output: 'open=2 close=2 display=2\n'});
  });

test('an existing firmware boot opens a fresh authenticated session after the Hub adapter is replaced',
  {skip: !pushPeer, timeout: 12000}, async t => {
    const {trust, store, controller} = makeTrust(t);
    const mount = bindingTrust => {
      const lifetime = new AbortController();
      const status = createDesktopStatusSources({usbIdentity: identity, lifetime: lifetime.signal,
        usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
      const adapter = createDeviceTcpAdapter({trust: bindingTrust, pushStatus: true, attach: status.attach,
        signal: lifetime.signal});
      t.after(() => lifetime.abort());
      return {adapter, status};
    };
    const first = mount(trust);
    let current = first.adapter;
    const {done} = await runPeer(t, {accept: socket => current.accept(socket), close: () => current.close()},
      controller, 2, pushPeer);
    const old = await eventually(() => first.adapter.actionTarget());
    assert.equal(old.play(0, 41, 1500), true);
    await eventually(() => first.adapter.snapshot().firstFrame);

    const replacementTrust = createDeviceTcpTrust({store, keychain: {lookup: () => controller},
      revision: store.read().revision, usbIdentity: identity, devicePublicKey: privateFixture(7).publicKey});
    const second = mount(replacementTrust);
    current = second.adapter;
    await first.adapter.close();
    assert.equal(old.play(0, 42, 1500), false);
    assert.equal(first.status.snapshot().networkStatus, undefined);
    await eventually(() => second.status.snapshot().networkStatus);
    assert.equal(second.adapter.snapshot().session, 2);
    assert.equal(second.adapter.snapshot().firstFrame, null);
    await second.adapter.close();
    assert.deepEqual(await done, {code: 0, output: 'open=2 close=2 display=1\n'});
  });

test('DSH extended events reach the authenticated firmware peer as one Play per admitted transition',
  {skip: !pushPeer, timeout: 10000}, async t => {
    const {trust, controller} = makeTrust(t), life = new AbortController();
    const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal,
      usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
    const adapter = createDeviceTcpAdapter({trust, pushStatus: true, attach: sources.attach, signal: life.signal});
    const {done} = await runPeer(t, adapter, controller, 1, pushPeer);
    t.after(() => life.abort());
    await eventually(() => adapter.actionTarget());
    let state = null, counter = 1, reads = 0;
    const motion = startTaskSource({async read() { reads++; return {sessionId: 'target', turnId: 'turn', state, counter}; }},
      'target', {lan: adapter, extended: true, wait: (_, value, options) => delay(12, value, options)});
    t.after(() => motion.close());
    async function display(action, sequence) {
      const outcome = await eventually(() => {
        const frame = adapter.snapshot().firstFrame;
        return frame?.action === action && frame;
      });
      assert.equal(outcome.sequence, sequence);
      assert.equal(outcome.displaySequence, sequence);
    }
    function advance(next) { state = next; counter++; }
    await eventually(() => reads >= 2);
    advance('waiting');
    await display(41, 1);
    advance('working');
    await display(2, 2);
    advance('result');
    await delay(200);
    await display(43, 3);
    advance('error');
    await display(42, 4);
    const last = reads;
    await eventually(() => reads >= last + 3);
    await motion.close();
    await adapter.close();
    assert.deepEqual(await done, {code: 0, output: 'open=1 close=1 display=4\n'});
  });

test('read-only pet state transitions traverse VPL1 mode 3 to real C++ without replay', {skip: !pushPeer}, async t => {
  const {trust, controller} = makeTrust(t), life = new AbortController();
  const sources = createDesktopStatusSources({usbIdentity: identity, lifetime: life.signal,
    usbAttachment: () => undefined, usbStatus: () => ({}), read: assert.fail});
  const adapter = createDeviceTcpAdapter({trust, pushStatus: true, attach: sources.attach, signal: life.signal});
  const {sockets, done} = await runPeer(t, adapter, controller, 2, pushPeer);
  await eventually(() => adapter.actionTarget());
  const first = adapter.actionTarget();
  let counter = 0, state = null, reads = 0;
  const http = createHttpServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/dsh-pet-7340/state');
    reads++;
    res.end(JSON.stringify({sections: {workStatus: {counter, data: {state, sessionId: 'target'}}}}));
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const motion = startDesktopTaskMotion({source: `http://127.0.0.1:${http.address().port}/dsh-pet-7340`, sessionId: 'target'},
    {lan: {signal: life.signal, actionTarget: adapter.actionTarget}, wait: (_, value, options) => delay(12, value, options)});
  t.after(async () => { await motion.close(); await new Promise(resolve => http.close(resolve)); });
  async function display(next, action, sequence) {
    counter++;
    state = next;
    const receipt = await eventually(() => adapter.snapshot().firstFrame?.action === action && adapter.snapshot().firstFrame);
    assert.equal(receipt.sequence, sequence);
    assert.equal(receipt.displaySequence, sequence);
  }
  await eventually(() => reads >= 2);
  await display('thinking', 1, 1);
  await display('working', 2, 2);
  counter++;
  state = 'result';
  const before = reads;
  await eventually(() => reads >= before + 2);
  assert.equal(adapter.snapshot().firstFrame.action, 2);
  await display('success', 3, 3);
  sockets[0].destroy();
  await eventually(() => adapter.actionTarget() && adapter.actionTarget() !== first);
  assert.equal(first.play(0, 3, 1500), false);
  const resumed = reads;
  await eventually(() => reads >= resumed + 3);
  assert.equal(adapter.snapshot().firstFrame, null);
  await motion.close();
  await adapter.close();
  assert.deepEqual(await done, {code: 0, output: 'open=2 close=2 display=3\n'});
  life.abort();
});
