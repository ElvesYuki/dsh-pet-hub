import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, realpath, rename, rm, writeFile} from 'node:fs/promises';
import {connect, createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {decodePbp1Frame, encodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {encodeMediaFrame, MEDIA_BLOCK_MAX} from '../packages/core/native400-tcp-media-wire.mjs';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {createNative400LanMaintenance, createNative400UsbPairing} from '../packages/runtime/index.mjs';
import {native400UsbPairingScope} from '../packages/runtime/native400-usb-pairing.mjs';
import {openMediaLoopbackIO} from '../packages/runtime/native400-tcp-media-socket.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {native400IdentityFixture} from '../packages/simulator/native400-identity-fixture.mjs';
import {mockPbp1Usb} from './fixtures/native400-pbp1.mjs';
import {deviceInit} from './fixtures/native400-media-auth.mjs';

const identity = {device: '32'.repeat(16), hub: '43'.repeat(16), binding: '54'.repeat(16), epoch: '1'};
const hello = {kind: 'hello', boot: '9007199254740999', root: '2', generation1: '3', generation11: '4'};
const endpoint = {address: '192.168.17.9', port: 42001}; // Synthetic address/port; never bound by the test.
const fixture = native400IdentityFixture();
const wifi = () => ({ssid: Buffer.from('test-ssid'), password: Buffer.from('test-password')});

async function setup(t, mode = 'saved', timeoutMs = 30000, tailTiming = false) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'pma1-lan-')));
  t.after(() => rm(directory, {recursive: true, force: true}));
  await writeFile(join(directory, '1.pet'), fixture.bytes(1), {mode: 0o600});
  const usb = mockPbp1Usb({boot: hello.boot, device: identity.device});
  const pairOwner = createNative400UsbPairing({enabled: true, transport: usb.transport, identity,
    pollMs: 5, confirmFingerprint: () => usb.screen()});
  t.after(() => pairOwner.close());
  const active = pairOwner.start();
  await usb.confirmed;
  usb.pressBoot();
  const pairing = await active;
  const scope = native400UsbPairingScope(pairing);
  const arrived = Promise.withResolvers();
  const releaseArm = Promise.withResolvers();
  const armStarted = Promise.withResolvers();
  const sockets = [];
  const noDelay = [];
  let listener, armCalls = 0, usbClosed = 0, grantCalls = 0, rawPacket;
  function makeServer(options, accept) {
    assert.equal(options.pauseOnConnect, true);
    listener = createServer(options, socket => {
      Object.defineProperties(socket, {localAddress: {value: endpoint.address}, localPort: {value: endpoint.port},
        remoteAddress: {value: mode === 'wrong-peer' ? '127.0.0.1' : '192.168.17.10'}});
      const setNoDelay = socket.setNoDelay.bind(socket);
      socket.setNoDelay = enabled => { noDelay.push(enabled); return setNoDelay(enabled); };
      accept(socket);
    });
    const original = listener.listen.bind(listener);
    listener.listen = options => {
      assert.deepEqual(options, {host: endpoint.address, port: endpoint.port, exclusive: true, backlog: 1});
      return original({host: '127.0.0.1', port: 0});
    };
    return listener;
  }
  const options = {enabled: true, ...endpoint, pairing, directory, sourceBytes: fixture.sourceBytes, indexBytes: fixture.indexBytes,
    timeoutMs, tailTiming,
    decision: {profile: 'native400-media-maintenance/1', purpose: 'lan-action1-repair', approval_id: 'original-fixture',
      license_ref: 'original-test-MIT', source_manifest_sha256: sha256(fixture.sourceBytes), source_index_sha256: sha256(fixture.indexBytes),
      namespace: NATIVE400_BOOT_NAMESPACE, action: 1, boot: hello.boot, root: hello.root, generation: hello.generation1},
    authorize(request) {
      grantCalls++;
      assert.equal(request.beginSha, caller.plan.beginSha);
      return {request, id: '65'.repeat(16), expiresAt: request.deadline};
    },
    async openArmTransport() {
      return {async exchange(packet, {signal}) {
        assert.ok(listener.listening);
        armCalls++;
        rawPacket = packet;
        const {kind, body} = decodePbp1Frame(packet);
        assert.equal(kind, 'lan-arm');
        assert.equal(packet.length, 196);
        const b = Buffer.from(body);
        assert.equal(b.readBigUInt64LE(0).toString(), hello.boot);
        assert.equal(b.readUInt32LE(8), scope.proposal);
        assert.deepEqual([...b.subarray(12, 16)], [192, 168, 17, 9]);
        assert.equal(b.readUInt16LE(16), endpoint.port);
        assert.deepEqual(b.subarray(20, 29), Buffer.from('test-ssid'));
        assert.ok(b.subarray(29, 52).every(x => x === 0));
        assert.ok(b.subarray(65, 116).every(x => x === 0));
        assert.equal(b.subarray(116, 148).toString('hex'), caller.plan.beginSha);
        const mac = createHmac('sha256', pairing.acquire(identity).key).update('PMA1/usb-lan-arm/v1').update(b.subarray(0, 148)).digest();
        assert.deepEqual(b.subarray(148), mac);
        b.fill(0);
        armStarted.resolve();
        if (mode === 'lost') return null;
        const peer = connect(listener.address().port, '127.0.0.1');
        peer.setNoDelay(true);
        peer.on('error', () => {});
        sockets.push(peer);
        await once(peer, 'connect');
        arrived.resolve(peer);
        await releaseArm.promise;
        signal.throwIfAborted();
        return encodePbp1Frame({kind: 'state', ...scope, phase: 'active', event: mode === 'reject' ? 'rejected' : 'ok'});
      }, async close() { usbClosed++; }};
    }};
  const caller = createNative400LanMaintenance(options, makeServer);
  t.after(async () => { releaseArm.resolve(); for (const peer of sockets) peer.destroy(); await caller.close(); });
  return {options, caller, arrived, releaseArm, armStarted, secret: usb.activeSecret(), makeServer, noDelay,
    state: () => ({armCalls, usbClosed, grantCalls, packetCleared: rawPacket?.every(x => !x), listening: listener?.listening})};
}

