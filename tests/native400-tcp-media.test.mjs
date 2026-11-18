import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer, connect} from 'node:net';
import {mkdtemp, realpath, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {encodeMediaFrame, decodeMediaFrame, MEDIA_BLOCK_MAX} from '../packages/core/native400-tcp-media-wire.mjs';
import {Pet4Decoder} from '../packages/core/pet4.mjs';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {native400IdentityFixture} from '../packages/simulator/native400-identity-fixture.mjs';
import {prepareNative400MediaTransfer} from '../packages/runtime/native400-tcp-media.mjs';
import {openMediaLoopback} from '../packages/runtime/native400-tcp-media-socket.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';

const directoryState = {kind: 'hello', boot: '7', root: '10', generation1: '8', generation11: '9'};
const fixture = native400IdentityFixture();

async function setup(t, action = 1, timeoutMs = 10000) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'pet-media-')));
  const file = join(directory, `${action}.pet`);
  await writeFile(file, fixture.bytes(action), {mode: 0o600});
  const input = {directory, sourceBytes: fixture.sourceBytes, indexBytes: fixture.indexBytes, timeoutMs,
    decision: {profile: 'native400-media-maintenance/1', purpose: 'offline-loopback-repair',
      approval_id: 'fixture-repair', license_ref: 'original-test-MIT', namespace: NATIVE400_BOOT_NAMESPACE,
      source_manifest_sha256: fixture.candidate.identity.source_manifest_sha256,
      source_index_sha256: fixture.candidate.identity.source_index_sha256,
      action, boot: directoryState.boot, root: directoryState.root, generation: directoryState[`generation${action}`]}};
  const job = prepareNative400MediaTransfer(input);
  t.after(async () => {
    await job.close();
    await rm(directory, {recursive: true, force: true});
  });
  return {job, file, input};
}

async function pair(t) {
  const server = createServer({highWaterMark: 128});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const accepted = once(server, 'connection');
  const client = connect(server.address().port, '127.0.0.1');
  const [[socket]] = await Promise.all([accepted, once(client, 'connect')]);
  const device = openMediaLoopback(client);
  t.after(async () => {
    socket.destroy();
    await device.close();
    await new Promise(resolve => server.close(resolve));
  });
  return {socket, client, device};
}

async function start(t, f, hello = directoryState) {
  const p = await pair(t);
  const done = f.job.start(p.socket);
  await p.device.send(hello);
  return {...p, done};
}

async function begin(p) {
  const frame = await p.device.receive();
  assert.equal(frame.kind, 'begin');
  await p.device.send({kind: 'ready', job: frame.job});
  return frame;
}

async function receiveFile(p, metadata) {
  const bytes = Buffer.alloc(metadata.bytes);
  let offset = 0;
  while (offset < bytes.length) {
    const frame = await p.device.receive();
    assert.equal(frame.kind, 'data');
    assert.equal(frame.job, metadata.job);
    assert.equal(frame.offset, offset);
    assert.equal(frame.data.length, Math.min(MEDIA_BLOCK_MAX, bytes.length - offset));
    frame.data.copy(bytes, offset);
    offset += frame.data.length;
    await p.device.send({kind: 'ack', job: metadata.job, bytes: offset});
  }
  assert.deepEqual(await p.device.receive(), {kind: 'end', job: metadata.job, bytes: offset});
  assert.equal(sha256(bytes), metadata.sha256);
  const decoder = new Pet4Decoder(bytes, {profile: 'native400-candidate-v1'});
  assert.equal(decoder.frames, metadata.frames);
  for (let i = 0; i < decoder.frames; i++) decoder.decodeInto(i);
}

function saved(metadata, extra = {}) {
  return {kind: 'result', job: metadata.job, status: 'saved', root: '11', generation: '12',
    sha256: metadata.sha256, ...extra};
}

for (const action of [1, 11]) test(`PTM1 action ${action} validates every original PET4 frame before simulated Saved`, async t => {
  const f = await setup(t, action);
  const p = await pair(t);
  const done = f.job.start(p.socket);
  const hello = encodeMediaFrame(directoryState);
  // Split both the header and the payload across writes.
  for (const chunk of [hello.subarray(0, 3), hello.subarray(3, 19), hello.subarray(19)]) {
    await new Promise(resolve => p.client.write(chunk, resolve));
    await delay(2);
  }
  const metadata = await begin(p);
  assert.equal(metadata.action, action);
  assert.equal(metadata.namespace, NATIVE400_BOOT_NAMESPACE);
  assert.equal(metadata.frames, 241);
  await receiveFile(p, metadata);
  assert.equal(f.job.snapshot().status, 'awaiting_result');
  assert.equal(f.job.snapshot().saved, null);
  await p.device.send(saved(metadata));
  const result = await done;
  assert.equal(result.status, 'saved');
  assert.equal(result.sent, metadata.bytes);
  assert.equal(result.confirmed, metadata.bytes);
  assert.equal(result.saved.root, '11');
  assert.deepEqual(f.job.resources(), {connection: false, openFiles: 0, blockBytes: MEDIA_BLOCK_MAX});
});

