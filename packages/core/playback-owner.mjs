import {encodeVpc1, VPC1_KIND as kind, VPC1_MAX_TTL, VPC1_U32_MAX, vpc1ActionId} from './playback-wire.mjs';

const heartbeatMs = 5000;
const outstandingLimit = 16;
const replyPhases = new Map([[kind.presented, 'presented'], [kind.missing, 'missing'],
  [kind.superseded, 'superseded'], [kind.expired, 'expired'], [kind.cancelled, 'cancelled']]);
const stopReplay = new Set(['missing', 'expired', 'cancelled']);

const matches = (frame, ticket) => frame.role === ticket.role && frame.action === ticket.action;

/** One device boot scope. The caller provides verified session numbers and a monotonic clock. */
export function createVpc1Owner({now = () => performance.now()} = {}) {
  let active, desired, action, firstFrame, lastReceipt, replayDesired;
  let sessionFloor = 0, displayFloor = 0, lastTime = 0, disconnectedReason = null;

  function time() {
    const current = Math.floor(now());
    if (!Number.isSafeInteger(current) || current < lastTime) {
      active?.close('clock_error');
      // A regressed clock cannot make the last lease fresh again.
      desired = undefined;
      throw new Error('vpc1_clock');
    }
    lastTime = current;
    return current;
  }

  function expire(current) {
    if (!desired || current < desired.deadline) return;
    if (action?.phase !== 'presented') action = {...action, phase: 'expired'};
    desired = undefined;
  }

  function attach(session, {send, terminate, newBoot = false, externalHeartbeat = false}) {
    const current = time();
    if (!Number.isInteger(session) || session <= (newBoot ? 0 : sessionFloor) || session > VPC1_U32_MAX)
      throw new Error('vpc1_session_order');
    if (typeof send !== 'function' || typeof terminate !== 'function') throw new Error('vpc1_transport');
    active?.close('superseded_connection');
    sessionFloor = session;
    if (newBoot) displayFloor = 0;
    disconnectedReason = null;
    firstFrame = lastReceipt = undefined;
    let sequence = 0, ping, nextPing = current + heartbeatMs;
    const pending = new Map();

    function close(reason = 'disconnected') {
      if (active !== link) return;
      active = undefined;
      disconnectedReason = reason;
      firstFrame = lastReceipt = undefined;
      pending.clear();
      if (action && desired) action = {...action, phase: 'disconnected', ticket: null};
      if (!replayDesired) desired = undefined;
      terminate(reason);
    }

    function sendRequest(type, target, ttl = 0) {
      if (sequence === VPC1_U32_MAX || pending.size >= outstandingLimit) {
        close('request_limit');
        return null;
      }
      const ticket = {session, sequence: ++sequence, role: target?.role ?? 0, action: target?.action ?? 0};
      const request = {ticket, type, target, accepted: false};
      pending.set(sequence, request);
      if (type === kind.play) action = {...target, ticket, phase: 'sent', duplicate: false};
      try { send(encodeVpc1({kind: type, ...ticket, value: ttl})); }
      catch { close('transport_error'); return null; }
      return request;
    }

    function play(at) {
      return desired ? sendRequest(kind.play, desired, desired.deadline - at) : null;
    }

    function currentAt(at) {
      if (active !== link) return false;
      expire(at);
      if (!externalHeartbeat && ping && at >= ping.deadline) { close('heartbeat_timeout'); return false; }
      return true;
    }

    function tick() {
      if (active !== link) return false;
      const at = time();
      if (!currentAt(at)) return false;
      if (!externalHeartbeat && !ping && at >= nextPing) {
        const request = sendRequest(kind.ping);
        if (request) ping = {request, deadline: at + heartbeatMs};
      }
      return active === link;
    }

    function protocolError() { close('protocol_error'); return false; }

    function probe() {
      if (!externalHeartbeat || !currentAt(time())) return null;
      if (ping) pending.delete(ping.request.ticket.sequence);
      const request = sendRequest(kind.ping);
      ping = request ? {request} : undefined;
      return request?.ticket.sequence ?? null;
    }

    function receive(frame) {
      if (active !== link) return false;
      const at = time();
      if (!currentAt(at)) return false;
      if (frame.session !== session || frame.sequence > sequence ||
          frame.kind < kind.accepted) return protocolError();
      const request = pending.get(frame.sequence);
      if (!request) return true; // Completed requests cannot update state.
      if (!matches(frame, request.ticket)) return protocolError();
      const isLatest = request.target && request.target === desired;
      if (frame.kind === kind.duplicate) {
        lastReceipt = {...frame, phase: 'duplicate'};
        if (isLatest) action = {...action, duplicate: true};
        return true;
      }
      if (request.type === kind.ping) {
        if (frame.kind !== kind.pong || request !== ping?.request) return protocolError();
        pending.delete(frame.sequence);
        ping = undefined;
        nextPing = at + heartbeatMs;
        return true;
      }
      if (frame.kind === kind.accepted) {
        if (request.accepted) return protocolError();
        request.accepted = true;
        lastReceipt = {...frame, phase: 'accepted'};
        if (isLatest) action = {...action, phase: 'accepted'};
        return true;
      }
      const phase = replyPhases.get(frame.kind);
      if (!phase || !request.accepted) return protocolError();
      pending.delete(frame.sequence);
      if (phase === 'presented') {
        if (frame.value <= displayFloor) return protocolError();
        displayFloor = frame.value;
      }
      lastReceipt = {...frame, phase};
      if (isLatest) {
        action = {...action, phase};
        if (phase === 'presented') firstFrame = {...request.ticket, displaySequence: frame.value};
        if (!replayDesired || stopReplay.has(phase)) desired = undefined;
      }
      return true;
    }

    const link = {close, receive, tick, play};
    active = link;
    expire(current);
    play(current);
    return Object.freeze({close, receive, tick, ...(externalHeartbeat ? {probe} : {})});
  }

  function setAction(role, actionId, ttlMs, replay) {
    if (!vpc1ActionId(role) || !vpc1ActionId(actionId) || !Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > VPC1_MAX_TTL)
      throw new Error('vpc1_action');
    const at = time();
    if (!replay && !active) return false;
    replayDesired = replay;
    desired = {role, action: actionId, deadline: at + ttlMs};
    firstFrame = lastReceipt = undefined;
    action = {...desired, phase: 'queued', ticket: null, duplicate: false};
    return Boolean(active?.tick() && active.play(at));
  }

  return Object.freeze({
    attach,
    setAction(role, actionId, ttlMs) { setAction(role, actionId, ttlMs, true); },
    playCurrent(role, actionId, ttlMs) { return setAction(role, actionId, ttlMs, false); },
    snapshot() {
      expire(time());
      return structuredClone({session: active ? sessionFloor : null, disconnectedReason, action: action ?? null,
        firstFrame: firstFrame ?? null, lastReceipt: lastReceipt ?? null});
    },
  });
}
