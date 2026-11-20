import {requireThat} from '../core/protocol.mjs';

const flows = ['standby', 'charging', 'discharging', 'unknown'];
const phases = ['trickle', 'precharge', 'cc', 'cv', 'full', 'idle', 'unknown'];
const touches = ['unknown', 'up', 'down'];
const validStatus = ok => requireThat(ok, 'vpl1_status');

const expectedLength = (prefix, size, flags) =>
  prefix + size + (flags & 1 ? 8 : 0) + (flags & 2 ? 6 : 0) + (flags & 4 ? 18 : 0);

/** Decode the common version and optional reading fields. */
export function decodeStatusFields(bytes, prefix) {
  const [, slot, flags, size] = bytes;
  validStatus(slot < 2 && flags < 8 && size >= 1 && size <= 31 && bytes.length === expectedLength(prefix, size, flags));
  const version = bytes.toString('latin1', prefix, prefix + size);
  validStatus(/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version));
  let at = prefix + size;
  let battery = null, touch = null, motion = null;
  if (flags & 1) {
    const [present, usbPower, percent, flow, phase, reserved] = bytes.subarray(at, at + 6);
    const mv = bytes.readUInt16LE(at + 6);
    validStatus(present <= 1 && usbPower <= 1 && reserved === 0 && (present ?
      (percent <= 100 || percent === 255) && flow < flows.length && phase < phases.length && mv <= 8191 :
      percent === 255 && flow === 255 && phase === 255 && mv === 0));
    battery = {present: Boolean(present), usbPower: Boolean(usbPower), percent: percent === 255 ? null : percent,
      flow: flows[flow] ?? null, phase: phases[phase] ?? null, mv: mv || null};
    at += 8;
  }
  if (flags & 2) {
    const state = touches[bytes[at]], x = bytes.readUInt16LE(at + 2), y = bytes.readUInt16LE(at + 4);
    validStatus(state && bytes[at + 1] === 0 && ((x <= 465 && y <= 465) || (x === 65535 && y === 65535)));
    touch = {state, last: x === 65535 ? null : [x, y]};
    at += 6;
  }
  if (flags & 4) {
    const accelerationMg = [0, 2, 4].map(offset => bytes.readInt16LE(at + offset));
    const rotationMdps = [6, 10, 14].map(offset => bytes.readInt32LE(at + offset));
    validStatus(accelerationMg.every(v => Math.abs(v) <= 4000) && rotationMdps.every(v => Math.abs(v) <= 256000));
    motion = {accelerationMg, rotationMdps};
  }
  const sensors = touch || motion ? {touch: touch ?? {state: 'unknown', last: null}, motion} : null;
  return {version, slot: 'ota_' + slot, battery, sensors};
}

/** Shared Status v2 payload for USB and authenticated VPL1. */
export function decodeStatusV2(bytes) {
  validStatus(bytes[0] === 2 && bytes.length >= 6 && bytes.length <= 68 && (bytes[4] & ~3) === 0);
  return {...decodeStatusFields(bytes, 5), busy: Boolean(bytes[4] & 1), selected: Boolean(bytes[4] & 2)};
}
