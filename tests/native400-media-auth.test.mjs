import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {encodeMediaFrame} from '../packages/core/native400-tcp-media-wire.mjs';
import {connectExample, deviceInit, exampleVectors, hubChallenge, issueDecision, queryReceipt, repairArm}
  from './fixtures/native400-media-auth.mjs';

const vectors = JSON.parse(await readFile(new URL('../docs/protocol/vectors/native400-media-auth-draft-v1.json', import.meta.url)));
const {example, cases} = vectors;
const {pair, nonces, decision, begin, result, hello} = example;
const encode = value => Buffer.from(encodeMediaFrame(value));
const read = (mode, name) => Buffer.from(cases[mode].records[name], 'hex');
const reject = fn => assert.throws(fn, /pma_auth_rejected/);
const beginBytes = encode(begin);
const issue = () => issueDecision({...decision, pair, begin: beginBytes});
const initial = (endpoint, overrides = {}) => ({endpoint, begin: beginBytes, startedAt: 100, now: 200, ...overrides});

function repairThrough(names, exchange = connectExample(example, 'repair')) {
  const opened = {};
  for (const name of names) {
    const target = ['hello', 'ready', 'ack', 'result'].includes(name) ? exchange.hub : exchange.device;
    opened[name] = target.open(read('repair', name));
  }
  return opened;
}

function replaceBody(packet, replacement) {
  assert.equal(replacement.length, packet.readUInt32LE(12));
  return Buffer.concat([packet.subarray(0, 16), replacement, packet.subarray(-32)]);
}

test('PMA1 published mutual proofs and all protected PTM1 records match the canonical bytes', () => {
  assert.deepEqual(exampleVectors(example), cases);
  const open = repairThrough(Object.keys(cases.repair.records));
  assert.deepEqual(open.hello.fields, hello);
  assert.deepEqual(open.begin.fields, begin);
  assert.equal(open.grant.fields.workMs, 15000);
  assert.equal(open.data.fields.data.length, 4);
  assert.equal(open.ack.fields.bytes, 4);
  assert.equal(open.end.fields.bytes, 4);
  assert.equal(open.cancel.fields.job, begin.job);
  assert.deepEqual(open.result.fields, result);
  const query = connectExample(example, 'query');
  assert.deepEqual(query.hub.open(read('query', 'hello')).fields, example.queryHello);
  assert.equal(query.device.open(read('query', 'query')).fields.job, begin.job);
  assert.deepEqual(query.hub.open(read('query', 'result')).fields, result);
  assert.notEqual(cases.repair.transcriptSha256, cases.query.transcriptSha256);
});

test('PMA1 pair mapping pins both identities, binding, epoch and secret before allowing records', () => {
  const init = deviceInit(pair, 'repair', nonces.repair.device).init;
  for (const [key, value] of Object.entries({device: 'ef'.repeat(16), hub: 'ef'.repeat(16),
    binding: 'ef'.repeat(16), epoch: '9007199254740994'})) {
    reject(() => hubChallenge({...pair, [key]: value}, init, nonces.repair.hub));
  }
  const other = deviceInit({...pair, syntheticKey: 'ab'.repeat(32)}, 'repair', nonces.repair.device);
  const hub = hubChallenge(pair, other.init, nonces.repair.hub);
  reject(() => other.finish(hub.challenge));
  reject(() => other.finish(hub.challenge));
});

test('PMA1 rejects reflected proofs, edited purpose and a replay against a fresh hub nonce', () => {
  const old = connectExample(example, 'repair').handshake;
  const rekeyed = hubChallenge(pair, old.init, 'fe'.repeat(32));
  reject(() => rekeyed.finish(old.finish));
  const reflection = hubChallenge(pair, old.init, nonces.repair.hub);
  const forged = Buffer.concat([old.finish.subarray(0, 16), old.challenge.subarray(-32)]);
  reject(() => reflection.finish(forged));
  const device = deviceInit(pair, 'repair', nonces.repair.device);
  const changed = Buffer.from(device.init);
  changed[16 + 56] = 2;
  reject(() => device.finish(hubChallenge(pair, changed, nonces.repair.hub).challenge));
});

test('PMA1 closes on duplicates, sequence gaps, reflection, truncation and raw PTM1 downgrade', () => {
  let live = connectExample(example, 'repair');
  live.device.open(read('repair', 'grant'));
  reject(() => live.device.open(read('repair', 'grant')));
  reject(() => live.device.open(read('repair', 'begin')));
  reject(() => live.device.seal('ptm', encode(hello)));
  for (const frame of [read('repair', 'begin'), beginBytes, read('repair', 'grant').subarray(0, -1)]) {
    live = connectExample(example, 'repair');
    reject(() => live.device.open(frame));
  }
  live = connectExample(example, 'repair');
  reject(() => live.hub.open(read('repair', 'grant')));
  for (const offset of [4, 5, 6, 12]) {
    const malformed = read('repair', 'grant');
    malformed[offset] ^= 1;
    reject(() => connectExample(example, 'repair').device.open(malformed));
  }
});

