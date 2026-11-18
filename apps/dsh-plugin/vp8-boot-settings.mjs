import {Readable} from 'node:stream';
import {keys, uint64} from '../../packages/core/protocol.mjs';
import {readNative400ReviewBody} from '../../packages/runtime/native400-review-channel.mjs';

const prefix = '/api/pet-hub-vp8-boot/';
const phases = ['unregistered', 'preparing', 'awaiting_boot', 'confirming_usb', 'reconciling', 'recovery_required', 'bound',
  'storage_unavailable'];
const issues = [null, 'interrupted', 'unsupported', 'usb_unsupported', 'usb_not_ready', 'usb_busy', 'device_conflict', 'unconfirmed',
  'transport_unavailable'];
const instanceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Isolated desktop settings routes. A trusted assembly provides a fresh
 * owner and explicit request admission. Disposing waits for the job to exit. */
export function mountVp8BootSettings(ctx, {owner, authorize, transport = 'desktop-renderer', usbEnrollment = false}) {
  return ctx.effect(() => registerVp8BootSettings(ctx, {owner, authorize, transport, usbEnrollment}),
    'pet-hub: offline VP8 BOOT settings');
}

export function registerVp8BootSettings(ctx, {owner, authorize, transport = 'desktop-renderer', usbEnrollment = false}) {
  if (typeof authorize !== 'function' || typeof owner?.status !== 'function' ||
      typeof owner.command !== 'function' || typeof owner.close !== 'function' ||
      typeof usbEnrollment !== 'boolean' ||
      !['desktop-renderer', 'desktop-rc3-connection'].includes(transport)) throw new Error('invalid BOOT settings provider');
  const inHost = transport === 'desktop-rc3-connection';
  const enroll = usbEnrollment ? 'enroll-usb' : 'enroll';
  {
    const stop = new AbortController(), disposers = [];
    let closing;
    const close = () => {
      stop.abort();
      return closing ??= (async () => {
        let failure;
        for (const dispose of disposers.reverse()) {
          try { dispose(); } catch (error) { failure ??= error; }
        }
        await owner.close();
        if (failure) throw failure;
      })();
    };
    const reply = (status, value) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});

    async function dispatch(request, method, route) {
      const signal = AbortSignal.any([request.signal, stop.signal, AbortSignal.timeout(2500)]);
      const url = new URL(request.url);
      if (request.method !== method || url.pathname !== prefix + route || url.search || url.hash ||
          url.protocol !== (inHost ? 'http:' : 'dsh-app:') || url.host !== (inHost ? 'dsh.internal' : 'app') ||
          url.username || url.password)
        return reply(404, {error: 'vp8_boot_route'});
      const post = method === 'POST', origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
      if ((origin !== null && (inHost || origin !== 'dsh-app://app')) || (site && site !== 'same-origin') ||
          request.headers.has('x-pet-hub-operator') ||
          (post && (!request.body || request.headers.get('content-type') !== 'application/json' ||
            request.headers.get('x-pet-hub') !== '1'))) return reply(403, {error: 'vp8_boot_request_rejected'});
      try {
        signal.throwIfAborted();
        if (await authorize(request, {signal}) !== true) return reply(401, {error: 'vp8_boot_unauthorized'});
        signal.throwIfAborted();
        let input;
        if (post) {
          const stream = Readable.fromWeb(request.body, {signal});
          try {
            input = await readNative400ReviewBody(stream, {signal});
            keys(input, ['operation', 'instanceId', 'revision']);
            uint64(input.revision);
            if (![enroll, 'recover', 'verify', 'cancel'].includes(input.operation) ||
                typeof input.instanceId !== 'string' || !instanceId.test(input.instanceId))
              return reply(400, {error: 'vp8_boot_request_rejected'});
          } catch { return reply(400, {error: 'vp8_boot_request_rejected'}); }
          finally { stream.destroy(); }
          if (await authorize(request, {signal}) !== true) return reply(401, {error: 'vp8_boot_unauthorized'});
          signal.throwIfAborted();
        }
        const view = post ? owner.command(input) : owner.status();
        const {instanceId: id, revision, phase, busy, issue, deviceChecked} = view;
        uint64(revision);
        if (typeof id !== 'string' || !instanceId.test(id) || !phases.includes(phase) || typeof busy !== 'boolean' ||
            !issues.includes(issue) || typeof deviceChecked !== 'boolean') return reply(503, {error: 'vp8_boot_unavailable'});
        return reply(200, {instanceId: id, revision, phase, busy, issue, deviceChecked,
          ...(usbEnrollment ? {usbEnrollment: true} : {})});
      } catch (error) {
        return ['vp8_boot_stale', 'vp8_boot_busy', 'vp8_boot_wrong_phase'].includes(error.code) ?
          reply(409, {error: 'vp8_boot_state_changed'}) : reply(503, {error: 'vp8_boot_unavailable'});
      }
    }

    try {
      for (const [method, route] of [['GET', 'status'], ['POST', 'command']]) {
        disposers.push(ctx.connection.fetch.register({path: prefix + route, methods: [method],
          requestBody: method === 'POST' ? 'streaming' : 'buffered', fetch: request => dispatch(request, method, route)}));
      }
    } catch (cause) {
      const error = new Error('vp8_settings_mount', {cause});
      error.draining = close();
      void error.draining.catch(() => {});
      throw error;
    }
    return close;
  }
}
