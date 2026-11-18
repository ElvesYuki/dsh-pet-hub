import {createHmac, createSecretKey, randomBytes, timingSafeEqual} from 'node:crypto';
import {addAbortListener} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {decodePbp1Frame, encodePbp1Frame, PBP1_HEADER_BYTES} from '../core/native400-pbp1-wire.mjs';

const CLOSED = new Error('pbp_closed');
const TIMED_OUT = new Error('pbp_timeout');
const zeroId = '0'.repeat(32);
const ownedTransports = new WeakSet();
const activeScopes = new WeakMap();

export function native400UsbPairingScope(provider) {
  return activeScopes.get(provider);
}

/** Internal handoff after a verified scope and actual USB exit. */
export function publishNative400UsbPairing(identity, scope, key, revoked) {
  const provider = Object.freeze({identity, boot: scope.boot, acquire(wanted) {
    need(!revoked.aborted && wanted && wanted.device === identity.device && wanted.hub === identity.hub &&
      wanted.binding === identity.binding && wanted.epoch === identity.epoch, 'pbp_lease');
    return {key, revoked};
  }});
  revoked.addEventListener('abort', () => {
    key = null;
    activeScopes.delete(provider);
  }, {once: true});
  activeScopes.set(provider, scope);
  return provider;
}

function need(condition, code) {
  if (!condition) throw new Error(code);
}

export function pbp1Fingerprint(offerPacket, proposal) {
  const offer = decodePbp1Frame(offerPacket);
  need(offer.kind === 'offer' && Number.isInteger(proposal) && proposal > 0 && proposal <= 0xffffffff, 'pbp_invalid_proposal');
  const body = offerPacket.subarray(PBP1_HEADER_BYTES);
  const scope = Buffer.alloc(12);
  scope.set(body.subarray(0, 8));
  scope.writeUInt32LE(proposal, 8);
  const proof = createHmac('sha256', offer.psk).update('PBP1/fingerprint/v1', 'ascii')
    .update(scope).update(body.subarray(8, 64)).digest();
  try {
    return proof.toString('hex', 0, 16);
  } finally {
    proof.fill(0);
  }
}

