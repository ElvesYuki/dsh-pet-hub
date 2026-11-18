import {createHash, createHmac, hkdfSync, KeyObject, randomBytes, timingSafeEqual} from 'node:crypto';
import {addAbortListener} from 'node:events';
import {decodeMediaFrame, encodeMediaFrame, MEDIA_HEADER_BYTES, MEDIA_PAYLOAD_MAX} from '../core/native400-tcp-media-wire.mjs';

const MAGIC = Buffer.from('PMA1');
const INIT = 1, CHALLENGE = 2, FINISH = 3, GRANT = 16, PTM = 17;
const HEADER = 16, TAG = 32, MAX_RECORDS = 2048, MAX_WORK_MS = 30000;
const recordMax = MEDIA_HEADER_BYTES + MEDIA_PAYLOAD_MAX;

function requireAuth(condition, message = 'media_auth_rejected') {
  if (!condition) throw new Error(message);
}

function hex(value, bytes) {
  requireAuth(typeof value === 'string' && value.length === bytes * 2 && /^[0-9a-f]+$/.test(value));
  return Buffer.from(value, 'hex');
}

function bindingBytes({device, hub, binding, epoch}) {
  requireAuth(typeof epoch === 'string' && /^[1-9][0-9]{0,19}$/.test(epoch) && BigInt(epoch) <= 0xffffffffffffffffn);
  const revision = Buffer.alloc(8);
  revision.writeBigUInt64LE(BigInt(epoch));
  return Buffer.concat([hex(device, 16), hex(hub, 16), hex(binding, 16), revision]);
}

export function mediaAuthPairing(pairing) {
  requireAuth(pairing && typeof pairing.acquire === 'function' && pairing.identity, 'media_auth_pairing');
  const {device, hub, binding, epoch} = pairing.identity;
  const identity = Object.freeze({device, hub, binding, epoch});
  return Object.freeze({identity, bytes: bindingBytes(identity), boot: pairing.boot, acquire: pairing.acquire});
}

function header(type, sequence, length) {
  const bytes = Buffer.alloc(HEADER);
  MAGIC.copy(bytes);
  bytes[4] = 1;
  bytes[5] = type;
  bytes.writeUInt32LE(sequence, 8);
  bytes.writeUInt32LE(length, 12);
  return bytes;
}

function payloadLength(prefix, type, sequence) {
  requireAuth(prefix.length === HEADER && prefix.subarray(0, 4).equals(MAGIC) && prefix[4] === 1 &&
    prefix[5] === type && prefix.readUInt16LE(6) === 0 && prefix.readUInt32LE(8) === sequence);
  return prefix.readUInt32LE(12);
}

function hmac(key, ...parts) {
  const digest = createHmac('sha256', key);
  for (const part of parts) digest.update(part);
  return digest.digest();
}

function authKeys(key, transcript) {
  const derive = label => Buffer.from(hkdfSync('sha256', key, transcript, `PMA1/1/${label}`, 32));
  return ['hub/proof', 'device/proof', 'hub/record', 'device/record'].map(derive);
}

function permittedSend(mode, previous, kind) {
  if (mode === 'query') return previous === null && kind === 'query';
  if (previous === 'grant') return kind === 'begin';
  if (previous === 'end') return kind === 'cancel';
  return ['begin', 'data'].includes(previous) && ['data', 'end', 'cancel'].includes(kind);
}

function permittedReceive(mode, previous, kind) {
  if (previous === null) return kind === 'hello';
  if (mode === 'query') return previous === 'hello' && kind === 'result';
  if (previous === 'hello') return kind === 'ready' || kind === 'result';
  return ['ready', 'ack'].includes(previous) && ['ack', 'result'].includes(kind);
}

