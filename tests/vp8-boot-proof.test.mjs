import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {decodePbp1Frame, encodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {createVp8BootEnrollment} from '../packages/runtime/vp8-boot-enrollment.mjs';
import {createVp8BootProof, decodeVp8BootReply, encodeVp8BootRequest} from '../packages/runtime/vp8-boot-wire.mjs';
import {compileVp8BootPeer} from './fixtures/vp8-boot-cpp.mjs';

const boot = '9007199254740999', reboot = '9007199254741000';
const key = Buffer.alloc(65, 0x44);
key[0] = 4;
const target = {device: '11'.repeat(16), controller: '22'.repeat(16), binding: '33'.repeat(16),
  epoch: '1', keySha256: createHash('sha256').update(key).digest('hex')};
const binding = {allowBinding: true}, proof = {allowVp8BootProof: true};
const frame = (kind, body, options = binding) => Buffer.from(encodePbp1Frame({kind, body}, options));
const replyLine = bytes => '@VP8_PAIR1 ' + bytes.toString('base64') + '\n';

function statusLine(counter, reference = 0) {
  const body = Buffer.alloc(reference ? 88 : 84);
  body[1] = reference ? 1 : 0;
  body[2] = 7;
  body.writeBigUInt64LE(BigInt(counter), 4);
  body.write(target.device, 12, 'hex');
  if (reference) body.writeUInt32LE(reference, 84);
  return replyLine(frame(reference ? 'binding-enrolled' : 'binding-status', body));
}

const proofProbe = counter => decodeVp8BootReply(statusLine(counter), {boot: counter});
const accepted = decodeVp8BootReply(statusLine(boot, 1), {boot, reference: 1});
const attempt = {attempt: 'fixture', boot, target};
const poll = (nonce = 0x77, ticket = attempt) => createVp8BootProof(
  {mode: 'poll', probe: proofProbe(boot), waiting: accepted, attempt: ticket}, {nonce: Buffer.alloc(32, nonce)});
const fence = (counter, nonce = 0x88, ticket = {...attempt, boot: counter}) => createVp8BootProof(
  {mode: 'fence', probe: proofProbe(counter), attempt: ticket}, {nonce: Buffer.alloc(32, nonce)});

function rawRequest(command) {
  return Buffer.from(command.line.slice('VP8PAIR1 '.length).trimEnd(), 'base64');
}

function receipt(command, result, phase, record = target) {
  const req = rawRequest(command).subarray(16);
  const body = Buffer.alloc(136);
  body.set([result, phase, req[0], 0]);
  req.copy(body, 4, 4, 28);
  req.copy(body, 100, 28);
  if (phase === 2) {
    body.writeBigUInt64LE(BigInt(record.epoch), 28);
    body.write(record.controller, 36, 'hex');
    body.write(record.binding, 52, 'hex');
    body.write(record.keySha256, 68, 'hex');
  }
  return body;
}
const proofLine = body => replyLine(frame('vp8-binding-proof-result', body, proof));

test('VP8 proof rejects replay, wrong correlation and partial identity even with a valid CRC', () => {
  const call = poll();
  const bytes = rawRequest(call);
  assert.equal(bytes.length, 80);
  assert.equal(bytes[5], 10);
  assert.throws(() => decodePbp1Frame(bytes, binding));
  const body = receipt(call, 0, 2);
  // Includes the second half of the digest, which the old 129 could not carry.
  for (const offset of [2, 3, 4, 12, 28, 36, 52, 68, 99, 100, 132]) {
    const mutated = Buffer.from(body);
    mutated[offset] ^= 1;
    assert.throws(() => poll().accept(proofLine(mutated)));
  }
  assert.throws(() => call.accept(statusLine(boot, 1)));
  assert.throws(() => call.accept(replyLine(bytes)), {code: 'vp8_boot_proof_reply'});
  assert.throws(() => poll(0x78).accept(proofLine(body)), {code: 'vp8_boot_proof_scope'});
  assert.deepEqual(call.accept(proofLine(body)).evidence, {...attempt, kind: 'verified_bound'});
  assert.throws(() => call.accept(proofLine(body)), {code: 'vp8_boot_proof_consumed'});
  assert.throws(() => poll(0), {code: 'vp8_boot_proof_nonce'});
  assert.throws(() => createVp8BootProof({mode: 'poll', probe: proofProbe(boot), attempt, waiting: {reference: 1}}),
    {code: 'vp8_boot_proof_reference'});
});

test('VP8 proof only yields fenced unbound for successful fresh fence and keeps all other results pending', () => {
  for (const [result, phase] of [[0, 1], [1, 2], [2, 0], [3, 0], [4, 3], [0, 3]]) {
    const call = fence(reboot);
    assert.equal(call.accept(proofLine(receipt(call, result, phase))).evidence, null);
  }
  const read = poll();
  assert.equal(read.accept(proofLine(receipt(read, 0, 0))).evidence, null);
  const clear = fence(reboot);
  assert.deepEqual(clear.accept(proofLine(receipt(clear, 0, 0))).evidence,
    {...attempt, boot: reboot, kind: 'fenced_unbound'});
});

const root = process.env.ROUND_PET_BOOT_PEER_ROOT;
test('Node receives and verifies actual firmware VP8 proof through BOOT, reboot, fence and storage fault',
  {skip: !root, timeout: 30000}, t => {
    const work = mkdtempSync(join(tmpdir(), 'vp8-boot-proof-'));
    t.after(() => rmSync(work, {recursive: true, force: true}));
    const vectors = compileVp8BootPeer(root, work, join(root, 'tools/round-pet/vp8-probe/test_boot_pairing.cpp'), 'vectors');
    const emitted = execFileSync(vectors, ['--vectors'], {encoding: 'utf8', timeout: 5000});
    const vectorFile = process.env.ROUND_PET_BOOT_VECTORS;
    if (vectorFile) assert.equal(emitted, readFileSync(vectorFile, 'utf8'));
    const fixed = new Map(emitted.trimEnd().split('\n')
      .map(row => {
        const split = row.indexOf(' ');
        return [row.slice(0, split), row.slice(split + 1) + '\n'];
      }));
    const vectorKey = Buffer.alloc(65, 0x99);
    vectorKey[0] = 4;
    const vectorTarget = {...target, keySha256: createHash('sha256').update(vectorKey).digest('hex')};
    const vectorTicket = {...attempt, target: vectorTarget};
    const fixedCases = [
      ['waiting', poll(0x66, vectorTicket), 0, 1, undefined],
      ['bound', poll(0x77, vectorTicket), 0, 2, 'verified_bound'],
      ['recovered', fence(reboot, 0x88, {...vectorTicket, boot: reboot}), 0, 2, 'verified_bound'],
      ['unbound', fence(boot, 0xaa, vectorTicket), 0, 0, 'fenced_unbound'],
      ['fault', poll(0xbb, vectorTicket), 4, 3, undefined],
    ];
    assert.equal(fixed.size, fixedCases.length);
    for (const [name, call, result, phase, expected] of fixedCases) {
      const fromFirmware = fixed.get(name);
      assert.equal(fromFirmware, proofLine(receipt(call, result, phase, vectorTarget)), name);
      assert.equal(call.accept(fromFirmware).evidence?.kind, expected, name);
    }

    const binary = compileVp8BootPeer(root, work, 'tests/fixtures/vp8-boot-proof-peer.cpp', 'peer');

    const enrollBody = Buffer.alloc(173), counters = Buffer.alloc(16);
    counters.writeBigUInt64LE(1n, 0);
    counters.writeBigUInt64LE(BigInt(boot), 8);
    enrollBody.writeUInt32LE(1, 0);
    enrollBody.write(target.controller, 4, 'hex');
    enrollBody.write(target.binding, 20, 'hex');
    counters.copy(enrollBody, 36, 0, 8);
    key.copy(enrollBody, 44);
    const transcript = createHash('sha256').update('PBP1/persist/enroll/v1').update(target.device, 'hex')
      .update(target.controller, 'hex').update(target.binding, 'hex')
      .update(counters).update(Buffer.alloc(32, 0x55)).update(key).digest();
    transcript.copy(enrollBody, 109);
    const probe = proofProbe(boot);
    const setup = [encodeVp8BootRequest(frame('binding-info', Buffer.alloc(0))),
      encodeVp8BootRequest(frame('binding-challenge', Buffer.from([1])), probe),
      encodeVp8BootRequest(frame('binding-enroll', enrollBody), probe)];
    // Fixture-owned monotonic samples for a debounced press after a drawn prompt.
    const ticks = ['#tick 100000 1 0\n', '#tick 150000 1 0\n', '#tick 200000 1 1\n',
      '#tick 250000 1 1\n', '#tick 300000 1 0\n', '#tick 350000 1 0\n'];
    const run = rows => execFileSync(binary, [], {input: rows.join(''), encoding: 'utf8', timeout: 5000})
      .trimEnd().split('\n').map(line => line + '\n');

    const store = {value: {revision: '0', record: null}, read() { return this.value; },
      commit(expected, record) {
        assert.equal(expected, this.value.revision);
        this.value = {revision: String(BigInt(expected) + 1n), record};
      }};
    const flow = createVp8BootEnrollment({store, now: () => 0});
    const ticket = flow.begin({revision: '0', capability: true, deviceState: 'unbound', boot, target});
    const wait = poll(0x77, ticket), done = poll(0x78, ticket), resumed = fence(reboot);
    const [initial, nonce, waiting, pending, bound, stale, recovered, legacy] = run([...setup, wait.line, ...ticks,
      done.line, '#reset\n', poll(0x79).line, resumed.line, 'STATUS2\n']);
    assert.equal(initial, statusLine(boot));
    assert.equal(decodeVp8BootReply(nonce).reference, 1);
    assert.equal(decodeVp8BootReply(waiting, {boot, reference: 1}).state.phase, 1);
    assert.equal(pending, proofLine(receipt(wait, 0, 1)));
    assert.equal(wait.accept(pending).evidence, null);
    assert.equal(bound, proofLine(receipt(done, 0, 2)));
    flow.waiting(ticket);
    assert.equal(flow.finish(done.accept(bound).evidence), 'bound');
    assert.equal(stale, '-\n');
    assert.equal(recovered, proofLine(receipt(resumed, 0, 2)));
    assert.equal(resumed.accept(recovered).evidence.kind, 'verified_bound');
    assert.equal(legacy, 'status2\n');

    const busy = fence(boot, 0x81), cancel = fence(boot, 0x82);
    const fenced = run([...setup, '#busy\n', busy.line, '#idle\n', cancel.line, ...ticks, poll(0x83).line]);
    assert.equal(fenced[3], proofLine(receipt(busy, 2, 1)));
    assert.equal(busy.accept(fenced[3]).evidence, null);
    assert.equal(fenced[4], proofLine(receipt(cancel, 0, 0)));
    assert.equal(cancel.accept(fenced[4]).evidence.kind, 'fenced_unbound');
    assert.equal(fenced[5], '-\n');

    const failed = poll(0x84);
    const fault = run([...setup, '#fail-write\n', ...ticks, failed.line])[3];
    assert.equal(fault, proofLine(receipt(failed, 4, 3)));
    assert.equal(failed.accept(fault).evidence, null);
  });