async function authenticatePeer(f, peer, device, signal) {
  f.releaseArm.resolve();
  const session = device.finish(await peer.read(80, signal));
  await peer.write(session.finish);
  const send = value => peer.write(session.endpoint.seal('ptm', encodeMediaFrame(value)));
  async function receive() {
    const head = await peer.read(16, signal);
    return session.endpoint.open(Buffer.concat([head, await peer.read(head.readUInt32LE(12) + 32, signal)]));
  }
  await send(hello);
  const grant = await receive();
  const begin = await receive();
  assert.equal(grant.fields.beginSha.toString('hex'), f.caller.plan.beginSha);
  assert.deepEqual(begin.fields, f.caller.plan.begin);
  await send({kind: 'ready', job: begin.fields.job});
  return {send, receive, begin: begin.fields};
}

test('one private endpoint arms the frozen exact BEGIN and reuses PMA1 through Saved', async t => {
  const f = await setup(t);
  assert.ok(Object.isFrozen(f.caller.plan.begin));
  assert.equal(f.caller.plan.beginSha, sha256(encodeMediaFrame(f.caller.plan.begin)));
  const credentials = wifi();
  const done = f.caller.run(credentials);
  const peer = openMediaLoopbackIO(await f.arrived.promise);
  t.after(() => peer.close());
  const device = deviceInit({...identity, syntheticKey: f.secret}, 'repair', 'ab'.repeat(32));
  const signal = AbortSignal.timeout(5000);
  await peer.write(device.init);
  assert.equal(f.state().grantCalls, 0);
  assert.equal(f.state().usbClosed, 0);
  assert.ok(credentials.ssid.every(x => !x) && credentials.password.every(x => !x));
  const {send, receive, begin} = await authenticatePeer(f, peer, device, signal);
  assert.equal(f.state().listening, false);
  assert.deepEqual(f.noDelay, [true]);
  const {job, bytes, sha256: digest} = begin;
  const data = [];
  for (let offset = 0; offset < bytes;) {
    const block = (await receive()).fields;
    assert.equal(block.offset, offset);
    if (!offset) await delay(35);
    data.push(block.data);
    offset += block.data.length;
    await send({kind: 'ack', job, bytes: offset});
  }
  assert.equal(sha256(Buffer.concat(data)), digest);
  assert.deepEqual((await receive()).fields, {kind: 'end', job, bytes});
  await send({kind: 'result', job, status: 'saved', root: '3', generation: '5', sha256: digest});
  const result = await done;
  assert.equal(result.status, 'saved');
  assert.deepEqual(Object.keys(result.timing).sort(), ['ack', 'dataWriteMs', 'tcpMs', 'totalMs']);
  assert.equal(result.timing.ack.count, Math.ceil(bytes / MEDIA_BLOCK_MAX));
  assert.ok(result.timing.ack.maxMs >= 20);
  assert.ok(result.timing.ack.meanMs > 0 && result.timing.ack.meanMs <= result.timing.ack.maxMs);
  assert.equal(result.timing.ack.unacknowledgedMs, null);
  assert.ok(result.timing.totalMs >= result.timing.tcpMs && result.timing.tcpMs >= result.timing.dataWriteMs);
  assert.deepEqual(f.state(), {armCalls: 1, usbClosed: 1, grantCalls: 1, packetCleared: true, listening: false});
  assert.throws(() => f.caller.run(wifi()), /media_lan_used/);
  const repeat = createNative400LanMaintenance(f.options, f.makeServer);
  await assert.rejects(repeat.run(wifi()), /media_lan_used/);
});

