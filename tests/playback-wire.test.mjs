import {cxx, firmwareHostTests, firmwareMain, firmwareProtocol, hasCppPeer} from './fixtures/firmware.mjs';
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {createConnection, createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {createVpc1Framer, decodeVpc1, encodeVpc1, VPC1_KIND as kind} from '../packages/core/playback-wire.mjs';
import {createVpc1Owner} from '../packages/core/playback-owner.mjs';
import {attachVpc1Loopback} from '../packages/runtime/playback-loopback.mjs';

const play = {kind: kind.play, session: 1, sequence: 1, role: 0, action: 4, value: 5000};
const reply = (message, type, value = 0, changes = {}) => ({...message, kind: type, value, ...changes});
const bytes = message => Buffer.from(encodeVpc1(message));

test('VPC1 fixed vector, all 23 split positions, coalesced frames, invalid fields and truncated EOF', () => {
  const vector = Buffer.from('565043310101000001000000010000000000040088130000', 'hex');
  assert.deepEqual(bytes(play), vector);
  const accepted = reply(play, kind.accepted);
  for (let split = 1; split < vector.length; split++) {
    const framer = createVpc1Framer(), actual = [];
    const receive = message => { actual.push(message); };
    framer.push(vector.subarray(0, split), receive);
    assert.equal(actual.length, 0);
    assert.throws(() => framer.finish(), /vpc1_truncated/);
    framer.push(Buffer.concat([vector.subarray(split), bytes(accepted)]), receive);
    framer.finish();
    assert.deepEqual(actual, [play, accepted]);
  }
  for (const change of [{sequence: 0}, {session: 0}, {value: 30001}, {role: 65535},
    {kind: kind.ping}, {kind: kind.presented, value: 0}, {kind: 3}])
    assert.throws(() => encodeVpc1({...play, ...change}), /vpc1_frame_fields/);
  const reserved = Buffer.from(vector);
  reserved[6] = 1;
  assert.throws(() => decodeVpc1(reserved), /vpc1_frame_header/);
});

function fixture() {
  let clock = 0;
  const owner = createVpc1Owner({now: () => clock});
  function attach(session) {
    const sent = [], closed = [];
    const peer = owner.attach(session, {send: value => sent.push(decodeVpc1(value)), terminate: reason => closed.push(reason)});
    return {sent, closed, peer};
  }
  return {owner, attach, advance: ms => { clock += ms; }};
}

test('only matching, accepted and latest Presented can confirm first frame; Pong can overtake a Play receipt', () => {
  const {owner, attach, advance} = fixture();
  const {sent, peer} = attach(1);
  owner.setAction(0, 4, 20000);
  const old = sent[0];
  assert.equal(owner.snapshot().action.phase, 'sent');
  peer.receive(reply(old, kind.accepted));
  assert.equal(owner.snapshot().action.phase, 'accepted');
  assert.equal(owner.snapshot().firstFrame, null);
  owner.setAction(0, 57, 20000);
  const latest = sent[1];
  peer.receive(reply(old, kind.superseded));
  assert.equal(owner.snapshot().lastReceipt.phase, 'superseded');
  peer.receive(reply(latest, kind.accepted));
  advance(5000);
  peer.tick();
  const ping = sent[2];
  assert.equal(ping.kind, kind.ping);
  peer.receive(reply(ping, kind.pong));
  peer.receive(reply(old, kind.presented, 90)); // Terminal stale ticket is ignored.
  assert.equal(owner.snapshot().firstFrame, null);
  peer.receive(reply(latest, kind.duplicate));
  assert.equal(owner.snapshot().action.duplicate, true);
  assert.equal(owner.snapshot().action.phase, 'accepted');
  peer.receive(reply(latest, kind.presented, 91));
  assert.deepEqual(owner.snapshot().firstFrame, {session: 1, sequence: 2, role: 0, action: 57, displaySequence: 91});
  assert.equal(owner.snapshot().action.phase, 'presented');
});

test('disconnect fences callbacks and replays only the latest target with residual TTL', () => {
  const {owner, attach, advance} = fixture();
  const first = attach(1);
  owner.setAction(0, 4, 20000);
  owner.setAction(0, 57, 10000);
  first.peer.receive(reply(first.sent[1], kind.accepted));
  first.peer.close();
  assert.equal(owner.snapshot().action.phase, 'disconnected');
  advance(4000);
  const second = attach(2);
  assert.deepEqual(second.sent, [{...play, session: 2, action: 57, value: 6000}]);
  assert.equal(first.peer.receive(reply(first.sent[1], kind.presented, 300)), false);
  first.peer.close('late_close');
  assert.equal(owner.snapshot().session, 2);
  assert.equal(owner.snapshot().firstFrame, null);
  assert.throws(() => attach(1), /vpc1_session_order/);
  advance(6000);
  second.peer.receive(reply(second.sent[0], kind.accepted));
  second.peer.receive(reply(second.sent[0], kind.presented, 301));
  assert.equal(owner.snapshot().action.phase, 'expired');
  assert.equal(owner.snapshot().firstFrame, null);
  assert.equal(attach(3).sent.length, 0);
});

test('Missing, Cancelled, and Expired are observable terminal outcomes without reconnect replay', () => {
  for (const phase of ['missing', 'cancelled', 'expired']) {
    const {owner, attach} = fixture();
    const {sent, peer} = attach(1);
    owner.setAction(0, 4, 5000);
    peer.receive(reply(sent[0], kind.accepted));
    peer.receive(reply(sent[0], kind[phase]));
    assert.equal(owner.snapshot().action.phase, phase);
    assert.equal(owner.snapshot().firstFrame, null);
    assert.equal(attach(2).sent.length, 0);
  }
});

test('wrong session, wrong request and display sequence rollback fail closed', () => {
  for (const changes of [{session: 2}, {sequence: 2}, {role: 1}, {action: 1}]) {
    const {owner, attach} = fixture();
    const {sent, peer, closed} = attach(1);
    owner.setAction(0, 4, 5000);
    assert.equal(peer.receive(reply(sent[0], kind.accepted, 0, changes)), false);
    assert.deepEqual(closed, ['protocol_error']);
    assert.equal(owner.snapshot().session, null);
  }
  const {owner, attach} = fixture();
  const first = attach(1);
  owner.setAction(0, 4, 5000);
  first.peer.receive(reply(first.sent[0], kind.accepted));
  first.peer.receive(reply(first.sent[0], kind.presented, 77));
  const next = attach(2);
  assert.equal(owner.snapshot().firstFrame, null);
  next.peer.receive(reply(next.sent[0], kind.accepted));
  assert.equal(next.peer.receive(reply(next.sent[0], kind.presented, 76)), false);
  assert.equal(owner.snapshot().firstFrame, null);
  assert.equal(owner.snapshot().disconnectedReason, 'protocol_error');
});

test('Duplicate and play receipts cannot renew the Ping deadline; in-flight requests stay bounded', () => {
  const {owner, attach, advance} = fixture();
  const {sent, peer} = attach(1);
  owner.setAction(0, 4, 20000);
  advance(5000);
  peer.tick();
  peer.receive(reply(sent[1], kind.duplicate));
  peer.receive(reply(sent[0], kind.accepted));
  advance(5000);
  assert.equal(peer.tick(), false);
  assert.equal(owner.snapshot().disconnectedReason, 'heartbeat_timeout');

  const next = attach(2);
  for (let i = 0; i < 16; i++) owner.setAction(0, i, 5000);
  assert.equal(next.sent.length, 16);
  assert.deepEqual(next.closed, ['request_limit']);
  assert.equal(attach(3).sent[0].action, 15);
});

async function listener(t) {
  const server = createServer();
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise(resolve => server.close(resolve));
  });
  return server;
}