test('PMA1 cannot carry old authenticated records into fresh repair or query sessions', () => {
  for (const [mode, name] of [['repair', 'grant'], ['query', 'query']]) {
    const fresh = connectExample({...example, nonces: {...nonces, [mode]: {device: 'c2'.repeat(32), hub: 'c3'.repeat(32)}}}, mode);
    reject(() => fresh.device.open(read(mode, name)));
  }
  const query = connectExample(example, 'query');
  reject(() => query.hub.seal('ptm', beginBytes));
  reject(() => issue()(initial(query.hub)));
});

test('PMA1 detects substituted DATA, CANCEL, QUERY and RESULT even with valid inner CRC', () => {
  const job = '07'.repeat(16);
  const mutations = [
    ['data', ['grant', 'begin'], {kind: 'data', job: begin.job, offset: 0, data: Buffer.from('PTM4')}],
    ['cancel', ['grant', 'begin', 'data', 'end'], {kind: 'cancel', job}],
    ['result', ['hello', 'ready', 'ack'], {...result, generation: '6'}]
  ];
  for (const [name, before, replacement] of mutations) {
    const peer = connectExample(example, 'repair');
    repairThrough(before, peer);
    const receiver = name === 'result' ? peer.hub : peer.device;
    reject(() => receiver.open(replaceBody(read('repair', name), encode(replacement))));
  }
  const query = connectExample(example, 'query');
  reject(() => query.device.open(replaceBody(read('query', 'query'), encode({kind: 'query', job}))));
});

test('PMA1 one-time decision pins the complete BEGIN, current binding and local expiry', () => {
  const authorize = issue();
  const {hub, device} = connectExample(example, 'repair');
  reject(() => hub.seal('ptm', beginBytes));
  for (const [field, changed] of Object.entries({job: 'a5'.repeat(16), boot: '6', root: '3', generation: '4',
    action: 11, frames: 118, bytes: 5, sha256: 'ab'.repeat(32), namespace: 'ac'.repeat(32)})) {
    reject(() => authorize(initial(hub, {begin: encode({...begin, [field]: changed})})));
  }
  const other = connectExample({...example, pair: {...pair, epoch: '9'}}, 'repair');
  reject(() => authorize(initial(other.hub)));
  reject(() => authorize(initial(hub, {now: decision.expiresAt})));
  const grant = device.open(authorize(initial(hub)));
  assert.equal(grant.fields.id, decision.decisionId);
  assert.equal(grant.fields.manifestSha, decision.manifestSha);
  assert.equal(grant.fields.indexSha, decision.indexSha);
  reject(() => authorize(initial(connectExample(example, 'repair').hub)));
  const actual = device.open(hub.seal('ptm', beginBytes));
  const arm = repairArm({startedAt: 90, armUntil: 1000, expectedBegin: beginBytes});
  const checkDeadline = arm(grant, actual, 220);
  checkDeadline(999);
  reject(() => checkDeadline(998));
  reject(() => checkDeadline(999));
  reject(() => checkDeadline(1000));
  reject(() => arm(grant, actual, 221));
});

test('PMA1 device rejects a different authenticated BEGIN and late arrival without resetting time', () => {
  const exchange = connectExample(example, 'repair');
  const grant = exchange.device.open(issue()(initial(exchange.hub)));
  const actual = exchange.device.open(exchange.hub.seal('ptm', encode({...begin, job: 'aa'.repeat(16)})));
  const arm = repairArm({startedAt: 90, armUntil: 60000, expectedBegin: beginBytes});
  reject(() => arm(grant, actual, 230));
  const open = repairThrough(['grant', 'begin']);
  reject(() => arm(open.grant, open.begin, 15090));
  const check = arm(open.grant, open.begin, 15089);
  reject(() => check(15090));
});

test('PMA1 same-boot query is exact, bounded and cannot acquire write permission', () => {
  const {device, hub} = connectExample(example, 'query');
  const query = device.open(hub.seal('ptm', encode({kind: 'query', job: begin.job})));
  const receipt = {binding: device.binding, boot: hello.boot, job: begin.job, closedAt: 400, result};
  const input = {endpoint: device, helloBoot: hello.boot, query, now: 405, receipt};
  assert.deepEqual(queryReceipt(input), result);
  for (const change of [{helloBoot: '7'}, {now: 120400}, {now: 399}, {receipt: null},
    {receipt: {...receipt, job: 'ff'.repeat(16)}}, {receipt: {...receipt, binding: 'ff'.repeat(56)}}]) {
    assert.equal(queryReceipt({...input, ...change}).status, 'unknown');
  }
  assert.equal(queryReceipt({...input, receipt: {...receipt, result: {kind: 'result', job: begin.job, status: 'unknown'}}}).status,
    'unknown');
  reject(() => hub.seal('ptm', encode({kind: 'query', job: begin.job})));
  reject(() => hub.seal('ptm', encode({kind: 'cancel', job: begin.job})));
});
