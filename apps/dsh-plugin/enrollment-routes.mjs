import {Readable} from 'node:stream';
import {keys, uint64} from '../../packages/core/protocol.mjs';
import {readJsonBody} from '../../packages/runtime/read-json-body.mjs';
import {decodeNetworkBody, networkBodyLimit} from '../../packages/runtime/usb-wifi-settings.mjs';
import {validateWeatherRequest} from '../../packages/runtime/usb-weather-settings.mjs';
import {parseWeatherSearch, searchWeatherPlaces} from '../../packages/runtime/weather-geocoding.mjs';

const prefix = '/api/pet-hub-enrollment/';
const phases = ['unregistered', 'preparing', 'awaiting_boot', 'confirming_usb', 'reconciling', 'recovery_required', 'bound',
  'storage_unavailable'];
const issues = [null, 'interrupted', 'unsupported', 'usb_unsupported', 'usb_not_ready', 'usb_busy', 'device_conflict', 'unconfirmed',
  'transport_unavailable'];
const instanceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function readNetworkBody(request, signal, bytes) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^[0-9]{1,4}$/.test(length) || Number(length) > bytes.length)) throw Error('device_network_body');
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, {once: true});
  let used = 0, complete = false;
  try {
    while (!complete) {
      signal.throwIfAborted();
      const {done, value: chunk} = await reader.read();
      complete = done;
      if (done) break;
      try {
        if (chunk.length + used > bytes.length) throw Error('device_network_body');
        bytes.set(chunk, used);
        used += chunk.length;
      } finally { chunk.fill(0); }
    }
    signal.throwIfAborted();
    if (length !== null && Number(length) !== used) throw Error('device_network_body');
    return decodeNetworkBody(bytes.subarray(0, used));
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!complete) cancel();
    reader.releaseLock();
  }
}

/** Isolated desktop settings routes. A trusted assembly provides a fresh
 * owner and explicit request admission. Disposing waits for the job to exit. */
export function mountEnrollmentSettings(ctx, {owner, authorize, transport = 'desktop-renderer', usbEnrollment = false}) {
  return ctx.effect(() => registerEnrollmentRoutes(ctx, {owner, authorize, transport, usbEnrollment}),
    'pet-hub: offline device enrollment settings');
}