test('real loopback closes a partial EOF without publishing a receipt', {timeout: 5000}, async t => {
  const server = await listener(t);
  const connected = once(server, 'connection');
  const client = createConnection(server.address());
  t.after(() => client.destroy());
  const [socket] = await connected;
  const {owner} = fixture();
  attachVpc1Loopback(socket, owner, 1);
  client.end(bytes(reply(play, kind.accepted)).subarray(0, 23));
  await once(socket, 'close');
  assert.equal(owner.snapshot().disconnectedReason, 'truncated_frame');
  assert.equal(owner.snapshot().firstFrame, null);
});

test('the firmware VPC1 C++ core and Node owner exchange bytes over real loopback',
  {skip: !hasCppPeer && 'requires a C++ compiler', timeout: 20000}, async t => {
    const temp = await mkdtemp(join(tmpdir(), 'vpc1-peer-'));
    t.after(() => rm(temp, {recursive: true, force: true}));
    const compile = (source, target) => {
      const output = join(temp, target);
      execFileSync(cxx, ['-std=c++20', '-O1', '-Wall', '-Wextra', '-Werror', '-fsanitize=address,undefined',
        '-I', firmwareProtocol, '-I', firmwareMain, join(firmwareMain, 'playback_control.cpp'), join(firmwareHostTests, source),
        '-o', output], {timeout: 12000});
      return output;
    };
    execFileSync(compile('playback_control_test.cpp', 'playback-test'), {timeout: 4000});
    const executable = compile('playback_loopback.cpp', 'playback-loopback');
    const server = await listener(t);
    const established = once(server, 'connection');
    const child = spawn(executable, [String(server.address().port)], {stdio: ['ignore', 'inherit', 'inherit']});
    const exit = once(child, 'exit');
    t.after(() => child.kill());
    const [socket] = await Promise.race([established, exit.then(() => { throw new Error('VPC1 peer exited before connecting'); })]);
    t.after(() => socket.destroy());
    const {owner, advance} = fixture();
    const peer = attachVpc1Loopback(socket, owner, 1, {automaticHeartbeat: false});
    async function waitFor(phase) {
      for (let i = 0; i < 100 && owner.snapshot().action?.phase !== phase; i++) await delay(10);
      assert.equal(owner.snapshot().action?.phase, phase);
    }
    owner.setAction(0, 4, 20000);
    await waitFor('accepted');
    assert.equal(owner.snapshot().firstFrame, null);
    owner.setAction(0, 57, 20000);
    await waitFor('accepted');
    advance(5000);
    peer.tick();
    await waitFor('presented');
    assert.deepEqual(owner.snapshot().firstFrame, {session: 1, sequence: 2, role: 0, action: 57, displaySequence: 77});
    owner.setAction(0, 999, 20000);
    await waitFor('missing');
    peer.close();
    assert.deepEqual(await exit, [0, null]);
    assert.equal(owner.snapshot().firstFrame, null);
  });
