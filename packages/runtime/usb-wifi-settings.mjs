import {bounded, keys, requireThat as need, uint64} from '../core/protocol.mjs';
import {exchangeDesktopSettings} from './usb-settings-exchange.mjs';

export const networkBodyLimit = 1024;
const operations = {info: 'ok', set: 'saved', clear: 'cleared'};
const selector = ['operation', 'instanceId', 'revision'];
const fields = ['ssid', 'timeHost', 'weatherHost', 'utcMinutes', 'latitudeE4', 'longitudeE4'];
const host = /^[A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*(?:\.[A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*)*(?![\s\S])/;
const validHost = value => typeof value === 'string' && value.length <= 63 && host.test(value);
const hex = Buffer.from('0123456789abcdef');

/** Decode the authorized request while leaving the secret as a view owned by the caller. */
export function decodeNetworkBody(bytes) {
  need(bytes.length >= 3 && bytes.length <= networkBodyLimit);
  const length = bytes.readUInt16BE(0);
  need(length > 0 && length <= bytes.length - 2);
  const input = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(2, 2 + length)));
  const password = bytes.subarray(2 + length);
  keys(input, input?.operation === 'set' ? [...selector, ...fields] : selector);
  need(Object.hasOwn(operations, input.operation) && typeof input.instanceId === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(input.instanceId));
  uint64(input.revision);
  if (input.operation === 'set') {
    need(typeof input.ssid === 'string' && input.ssid.length > 0 && !input.ssid.includes('\0') &&
      input.ssid.isWellFormed() && Buffer.byteLength(input.ssid) <= 32);
    need(password.length === 0 || (password.length >= 8 && password.length <= 63 &&
      password.every(byte => byte >= 32 && byte <= 126)));
    need(validHost(input.timeHost));
    need(input.weatherHost === '' || validHost(input.weatherHost));
    bounded(input.utcMinutes, -720, 840);
    bounded(input.latitudeE4, -900000, 900000);
    bounded(input.longitudeE4, -1800000, 1800000);
    need(input.weatherHost || (!input.latitudeE4 && !input.longitudeE4));
  } else need(password.length === 0);
  return {...input, password};
}

/** The caller owns and clears the returned wire buffer. Password bytes never form a JS string. */
export function encodeNetworkLine(id, operation, settings) {
  need(typeof id === 'string' && /^[a-f0-9]{8}$/.test(id) && Object.hasOwn(operations, operation));
  const prefix = `DESKNET2 ${id} ${operation.toUpperCase()}`;
  if (operation !== 'set') return Buffer.from(prefix + '\n', 'ascii');
  const {ssid, password, timeHost, weatherHost, utcMinutes, latitudeE4, longitudeE4} = settings;
  const start = `${prefix} ${Buffer.from(ssid).toString('hex')} `;
  const tail = ` ${timeHost} ${weatherHost || '-'} ${utcMinutes} ${latitudeE4} ${longitudeE4}\n`;
  const line = Buffer.alloc(start.length + (password.length ? password.length * 2 : 1) + tail.length);
  let offset = line.write(start, 'ascii');
  if (!password.length) line[offset++] = 45;
  for (const byte of password) {
    line[offset++] = hex[byte >> 4];
    line[offset++] = hex[byte & 15];
  }
  line.write(tail, offset, 'ascii');
  return line;
}

export function decodeNetworkReply(line, id, operation) {
  const match = /^@VP8_DESKNET2 id=([a-f0-9]{8}) status=(ok|saved|cleared|busy|invalid|storage_failed)(?: configured=([01]) link=(off|connecting|online|unavailable))?\r?\n$/.exec(line);
  if (!match || match[1] !== id) return null;
  const [, , status, flag, link] = match;
  if (['busy', 'invalid', 'storage_failed'].includes(status)) return flag === undefined ? {status} : null;
  if (status !== operations[operation] || flag === undefined || (status === 'saved' && flag !== '1') ||
      (status === 'cleared' && flag !== '0') || (flag === '0' && !['off', 'unavailable'].includes(link))) return null;
  return {status, configured: flag === '1', link};
}

/** Probe before any mutation. A previously missing INFO never triggers a write or a legacy fallback. */
export function exchangeDesktopNetwork(session, input, signal, beforeMutation, {statusV2} = {}) {
  return exchangeDesktopSettings(session, input, signal, beforeMutation, {
    prefix: '@VP8_DESKNET2 ', decode: decodeNetworkReply,
    encode(id, operation, settings) {
      const command = encodeNetworkLine(id, operation, settings);
      if (operation === 'set') settings.password.fill(0);
      return command;
    },
  }, statusV2);
}
