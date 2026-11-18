import assert from 'node:assert/strict';
import test from 'node:test';
import {createVp8BootEnrollment} from '../packages/runtime/vp8-boot-enrollment.mjs';
import {increment} from '../packages/core/protocol.mjs';

const target = {device: '11'.repeat(16), controller: '22'.repeat(16), binding: '33'.repeat(16),
  epoch: '9007199254740993', keySha256: 'ab'.repeat(32)};
const start = {capability: true, deviceState: 'unbound', revision: '0', boot: '1', target};
const reconcile = {capability: true, revision: '1', boot: '2', device: target.device};
const confirmed = ticket => ({...ticket, kind: 'verified_bound'});

function fixture() {
  let stored = {revision: '0', record: null}, time = 0, failure;
  const store = {
    read: () => structuredClone(stored),
    commit(expected, record) {
      assert.equal(expected, stored.revision);
      if (failure === 'before') throw new Error('storage_failed');
      stored = {revision: increment(expected), record};
      if (failure === 'after') throw new Error('storage_commit_unknown');
    },
  };
  const open = () => createVp8BootEnrollment({store, now: () => time});
  return {store, open, setTime: next => { time = next; }, fault: stage => { failure = stage; }};
}

test('VP8 BOOT requires capability and durable pending before an exact verified receipt can bind', () => {
  const f = fixture(), owner = f.open();
  assert.throws(() => owner.begin({...start, capability: false}), {code: 'vp8_enrollment_unsupported'});
  for (const deviceState of ['bound', 'pending', 'unknown']) {
    assert.throws(() => owner.begin({...start, deviceState}), {code: 'vp8_enrollment_device_conflict'});
  }
  assert.equal(f.store.read().record, null);

  const ticket = owner.begin(start);
  assert.deepEqual(f.store.read(), {revision: '1', record: {phase: 'pending', target}});
  assert.throws(() => owner.finish(confirmed(ticket)), {code: 'vp8_enrollment_insufficient_evidence'});
  assert.throws(() => owner.waiting({...ticket, boot: '2'}), {code: 'vp8_enrollment_evidence_scope'});
  owner.waiting(ticket);
  assert.deepEqual(owner.snapshot(), {revision: '1', phase: 'awaiting_boot'});
  for (const field of ['device', 'binding', 'controller', 'keySha256']) {
    const conflict = {...target, [field]: '09'.repeat(target[field].length / 2)};
    assert.throws(() => owner.finish(confirmed({...ticket, target: conflict})), {code: 'vp8_enrollment_evidence_scope'});
  }
  assert.throws(() => owner.finish(confirmed({...ticket, target: {...target, epoch: '9007199254740992'}})),
    {code: 'vp8_enrollment_evidence_scope'});
  assert.throws(() => owner.finish({...ticket, kind: 'button_pressed'}), {code: 'vp8_enrollment_insufficient_evidence'});
  assert.equal(owner.finish(confirmed(ticket)), 'bound');
  assert.deepEqual(f.open().snapshot(), {revision: '2', phase: 'bound'});
  assert.throws(() => owner.finish(confirmed(ticket)), {code: 'vp8_enrollment_evidence_scope'});
});

test('expired BOOT does not bind, and restart only reconciles fresh evidence from the same device', () => {
  const f = fixture(), owner = f.open(), ticket = owner.begin(start);
  f.setTime(1000);
  owner.waiting(ticket);
  f.setTime(16000);
  assert.throws(() => owner.finish(confirmed(ticket)), {code: 'vp8_enrollment_evidence_scope'});
  assert.equal(owner.snapshot().phase, 'recovery_required');

  const reopened = f.open();
  assert.throws(() => reopened.begin({...start, revision: '1'}), {code: 'vp8_enrollment_existing_record'});
  assert.throws(() => reopened.recover({...reconcile, device: '33'.repeat(16)}), {code: 'vp8_enrollment_recovery_target'});
  const fresh = reopened.recover(reconcile);
  assert.notEqual(fresh.attempt, ticket.attempt);
  assert.throws(() => reopened.finish(confirmed(ticket)), {code: 'vp8_enrollment_evidence_scope'});
  assert.throws(() => reopened.finish(confirmed({...fresh, boot: ticket.boot})), {code: 'vp8_enrollment_evidence_scope'});
  assert.equal(reopened.finish(confirmed(fresh)), 'bound');
});

test('interrupt preserves pending, and only fenced unbound on fresh recovery clears it', () => {
  const f = fixture(), owner = f.open(), ticket = owner.begin(start);
  owner.waiting(ticket);
  assert.throws(() => owner.finish({...ticket, kind: 'fenced_unbound'}), {code: 'vp8_enrollment_insufficient_evidence'});
  owner.interrupt(ticket.attempt);
  assert.throws(() => owner.finish(confirmed(ticket)), {code: 'vp8_enrollment_evidence_scope'});
  const fresh = owner.recover(reconcile);
  owner.interrupt(ticket.attempt);
  assert.equal(owner.snapshot().phase, 'reconciling');
  assert.throws(() => owner.finish({...fresh, kind: 'plain_unbound'}), {code: 'vp8_enrollment_insufficient_evidence'});
  assert.equal(owner.finish({...fresh, kind: 'fenced_unbound'}), 'unregistered');
  assert.deepEqual(f.store.read(), {revision: '2', record: null});
});

test('local commit faults never release a proposal or allow replay of old completion evidence', () => {
  const f = fixture(), owner = f.open();
  f.fault('before');
  assert.throws(() => owner.begin(start), /storage_failed/);
  assert.equal(owner.snapshot().phase, 'unregistered');
  f.fault('after');
  assert.throws(() => owner.begin(start), /storage_commit_unknown/);
  assert.equal(owner.snapshot().phase, 'recovery_required');
  f.fault(undefined);
  const ticket = owner.recover(reconcile);
  f.fault('before');
  assert.throws(() => owner.finish(confirmed(ticket)), /storage_failed/);
  assert.throws(() => owner.finish(confirmed(ticket)), {code: 'vp8_enrollment_evidence_scope'});
  assert.deepEqual(f.open().snapshot(), {revision: '1', phase: 'recovery_required'});
});
