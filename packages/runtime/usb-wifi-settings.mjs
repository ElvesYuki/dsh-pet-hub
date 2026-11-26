import {bounded, keys, requireThat as need, uint64} from '../core/protocol.mjs';
import {exchangeDesktopSettings} from './usb-settings-exchange.mjs';

export const networkBodyLimit = 1024;
const operations = {info: 'ok', set: 'saved', clear: 'cleared'};
const profileOperations = {info: 'ok', set: 'saved', remove: 'removed'};
const selector = ['operation', 'instanceId', 'revision'];
const fields = ['ssid', 'timeHost', 'weatherHost', 'utcMinutes', 'latitudeE4', 'longitudeE4'];
const host = /^[A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*(?:\.[A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*)*(?![\s\S])/;
const validHost = value => typeof value === 'string' && value.length <= 63 && host.test(value);
const hex = Buffer.from('0123456789abcdef');
const validSsidHex = value => typeof value === 'string' && /^(?:[0-9a-f]{2}){1,32}$/.test(value) &&
  !Buffer.from(value, 'hex').includes(0);

/** Decode the authorized request while leaving the secret as a view owned by the caller. */
export function decodeNetworkBody(bytes) {
  need(bytes.length >= 3 && bytes.length <= networkBodyLimit);
  const length = bytes.readUInt16BE(0);
  need(length > 0 && length <= bytes.length - 2);
  const input = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(2, 2 + length)));
  const password = bytes.subarray(2 + length);
  const version = input?.version;
  need(version === undefined || version === 3);
  const protocol = version === 3 ? profileOperations : operations;
  const common = version === 3 ? [...selector, 'version'] : selector;
  keys(input, input?.operation === 'set' ? [...common, ...fields] :
    input?.operation === 'remove' ? [...common, 'ssidHex'] : common);
  need(Object.hasOwn(protocol, input.operation) && typeof input.instanceId === 'string' &&
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
  } else {
    need(password.length === 0);
    if (input.operation === 'remove') need(validSsidHex(input.ssidHex));
  }
  return {...input, password};
}

/** The caller owns and clears the returned wire buffer. Password bytes never form a JS string. */
export function encodeNetworkLine(id, operation, settings) {
  const profiles = settings?.version === 3;
  need(typeof id === 'string' && /^[a-f0-9]{8}$/.test(id) &&
    Object.hasOwn(profiles ? profileOperations : operations, operation));
  const command = profiles && operation === 'info' ? 'LIST' : operation.toUpperCase();
  const prefix = `DESKNET${profiles ? 3 : 2} ${id} ${command}`;
  if (operation === 'remove') {
    need(validSsidHex(settings.ssidHex));
    return Buffer.from(`${prefix} ${settings.ssidHex}\n`, 'ascii');
  }
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

/** Decode only a correlated status or a complete list from the current USB request. */
export function decodeWifiProfilesReply(line, id, operation, settings) {
  const prefix = /^@VP8_DESKNET3 id=([a-f0-9]{8}) status=([a-z_]+)(.*?)\r?\n(?![\s\S])/.exec(line);
  if (!prefix || prefix[1] !== id) return null;
  const [, , status, fields] = prefix;
  if (['busy', 'invalid', 'storage_failed'].includes(status) ||
      (status === 'full' && operation === 'set') || (status === 'missing' && operation === 'remove'))
    return fields === '' ? {status} : null;
  if (status !== profileOperations[operation]) return null;
  const snapshot = /^ mode=(online|offline) link=(off|connecting|online|unavailable) active=([^ ]+) profiles=([^ ]+)$/.exec(fields);
  if (!snapshot) return null;
  const [, mode, link, active, list] = snapshot;
  const ids = list === '-' ? [] : list.split(',');
  if (ids.length > 4 || new Set(ids).size !== ids.length || !ids.every(validSsidHex) ||
      (link === 'online' ? !ids.includes(active) : active !== '-') ||
      (mode === 'offline' && link !== 'off') || (link === 'connecting' && !ids.length)) return null;
  if ((operation === 'set' && !ids.includes(Buffer.from(settings.ssid).toString('hex'))) ||
      (operation === 'remove' && ids.includes(settings.ssidHex))) return null;
  const utf8 = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
  const profiles = ids.map(id => {
    let name = null;
    try { name = utf8.decode(Buffer.from(id, 'hex')); }
    catch { /* The raw SSID remains addressable. */ }
    return {id, name};
  });
  return {version: 3, status, configured: ids.length > 0, mode, link, active: active === '-' ? null : active, profiles};
}

/** Mutations probe using the chosen wire contract. A list read alone can try legacy INFO. */
export function exchangeDesktopNetwork(session, input, signal, beforeMutation, {statusV2} = {}) {
  function encode(id, operation, settings) {
    const command = encodeNetworkLine(id, operation, settings);
    if (operation === 'set') settings.password.fill(0);
    return command;
  }
  const legacy = {prefix: '@VP8_DESKNET2 ', decode: decodeNetworkReply, encode};
  if (input.version !== 3) return exchangeDesktopSettings(session, input, signal, beforeMutation, legacy, statusV2);
  return exchangeDesktopSettings(session, input, signal, beforeMutation, {
    prefix: '@VP8_DESKNET3 ', decode: decodeWifiProfilesReply, encode,
    ...(input.operation === 'info' ? {async fallbackInfo() {
      const result = await exchangeDesktopSettings(session, {...input, version: undefined}, signal, beforeMutation, legacy, statusV2);
      return result.status === 'ok' ? {...result, readOnly: true} : result;
    }} : {}),
  }, statusV2);
}
