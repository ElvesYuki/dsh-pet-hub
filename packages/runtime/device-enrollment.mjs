import {randomUUID} from 'node:crypto';
import {clone, digest, id, increment, keys, requireThat, same, uint64} from '../core/protocol.mjs';

function identifier(value) {
  requireThat(typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) && /[^0]/.test(value), 'device_enrollment_identity');
}

function target(value) {
  keys(value, ['device', 'controller', 'binding', 'epoch', 'keySha256']);
  for (const field of ['device', 'controller', 'binding']) identifier(value[field]);
  requireThat(uint64(value.epoch) > 0n, 'device_enrollment_epoch');
  digest(value.keySha256);
}

export function validateBootState(state, {requireKeyRef = false} = {}) {
  keys(state, ['revision', 'record']);
  uint64(state.revision);
  if (state.record !== null) {
    keys(state.record, ['phase', 'target', 'keyRef']);
    requireThat(['pending', 'bound'].includes(state.record.phase), 'device_enrollment_record');
    target(state.record.target);
    if (requireKeyRef || state.record.keyRef !== undefined) id(state.record.keyRef);
  }
  return state;
}

/**
 * Host-only enrollment transaction. The store provides synchronous read and
 * atomic commit(expectedRevision, record); the USB verifier alone supplies
 * waiting and final evidence. Neither method is an IPC or wire decoder.
 */
export function createBootEnrollment({store, now = () => performance.now()}) {
  requireThat(typeof store?.read === 'function' && typeof store.commit === 'function' &&
    typeof now === 'function', 'device_enrollment_dependencies');
  let active, lastTime = -Infinity;

  function clock() {
    const time = now();
    requireThat(Number.isFinite(time) && time >= lastTime, 'device_enrollment_clock');
    lastTime = time;
    return time;
  }

  function read() {
    return validateBootState(store.read());
  }

  function live(state, time) {
    if (active && (active.revision !== state.revision || time >= active.deadline)) active = undefined;
    return active;
  }

  function commit(state, record) {
    const revision = increment(state.revision);
    store.commit(state.revision, clone(record));
    const saved = read();
    requireThat(saved.revision === revision && same(saved.record, record), 'device_enrollment_commit_unconfirmed');
    return saved;
  }

  function preflight(state, request, time) {
    requireThat(request.capability === true, 'device_enrollment_unsupported');
    requireThat(uint64(request.boot) > 0n, 'device_enrollment_boot');
    requireThat(request.revision === state.revision && !live(state, time), 'device_enrollment_stale');
  }

  function beginAttempt(state, phase, boot, time) {
    const id = randomUUID();
    active = {id, boot, phase, revision: state.revision, deadline: time + 25000};
    return {attempt: id, boot, target: clone(state.record.target)};
  }

  function match(state, evidence, time) {
    const attempt = live(state, time);
    requireThat(attempt && state.record?.phase === 'pending' && evidence.attempt === attempt.id && evidence.boot === attempt.boot &&
      same(state.record.target, evidence.target), 'device_enrollment_evidence_scope');
    return attempt;
  }

  return {
    begin(request) {
      keys(request, ['capability', 'deviceState', 'revision', 'boot', 'target', 'keyRef']);
      const state = read(), time = clock();
      preflight(state, request, time);
      requireThat(state.record === null, 'device_enrollment_existing_record');
      requireThat(request.deviceState === 'unbound', 'device_enrollment_device_conflict');
      target(request.target);
      const record = {phase: 'pending', target: request.target};
      if (request.keyRef !== undefined) record.keyRef = id(request.keyRef);
      const pending = commit(state, record);
      return beginAttempt(pending, 'preparing', request.boot, time);
    },
    waiting(evidence) {
      keys(evidence, ['attempt', 'boot', 'target']);
      const state = read(), time = clock(), attempt = match(state, evidence, time);
      requireThat(attempt.phase === 'preparing', 'device_enrollment_wrong_phase');
      attempt.phase = 'awaiting_boot';
      attempt.deadline = Math.min(attempt.deadline, time + 15000);
    },
    confirmingUsb(evidence) {
      keys(evidence, ['attempt', 'boot', 'target']);
      const state = read(), attempt = match(state, evidence, clock());
      requireThat(attempt.phase === 'preparing', 'device_enrollment_wrong_phase');
      attempt.phase = 'confirming_usb';
    },
    recover(request) {
      keys(request, ['capability', 'revision', 'boot', 'device']);
      const state = read(), time = clock();
      preflight(state, request, time);
      requireThat(state.record?.phase === 'pending' && state.record.target.device === request.device,
        'device_enrollment_recovery_target');
      return beginAttempt(state, 'reconciling', request.boot, time);
    },
    finish(evidence) {
      keys(evidence, ['attempt', 'boot', 'target', 'kind']);
      const state = read(), attempt = match(state, evidence, clock());
      const bound = evidence.kind === 'verified_bound';
      requireThat((bound && ['awaiting_boot', 'reconciling', 'confirming_usb'].includes(attempt.phase)) ||
        (evidence.kind === 'fenced_unbound' && attempt.phase === 'reconciling'), 'device_enrollment_insufficient_evidence');
      // A lost local commit response is recovered by a new attempt, never by
      // accepting the same evidence a second time.
      active = undefined;
      commit(state, bound ? {...state.record, phase: 'bound'} : null);
      return bound ? 'bound' : 'unregistered';
    },
    interrupt(attempt) {
      if (active?.id === attempt) active = undefined;
    },
    snapshot() {
      const state = read(), current = live(state, clock());
      return {revision: state.revision, phase: current?.phase ??
        (state.record?.phase === 'pending' ? 'recovery_required' : state.record?.phase ?? 'unregistered')};
    },
  };
}