function fingerprintMatches(actual, expected) {
  return typeof actual === 'string' && /^[0-9a-fA-F]{32}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

/** One explicitly enabled RAM pairing over an exclusively supplied transport.
 * exchange(bytes, {signal}) returns one full frame or null for a missed reply.
 * close() must stop and wait for transport I/O and is invoked once by the owner.
 * confirmFingerprint(view, {signal}) returns the device-screen hex read by the user.
 * start() returns the boot-pinned PMA1 provider after Active and USB exit.
 */
export function createNative400UsbPairing({enabled = false, transport, identity: input, confirmFingerprint,
  timeoutMs = 60000, requestTimeoutMs = 1000, pollMs = 200} = {}) {
  need(enabled === true, 'pbp_disabled');
  need(transport && typeof transport.exchange === 'function' && typeof transport.close === 'function' &&
    !ownedTransports.has(transport) && typeof confirmFingerprint === 'function', 'pbp_transport');
  const {device, hub, binding, epoch} = input ?? {};
  need([device, hub, binding].every(id => typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) && id !== zeroId) &&
    typeof epoch === 'string' && /^[1-9][0-9]{0,19}$/.test(epoch) && BigInt(epoch) <= 0xffffffffffffffffn, 'pbp_identity');
  need([timeoutMs, requestTimeoutMs, pollMs].every(ms => Number.isInteger(ms) && ms > 0) &&
    timeoutMs <= 60000 && requestTimeoutMs <= 5000 && pollMs <= 5000, 'pbp_timing');
  ownedTransports.add(transport);
  const identity = Object.freeze({device, hub, binding, epoch});
  const operation = new AbortController(), revocation = new AbortController();
  const signal = operation.signal;
  let running, closingTransport, closing;

  function closeTransport() {
    return closingTransport ??= Promise.resolve().then(() => transport.close()).catch(() => { throw new Error('pbp_usb_close'); });
  }

  async function pair() {
    const deadline = performance.now() + timeoutMs;
    const timer = setTimeout(() => operation.abort(TIMED_OUT), timeoutMs);
    const onAbort = addAbortListener(signal, () => { void closeTransport().catch(() => {}); });
    function check() {
      if (performance.now() >= deadline) operation.abort(TIMED_OUT);
      signal.throwIfAborted();
    }
    async function exchange(packet) {
      check();
      const cutoff = Math.min(performance.now() + requestTimeoutMs, deadline);
      const timeout = AbortSignal.timeout(Math.max(0, Math.ceil(cutoff - performance.now())));
      let reply;
      try {
        reply = await transport.exchange(packet, {signal: AbortSignal.any([signal, timeout])});
      } catch {
        check();
        if (timeout.aborted || performance.now() >= cutoff) return null;
        throw new Error('pbp_usb_io');
      }
      check();
      if (reply === null || timeout.aborted || performance.now() >= cutoff) return null;
      const frame = decodePbp1Frame(reply);
      need(frame.kind === 'state' && frame.device === device && frame.boot !== '0', 'pbp_device');
      return frame;
    }
    const info = () => exchange(encodePbp1Frame({kind: 'info'}));
    const wait = async () => {
      try {
        await delay(pollMs, undefined, {signal});
      } catch {
        signal.throwIfAborted();
        throw new Error('pbp_wait');
      }
    };
    async function ask(view) {
      const stop = Promise.withResolvers();
      const listen = addAbortListener(signal, () => stop.reject(signal.reason));
      try {
        return await Promise.race([stop.promise, Promise.resolve().then(() => {
          check();
          return confirmFingerprint(view, {signal});
        })]);
      } catch {
        check();
        throw new Error('pbp_confirmation_failed');
      } finally {
        listen[Symbol.dispose]();
      }
    }
    function successful(state, boot) {
      need(state.boot === boot, 'pbp_device_changed');
      need(state.event !== 'timed-out', 'pbp_timeout');
      need(state.event === 'ok', 'pbp_rejected');
    }

    let boot, proposal, psk, offerPacket, readyKey;
    let confirmed = false;
    try {
      const initial = await info();
      need(initial, 'pbp_info_unconfirmed');
      boot = initial.boot;
      successful(initial, boot);
      need(initial.phase === 'empty' && initial.proposal === 0 && initial.fingerprint === zeroId, 'pbp_device_busy');
      psk = randomBytes(32);
      offerPacket = encodePbp1Frame({kind: 'offer', boot, device, controller: hub, binding, epoch, psk});
      let state = await exchange(offerPacket);
      while (!state) {
        await wait();
        state = await info();
      }
      successful(state, boot);
      need(state.phase === 'pending' && state.proposal > 0, 'pbp_pending_required');
      const fingerprint = pbp1Fingerprint(offerPacket, state.proposal);
      offerPacket.fill(0);
      need(fingerprintMatches(state.fingerprint, fingerprint), 'pbp_fingerprint');
      proposal = Object.freeze({boot, device, proposal: state.proposal, fingerprint});
      const visible = await ask(proposal);
      check();
      need(fingerprintMatches(visible, fingerprint), 'pbp_confirmation_denied');
      confirmed = true;
      state = await exchange(encodePbp1Frame({kind: 'confirm', ...proposal}));
      for (;;) {
        if (state) {
          successful(state, boot);
          need(state.proposal === proposal.proposal && fingerprintMatches(state.fingerprint, fingerprint), 'pbp_proposal_changed');
          if (state.phase === 'active') break;
          need(state.phase === 'host-confirmed', 'pbp_confirmation_unconfirmed');
        }
        await wait();
        state = await info();
      }
      readyKey = createSecretKey(psk);
    } catch (error) {
      if (proposal && !confirmed && !signal.aborted) {
        // Cancellation is scoped to the verified Pending. A failure is resolved by the device's timeout/disconnect.
        try { await exchange(encodePbp1Frame({kind: 'cancel', ...proposal})); } catch {}
      }
      throw error;
    } finally {
      psk?.fill(0);
      offerPacket?.fill(0);
      try { await closeTransport(); } finally {
        clearTimeout(timer);
        onAbort[Symbol.dispose]();
      }
    }
    check();
    return publishNative400UsbPairing(identity, proposal, readyKey, revocation.signal);
  }

  return Object.freeze({
    start() {
      need(!running && !closing, 'pbp_used');
      return running = Promise.resolve().then(pair);
    },
    close() {
      if (!closing) {
        closing = Promise.resolve().then(async () => {
          const [transportExit] = await Promise.allSettled([closeTransport(), running]);
          if (transportExit.status === 'rejected') throw transportExit.reason;
        });
        revocation.abort(CLOSED);
        operation.abort(CLOSED);
      }
      return closing;
    }
  });
}
