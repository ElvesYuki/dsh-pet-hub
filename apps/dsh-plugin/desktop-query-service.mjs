import {basename, dirname, isAbsolute, join, normalize} from 'node:path';
import {startOrAttach} from '../../packages/runtime/service.mjs';
import {prepareDesktopQuery, readDesktopQueryConfig} from '../../packages/runtime/vp8-desktop-query.mjs';
import {desktopUsbOpener, desktopUsbStatus, trackDesktopUsbTarget} from '../../packages/runtime/vp8-desktop-usb.mjs';
import {createDesktopBatterySampler, readDesktopBattery} from '../../packages/runtime/vp8-desktop-battery.mjs';

const releasing = new Map();

/** Mount a shared query-only service. Cordis waits for the returned disposer. */
export function mountDesktopQueryService(ctx, directory, {start = startOrAttach, report = console.error, sharedUsb = false} = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory !== normalize(directory) ||
      basename(directory) !== 'ipc') throw new Error('managed_desktop_runtime_directory');
  const root = dirname(directory);
  let access;
  ctx.effect(() => {
    let disposed = false, disposal, untrack, battery;
    const lifetime = new AbortController();
    const revoke = () => { access = undefined; untrack?.(); lifetime.abort(); };
    const closeOwner = async service => {
      await battery?.drain();
      if (service?.role === 'owner') await service.close();
    };
    const prior = releasing.get(directory);
    const ready = (async () => {
      await prior;
      if (disposed) return;
      const config = await readDesktopQueryConfig(root);
      if (disposed) return;
      const openTty = sharedUsb ? desktopUsbOpener() : undefined;
      const vp8Update = prepareDesktopQuery(root, config, {openTty});
      const service = await start({directory, vp8Update, onVp8LocalStop() {
        revoke();
        void ready.then(closeOwner)
          .catch(() => report('[dsh-pet-hub] Desktop query service stop failed.'));
      }});
      if (!disposed && !lifetime.signal.aborted && service.role === 'owner') {
        if (sharedUsb) {
          try { untrack = trackDesktopUsbTarget('query', config.usbIdentity); }
          catch (error) { await service.close(); throw error; }
          battery = createDesktopBatterySampler({usbStatus: desktopUsbStatus, lifetime: lifetime.signal,
            read: signal => readDesktopBattery({port: config.port, helper: join(root, 'tty'),
              identity: config.usbIdentity, openTty}, signal)});
        }
        const options = signal => ({signal: AbortSignal.any([lifetime.signal, signal]),
          reviewToken: config.operatorToken, expectedInstanceId: service.instanceId});
        access = Object.freeze({
          instanceId: service.instanceId,
          ...(sharedUsb ? {usbStatus: desktopUsbStatus, battery} : {}),
          status: signal => service.client.request('GET', '/v1/vp8-action/status', undefined, options(signal)),
          query: (revision, signal) => service.client.request('POST', '/v1/vp8-action/command',
            {operation: 'query', instanceId: service.instanceId, revision}, options(signal)),
        });
      }
      return service;
    })().catch(() => {
      report('[dsh-pet-hub] Desktop query service startup failed.');
    });
    return () => {
      if (disposal) return disposal;
      disposed = true;
      revoke();
      disposal = ready.then(closeOwner);
      releasing.set(directory, disposal);
      void disposal.then(() => {
        if (releasing.get(directory) === disposal) releasing.delete(directory);
      }, () => report('[dsh-pet-hub] Desktop query service disposal failed.'));
      return disposal;
    };
  }, 'pet-hub: managed Desktop query service');
  return () => access;
}
