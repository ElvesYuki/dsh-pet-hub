import assert from 'node:assert/strict';
import test from 'node:test';
import {createTaskMotion} from '../packages/core/task-motion.mjs';
import {parsePetState} from '../packages/source-pet/schema.mjs';
import {parsePetSessionState} from '../packages/source-pet/session-state.mjs';
import {createVpc1Owner} from '../packages/core/playback-owner.mjs';
import {decodeVpc1, VPC1_KIND as kind} from '../packages/core/playback-wire.mjs';

test('task source projects only the selected DSH session and preserves the old reader shape', () => {
  const leaf = {counter: 2, data: {state: 'thinking', task: 'private detail', sessionId: 'target'}};
  const payload = {sections: {workStatus: leaf}};
  assert.deepEqual(parsePetSessionState(payload), {counter: 2, state: 'thinking', sessionId: 'target'});
  assert.deepEqual(parsePetState(payload), {counter: 2, state: 'thinking'});
  for (const sessionId of [null, 'unknown', undefined, ' '.repeat(300)]) {
    leaf.data.sessionId = sessionId;
    assert.equal(parsePetSessionState(payload).sessionId, null);
  }
  leaf.data = null;
  assert.equal(parsePetSessionState(payload).state, null);
});

test('one scoped task maps semantic edges and one completion, with no source or connection replay', () => {
  const observe = createTaskMotion('target');
  const a = {}, b = {};
  const rows = [
    [1, 'success', 'target', a], // Startup terminal has no observed activity.
    [2, 'working', 'foreign', a],
    [3, 'working', null, a],
    [4, 'thinking', 'target', a, 1],
    [5, 'thinking', 'target', a],
    [6, 'working', 'target', a, 2],
    [7, 'result', 'target', a],
    [8, 'waiting', 'target', a],
    [9, 'success', 'target', a, 3],
    [10, 'waiting', 'target', a],
    [11, 'success', 'target', a],
    [12, 'thinking', 'target', a, 1],
    [13, 'working', 'target', undefined],
    [14, 'success', 'target', b],
    [15, 'success', 'target', b],
    [16, 'thinking', 'target', b, 1],
    [17, 'working', 'foreign', b],
    [18, 'success', 'target', b],
    [19, 'working', 'target', b, 2],
    [1, 'success', 'target', b], // Source restart cannot complete prior work.
    [1, 'thinking', 'target', b], // Conflicting sample of the same revision.
    [2, 'working', 'target', b], // New baseline after the conflict.
    [3, 'result', 'target', b],
    [4, 'success', 'target', b],
    [5, 'thinking', 'target', b, 1],
  ];
  for (const [counter, state, sessionId, target, action] of rows)
    assert.equal(observe({counter, state, sessionId}, target), action, `${counter}/${state}`);
  assert.equal(observe(undefined, b), undefined);
  assert.equal(observe({counter: 6, state: 'success', sessionId: 'target'}, b), undefined);
});

test('current-connection Play never queues offline or replays on reconnect, including Presented', () => {
  let now = 0;
  const requests = [];
  const options = {externalHeartbeat: true, send: bytes => requests.push(decodeVpc1(bytes)), terminate() {}};
  const owner = createVpc1Owner({now: () => now});
  assert.equal(owner.playCurrent(0, 3, 1500), false);
  const first = owner.attach(1, options);
  assert.deepEqual(requests, []);
  assert.equal(owner.playCurrent(0, 3, 1500), true);
  const [ticket] = requests;
  assert.equal(first.receive({...ticket, kind: kind.accepted, value: 0}), true);
  assert.equal(owner.snapshot().firstFrame, null);
  assert.equal(first.receive({...ticket, kind: kind.presented, value: 1}), true);
  assert.equal(owner.snapshot().firstFrame.action, 3);
  now += 10;
  const second = owner.attach(2, options);
  assert.equal(requests.length, 1);
  assert.equal(first.receive({...ticket, kind: kind.presented, value: 2}), false);
  assert.equal(owner.snapshot().firstFrame, null);
  assert.equal(owner.snapshot().action.phase, 'presented');
  assert.equal(owner.playCurrent(0, 2, 1500), true);
  const current = requests.at(-1);
  assert.equal(second.receive({...current, kind: kind.accepted, value: 0}), true);
  assert.equal(second.receive({...current, kind: kind.missing, value: 0}), true);
  assert.equal(owner.snapshot().lastReceipt.phase, 'missing');
  assert.equal(owner.snapshot().firstFrame, null);
});

test('a different native turn cannot inherit the previous turn’s celebration', () => {
  const observe = createTaskMotion('target'), connection = {};
  const sample = (counter, turnId, state) => observe({counter, sessionId: 'target', turnId, state}, connection);
  assert.equal(sample(1, 'first', null), undefined);
  assert.equal(sample(2, 'first', 'thinking'), 1);
  assert.equal(sample(3, 'second', 'success'), undefined);
  assert.equal(sample(4, 'third', 'thinking'), 1);
  assert.equal(sample(5, 'third', 'success'), 3);
  assert.equal(sample(6, 'third', 'success'), undefined);
});
