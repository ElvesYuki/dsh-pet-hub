import assert from 'node:assert/strict';
import {createSecretKey} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, realpath, rm, writeFile} from 'node:fs/promises';
import {connect, createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {encodeMediaFrame, MEDIA_BLOCK_MAX} from '../packages/core/native400-tcp-media-wire.mjs';
import {createNative400UsbPairing, prepareNative400AuthenticatedMediaTransfer} from '../packages/runtime/index.mjs';
import {openMediaLoopbackIO} from '../packages/runtime/native400-tcp-media-socket.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {native400IdentityFixture} from '../packages/simulator/native400-identity-fixture.mjs';
import {deviceInit} from './fixtures/native400-media-auth.mjs';
import {mockPbp1Usb} from './fixtures/native400-pbp1.mjs';

const fixture = native400IdentityFixture();
const pair = {device: '17'.repeat(16), hub: '25'.repeat(16), binding: '36'.repeat(16), epoch: '9007199254740993'};
const syntheticKey = 'ac'.repeat(32);
const hello = {kind: 'hello', boot: '9007199254740999', root: '2', generation1: '3', generation11: '4'};
const encode = frame => Buffer.from(encodeMediaFrame(frame));

async function setup(t, changes = {}) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'pet-media-auth-')));
  const file = join(directory, '1.pet');
  await writeFile(file, fixture.bytes(1), {mode: 0o600});
  const requests = [], acquisitions = [];
  const revocation = new AbortController();
  const options = {enabled: true, directory, sourceBytes: fixture.sourceBytes, indexBytes: fixture.indexBytes, timeoutMs: 10000,
    decision: {profile: 'native400-media-maintenance/1', purpose: 'offline-loopback-repair', approval_id: 'original-pma-source',
      license_ref: 'original-test-MIT', source_manifest_sha256: fixture.candidate.identity.source_manifest_sha256,
      source_index_sha256: fixture.candidate.identity.source_index_sha256, namespace: NATIVE400_BOOT_NAMESPACE,
      action: 1, boot: hello.boot, root: hello.root, generation: hello.generation1},
    pairing: {identity: pair, acquire(identity) {
      acquisitions.push(identity);
      return {key: createSecretKey(Buffer.from(syntheticKey, 'hex')), revoked: revocation.signal};
    }},
    authorize(request) {
      requests.push(request);
      return {request, id: 'c4'.repeat(16), expiresAt: request.deadline};
    }, ...changes};
  t.after(() => rm(directory, {recursive: true, force: true}));
  const job = prepareNative400AuthenticatedMediaTransfer(options);
  t.after(() => job.close());
  return {job, file, options, requests, acquisitions, revocation};
}

async function connection(t) {
  const server = createServer({highWaterMark: 128});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const accepted = once(server, 'connection');
  const socket = connect(server.address().port, '127.0.0.1');
  const [[host]] = await Promise.all([accepted, once(socket, 'connect')]);
  socket.setNoDelay(true);
  host.setNoDelay(true);
  const raw = openMediaLoopbackIO(socket);
  const signal = AbortSignal.timeout(12000);
  t.after(async () => {
    host.destroy();
    await raw.close();
    await new Promise(resolve => server.close(resolve));
  });
  return {host, raw, signal, async authenticate(mode = 'repair', options = {}) {
    const {identity = pair, nonce = '48'.repeat(32), directory = hello, badProof = false, secret = syntheticKey} = options;
    const device = deviceInit({...identity, syntheticKey: secret}, mode, nonce);
    // Split the first prefix and coalesce FINISH with the first protected record.
    await raw.write(device.init.subarray(0, 7));
    await raw.write(device.init.subarray(7));
    const challenge = await raw.read(80, signal);
    const auth = device.finish(challenge);
    if (badProof) auth.finish[auth.finish.length - 1] ^= 1;
    await raw.write(Buffer.concat([auth.finish, auth.endpoint.seal('ptm', encode(directory))]));
    return {
      challenge,
      async read() {
        const prefix = await raw.read(16, signal);
        const body = await raw.read(prefix.readUInt32LE(12) + 32, signal);
        return auth.endpoint.open(Buffer.concat([prefix, body]));
      },
      seal: frame => auth.endpoint.seal('ptm', encode(frame)),
      send: frame => raw.write(auth.endpoint.seal('ptm', encode(frame)))
    };
  }};
}