test('deadline keeps the last DATA out of confirmed ACK timing and preserves Unknown', async t => {
  const f = await setup(t, 'saved', 1000, true);
  const done = f.caller.run(wifi());
  const peer = openMediaLoopbackIO(await f.arrived.promise);
  t.after(() => peer.close());
  const device = deviceInit({...identity, syntheticKey: f.secret}, 'repair', 'ab'.repeat(32));
  await peer.write(device.init);
  const {send, receive, begin} = await authenticatePeer(f, peer, device, AbortSignal.timeout(5000));
  const first = (await receive()).fields;
  await send({kind: 'ack', job: begin.job, bytes: first.data.length});
  assert.equal((await receive()).fields.offset, first.data.length);
  const result = await done;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'media_deadline');
  assert.equal(result.saved, null);
  assert.equal(result.confirmed, MEDIA_BLOCK_MAX);
  assert.equal(result.sent, 2 * MEDIA_BLOCK_MAX);
  assert.equal(result.timing.ack.count, 1);
  assert.ok(result.timing.ack.unacknowledgedMs > 0);
  const {finished, ...stages} = result.timing.tail;
  assert.deepEqual(Object.values(stages), [null, null, null, null, null]);
  assert.equal(finished.atMs, result.timing.tcpMs);
  assert.equal(f.state().usbClosed, 1);
});

test('opt-in tail timing distinguishes source check, END write, and validated RESULT', async t => {
  for (const outcome of ['saved', 'source-replaced', 'missing-result']) {
    await t.test(outcome, async sub => {
      const f = await setup(sub, 'saved', 1000, true);
      const done = f.caller.run(wifi());
      const peer = openMediaLoopbackIO(await f.arrived.promise);
      sub.after(() => peer.close());
      const device = deviceInit({...identity, syntheticKey: f.secret}, 'repair', 'ab'.repeat(32));
      await peer.write(device.init);
      const {send, receive, begin} = await authenticatePeer(f, peer, device, AbortSignal.timeout(5000));
      for (let offset = 0; offset < begin.bytes;) {
        const block = (await receive()).fields;
        assert.equal(block.kind, 'data');
        offset += block.data.length;
        if (outcome === 'source-replaced' && offset === begin.bytes) {
          await writeFile(join(f.options.directory, 'replacement.pet'), fixture.bytes(1), {mode: 0o600});
          await rename(join(f.options.directory, '1.pet'), join(f.options.directory, 'original.pet'));
          await rename(join(f.options.directory, 'replacement.pet'), join(f.options.directory, '1.pet'));
        }
        await send({kind: 'ack', job: begin.job, bytes: offset});
      }
      if (outcome !== 'source-replaced') {
        assert.deepEqual((await receive()).fields, {kind: 'end', job: begin.job, bytes: begin.bytes});
      }
      if (outcome === 'saved') {
        await send({kind: 'result', job: begin.job, status: 'saved', root: '3', generation: '5', sha256: begin.sha256});
      }
      const result = await done;
      const {lastAck, sourceVerified, endAttempted, endWritten, resultValidated, finished} = result.timing.tail;
      assert.equal(result.confirmed, begin.bytes);
      assert.equal(result.timing.ack.unacknowledgedMs, null);
      assert.equal(finished.atMs, result.timing.tcpMs);
      assert.equal(result.status, outcome === 'saved' ? 'saved' : 'unknown');
      const stages = [lastAck];
      if (outcome === 'source-replaced') {
        assert.equal(result.reason, 'media_source_changed');
        assert.deepEqual([sourceVerified, endAttempted, endWritten, resultValidated], [null, null, null, null]);
      } else {
        stages.push(sourceVerified, endAttempted, endWritten);
        if (outcome === 'saved') stages.push(resultValidated);
        else {
          assert.equal(result.reason, 'media_deadline');
          assert.equal(resultValidated, null);
        }
      }
      stages.push(finished);
      for (const [index, stage] of stages.entries()) {
        assert.ok(Number.isFinite(stage.atMs) && Number.isFinite(stage.remainingMs));
        assert.ok(stage.atMs >= (stages[index - 1]?.atMs ?? 0));
        assert.ok(Math.abs(stage.atMs + stage.remainingMs - (lastAck.atMs + lastAck.remainingMs)) < 0.01);
      }
    });
  }
});

test('bad, lost and non-private connections never send GRANT or repeat ARM', async t => {
  for (const [mode, error] of [['reject', /media_lan_arm_rejected/], ['lost', /media_lan_arm_unconfirmed/],
    ['wrong-peer', /media_lan_endpoint/]]) {
    const f = await setup(t, mode);
    const failed = assert.rejects(f.caller.run(wifi()), error);
    await f.armStarted.promise;
    if (mode !== 'lost') await f.arrived.promise;
    f.releaseArm.resolve();
    await failed;
    assert.deepEqual(f.state(), {armCalls: 1, usbClosed: 1, grantCalls: 0, packetCleared: true, listening: false});
  }
});

test('dedicated caller rejects default, wildcard/loopback, other action and an unverified binding', async t => {
  const {options, makeServer} = await setup(t);
  for (const [change, reason] of [[{enabled: false}, /media_lan_disabled/], [{address: '0.0.0.0'}, /media_lan_endpoint/],
    [{address: '127.0.0.1'}, /media_lan_endpoint/], [{port: 0}, /media_lan_endpoint/],
    [{pairing: {...options.pairing}}, /media_lan_scope/], [{decision: {...options.decision, action: 11}}, /media_usage_required/]]) {
    assert.throws(() => createNative400LanMaintenance({...options, ...change}, makeServer), reason);
  }
});
