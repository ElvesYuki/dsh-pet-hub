import {keys, requireThat as need} from '../core/protocol.mjs';

const endpoint = 'https://geocoding-api.open-meteo.com/v1/search';
const maxBytes = 128 * 1024;
const count = 12;
const validText = (value, max) => typeof value === 'string' && value.length <= max &&
  value.isWellFormed() && !/\p{Cc}/u.test(value) && value.trim() !== '';

export function parseWeatherSearch(input) {
  keys(input, ['name']);
  need(validText(input.name, 160));
  const name = input.name.trim();
  const length = [...name].length;
  need(length >= 2 && length <= 80);
  return name;
}

async function readGeocodingJson(response, signal) {
  const declared = Number(response.headers.get('content-length'));
  if (!response.ok || !response.body || declared > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error('device_geocoding_response');
  }
  const reader = response.body.getReader();
  const cancellation = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancellation, {once: true});
  const bytes = new Uint8Array(maxBytes);
  let length = 0, complete = false;
  try {
    while (!complete) {
      signal.throwIfAborted();
      const {done, value} = await reader.read();
      complete = done;
      if (!done) {
        need(value.byteLength <= bytes.length - length, 'device_geocoding_response');
        bytes.set(value, length);
        length += value.byteLength;
      }
    }
    signal.throwIfAborted();
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, length)));
  } finally {
    signal.removeEventListener('abort', cancellation);
    if (!complete) cancellation();
    reader.releaseLock();
  }
}

function projectPlaces(json) {
  need(json && typeof json === 'object' && !Array.isArray(json) && !json.error &&
    (json.results === undefined || (Array.isArray(json.results) && json.results.length <= count)), 'device_geocoding_response');
  const results = new Map();
  for (const place of json.results ?? []) {
    const {id, name, latitude, longitude, admin1, admin2, country, country_code: countryCode} = place ?? {};
    if (!Number.isSafeInteger(id) || id <= 0 || !validText(name, 120) || !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || results.has(id)) continue;
    const nation = validText(country, 120) ? country : countryCode;
    const area = [...new Set([admin2, admin1, nation].filter(value => validText(value, 120)).map(value => value.trim()))];
    results.set(id, {id, name: name.trim(), area, latitudeE4: Math.round(latitude * 10000) || 0,
      longitudeE4: Math.round(longitude * 10000) || 0});
  }
  need(!json.results?.length || results.size > 0, 'device_geocoding_response');
  return [...results.values()];
}

/** Fixed public HTTPS endpoint. The caller provides an already validated search term. */
export async function searchWeatherPlaces(name, {signal, fetcher = fetch} = {}) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({name, count: String(count), language: 'zh', format: 'json'});
  const deadline = AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]);
  deadline.throwIfAborted();
  const response = await fetcher(url, {signal: deadline, redirect: 'error', headers: {Accept: 'application/json'}});
  return projectPlaces(await readGeocodingJson(response, deadline));
}
