import {createHash, createHmac, createPublicKey, createSecretKey, randomBytes, timingSafeEqual, verify} from 'node:crypto';
import {addAbortListener} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {decodePbp1Frame, encodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {pbp1Fingerprint, publishNative400UsbPairing} from './native400-usb-pairing.mjs';

const wire = {allowBinding: true};
const owned = new WeakSet();
const sha = value => createHash('sha256').update(value).digest();
const hex = value => Buffer.from(value, 'hex');
const zero = value => value.every(byte => byte === 0);
const domain = operation => Buffer.from(`PBP1/persist/${operation}/v1`, 'ascii');
const statusErrors = ['ok', 'denied', 'busy', 'expired', 'storage_fault'];
const validId = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value) && /[^0]/.test(value);

function need(condition, code) {
  if (!condition) throw new Error(code);
}

export function createPbp1BindingVerifier(keyBytes) {
  return createPublicKey({format: 'jwk', key: {kty: 'EC', crv: 'P-256',
    x: keyBytes.subarray(1, 33).toString('base64url'), y: keyBytes.subarray(33, 65).toString('base64url')}});
}

export function pbp1BindingTranscript(operation, {device, hub, binding, epoch}, boot, challenge, payload) {
  const counters = Buffer.alloc(16);
  counters.writeBigUInt64LE(BigInt(epoch));
  counters.writeBigUInt64LE(BigInt(boot), 8);
  return Buffer.concat([domain(operation === 1 ? 'enroll' : 'resume'), hex(device), hex(hub),
    hex(binding), counters, challenge, payload]);
}

export function pbp1EnrollmentBody({hub, binding, epoch}, reference, publicKey, signature) {
  const request = Buffer.alloc(173);
  request.writeUInt32LE(reference);
  request.set(hex(hub), 4);
  request.set(hex(binding), 20);
  request.writeBigUInt64LE(BigInt(epoch), 36);
  request.set(publicKey, 44);
  request.set(signature, 109);
  return request;
}

export function decodePbp1BindingStatus(body) {
  need(Buffer.isBuffer(body) && (body.length === 84 || body.length === 88), 'pbp_binding_state');
  const [result, phase] = body;
  const capabilities = body.readUInt16LE(2);
  const boot = body.readBigUInt64LE(4).toString();
  const device = body.toString('hex', 12, 28);
  const epoch = body.readBigUInt64LE(28).toString();
  const hub = body.toString('hex', 36, 52), binding = body.toString('hex', 52, 68);
  const keyDigest = body.subarray(68, 84);
  need(statusErrors[result] && phase <= 3 && boot !== '0' && validId(device) &&
    ((phase === 3) === (result === 4)) && (phase !== 3 || epoch === '0') &&
    (phase === 2 ? epoch !== '0' && validId(hub) && validId(binding) : zero(body.subarray(36, 84))), 'pbp_binding_state');
  return {result, phase, capabilities, boot, device, epoch, hub, binding, keyDigest};
}

function activeMatches(body, identity, boot, transcript, psk) {
  const result = body[0], proposal = body.readUInt32LE(4);
  need(statusErrors[result] && zero(body.subarray(1, 4)), 'pbp_binding_active');
  if (result) {
    need(zero(body.subarray(4)), 'pbp_binding_active');
    return true;
  }
  need(proposal !== 0, 'pbp_binding_active');
  const offer = encodePbp1Frame({kind: 'offer', ...identity, controller: identity.hub, boot, psk});
  try {
    const fingerprint = hex(pbp1Fingerprint(offer, proposal));
    const tag = createHmac('sha256', psk).update(domain('active')).update(sha(transcript))
      .update(body.subarray(4, 8)).update(fingerprint).digest();
    return timingSafeEqual(body.subarray(8, 24), fingerprint) && timingSafeEqual(body.subarray(24), tag);
  } finally { offer.fill(0); }
}

/** One explicitly enabled USB transaction with a trusted signer and binding intent.
 * enroll requires the split reply capability. The caller owns durable intent and key storage.
 * signTranscript(bytes, {signal}) returns a 64-byte P-256 P1363 signature.
 * start publishes a PMA1 RAM provider only after USB close. close revokes it.
 */
