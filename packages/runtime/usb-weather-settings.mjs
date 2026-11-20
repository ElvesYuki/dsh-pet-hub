import {bounded, keys, requireThat as need, uint64} from '../core/protocol.mjs';
import {exchangeDesktopSettings} from './usb-settings-exchange.mjs';

const expectedStatus = {info: 'ok', set: 'saved', clear: 'cleared'};
const selector = ['operation', 'instanceId', 'revision'];
const coordinate = /^@VP8_DESKWEATHER1 id=([a-f0-9]{8}) status=(ok|saved|cleared|busy|invalid|storage_failed)(?: configured=([01])(?: lat_e4=(0|-?[1-9][0-9]{0,6}) lon_e4=(0|-?[1-9][0-9]{0,6}))?)?\r?\n$/;

export function validateWeatherRequest(input) {
  keys(input, input?.operation === 'set' ? [...selector, 'latitudeE4', 'longitudeE4'] : selector);
  need(Object.hasOwn(expectedStatus, input.operation) && typeof input.instanceId === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(input.instanceId));
  uint64(input.revision);
  if (input.operation === 'set') {
    bounded(input.latitudeE4, -900000, 900000);
    bounded(input.longitudeE4, -1800000, 1800000);
  }
}

export function encodeWeatherLine(id, operation, input) {
  need(typeof id === 'string' && /^[a-f0-9]{8}$/.test(id) && Object.hasOwn(expectedStatus, operation));
  const fields = operation === 'set' ? ` ${input.latitudeE4} ${input.longitudeE4}` : '';
  return Buffer.from(`DESKWEATHER1 ${id} ${operation.toUpperCase()}${fields}\n`, 'ascii');
}

export function decodeWeatherReply(line, id, operation, input) {
  const match = coordinate.exec(line);
  if (!match || match[1] !== id) return null;
  const [, , status, flag, latitude, longitude] = match;
  if (['busy', 'invalid', 'storage_failed'].includes(status)) return flag === undefined ? {status} : null;
  if (status !== expectedStatus[operation] || flag === undefined) return null;
  if (flag === '0') return latitude === undefined && status !== 'saved' ? {status, configured: false} : null;
  if (latitude === undefined || status === 'cleared') return null;
  const latitudeE4 = Number(latitude), longitudeE4 = Number(longitude);
  if (Math.abs(latitudeE4) > 900000 || Math.abs(longitudeE4) > 1800000 || (status === 'saved' &&
      (input.latitudeE4 !== latitudeE4 || input.longitudeE4 !== longitudeE4))) return null;
  return {status, configured: true, latitudeE4, longitudeE4};
}

export function exchangeDesktopWeather(session, input, signal, beforeMutation, {statusV2} = {}) {
  return exchangeDesktopSettings(session, input, signal, beforeMutation, {
    prefix: '@VP8_DESKWEATHER1 ', encode: encodeWeatherLine, decode: decodeWeatherReply,
  }, statusV2);
}
