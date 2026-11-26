import {createHash, randomBytes, randomUUID, verify} from 'node:crypto';
import {encodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {increment, requireThat, same, uint64} from '../core/protocol.mjs';
import {validateBootState} from './device-enrollment.mjs';
import {createBootProof, decodeBootReply, encodeBootRequest} from './device-enrollment-wire.mjs';
import {createPbp1BindingVerifier} from './native400-pbp1-binding.mjs';

const digest = point => createHash('sha256').update(point).digest('hex');
const info = encodeBootRequest(encodePbp1Frame({kind: 'binding-info', body: Buffer.alloc(0)}, {allowBinding: true}));

export function deviceKeyRotationTranscript(replacement, target, boot, reference, nonce, publicKey) {
  const counters = Buffer.alloc(20);
  counters.writeBigUInt64LE(uint64(target.epoch));
  counters.writeBigUInt64LE(uint64(boot), 8);
  counters.writeUInt32LE(reference, 16);
  return Buffer.concat([Buffer.from(replacement ? 'BINDKEY/new/v1' : 'BINDKEY/old/v1'),
    ...['device', 'controller', 'binding'].map(field => Buffer.from(target[field], 'hex')), counters, nonce, publicKey]);
}

async function signVerified(key, bytes, signal) {
  const signature = await key.signTranscript(bytes, {signal});
  signal.throwIfAborted();
  requireThat(signature instanceof Uint8Array && signature.length === 64 && verify('sha256', bytes,
    {key: createPbp1BindingVerifier(key.publicKey), dsaEncoding: 'ieee-p1363'}, signature), 'device_key_rotation_signature');
  return signature;
}

function checkKey(key, record) {
  requireThat(key?.ref === record.keyRef && key.publicKey instanceof Uint8Array && key.publicKey.length === 65 &&
    key.publicKey[0] === 4 && digest(key.publicKey) === record.target.keySha256, 'device_key_rotation_key');
  return key;
}

async function readProbe(session, signal) {
  const line = await session.exchange(info, {signal});
  signal.throwIfAborted();
  requireThat(line, 'device_key_rotation_no_usb_reply');
  const probe = decodeBootReply(line);
  requireThat(probe.kind === 'binding-status' && probe.supported && probe.state.result === 0 &&
    probe.state.phase === 2, 'device_key_rotation_binding');
  return probe;
}

function scopeMatches(state, target) {
  return state.device === target.device && state.hub === target.controller && state.binding === target.binding &&
    state.epoch === target.epoch && state.keyDigest.toString('hex') === target.keySha256.slice(0, 32);
}

async function fence(session, probe, target, signal) {
  const proof = createBootProof({mode: 'fence', probe, attempt: {attempt: randomUUID(), boot: probe.state.boot, target}});
  requireThat(proof.accept(await session.exchange(proof.line, {signal})).evidence?.kind === 'verified_bound',
    'device_key_rotation_unconfirmed');
  signal.throwIfAborted();
}

function exchange(session, operation, signal, beforeWrite) {
  const id = randomBytes(4).toString('hex');
  return session.exchangeDesktop(Buffer.from(`BINDKEY 1 ${id} ${operation}\n`), {
    prefix: '@BINDKEY ', signal, beforeWrite, match(line) {
      const fields = /^@BINDKEY 1 ([a-f0-9]{8}) (challenge [0-9]{1,20} [0-9]{1,10} [a-f0-9]{64}|committed|denied|busy|expired|storage_fault)\r?\n$/.exec(line);
      return fields?.[1] === id ? fields[2] : undefined;
    },
  });
}

/** Rotate a bound device via one trusted USB descriptor. The destination index
 * is the recovery journal. Never discard either directory while pending. */
export async function rotateDeviceBinding({source, destination, oldKeys, newKeys, openSession,
  signal = AbortSignal.timeout(45000)}) {
  signal.throwIfAborted();
  const bound = validateBootState(source.read(), {requireKeyRef: true}), current = bound.record;
  requireThat(current?.phase === 'bound', 'device_key_rotation_binding');
  let pending = validateBootState(destination.read(), {requireKeyRef: true});
  const epoch = increment(current.target.epoch);
  const key = pending.record ? checkKey(await newKeys.lookup(pending.record.keyRef, {signal}), pending.record) :
    await newKeys.prepare({device: current.target.device, signal});
  requireThat(key?.publicKey instanceof Uint8Array && key.publicKey.length === 65 && key.publicKey[0] === 4 &&
    digest(key.publicKey) !== current.target.keySha256, 'device_key_rotation_key');
  const next = {phase: 'pending', keyRef: key.ref, target: {...current.target, epoch, keySha256: digest(key.publicKey)}};
  requireThat(!pending.record || same({...pending.record, phase: 'pending'}, next), 'device_key_rotation_destination');
  await signVerified(key, Buffer.concat([Buffer.from('BINDKEY/local/v1'), randomBytes(32)]), signal);
  if (!pending.record) pending = destination.commit(pending.revision, next);
  requireThat(same({...pending.record, phase: 'pending'}, next), 'device_key_rotation_destination');

  function checkIndexes() {
    requireThat(same(source.read(), bound) && same(destination.read(), pending), 'device_key_rotation_revision');
  }

  const session = await openSession({signal});
  try {
    let probe = await readProbe(session, signal);
    if (!scopeMatches(probe.state, next.target)) {
      requireThat(pending.record.phase === 'pending' && scopeMatches(probe.state, current.target), 'device_key_rotation_binding');
      requireThat((probe.state.capabilities & 16) !== 0, 'device_key_rotation_unsupported');
      await fence(session, probe, current.target, signal);
      const old = checkKey(await oldKeys.lookup(current.keyRef, {signal}), current);
      const response = await exchange(session, 'BEGIN', signal, checkIndexes);
      const fields = /^challenge ([0-9]{1,20}) ([0-9]{1,10}) ([a-f0-9]{64})$/.exec(response ?? '');
      requireThat(fields && fields[1] === probe.state.boot, 'device_key_rotation_challenge');
      const reference = Number(fields[2]), nonce = Buffer.from(fields[3], 'hex');
      requireThat(reference > 0 && reference <= 0xffffffff && nonce.some(Boolean), 'device_key_rotation_challenge');
      const transcript = replacement => deviceKeyRotationTranscript(replacement, current.target, probe.state.boot,
        reference, nonce, key.publicKey);
      const oldSignature = await signVerified(old, transcript(false), signal);
      const newSignature = await signVerified(key, transcript(true), signal);
      const packet = Buffer.alloc(197);
      packet.writeUInt32LE(reference);
      packet.set(key.publicKey, 4);
      packet.set(oldSignature, 69);
      packet.set(newSignature, 133);
      let written = false, result;
      try {
        result = await exchange(session, 'COMMIT ' + packet.toString('base64'), signal, () => { checkIndexes(); written = true; });
        requireThat(typeof result === 'string' && result !== 'storage_fault', 'device_key_rotation_unknown');
      } catch (cause) {
        if (written) throw Object.assign(new Error('device_key_rotation_unknown', {cause}), {code: 'device_key_rotation_unknown'});
        throw cause;
      }
      requireThat(result === 'committed', 'device_key_rotation_denied');
      probe = await readProbe(session, signal);
    }
    requireThat(scopeMatches(probe.state, next.target), 'device_key_rotation_unconfirmed');
    await fence(session, probe, next.target, signal);
    checkIndexes();
    if (pending.record.phase === 'pending') destination.commit(pending.revision, {...next, phase: 'bound'});
    requireThat(same(destination.read().record, {...next, phase: 'bound'}), 'device_key_rotation_unconfirmed');
    return {verified: true};
  } finally { await session.close(); }
}