test('PTM1 slow peer permits one block, cancels with in-flight ACK, and preserves counts', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await begin(p);
  const first = await p.device.receive();
  assert.ok(first.data.length > p.socket.writableHighWaterMark);
  await delay(30);
  assert.equal(f.job.snapshot().sent, MEDIA_BLOCK_MAX);
  assert.equal(f.job.snapshot().confirmed, 0);
  assert.equal(p.client.readableLength, 0);
  assert.equal(f.job.cancel(), true);
  assert.deepEqual(await p.device.receive(), {kind: 'cancel', job: metadata.job});
  const ack = encodeMediaFrame({kind: 'ack', job: metadata.job, bytes: MEDIA_BLOCK_MAX});
  const cancelled = encodeMediaFrame({kind: 'result', job: metadata.job, status: 'cancelled'});
  p.client.write(Buffer.concat([ack, cancelled]));
  const result = await p.done;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.confirmed, MEDIA_BLOCK_MAX);
  assert.equal(result.saved, null);
});

test('PTM1 cancellation after END preserves the device Saved result', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await begin(p);
  await receiveFile(p, metadata);
  assert.ok(f.job.cancel());
  assert.deepEqual(await p.device.receive(), {kind: 'cancel', job: metadata.job});
  await p.device.send(saved(metadata));
  assert.equal((await p.done).status, 'saved');
});

test('PTM1 disconnect after END requires explicit same boot query and never repeats BEGIN', async t => {
  const f = await setup(t);
  const first = await start(t, f);
  const metadata = await begin(first);
  await receiveFile(first, metadata);
  await first.device.close();
  assert.equal((await first.done).status, 'unknown');
  assert.throws(() => f.job.start(first.socket), /media_already_started/);
  const wrong = await pair(t);
  const rejected = f.job.query(wrong.socket);
  await wrong.device.send({...directoryState, boot: '8'});
  assert.equal((await rejected).reason, 'media_query_boot');
  const next = await pair(t);
  const query = f.job.query(next.socket);
  await next.device.send({...directoryState, root: '11', generation1: '12'});
  assert.deepEqual(await next.device.receive(), {kind: 'query', job: metadata.job});
  await next.device.send(saved(metadata));
  assert.equal((await query).status, 'saved');
});

test('PTM1 ignores directory advancement as a save receipt and accepts explicit Unknown', async t => {
  const f = await setup(t);
  const first = await start(t, f);
  const metadata = await begin(first);
  await first.device.close();
  assert.equal((await first.done).status, 'unknown');
  const next = await pair(t);
  const query = f.job.query(next.socket);
  await next.device.send({...directoryState, root: '11', generation1: '12'});
  assert.deepEqual(await next.device.receive(), {kind: 'query', job: metadata.job});
  await next.device.send({kind: 'result', job: metadata.job, status: 'unknown'});
  const result = await query;
  assert.equal(result.status, 'unknown');
  assert.equal(result.saved, null);
});

test('PTM1 changed directory rejects before BEGIN', async t => {
  const f = await setup(t);
  const p = await start(t, f, {...directoryState, generation1: '77'});
  const result = await p.done;
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'media_directory_changed');
  assert.equal(result.sent, 0);
});

test('PTM1 wrong cumulative ACK closes without a second chunk or END', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await begin(p);
  await p.device.receive();
  await p.device.send({kind: 'ack', job: metadata.job, bytes: MEDIA_BLOCK_MAX - 1});
  const result = await p.done;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'media_ack_offset');
  assert.equal(result.sent, MEDIA_BLOCK_MAX);
  assert.equal(result.confirmed, 0);
});

test('PTM1 early Saved is rejected', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await p.device.receive();
  await p.device.send(saved(metadata));
  const result = await p.done;
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'media_saved_identity');
});

test('PTM1 source SHA mismatch fails before sending', async t => {
  const f = await setup(t);
  const changed = fixture.bytes(1);
  changed[0] ^= 1;
  await writeFile(f.file, changed);
  const p = await start(t, f);
  const result = await p.done;
  assert.equal(result.reason, 'media_source_hash');
  assert.equal(result.status, 'failed');
  assert.equal(result.sent, 0);
});