async function beginTransfer(peer) {
  const grant = await peer.read();
  const begin = await peer.read();
  assert.equal(grant.kind, 'grant');
  assert.equal(begin.fields.kind, 'begin');
  assert.equal(grant.fields.beginSha.toString('hex'), sha256(begin.body));
  assert.equal(grant.fields.manifestSha, fixture.candidate.identity.source_manifest_sha256);
  assert.equal(grant.fields.indexSha, fixture.candidate.identity.source_index_sha256);
  assert.ok(grant.fields.workMs > 0 && grant.fields.workMs <= 10000);
  await peer.send({kind: 'ready', job: begin.fields.job});
  return begin.fields;
}

async function receiveFile(peer, {job, bytes, sha256: digest}) {
  const file = Buffer.alloc(bytes);
  let offset = 0;
  while (offset < bytes) {
    const {fields: frame} = await peer.read();
    assert.equal(frame.kind, 'data');
    assert.equal(frame.job, job);
    assert.equal(frame.offset, offset);
    assert.equal(frame.data.length, Math.min(bytes - offset, MEDIA_BLOCK_MAX));
    frame.data.copy(file, offset);
    offset += frame.data.length;
    await peer.send({kind: 'ack', job, bytes: offset});
  }
  assert.deepEqual((await peer.read()).fields, {kind: 'end', job, bytes});
  assert.equal(sha256(file), digest);
  assert.deepEqual(file, fixture.bytes(1));
}

const saved = begin => ({kind: 'result', job: begin.job, status: 'saved', root: '3', generation: '5', sha256: begin.sha256});

test('authenticated sender pins the allocated job before one GRANT and verifies complete protected transfer', async t => {
  const f = await setup(t);
  assert.throws(() => prepareNative400AuthenticatedMediaTransfer({...f.options, enabled: false}), /media_auth_disabled/);
  const allocated = f.job.snapshot().job;
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  const begin = await beginTransfer(device);
  assert.equal(f.requests.length, 1);
  assert.equal(begin.job, allocated);
  assert.deepEqual(f.requests[0].begin, begin);
  assert.equal(f.requests[0].beginSha, sha256(encode(begin)));
  assert.ok(Object.isFrozen(f.requests[0]) && Object.isFrozen(f.requests[0].begin));
  assert.deepEqual(f.acquisitions, [pair]);
  await receiveFile(device, begin);
  assert.equal(f.job.snapshot().saved, null);
  await device.send(saved(begin));
  const result = await done;
  assert.equal(result.status, 'saved');
  assert.equal(result.confirmed, begin.bytes);
  assert.deepEqual(f.job.resources(), {connection: false, openFiles: 0, blockBytes: MEDIA_BLOCK_MAX});
  assert.throws(() => f.job.start(socket.host), /media_already_started/);
});

test('authenticated sender rejects raw PTM1, wrong mode/epoch and bad proof before opening source or authorizing', async t => {
  for (const variant of ['raw', 'mode', 'epoch', 'proof']) {
    const f = await setup(t);
    const socket = await connection(t);
    const done = f.job.start(socket.host);
    if (variant === 'raw') await socket.raw.write(encode(hello));
    if (variant === 'mode' || variant === 'epoch') {
      const init = deviceInit({...pair, syntheticKey, epoch: variant === 'epoch' ? '1' : pair.epoch},
        variant === 'mode' ? 'query' : 'repair', '48'.repeat(32));
      await socket.raw.write(init.init);
    }
    if (variant === 'proof') await socket.authenticate('repair', {badProof: true});
    const result = await done;
    assert.equal(result.status, 'failed');
    assert.match(result.reason, /media_auth_(binding|rejected)/);
    assert.equal(f.acquisitions.length, Number(variant === 'proof'));
    assert.equal(f.requests.length, 0);
    assert.equal(result.sent, 0);
    assert.equal(f.job.resources().openFiles, 0);
  }
});

