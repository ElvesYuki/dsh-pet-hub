import {randomBytes} from 'node:crypto';
import {decodePbp1Frame, encodePbp1Frame, PBP1_FRAME_MAX} from '../core/native400-pbp1-wire.mjs';
import {digest, keys, requireThat, uint64} from '../core/protocol.mjs';
import {decodePbp1BindingStatus} from './native400-pbp1-binding.mjs';

const requestPrefix = 'VP8PAIR1 ';
const replyPrefix = '@VP8_PAIR1 ';
const maxEncoded = 4 * Math.ceil(PBP1_FRAME_MAX / 3);
const allowBinding = {allowBinding: true};
const supportedProbes = new WeakMap();
const waitingReplies = new WeakMap();
const usbNonces = new WeakMap();
const allowBootProof = {allowBootProof: true};

export const supportsUsbEnrollment = probe => supportedProbes.get(probe)?.usbEnrollment === true;

/** Standalone VP8 enrollment proposal. No transport or key storage. */
export function encodeBootRequest(packet, probe, {operation = 1, nonce} = {}) {
  const {kind, body} = decodePbp1Frame(packet, allowBinding);
  requireThat((operation === 1 || operation === 3) &&
    (kind === 'binding-info' || (kind === 'binding-challenge' && body[0] === operation) ||
    (kind === 'binding-enroll' && Buffer.from(body).readUInt32LE(0) !== 0)), 'device_boot_request');
  requireThat(kind === 'binding-info' || supportedProbes.get(probe)?.phase === 0, 'device_boot_probe_required');
  if (operation === 3) {
    requireThat(supportsUsbEnrollment(probe), 'device_usb_enrollment_unsupported');
    if (kind === 'binding-enroll') {
      const scope = usbNonces.get(nonce);
      requireThat(scope?.probe === probe && scope.reference === Buffer.from(body).readUInt32LE(0),
        'device_usb_enrollment_nonce');
      usbNonces.delete(nonce);
    }
  }
  return encodeEnvelope(packet);
}

function encodeEnvelope(packet) {
  return requestPrefix + Buffer.from(packet).toString('base64') + '\n';
}

function decodeEnvelope(line) {
  requireThat(typeof line === 'string' && line.startsWith(replyPrefix) && line.endsWith('\n') &&
    line.length <= replyPrefix.length + maxEncoded + 2, 'device_boot_envelope');
  const encoded = line.slice(replyPrefix.length, line.endsWith('\r\n') ? -2 : -1);
  requireThat(encoded.length <= maxEncoded && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded), 'device_boot_envelope');
  const bytes = Buffer.from(encoded, 'base64');
  requireThat(bytes.length <= PBP1_FRAME_MAX && bytes.toString('base64') === encoded, 'device_boot_envelope');
  return bytes;
}

export function decodeBootReply(line, {boot, reference, operation = 1, probe} = {}) {
  requireThat(operation === 1 || (operation === 3 && supportsUsbEnrollment(probe)),
    'device_usb_enrollment_unsupported');
  const {kind, body} = decodePbp1Frame(decodeEnvelope(line), allowBinding);
  if (kind === 'binding-nonce') {
    const fields = Buffer.from(body);
    const result = fields[0], nonceReference = fields.readUInt32LE(4), challenge = fields.subarray(8);
    requireThat(fields[1] === operation && fields.readUInt16LE(2) === 0 && result <= 4 &&
      (result === 0 ? nonceReference !== 0 && challenge.some(Boolean) :
        nonceReference === 0 && !challenge.some(Boolean)), 'device_boot_nonce');
    const reply = {kind, result, reference: nonceReference, challenge};
    if (operation === 3 && result === 0) usbNonces.set(reply, {probe, reference: nonceReference});
    return reply;
  }
  requireThat(kind === 'binding-status' || kind === 'binding-enrolled', 'device_boot_reply');
  const fields = Buffer.from(body);
  const state = decodePbp1BindingStatus(fields);
  const supported = (state.capabilities & 7) === 7;
  requireThat(boot === undefined || state.boot === boot, 'device_boot_scope');
  if (kind === 'binding-enrolled') {
    const usb = operation === 3;
    requireThat(supported && (!usb || (state.capabilities & 8) !== 0) &&
      state.phase === (usb ? 2 : 1) && state.result === 0 && Number.isInteger(reference) &&
      reference > 0 && fields.readUInt32LE(84) === reference, 'device_boot_scope');
    const response = {kind, supported, state, reference};
    if (!usb) waitingReplies.set(response, {boot: state.boot, device: state.device, reference});
    return response;
  }
  const response = {kind, supported, state};
  if (supported && state.result === 0) supportedProbes.set(response,
    {boot: state.boot, device: state.device, phase: state.phase, usbEnrollment: (state.capabilities & 8) !== 0});
  return response;
}