test('PTM1 source replaced during send cannot reach END', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await p.device.receive();
  await writeFile(f.file, fixture.bytes(1));
  await p.device.send({kind: 'ready', job: metadata.job});
  let offset = 0;
  while (offset < metadata.bytes) {
    const frame = await p.device.receive();
    assert.equal(frame.kind, 'data');
    offset += frame.data.length;
    await p.device.send({kind: 'ack', job: metadata.job, bytes: offset});
  }
  const result = await p.done;
  assert.equal(result.reason, 'media_source_changed');
  assert.equal(result.status, 'unknown');
});

test('PTM1 CRC and truncated peer input fail with no source reads or send', async t => {
  for (const corrupt of [true, false]) {
    const f = await setup(t);
    const p = await pair(t);
    const done = f.job.start(p.socket);
    const packet = encodeMediaFrame(directoryState);
    if (corrupt) {
      packet[20] ^= 1;
      p.client.write(packet);
    } else {
      p.client.end(packet.subarray(0, 27));
    }
    const result = await done;
    assert.equal(result.status, 'failed');
    assert.match(result.reason, /media_(invalid_frame|truncated)/);
    assert.equal(result.sent, 0);
  }
});

test('PTM1 absolute deadline closes a peer stalled before HELLO', async t => {
  const f = await setup(t, 1, 40);
  const p = await pair(t);
  const result = await f.job.start(p.socket);
  assert.equal(result.reason, 'media_deadline');
  assert.equal(f.job.resources().connection, false);
});

test('PTM1 source-only approval, protected actions and over-budget frames are rejected', async t => {
  const {input} = await setup(t);
  assert.throws(() => prepareNative400MediaTransfer({...input, decision: fixture.approval}), /media_usage_required/);
  assert.throws(() => prepareNative400MediaTransfer({...input, decision: {...input.decision, action: 4}}), /media_usage_required/);
  assert.throws(() => encodeMediaFrame({kind: 'data', job: 'ab'.repeat(16), offset: 0, data: Buffer.alloc(MEDIA_BLOCK_MAX + 1)}), /media_invalid_frame/);
  const frame = encodeMediaFrame(directoryState);
  assert.deepEqual(decodeMediaFrame(frame.subarray(0, 16), frame.subarray(16)), directoryState);
});

test('PTM1 one active job per boot and close waits for socket and fd release', async t => {
  const first = await setup(t);
  const second = await setup(t, 11);
  const p = await start(t, first);
  await begin(p);
  await p.device.receive();
  const other = await pair(t);
  assert.throws(() => second.job.start(other.socket), /media_busy/);
  await first.job.close();
  assert.equal((await p.done).status, 'unknown');
  assert.equal(first.job.resources().openFiles, 0);
  assert.equal(p.socket.destroyed, true);
  assert.equal(first.job.resources().connection, false);
});

test('PTM1 Saved with skipped root sequence is not accepted', async t => {
  const f = await setup(t);
  const p = await start(t, f);
  const metadata = await begin(p);
  await receiveFile(p, metadata);
  await p.device.send(saved(metadata, {root: '12'}));
  assert.equal((await p.done).reason, 'media_saved_identity');
  assert.equal(f.job.snapshot().saved, null);
});

test('PTM1 Saved generation must advance beyond both reported live objects', async t => {
  const f = await setup(t);
  const p = await pair(t);
  const done = f.job.start(p.socket);
  await p.device.send({...directoryState, generation11: '19'});
  const metadata = await begin(p);
  await receiveFile(p, metadata);
  await p.device.send(saved(metadata));
  assert.equal((await done).status, 'unknown');
  assert.equal(f.job.snapshot().saved, null);
});

test('PTM1 published byte vectors roundtrip and reject malformed records', async () => {
  const {readFile} = await import('node:fs/promises');
  const vectors = JSON.parse(await readFile(new URL('../docs/protocol/vectors/native400-tcp-media-draft-v1.json', import.meta.url)));
  for (const vector of vectors.valid) {
    const frame = Buffer.from(vector.hex, 'hex');
    const parsed = decodeMediaFrame(frame.subarray(0, 16), frame.subarray(16));
    assert.equal(parsed.kind, vector.kind);
    assert.equal(Buffer.from(encodeMediaFrame(parsed)).toString('hex'), vector.hex);
  }
  for (const vector of vectors.invalid) {
    const frame = Buffer.from(vector.hex, 'hex');
    assert.throws(() => decodeMediaFrame(frame.subarray(0, 16), frame.subarray(16)), /media_invalid_frame/, vector.name);
  }
});