test('authenticated sender checks source, directory and exact unexpired approval before GRANT', async t => {
  for (const variant of ['source', 'directory', 'decision', 'expiry']) {
    const changes = {};
    if (variant === 'decision') changes.authorize = request => ({request: {...request}, id: 'c4'.repeat(16), expiresAt: request.deadline});
    if (variant === 'expiry') changes.authorize = request => ({request, id: 'c4'.repeat(16), expiresAt: performance.now() - 1});
    const f = await setup(t, changes);
    if (variant === 'source') {
      const file = fixture.bytes(1);
      file[0] ^= 1;
      await writeFile(f.file, file);
    }
    const socket = await connection(t);
    const done = f.job.start(socket.host);
    const peer = await socket.authenticate('repair', {directory: variant === 'directory' ? {...hello, root: '3'} : hello});
    await assert.rejects(peer.read(), /media_disconnected/);
    assert.equal((await done).status, 'failed');
    assert.equal(f.requests.length, 0);
    assert.equal(f.job.resources().openFiles, 0);
  }
});

test('authenticated sender keeps one DATA in flight and drains a partial ACK on targeted cancellation', async t => {
  const f = await setup(t);
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  const {job} = await beginTransfer(device);
  const first = (await device.read()).fields;
  assert.equal(first.data.length, MEDIA_BLOCK_MAX);
  const ack = device.seal({kind: 'ack', job, bytes: first.data.length});
  await socket.raw.write(ack.subarray(0, 19));
  await delay(20);
  assert.equal(f.job.snapshot().sent, MEDIA_BLOCK_MAX);
  assert.equal(f.job.snapshot().confirmed, 0);
  assert.ok(f.job.cancel());
  assert.deepEqual((await device.read()).fields, {kind: 'cancel', job});
  await socket.raw.write(Buffer.concat([ack.subarray(19), device.seal({kind: 'result', job, status: 'cancelled'})]));
  const result = await done;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.confirmed, MEDIA_BLOCK_MAX);
});

test('authenticated sender closes revoked in-flight write and refuses a revoked query lease', async t => {
  const f = await setup(t);
  f.revocation.signal.addEventListener('abort', event => event.stopImmediatePropagation(), {once: true});
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  await beginTransfer(device);
  await device.read();
  f.revocation.abort(new Error('private provider detail'));
  const result = await done;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'media_auth_revoked');
  assert.equal(result.saved, null);
  const next = await connection(t);
  const query = f.job.query(next.host);
  const init = deviceInit({...pair, syntheticKey}, 'query', '48'.repeat(32));
  await next.raw.write(init.init);
  assert.equal((await query).reason, 'media_auth_revoked');
  assert.equal(f.requests.length, 1);
  assert.equal(f.job.resources().connection, false);
  assert.equal(f.job.resources().openFiles, 0);
});

test('authenticated late cancellation preserves a valid Saved after END', async t => {
  const f = await setup(t);
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  const begin = await beginTransfer(device);
  await receiveFile(device, begin);
  assert.ok(f.job.cancel());
  assert.deepEqual((await device.read()).fields, {kind: 'cancel', job: begin.job});
  await device.send(saved(begin));
  assert.equal((await done).status, 'saved');
});

