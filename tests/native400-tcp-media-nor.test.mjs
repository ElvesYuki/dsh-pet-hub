import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {on, once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {isAbsolute, join} from 'node:path';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {encodeMediaFrame} from '../packages/core/native400-tcp-media-wire.mjs';
import {prepareNative400MediaTransfer} from '../packages/runtime/native400-tcp-media.mjs';
import {openMediaLoopback} from '../packages/runtime/native400-tcp-media-socket.mjs';
import {native400BootstrapFixture} from '../packages/simulator/native400-bootstrap-fixture.mjs';
import {native400IdentityFixture} from '../packages/simulator/native400-identity-fixture.mjs';

const exec = promisify(execFile);
const firmwareRoot = process.env.ROUND_PET_MEDIA_ROOT;
const boot = '9007199254740999';
const deadlineMs = 20000;

async function build(root, source) {
  assert.ok(isAbsolute(firmwareRoot), 'ROUND_PET_MEDIA_ROOT must be an absolute firmware repository path');
  const app = join(firmwareRoot, 'apps/round-pet');
  const device = join(app, 'devices/esp32s3-touch-amoled-175c');
  const common = join(app, 'common');
  const binary = join(root, 'media-nor');
  const object = join(root, 'lz4.o');
  const flags = ['-O1', '-g', '-fsanitize=address,undefined'];
  const samples = [0, 4, 1, 11].map(action => {
    const {id, frames, bytes, sha256} = source.source.actions[action];
    const digest = sha256.match(/../g).map(byte => `0x${byte}`).join(', ');
    return `  {${id}, ${frames}, ${bytes}, {${digest}}},`;
  });
  await writeFile(join(root, 'native400_samples.h'), `#pragma once
#include <cstdint>
namespace pet400 {
struct Sample { unsigned id, frames, bytes; uint8_t sha[32]; };
inline constexpr bool fixture_allowed = false;
inline constexpr Sample samples[] = {
${samples.join('\n')}
};
inline const Sample *sample(unsigned id) {
  for (const auto &value : samples) if (value.id == id) return &value;
  return nullptr;
}
}
`);
  await exec('cc', [...flags, '-c', join(common, 'vendor/lz4/lz4.c'), '-o', object], {cwd: root, timeout: deadlineMs});
  const includes = [root, join(device, 'main'), join(device, 'tests/native400'), common,
    join(common, 'protocol_types'), join(common, 'playback_logic')];
  const cpp = fileURLToPath(new URL('../native/native400-tcp-media-nor.cpp', import.meta.url));
  await exec('c++', ['-std=c++17', ...flags, '-Wall', '-Wextra', '-Werror',
    ...includes.flatMap(path => ['-I', path]), cpp, object, '-o', binary], {cwd: root, timeout: deadlineMs});
  return binary;
}

async function runCase(t, binary, image, source, action, mode) {
  const asset = source.source.actions[action];
  const job = prepareNative400MediaTransfer({directory: image.root, sourceBytes: source.sourceBytes,
    indexBytes: source.indexBytes, timeoutMs: 12000,
    decision: {profile: 'native400-media-maintenance/1', purpose: 'offline-loopback-repair', approval_id: 'original-nor-test',
      license_ref: 'original-test-MIT', source_manifest_sha256: source.candidate.identity.source_manifest_sha256,
      source_index_sha256: source.candidate.identity.source_index_sha256, namespace: NATIVE400_BOOT_NAMESPACE,
      action, boot, root: '2', generation: action === 1 ? '3' : '4'}});
  const server = createServer();
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.setNoDelay();
  });
  const signal = AbortSignal.timeout(deadlineMs);
  const connections = on(server, 'connection', {signal});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening', {signal});
  const child = spawn(binary, [String(server.address().port), image.file, String(action), mode],
    {cwd: image.root, stdio: ['ignore', 'pipe', 'pipe']});
  const childExit = new Promise(resolve => {
    child.on('error', error => resolve({error}));
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  const reader = createInterface({input: child.stdout});
  const lines = on(reader, 'line', {signal});
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    await job.close();
    for (const socket of sockets) socket.destroy();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await childExit;
    reader.close();
    await lines.return();
    await connections.return();
    await new Promise(resolve => server.close(resolve));
  });
  const accept = async () => (await connections.next()).value[0];
  const socket = await accept();
  const transfer = job.start(socket);
  if (['cancel', 'late', 'extra'].includes(mode)) {
    assert.deepEqual((await lines.next()).value, [mode === 'late' ? 'after-marker' : 'before-marker']);
    assert.equal(job.snapshot().confirmed, asset.bytes);
    assert.equal(job.snapshot().saved, null);
    if (mode === 'extra') {
      const packet = encodeMediaFrame({kind: 'data', job: job.snapshot().job, offset: asset.bytes, data: Uint8Array.of(9)});
      await new Promise((resolve, reject) => socket.write(packet, error => error ? reject(error) : resolve()));
    } else assert.ok(job.cancel());
  }
  let result = await transfer;
  if (mode === 'lost') {
    assert.equal(result.status, 'unknown');
    assert.equal(result.saved, null);
    const wrongJob = result.job.slice(0, -2) + (Number.parseInt(result.job.slice(-2), 16) ^ 1).toString(16).padStart(2, '0');
    const query = openMediaLoopback(await accept());
    try {
      const hello = await query.receive(signal);
      assert.equal(hello.boot, boot);
      assert.equal(hello.root, '3');
      await query.send({kind: 'query', job: wrongJob});
      assert.equal((await query.receive(signal)).status, 'unknown');
    } finally {
      await query.close();
    }
    result = await job.query(await accept());
  }
  assert.equal(result.status, mode === 'cancel' ? 'cancelled' : mode === 'extra' ? 'failed' : 'saved', result.reason);
  assert.equal(result.sent, asset.bytes);
  assert.equal(result.confirmed, asset.bytes);
  assert.deepEqual(result.saved, mode === 'cancel' || mode === 'extra' ? null :
    {root: '3', generation: '5', sha256: asset.sha256});
  assert.deepEqual((await lines.next()).value, ['nor-verified']);
  assert.deepEqual(await childExit, {code: 0, signal: null}, stderr);
  assert.equal(job.resources().openFiles, 0);
  assert.equal(job.resources().connection, false);
}

test('PTM1 Node sender and firmware C++ saver over isolated TCP/NOR',
  {skip: !firmwareRoot && 'set ROUND_PET_MEDIA_ROOT to opt into external read-only C++ interop', timeout: 90000}, async t => {
    const source = native400IdentityFixture();
    const image = native400BootstrapFixture();
    t.after(() => image.close());
    const binary = await build(image.root, source);
    for (const action of [1, 11]) {
      await writeFile(join(image.root, `${action}.pet`), source.bytes(action), {mode: 0o600});
      for (const mode of action === 1 ? ['save', 'cancel', 'late', 'extra', 'lost'] : ['save']) {
        await t.test(`action ${action}, ${mode}`, {timeout: 25000}, sub => runCase(sub, binary, image, source, action, mode));
      }
    }
  });
