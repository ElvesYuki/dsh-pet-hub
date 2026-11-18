import {crc32} from './crc32.mjs';

export const PBP1_HEADER_BYTES = 16;
export const PBP1_FRAME_MAX = 196;
const magic = [80, 66, 80, 49];
const layouts = new Map([[1, ['info', 0]], [2, ['offer', 96]], [3, ['confirm', 28]],
  [4, ['cancel', 28]], [5, ['lan-arm', 180]], [128, ['state', 48]]]);
const bindingLayouts = new Map([[6, ['binding-info', 0]], [7, ['binding-challenge', 1]],
  [8, ['binding-enroll', 173]], [9, ['binding-resume', 100]], [129, ['binding-status', 84]],
  [130, ['binding-nonce', 40]], [131, ['binding-active', 56]], [132, ['binding-enrolled', 88]]]);
const vp8ProofLayouts = new Map([[10, ['vp8-binding-proof', 64]], [133, ['vp8-binding-proof-result', 136]]]);
const phases = ['empty', 'pending', 'host-confirmed', 'active'];
const events = ['ok', 'rejected', 'timed-out'];

function need(condition) {
  if (!condition) throw new Error('pbp_invalid_frame');
}

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

function putId(body, offset, value) {
  need(typeof value === 'string' && /^[0-9a-f]{32}$/.test(value));
  for (let i = 0; i < 16; i++) body[offset + i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
}

function u64(value) {
  need(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value));
  const number = BigInt(value);
  need(number <= 0xffffffffffffffffn);
  return number;
}

function putProposal(fields, offset, number) {
  need(Number.isInteger(number) && number >= 0 && number <= 0xffffffff);
  fields.setUint32(offset, number, true);
}

function* crcInput(prefix, body) {
  yield* prefix.subarray(0, 12);
  yield* body;
}

/** Inspect one complete fixed-size header before collecting its body. */
export function pbp1Header(prefix, {allowBinding = false, allowVp8BootProof = false} = {}) {
  need(prefix instanceof Uint8Array && prefix.length === PBP1_HEADER_BYTES &&
    magic.every((byte, i) => byte === prefix[i]) && prefix[4] === 1 && prefix[6] === 0 && prefix[7] === 0);
  const type = prefix[5];
  const layout = layouts.get(type) ?? (allowBinding ? bindingLayouts.get(type) : undefined) ??
    (allowVp8BootProof ? vp8ProofLayouts.get(type) : undefined);
  need(layout && view(prefix).getUint32(8, true) === layout[1]);
  return {kind: layout[0], length: layout[1]};
}

/** Encode a PBP1 frame. An OFFER result contains the PSK and is caller-owned. */
export function encodePbp1Frame(frame, {allowBinding = false, allowVp8BootProof = false} = {}) {
  const {kind} = frame;
  const entry = [...layouts, ...(allowBinding ? bindingLayouts : []), ...(allowVp8BootProof ? vp8ProofLayouts : [])]
    .find(([, layout]) => layout[0] === kind);
  need(entry);
  const [type, [, length]] = entry;
  const packet = new Uint8Array(PBP1_HEADER_BYTES + length);
  const prefix = packet.subarray(0, PBP1_HEADER_BYTES);
  const body = packet.subarray(PBP1_HEADER_BYTES);
  const fields = view(body);
  if (bindingLayouts.has(type) || vp8ProofLayouts.has(type) || kind === 'lan-arm') {
    need(frame.body instanceof Uint8Array && frame.body.length === length);
    body.set(frame.body);
  } else if (kind !== 'info') fields.setBigUint64(0, u64(frame.boot), true);
  switch (kind) {
    case 'offer':
      putId(body, 8, frame.device);
      putId(body, 24, frame.controller);
      putId(body, 40, frame.binding);
      fields.setBigUint64(56, u64(frame.epoch), true);
      need(frame.psk instanceof Uint8Array && frame.psk.length === 32);
      body.set(frame.psk, 64);
      break;
    case 'confirm':
    case 'cancel':
      putProposal(fields, 8, frame.proposal);
      putId(body, 12, frame.fingerprint);
      break;
    case 'state': {
      putId(body, 8, frame.device);
      putProposal(fields, 24, frame.proposal);
      putId(body, 28, frame.fingerprint);
      const phase = phases.indexOf(frame.phase), event = events.indexOf(frame.event);
      need(phase >= 0 && event >= 0);
      body[44] = phase;
      body[45] = event;
      break;
    }
  }
  prefix.set(magic);
  prefix[4] = 1;
  prefix[5] = type;
  const header = view(prefix);
  header.setUint32(8, length, true);
  header.setUint32(12, crc32(crcInput(prefix, body)), true);
  return packet;
}

/** Decode exactly one complete frame. The OFFER PSK is a view of input bytes. */
export function decodePbp1Frame(packet, options) {
  need(packet instanceof Uint8Array && packet.length >= PBP1_HEADER_BYTES);
  const prefix = packet.subarray(0, PBP1_HEADER_BYTES);
  const {kind, length} = pbp1Header(prefix, options);
  const body = packet.subarray(PBP1_HEADER_BYTES);
  need(body.length === length && view(prefix).getUint32(12, true) === crc32(crcInput(prefix, body)));
  if (kind === 'info') return {kind};
  if (kind === 'lan-arm' || bindingLayouts.has(prefix[5]) || vp8ProofLayouts.has(prefix[5])) return {kind, body};
  const fields = view(body);
  const boot = fields.getBigUint64(0, true).toString();
  const id = offset => toHex(body.subarray(offset, offset + 16));
  if (kind === 'offer') return {kind, boot, device: id(8), controller: id(24), binding: id(40),
    epoch: fields.getBigUint64(56, true).toString(), psk: body.subarray(64)};
  if (kind !== 'state') return {kind, boot, proposal: fields.getUint32(8, true), fingerprint: id(12)};
  const phase = phases[body[44]], event = events[body[45]];
  need(phase && event && body[46] === 0 && body[47] === 0);
  return {kind, boot, device: id(8), proposal: fields.getUint32(24, true), fingerprint: id(28), phase, event};
}