test('authenticated sender retains Unknown after a damaged Saved and only queries original boot and job', async t => {
  const f = await setup(t);
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  const begin = await beginTransfer(device);
  await receiveFile(device, begin);
  const bad = device.seal(saved(begin));
  bad[bad.length - 1] ^= 1;
  await socket.raw.write(bad);
  const unknown = await done;
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.reason, 'media_auth_rejected');
  assert.equal(unknown.saved, null);
  const wrongEpoch = await connection(t);
  const epochResult = f.job.query(wrongEpoch.host);
  await wrongEpoch.raw.write(deviceInit({...pair, syntheticKey, epoch: '1'}, 'query', '48'.repeat(32)).init);
  assert.equal((await epochResult).reason, 'media_auth_binding');
  const stale = await connection(t);
  const staleResult = f.job.query(stale.host);
  const oldDevice = await stale.authenticate('query', {directory: {...hello, boot: '1'}});
  await assert.rejects(oldDevice.read(), /media_disconnected/);
  assert.equal((await staleResult).reason, 'media_query_boot');
  const next = await connection(t);
  const query = f.job.query(next.host);
  const newDevice = await next.authenticate('query', {directory: {...hello, root: '3', generation1: '5'}});
  assert.notDeepEqual(newDevice.challenge, device.challenge);
  assert.deepEqual((await newDevice.read()).fields, {kind: 'query', job: begin.job});
  assert.equal(f.job.snapshot().saved, null);
  await newDevice.send(saved(begin));
  assert.equal((await query).status, 'saved');
  assert.equal(f.requests.length, 1);
  assert.equal(f.acquisitions.length, 3);
});

test('authenticated EOF after END never resumes the upload and an explicit Unknown stays Unknown', async t => {
  const f = await setup(t);
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  const begin = await beginTransfer(device);
  await receiveFile(device, begin);
  await socket.raw.close();
  assert.equal((await done).status, 'unknown');
  const next = await connection(t);
  const query = f.job.query(next.host);
  const peer = await next.authenticate('query', {directory: {...hello, root: '3', generation1: '5'}});
  assert.deepEqual((await peer.read()).fields, {kind: 'query', job: begin.job});
  await peer.send({kind: 'result', job: begin.job, status: 'unknown'});
  const result = await query;
  assert.equal(result.status, 'unknown');
  assert.equal(result.saved, null);
  assert.equal(f.requests.length, 1);
});

test('authenticated sender can close a stalled handshake and respects its work deadline after GRANT', async t => {
  const stalled = await setup(t, {timeoutMs: 35});
  const silent = await connection(t);
  const failure = await stalled.job.start(silent.host);
  assert.equal(failure.status, 'failed');
  assert.equal(failure.reason, 'media_deadline');
  assert.equal(stalled.job.resources().connection, false);
  const f = await setup(t, {authorize: request => ({request, id: 'c4'.repeat(16), expiresAt: performance.now() + 300})});
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const device = await socket.authenticate();
  await beginTransfer(device);
  await device.read();
  const result = await done;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'media_deadline');
  assert.equal(f.job.resources().openFiles, 0);
});

test('a verified simulated USB Active supplies the formal PMA1 sender and is pinned to its boot', async t => {
  const usb = mockPbp1Usb({boot: hello.boot, device: pair.device});
  const owner = createNative400UsbPairing({enabled: true, transport: usb.transport, identity: pair, pollMs: 5,
    confirmFingerprint: () => usb.screen()});
  t.after(() => owner.close());
  const active = owner.start();
  await usb.confirmed;
  assert.ok(usb.longPress());
  const provider = await active;
  const f = await setup(t, {pairing: provider});
  assert.throws(() => prepareNative400AuthenticatedMediaTransfer({...f.options,
    decision: {...f.options.decision, boot: '2'}}), /media_auth_binding/);
  const socket = await connection(t);
  const done = f.job.start(socket.host);
  const peer = await socket.authenticate('repair', {secret: usb.activeSecret()});
  const begin = await beginTransfer(peer);
  await receiveFile(peer, begin);
  await peer.send(saved(begin));
  assert.equal((await done).status, 'saved');
  const lease = provider.acquire(pair);
  await owner.close();
  assert.ok(lease.revoked.aborted);
  assert.throws(() => provider.acquire(pair), /pbp_lease/);
});
