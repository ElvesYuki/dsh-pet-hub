export const VPC1_BYTES = 24;
export const VPC1_MAX_TTL = 30000;
export const VPC1_U32_MAX = 0xffffffff;
export const VPC1_KIND = Object.freeze({
  play: 1, ping: 2, accepted: 128, presented: 129, missing: 130, superseded: 131,
  expired: 132, pong: 133, duplicate: 134, cancelled: 135,
});
const kinds = new Set(Object.values(VPC1_KIND));
const prefix = [0x56, 0x50, 0x43, 0x31, 1];

const uint = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
const nonzero = value => uint(value, VPC1_U32_MAX) && value !== 0;
export const vpc1ActionId = value => uint(value, 65534);

function valid({kind, session, sequence, role, action, value}) {
  if (!kinds.has(kind) || !nonzero(session) || !nonzero(sequence) ||
      !vpc1ActionId(role) || !vpc1ActionId(action) || !uint(value, VPC1_U32_MAX)) return false;
  if (kind === VPC1_KIND.play) return value >= 1 && value <= VPC1_MAX_TTL;
  if (kind === VPC1_KIND.presented) return value > 0;
  if (kind === VPC1_KIND.ping || kind === VPC1_KIND.pong) return role === 0 && action === 0 && value === 0;
  return value === 0;
}

export function encodeVpc1(message) {
  if (!valid(message)) throw new Error('vpc1_frame_fields');
  const bytes = new Uint8Array(VPC1_BYTES);
  bytes.set(prefix);
  bytes[5] = message.kind;
  const view = new DataView(bytes.buffer);
  view.setUint32(8, message.session, true);
  view.setUint32(12, message.sequence, true);
  view.setUint16(16, message.role, true);
  view.setUint16(18, message.action, true);
  view.setUint32(20, message.value, true);
  return bytes;
}

export function decodeVpc1(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== VPC1_BYTES ||
      !prefix.every((byte, index) => bytes[index] === byte) || bytes[6] || bytes[7]) throw new Error('vpc1_frame_header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const message = {kind: bytes[5], session: view.getUint32(8, true), sequence: view.getUint32(12, true),
    role: view.getUint16(16, true), action: view.getUint16(18, true), value: view.getUint32(20, true)};
  if (!valid(message)) throw new Error('vpc1_frame_fields');
  return message;
}

/** Deliver complete frames synchronously. A false consumer result stops the connection. */
export function createVpc1Framer() {
  const frame = new Uint8Array(VPC1_BYTES);
  let used = 0;
  return {
    push(chunk, consume) {
      for (let offset = 0; offset < chunk.length;) {
        const count = Math.min(frame.length - used, chunk.length - offset);
        frame.set(chunk.subarray(offset, offset + count), used);
        offset += count;
        used += count;
        if (used === frame.length) {
          used = 0;
          if (consume(decodeVpc1(frame)) === false) return false;
        }
      }
      return true;
    },
    finish() { if (used) throw new Error('vpc1_truncated'); },
  };
}
