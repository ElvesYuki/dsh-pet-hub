import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {encodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {decodeBootReply, encodeBootRequest} from '../packages/runtime/device-enrollment-wire.mjs';
import {compileBootPeer, hasCryptoPeer} from './fixtures/device-enrollment-cpp.mjs';

const old = JSON.parse(readFileSync(new URL('../docs/protocol/vectors/native400-pbp1-persistent-wire-draft-v1.json', import.meta.url)));
const encode = (kind, body) => Buffer.from(encodePbp1Frame({kind, body}, {allowBinding: true}));
const line = (bytes, prefix = '@VP8_PAIR1 ') => prefix + bytes.toString('base64') + '\n';
const withOldFrame = id => Buffer.from(old.accept.find(sample => sample.id === id).frame_hex, 'hex');

test('VP8 BOOT rejects unavailable capability, wrong direction, and noncanonical frames', () => {
  const probe = withOldFrame('read-capabilities-and-binding');
  assert.equal(encodeBootRequest(probe), line(probe, 'VP8PAIR1 '));
  const status = withOldFrame('unbound-new');
  const legacy = decodeBootReply(line(status));
  assert.equal(legacy.supported, false);
  const challenge = encode('binding-challenge', Buffer.from([1]));
  assert.throws(() => encodeBootRequest(challenge, legacy), {code: 'device_boot_probe_required'});
  assert.throws(() => encodeBootRequest(challenge, {supported: true}), {code: 'device_boot_probe_required'});
  assert.throws(() => decodeBootReply('@VP8_OTA STATUS busy=0 selected=0 slot=ota_0 version=0.1.4\n'));
  assert.throws(() => encodeBootRequest(status));
  assert.throws(() => encodeBootRequest(encode('binding-challenge', Buffer.from([2]))));
  assert.throws(() => encodeBootRequest(encode('binding-enroll', Buffer.alloc(173))));
  assert.throws(() => decodeBootReply(line(probe)));
  assert.throws(() => decodeBootReply(line(Buffer.concat([status, Buffer.from([0])]))));
  const corrupt = Buffer.from(status);
  corrupt[12] ^= 1;
  assert.throws(() => decodeBootReply(line(corrupt)));
  assert.throws(() => decodeBootReply(line(status).replace(/=+\n$/, '\n')));
  assert.throws(() => decodeBootReply(line(status).trimEnd()));
  assert.equal(decodeBootReply(line(status).replace('\n', '\r\n')).state.phase, 0);
});

test('USB enrollment agrees with the firmware line parser and PBP1 C++ proof', {skip: !hasCryptoPeer, timeout: 30000}, t => {
  const work = mkdtempSync(join(tmpdir(), 'hub-vp8-boot-wire-'));
  t.after(() => rmSync(work, {recursive: true, force: true}));
  const binary = compileBootPeer(work, 'tests/fixtures/device-enrollment-peer.cpp', 'peer');

  const probe = encode('binding-info', Buffer.alloc(0));
  const enroll = withOldFrame('enroll-proof');
  const challenge = encode('binding-challenge', Buffer.from([1]));
  const boot = '9007199254740999', epoch = '9007199254740993';
  const status = Buffer.alloc(84), waiting = Buffer.alloc(88), publicKey = Buffer.alloc(65, 0x44);
  status.writeBigUInt64LE(BigInt(boot), 4);
  status.fill(0x11, 12, 28);
  status[2] = 7;
  const capability = decodeBootReply(line(encode('binding-status', status)), {boot});
  const infoLine = encodeBootRequest(probe), challengeLine = encodeBootRequest(challenge, capability);
  const enrollLine = encodeBootRequest(enroll, capability);
  const badCrc = Buffer.from(enroll);
  badCrc[12] ^= 1;
  const request = bytes => line(bytes, 'VP8PAIR1 ');
  const rows = [
    [infoLine + challengeLine + enrollLine, '6 7 8'],
    [infoLine.slice(0, -1), ''],
    [request(enroll.subarray(0, -1)) + infoLine, '6'],
    [request(badCrc), ''],
    [request(Buffer.concat([probe, challenge])), ''],
    [request(Buffer.concat([Buffer.from([0]), probe])), ''],
    [request(withOldFrame('unbound-new')), ''],
    [request(encode('binding-challenge', Buffer.from([2]))), ''],
    [request(encode('binding-enroll', Buffer.alloc(173))), ''],
    [infoLine.replace('=', '') + 'STATUS2\n', 'status2'],
    ['VP8PAIR1 invalid\rSTATUS2\n', ''],
    ['VP8PAIR1 ' + 'X'.repeat(400) + 'STATUS2\n' + infoLine, '6'],
    ['STATUS2\n' + infoLine, 'status2 6'],
  ];
  const input = rows.map(([wire]) => Buffer.from(wire).toString('hex')).join('\n') + '\n';
  const output = execFileSync(binary, [], {input, encoding: 'utf8', timeout: 5000}).split('\n');
  assert.deepEqual(output.slice(5, -1).map(value => value.trim()), rows.map(([, expected]) => expected));

  status[2] = 3;
  assert.equal(output[0] + '\n', line(encode('binding-status', status)));
  status[2] = 7;
  assert.equal(output[1] + '\n', line(encode('binding-status', status)));
  status.copy(waiting);
  waiting[1] = 1;
  waiting.writeUInt32LE(42, 84);
  assert.equal(output[2] + '\n', line(encode('binding-enrolled', waiting)));
  status[1] = 2;
  status.writeBigUInt64LE(BigInt(epoch), 28);
  status.fill(0x22, 36, 52);
  status.fill(0x33, 52, 68);
  publicKey[0] = 4;
  createHash('sha256').update(publicKey).digest().copy(status, 68, 0, 16);
  assert.equal(output[3] + '\n', line(encode('binding-status', status)));
  const nonce = Buffer.alloc(40, 0x55);
  nonce.fill(0, 0, 4);
  nonce[1] = 1;
  nonce.writeUInt32LE(42, 4);
  assert.equal(output[4] + '\n', line(encode('binding-nonce', nonce)));
  assert.equal(decodeBootReply(output[1] + '\n').supported, true);
  assert.throws(() => decodeBootReply(output[2] + '\n', {boot, reference: 41}), {code: 'device_boot_scope'});
  assert.throws(() => decodeBootReply(output[2] + '\n', {boot: '1', reference: 42}), {code: 'device_boot_scope'});
  assert.equal(decodeBootReply(output[2] + '\n', {boot, reference: 42}).state.phase, 1);
  assert.equal(decodeBootReply(output[3] + '\n', {boot}).state.epoch, epoch);
  assert.throws(() => encodeBootRequest(enroll, decodeBootReply(output[3] + '\n')),
    {code: 'device_boot_probe_required'});
  assert.equal(decodeBootReply(output[4] + '\n').reference, 42);
});