const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) && /[^0]/.test(value);

/**
 * Pin one poll/fence request to a verified USB session's probe and enrollment ticket.
 * A mismatched reply never changes the transaction. A matching reply consumes the
 * nonce even for Waiting or Fault; the next poll needs a new request.
 */
export function createBootProof({mode, probe, waiting, attempt}, {nonce = randomBytes(32)} = {}) {
  const peer = supportedProbes.get(probe);
  keys(attempt, ['attempt', 'boot', 'target']);
  const {target} = attempt;
  keys(target, ['device', 'controller', 'binding', 'epoch', 'keySha256']);
  requireThat(typeof attempt.attempt === 'string' && attempt.attempt.length > 0 && uint64(attempt.boot) > 0n &&
    [target.device, target.controller, target.binding].every(validId) && uint64(target.epoch) > 0n,
    'device_boot_proof_target');
  digest(target.keySha256);
  requireThat(peer && peer.boot === attempt.boot && peer.device === target.device, 'device_boot_proof_peer');
  requireThat(mode === 'poll' || mode === 'fence', 'device_boot_proof_mode');
  const accepted = waitingReplies.get(waiting);
  const poll = mode === 'poll';
  requireThat(poll ? accepted?.device === peer.device && accepted.boot === peer.boot : waiting === undefined,
    'device_boot_proof_reference');
  requireThat(nonce instanceof Uint8Array && nonce.length === 32 && nonce.some(Boolean), 'device_boot_proof_nonce');
  const reference = poll ? accepted.reference : 0;
  const ticket = structuredClone(attempt);
  const request = Buffer.alloc(64);
  request[0] = poll ? 0 : 1;
  request.writeBigUInt64LE(BigInt(peer.boot), 4);
  request.write(peer.device, 12, 'hex');
  request.set(nonce, 28);
  request.writeUInt32LE(reference, 60);
  let consumed = false;
  const line = encodeEnvelope(encodePbp1Frame({kind: 'vp8-binding-proof', body: request}, allowBootProof));
  return {
    line,
    accept(reply) {
      requireThat(!consumed, 'device_boot_proof_consumed');
      const {kind, body} = decodePbp1Frame(decodeEnvelope(reply), allowBootProof);
      requireThat(kind === 'vp8-binding-proof-result', 'device_boot_proof_reply');
      const fields = Buffer.from(body);
      const [result, phase, responseMode, reserved] = fields;
      requireThat(result <= 4 && phase <= 3 && reserved === 0, 'device_boot_proof_reply');
      requireThat(responseMode === request[0] && fields.readBigUInt64LE(4).toString() === peer.boot &&
        fields.toString('hex', 12, 28) === peer.device &&
        fields.subarray(100, 132).equals(request.subarray(28, 60)) && fields.readUInt32LE(132) === reference,
        'device_boot_proof_scope');
      consumed = true;
      if (result !== 0 || phase === 3) return {result, phase, evidence: null};
      if (phase === 2) {
        requireThat(fields.readBigUInt64LE(28).toString() === ticket.target.epoch &&
          fields.toString('hex', 36, 52) === ticket.target.controller &&
          fields.toString('hex', 52, 68) === ticket.target.binding &&
          fields.toString('hex', 68, 100) === ticket.target.keySha256, 'device_boot_proof_binding');
        return {result, phase, evidence: {...ticket, kind: 'verified_bound'}};
      }
      requireThat(!fields.subarray(36, 100).some(Boolean), 'device_boot_proof_reply');
      return {result, phase, evidence: !poll && phase === 0 ? {...ticket, kind: 'fenced_unbound'} : null};
    },
  };
}