/** Adopt the sender's already-owned bounded socket I/O for one PMA1 connection. */
export async function authenticateMediaLoopback(io, {pairing, mode, signal, checkDeadline, deadline, tighten, invalidate, authorize, source}) {
  const initHeader = await io.read(HEADER, signal);
  requireAuth(payloadLength(initHeader, INIT, 0) === 96);
  const init = await io.read(96, signal);
  const startedAt = performance.now();
  checkDeadline();
  requireAuth(init.subarray(0, 56).equals(pairing.bytes) && init[56] === (mode === 'repair' ? 1 : 2) &&
    init.subarray(57, 64).every(byte => byte === 0), 'media_auth_binding');
  let lease;
  try {
    lease = pairing.acquire(pairing.identity);
  } catch {
    throw new Error('media_auth_pairing');
  }
  requireAuth(lease?.key instanceof KeyObject && lease.key.type === 'secret' && lease.key.symmetricKeySize === 32 &&
    lease.revoked instanceof AbortSignal, 'media_auth_pairing');
  const revoked = lease.revoked;
  requireAuth(!revoked.aborted, 'media_auth_revoked');
  const revocation = addAbortListener(revoked, () => invalidate(new Error('media_auth_revoked')));
  let keys = [];
  function dispose() {
    revocation[Symbol.dispose]();
    for (const key of keys) key.fill(0);
  }
  try {
    const challenge = header(CHALLENGE, 0, 64);
    const nonce = randomBytes(32);
    const transcript = createHash('sha256').update(initHeader).update(init).update(challenge).update(nonce).digest();
    keys = authKeys(lease.key, transcript);
    lease = null;
    const [hubProof, deviceProof, sendKey, receiveKey] = keys;
    checkDeadline();
    await io.write(Buffer.concat([challenge, nonce, hmac(hubProof, transcript)]));
    hubProof.fill(0);
    const finish = await io.read(HEADER, signal);
    requireAuth(payloadLength(finish, FINISH, 0) === TAG);
    const proof = await io.read(TAG, signal);
    checkDeadline();
    requireAuth(timingSafeEqual(proof, hmac(deviceProof, transcript)));
    deviceProof.fill(0);

    let sendSeq = 0, receiveSeq = 0;
    let sent = null, received = null, pendingHeader = null;
    let approvedBegin = null;
    function writeRecord(type, body, kind, onAttempt) {
      checkDeadline();
      requireAuth(sendSeq < MAX_RECORDS);
      const prefix = header(type, ++sendSeq, body.length);
      const tag = hmac(sendKey, transcript, prefix, body);
      sent = kind;
      onAttempt?.();
      return io.write(Buffer.concat([prefix, body, tag]));
    }
    return {
      async authorize(begin, uploadSignal) {
        requireAuth(mode === 'repair' && sent === null && received === 'hello', 'media_auth_approval');
        const bytes = Buffer.from(encodeMediaFrame(begin));
        const beginSha = createHash('sha256').update(bytes).digest();
        const request = Object.freeze({purpose: 'repair', pairing: pairing.identity,
          begin: Object.freeze({...begin}), beginSha: beginSha.toString('hex'), ...source, deadline: deadline()});
        let decision;
        checkDeadline();
        try {
          decision = authorize(request);
        } catch {
          throw new Error('media_auth_approval');
        }
        uploadSignal.throwIfAborted();
        requireAuth(decision?.request === request && Number.isFinite(decision.expiresAt) &&
          typeof decision.id === 'string' && /^[0-9a-f]{32}$/.test(decision.id) && /[^0]/.test(decision.id), 'media_auth_approval');
        const workMs = Math.floor(Math.min(MAX_WORK_MS, decision.expiresAt - startedAt, deadline() - startedAt));
        requireAuth(workMs >= 1 && performance.now() < startedAt + workMs, 'media_auth_approval');
        const span = Buffer.alloc(4);
        span.writeUInt32LE(workMs);
        tighten(startedAt + workMs);
        approvedBegin = bytes;
        // Once this write is attempted neither the session nor the job can issue another GRANT.
        await writeRecord(GRANT, Buffer.concat([hex(decision.id, 16), beginSha, hex(source.manifestSha, 32),
          hex(source.indexSha, 32), span]), 'grant');
      },
      send(frame, onAttempt) {
        requireAuth(permittedSend(mode, sent, frame.kind));
        const bytes = Buffer.from(encodeMediaFrame(frame));
        if (frame.kind === 'begin') requireAuth(approvedBegin?.equals(bytes), 'media_auth_approval');
        return writeRecord(PTM, bytes, frame.kind, onAttempt);
      },
      async receive(readSignal) {
        checkDeadline();
        requireAuth(receiveSeq < MAX_RECORDS);
        pendingHeader ??= await io.read(HEADER, readSignal);
        const length = payloadLength(pendingHeader, PTM, receiveSeq + 1);
        requireAuth(length >= 32 && length <= recordMax);
        const tail = await io.read(length + TAG, readSignal);
        checkDeadline();
        const body = tail.subarray(0, length);
        requireAuth(timingSafeEqual(tail.subarray(length), hmac(receiveKey, transcript, pendingHeader, body)));
        const frame = decodeMediaFrame(body.subarray(0, MEDIA_HEADER_BYTES), body.subarray(MEDIA_HEADER_BYTES));
        requireAuth(permittedReceive(mode, received, frame.kind));
        pendingHeader = null;
        ++receiveSeq;
        received = frame.kind;
        return frame;
      },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
