import {crc32} from './crc32.mjs';

export const MEDIA_PAYLOAD_MAX = 4096;
export const MEDIA_BLOCK_MAX = MEDIA_PAYLOAD_MAX - 20;
export const MEDIA_HEADER_BYTES = 16;
const kinds = ['hello', 'begin', 'ready', 'data', 'ack', 'end', 'cancel', 'query', 'result'];
const sizes = [32, 124, 16, null, 20, 20, 16, 16, 68];
const outcomes = ['saved', 'cancelled', 'failed', 'unknown'];
const zeroSha = '0'.repeat(64);

function need(condition) {
  if (!condition) throw new Error('media_invalid_frame');
}

function hex(value, bytes) {
  need(typeof value === 'string' && value.length === bytes * 2 && /^[a-f0-9]+$/.test(value));
  return Uint8Array.from(value.match(/../g), pair => Number.parseInt(pair, 16));
}

function u64(value) {
  need(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value));
  const number = BigInt(value);
  need(number <= 0xffffffffffffffffn);
  return number;
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function put64(bytes, values, start = 0) {
  const fields = view(bytes);
  values.forEach((value, index) => fields.setBigUint64(start + index * 8, u64(value), true));
}

function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function uint(value, max) {
  need(Number.isSafeInteger(value) && value >= 0 && value <= max);
  return value;
}

function checksum(header, payload) {
  const covered = new Uint8Array(12 + payload.length);
  covered.set(header.subarray(0, 12));
  covered.set(payload, 12);
  return crc32(covered);
}

export function mediaHeader(header) {
  need(header instanceof Uint8Array && header.length === MEDIA_HEADER_BYTES &&
    [80, 84, 77, 49].every((byte, i) => header[i] === byte));
  const fields = view(header);
  const type = header[5] - 1;
  const length = fields.getUint32(8, true);
  need(header[4] === 1 && type >= 0 && type < kinds.length && fields.getUint16(6, true) === 0);
  need(length <= MEDIA_PAYLOAD_MAX && (kinds[type] === 'data' ? length > 20 : length === sizes[type]));
  return {kind: kinds[type], length};
}

export function encodeMediaFrame(message) {
  const type = kinds.indexOf(message.kind);
  need(type >= 0);
  if (message.kind === 'data') {
    need(message.data instanceof Uint8Array && message.data.length > 0 && message.data.length <= MEDIA_BLOCK_MAX);
  }
  const payload = new Uint8Array(sizes[type] ?? (20 + message.data.length));
  const fields = view(payload);
  if (message.kind === 'hello') {
    put64(payload, [message.boot, message.root, message.generation1, message.generation11]);
  } else {
    payload.set(hex(message.job, 16));
    switch (message.kind) {
      case 'begin':
        put64(payload, [message.boot, message.root, message.generation], 16);
        fields.setUint16(40, uint(message.action, 0xffff), true);
        fields.setUint16(42, uint(message.frames, 0xffff), true);
        fields.setUint32(44, uint(message.bytes, 0xffffffff), true);
        [400, 400, 24, 1, 12, 20].forEach((n, i) => fields.setUint16(48 + i * 2, n, true));
        payload.set(hex(message.sha256, 32), 60);
        payload.set(hex(message.namespace, 32), 92);
        break;
      case 'data':
        fields.setUint32(16, uint(message.offset, 0xffffffff), true);
        payload.set(message.data, 20);
        break;
      case 'ack':
      case 'end':
        fields.setUint32(16, uint(message.bytes, 0xffffffff), true);
        break;
      case 'result':
        need(outcomes.includes(message.status));
        payload[16] = outcomes.indexOf(message.status) + 1;
        put64(payload, [message.root ?? '0', message.generation ?? '0'], 20);
        payload.set(hex(message.sha256 ?? zeroSha, 32), 36);
        break;
    }
  }
  const frame = new Uint8Array(MEDIA_HEADER_BYTES + payload.length);
  const header = frame.subarray(0, MEDIA_HEADER_BYTES);
  header.set([80, 84, 77, 49]);
  header[4] = 1;
  header[5] = type + 1;
  view(header).setUint32(8, payload.length, true);
  mediaHeader(header);
  view(header).setUint32(12, checksum(header, payload), true);
  frame.set(payload, MEDIA_HEADER_BYTES);
  return frame;
}

export function decodeMediaFrame(header, payload) {
  const {kind, length} = mediaHeader(header);
  need(payload instanceof Uint8Array && payload.length === length &&
    view(header).getUint32(12, true) === checksum(header, payload));
  const fields = view(payload);
  const number = offset => fields.getBigUint64(offset, true).toString();
  if (kind === 'hello') {
    return {kind, boot: number(0), root: number(8), generation1: number(16), generation11: number(24)};
  }
  const message = {kind, job: toHex(payload.subarray(0, 16))};
  switch (kind) {
    case 'begin':
      need([400, 400, 24, 1, 12, 20].every((n, i) => fields.getUint16(48 + i * 2, true) === n));
      return {...message, boot: number(16), root: number(24), generation: number(32),
        action: fields.getUint16(40, true), frames: fields.getUint16(42, true), bytes: fields.getUint32(44, true),
        sha256: toHex(payload.subarray(60, 92)), namespace: toHex(payload.subarray(92))};
    case 'data':
      return {...message, offset: fields.getUint32(16, true), data: payload.subarray(20)};
    case 'ack':
    case 'end':
      return {...message, bytes: fields.getUint32(16, true)};
    case 'result': {
      const status = outcomes[payload[16] - 1];
      const root = number(20), generation = number(28), sha256 = toHex(payload.subarray(36));
      need(status && payload.subarray(17, 20).every(n => n === 0));
      need(status === 'saved' || (root === '0' && generation === '0' && sha256 === zeroSha));
      return {...message, status, root, generation, sha256};
    }
    default:
      return message;
  }
}
