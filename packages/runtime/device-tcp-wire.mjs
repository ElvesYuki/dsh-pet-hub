import {createHash, createHmac, hkdfSync, timingSafeEqual} from 'node:crypto';
import {requireThat} from '../core/protocol.mjs';
import {decodeStatusFields, decodeStatusV2} from './device-status-wire.mjs';

export const VPL1 = Object.freeze({hello: 1, auth: 2, deviceFinish: 3, hubFinish: 4, ready: 16, control: 17,
  status: 18, statusAck: 19});
const headerBytes = 8, maxFrame = 202, magic = Buffer.from('VPL1');
const lengths = new Map([[1, 194], [2, 162], [3, 100], [4, 32], [16, 40], [17, 60], [19, 44]]);
const checkLength = (type, length, statusVersion) => requireThat(type === VPL1.status ?
  length >= (statusVersion === 2 ? 50 : 49) && length <= (statusVersion === 1 ? 111 : 112) :
  lengths.get(type) === length, 'vpl1_length');

export function vpl1Frame(type, data) {
  checkLength(type, data.length);
  const frame = Buffer.alloc(headerBytes + data.length);
  magic.copy(frame);
  frame[4] = 1;
  frame[5] = type;
  frame.writeUInt16LE(data.length, 6);
  frame.set(data, headerBytes);
  return frame;
}

/** Validate the header before assembling a packet, and retain at most one partial frame. */
export function createVpl1Framer(statusVersion) {
  const storage = Buffer.alloc(maxFrame);
  let used = 0, end = headerBytes;
  return {
    push(chunk, consume) {
      for (let at = 0; at < chunk.length;) {
        const part = chunk.subarray(at, at + end - used);
        storage.set(part, used);
        at += part.length;
        used += part.length;
        if (used !== end) continue;
        if (end === headerBytes) {
          requireThat(storage.subarray(0, 4).equals(magic) && storage[4] === 1, 'vpl1_header');
          const length = storage.readUInt16LE(6);
          checkLength(storage[5], length, statusVersion);
          end += length;
        } else {
          const frame = Buffer.from(storage.subarray(0, end));
          used = 0;
          end = headerBytes;
          if (consume(frame[5], frame) === false) return;
        }
      }
    },
    finish() { requireThat(!used, 'vpl1_truncated'); },
  };
}

export function vpl1Transcript(hello, auth) {
  return createHash('sha256').update(hello).update(auth).digest();
}

export function vpl1Keys(secret, transcript) {
  const derive = direction => Buffer.from(hkdfSync('sha256', secret, transcript, 'VPL1/' + direction, 32));
  return {fromDevice: derive('device-to-hub'), toDevice: derive('hub-to-device')};
}

export function vpl1Tag(key, label, ...parts) {
  const mac = createHmac('sha256', key).update('VPL1/' + label);
  for (const part of parts) mac.update(part);
  return mac.digest();
}

export function sealVpl1(type, counter, payload, key) {
  const frame = vpl1Frame(type, Buffer.alloc(36 + payload.length));
  frame.writeUInt32LE(counter, 8);
  frame.set(payload, 12);
  const signed = frame.subarray(0, -32);
  frame.set(vpl1Tag(key, 'record', signed), signed.length);
  return frame;
}

export function openVpl1(frame, counter, key) {
  requireThat(counter <= 0xffffffff && counter === frame.readUInt32LE(8) &&
    timingSafeEqual(vpl1Tag(key, 'record', frame.subarray(0, -32)), frame.subarray(-32)), 'vpl1_record');
  return frame.subarray(12, -32);
}

export function vpl1StatusTicket(bytes, statusVersion) {
  const v2 = statusVersion === 2;
  requireThat(v2 ? bytes.length >= 14 : bytes.length >= 13 && bytes[0] === 1, 'vpl1_status');
  const session = bytes.readUInt32LE(v2 ? 0 : 4), sequence = bytes.readUInt32LE(v2 ? 4 : 8);
  requireThat(session && sequence, 'vpl1_status');
  return {session, sequence};
}

export function decodeVpl1Status(bytes, statusVersion = 1) {
  const {session, sequence} = vpl1StatusTicket(bytes, statusVersion);
  const v2 = statusVersion === 2;
  const status = v2 ? decodeStatusV2(bytes.subarray(8)) : decodeStatusFields(bytes, 12);
  return {session, sequence, value: {schema: 1, ...status}};
}