export function createNative400PersistentUsbPairing({enabled = false, transport, identity: input,
  publicKey, signTranscript, enroll = false, timeoutMs = 25000, pollMs = 200} = {}) {
  need(enabled === true, 'pbp_binding_disabled');
  const {device, hub, binding, epoch} = input ?? {};
  need([device, hub, binding].every(validId) && typeof epoch === 'string' && /^[1-9][0-9]{0,19}$/.test(epoch) &&
    BigInt(epoch) <= 0xffffffffffffffffn, 'pbp_binding_identity');
  need(publicKey instanceof Uint8Array && publicKey.length === 65 && publicKey[0] === 4 &&
    typeof signTranscript === 'function' && typeof enroll === 'boolean', 'pbp_binding_signer');
  need(transport && typeof transport.exchange === 'function' && typeof transport.close === 'function' &&
    !owned.has(transport), 'pbp_binding_transport');
  need(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000 && Number.isInteger(pollMs) &&
    pollMs > 0 && pollMs <= 1000, 'pbp_binding_timing');
  const identity = Object.freeze({device, hub, binding, epoch});
  const keyBytes = Buffer.from(publicKey);
  const verifier = createPbp1BindingVerifier(keyBytes);
  const keyDigest = sha(keyBytes).subarray(0, 16);
  const stop = new AbortController();
  owned.add(transport);
  let running, usbExit;
  const closeUsb = () => usbExit ??= Promise.resolve().then(() => transport.close());

  async function run() {
    const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(timeoutMs)]);
    const abort = addAbortListener(signal, () => { void closeUsb().catch(() => {}); });
    let boot, splitEnroll, psk, scope, key;
    async function exchange(kind, expected, body = Buffer.alloc(0), accept) {
      signal.throwIfAborted();
      const packet = encodePbp1Frame({kind, body}, wire);
      try {
        const reply = await transport.exchange(packet, {signal, accept});
        signal.throwIfAborted();
        need(reply, 'pbp_binding_reply_unknown');
        const decoded = decodePbp1Frame(reply, wire);
        need(decoded.kind === expected && (!accept || accept(decoded)), 'pbp_binding_reply_scope');
        return Buffer.from(decoded.body);
      } finally { packet.fill(0); }
    }
    function checked(reply) {
      const state = decodePbp1BindingStatus(reply);
      need(state.device === device && (!boot || state.boot === boot), 'pbp_binding_device');
      need(state.capabilities & 1, 'pbp_binding_unsupported');
      need(!splitEnroll || (state.capabilities & 2), 'pbp_binding_enroll_reply_unsupported');
      need(!state.result, `pbp_binding_${statusErrors[state.result]}`);
      return state;
    }
    function matches(state) {
      need(state.phase === 2 && state.epoch === epoch && state.hub === hub && state.binding === binding &&
        timingSafeEqual(state.keyDigest, keyDigest), 'pbp_binding_mismatch');
    }
    const read = async () => checked(await exchange('binding-info', 'binding-status', undefined, ({body}) => {
      const state = decodePbp1BindingStatus(Buffer.from(body));
      return state.device === device && (!boot || state.boot === boot);
    }));

    async function proof(operation, payload) {
      let nonce, result, reference;
      do {
        nonce = await exchange('binding-challenge', 'binding-nonce', Buffer.from([operation]),
          ({body}) => body[1] === operation);
        result = nonce[0];
        reference = nonce.readUInt32LE(4);
        need(statusErrors[result] && zero(nonce.subarray(2, 4)) &&
          (result ? zero(nonce.subarray(4)) : reference !== 0 && !zero(nonce.subarray(8))), 'pbp_binding_nonce');
        if (result === 2) await delay(1000, undefined, {signal});
      } while (result === 2);
      need(!result, `pbp_binding_${statusErrors[result]}`);
      const transcript = pbp1BindingTranscript(operation, identity, boot, nonce.subarray(8), payload);
      const signature = await signTranscript(Buffer.from(transcript), {signal});
      signal.throwIfAborted();
      need(signature instanceof Uint8Array && signature.length === 64 &&
        verify('sha256', transcript, {key: verifier, dsaEncoding: 'ieee-p1363'}, signature), 'pbp_binding_signature');
      return {reference, transcript, signature};
    }

    try {
      let state = await read();
      boot = state.boot;
      splitEnroll = Boolean(state.capabilities & 2);
      if (enroll && state.phase === 0) {
        need(state.capabilities & 2, 'pbp_binding_enroll_reply_unsupported');
        need(BigInt(state.epoch) + 1n === BigInt(epoch), 'pbp_binding_mismatch');
        const {reference, signature} = await proof(1, keyBytes);
        const request = pbp1EnrollmentBody(identity, reference, keyBytes, signature);
        const response = checked(await exchange('binding-enroll', 'binding-enrolled', request,
          ({body}) => Buffer.from(body).readUInt32LE(84) === reference));
        need(response.phase === 1 && response.epoch === state.epoch, 'pbp_binding_enroll_unconfirmed');
        do {
          await delay(pollMs, undefined, {signal});
          state = await read();
        } while (state.phase === 1 && state.epoch === response.epoch);
      }
      matches(state);
      psk = randomBytes(32);
      const {reference, transcript, signature} = await proof(2, sha(psk));
      const request = Buffer.alloc(100);
      let active;
      try {
        request.writeUInt32LE(reference);
        request.set(psk, 4);
        request.set(signature, 36);
        active = await exchange('binding-resume', 'binding-active', request,
          ({body}) => activeMatches(Buffer.from(body), identity, boot, transcript, psk));
      } finally { request.fill(0); }
      need(!active[0], `pbp_binding_${statusErrors[active[0]]}`);
      scope = Object.freeze({device, boot, proposal: active.readUInt32LE(4), fingerprint: active.toString('hex', 8, 24)});
      key = createSecretKey(psk);
    } finally {
      psk?.fill(0);
      try { await closeUsb(); } finally { abort[Symbol.dispose](); }
    }
    signal.throwIfAborted();
    return publishNative400UsbPairing(identity, scope, key, stop.signal);
  }

  return Object.freeze({
    start() {
      need(!running && !stop.signal.aborted, 'pbp_binding_used');
      return running = Promise.resolve().then(run);
    },
    async close() {
      stop.abort(new Error('pbp_binding_closed'));
      const [closed] = await Promise.allSettled([closeUsb(), running]);
      if (closed.status === 'rejected') throw closed.reason;
    }
  });
}