export function registerEnrollmentRoutes(ctx, {owner, authorize, transport = 'desktop-renderer', usbEnrollment = false,
  geocode = searchWeatherPlaces}) {
  if (typeof authorize !== 'function' || typeof owner?.status !== 'function' ||
      typeof owner.command !== 'function' || typeof owner.close !== 'function' ||
      typeof usbEnrollment !== 'boolean' ||
      !['desktop-renderer', 'desktop-rc3-connection'].includes(transport)) throw new Error('invalid BOOT settings provider');
  const inHost = transport === 'desktop-rc3-connection';
  const networkAvailable = inHost && typeof owner.network === 'function';
  const weatherAvailable = inHost && typeof owner.weather === 'function';
  const enroll = usbEnrollment ? 'enroll-usb' : 'enroll';
  {
    const stop = new AbortController(), disposers = [], searches = new Set();
    let closing;
    const close = () => {
      stop.abort();
      return closing ??= (async () => {
        let failure;
        for (const dispose of disposers.reverse()) {
          try { dispose(); } catch (error) { failure ??= error; }
        }
        const [ownerResult] = await Promise.allSettled([owner.close(), ...searches]);
        if (ownerResult.status === 'rejected') throw ownerResult.reason;
        if (failure) throw failure;
      })();
    };
    const reply = (status, value) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});

    async function dispatch(request, method, route) {
      const lifetime = AbortSignal.any([request.signal, stop.signal]);
      const signal = AbortSignal.any([lifetime, AbortSignal.timeout(2500)]);
      const url = new URL(request.url);
      if (request.method !== method || url.pathname !== prefix + route || url.search || url.hash ||
          url.protocol !== (inHost ? 'http:' : 'dsh-app:') || url.host !== (inHost ? 'dsh.internal' : 'app') ||
          url.username || url.password)
        return reply(404, {error: 'device_boot_route'});
      const post = method === 'POST', network = route === 'network';
      const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
      const contentType = network ? 'application/octet-stream' : 'application/json';
      if ((origin !== null && (inHost || origin !== 'dsh-app://app')) || (site && site !== 'same-origin') ||
          request.headers.has('x-pet-hub-operator') ||
          (network && request.headers.has('content-encoding')) ||
          (post && (!request.body || request.headers.get('content-type') !== contentType ||
            request.headers.get('x-pet-hub') !== '1'))) return reply(403, {error: 'device_boot_request_rejected'});
      try {
        signal.throwIfAborted();
        if (await authorize(request, {signal}) !== true) return reply(401, {error: 'device_boot_unauthorized'});
        signal.throwIfAborted();
        if (network) {
          const bytes = Buffer.alloc(networkBodyLimit);
          try {
            let input;
            try { input = await readNetworkBody(request, signal, bytes); }
            catch { return reply(400, {error: 'device_boot_request_rejected'}); }
            if (await authorize(request, {signal}) !== true) return reply(401, {error: 'device_boot_unauthorized'});
            signal.throwIfAborted();
            return reply(200, await owner.network(input, {signal: lifetime}));
          } finally { bytes.fill(0); }
        }
        let input;
        if (post) {
          const stream = Readable.fromWeb(request.body, {signal});
          try {
            input = await readJsonBody(stream, {signal});
            if (route === 'weather-search') input = parseWeatherSearch(input);
            else if (route === 'weather') validateWeatherRequest(input);
            else {
              keys(input, ['operation', 'instanceId', 'revision']);
              uint64(input.revision);
              if (![enroll, 'recover', 'verify', 'cancel'].includes(input.operation) ||
                  typeof input.instanceId !== 'string' || !instanceId.test(input.instanceId))
                return reply(400, {error: 'device_boot_request_rejected'});
            }
          } catch { return reply(400, {error: 'device_boot_request_rejected'}); }
          finally { stream.destroy(); }
          if (await authorize(request, {signal}) !== true) return reply(401, {error: 'device_boot_unauthorized'});
          signal.throwIfAborted();
        }
        if (route === 'weather') return reply(200, await owner.weather(input, {signal: lifetime}));
        if (route === 'weather-search') {
          if (searches.size >= 4) return reply(429, {error: 'device_geocoding_busy'});
          const pending = Promise.resolve().then(() => geocode(input, {signal: lifetime}));
          searches.add(pending);
          try {
            const places = await pending;
            lifetime.throwIfAborted();
            return reply(200, {places});
          } catch { return reply(502, {error: 'device_geocoding_unavailable'}); }
          finally { searches.delete(pending); }
        }
        const view = post ? owner.command(input) : owner.status();
        const {instanceId: id, revision, phase, busy, issue, deviceChecked} = view;
        uint64(revision);
        if (typeof id !== 'string' || !instanceId.test(id) || !phases.includes(phase) || typeof busy !== 'boolean' ||
            !issues.includes(issue) || typeof deviceChecked !== 'boolean') return reply(503, {error: 'device_boot_unavailable'});
        return reply(200, {instanceId: id, revision, phase, busy, issue, deviceChecked,
          ...(usbEnrollment ? {usbEnrollment: true} : {}), ...(networkAvailable ? {networkAvailable: true} : {}),
          ...(weatherAvailable ? {weatherAvailable: true} : {})});
      } catch (error) {
        return ['device_boot_stale', 'device_boot_busy', 'device_boot_wrong_phase'].includes(error.code) ?
          reply(409, {error: 'device_boot_state_changed'}) : reply(503, {error: 'device_boot_unavailable'});
      }
    }

    try {
      for (const [method, route] of [['GET', 'status'], ['POST', 'command'],
        ...(networkAvailable ? [['POST', 'network']] : []), ...(weatherAvailable ? [['POST', 'weather'], ['POST', 'weather-search']] : [])]) {
        disposers.push(ctx.connection.fetch.register({path: prefix + route, methods: [method],
          requestBody: method === 'POST' ? 'streaming' : 'buffered', fetch: request => dispatch(request, method, route)}));
      }
    } catch (cause) {
      const error = new Error('device_settings_mount', {cause});
      error.draining = close();
      void error.draining.catch(() => {});
      throw error;
    }
    return close;
  }
}
