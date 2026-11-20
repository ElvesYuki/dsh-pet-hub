import {basename, dirname, isAbsolute, join, normalize} from 'node:path';
import {startOrAttach} from '../../packages/runtime/service.mjs';
import {prepareDesktopQuery, readDesktopQueryConfig} from '../../packages/runtime/desktop-device-query.mjs';
import {desktopUsbOpener, desktopUsbStatus, trackDesktopUsbTarget} from '../../packages/runtime/desktop-usb-ownership.mjs';
import {readDesktopBattery} from '../../packages/runtime/usb-battery-sampler.mjs';
import {createDesktopStatusSources, desktopUsbAttachment} from '../../packages/runtime/device-status-sources.mjs';
import {subscribeUsbDeviceStatus} from '../../packages/runtime/usb-status-subscription.mjs';

const releasing = new Map();

/** Mount a shared query-only service. Cordis waits for the returned disposer.
 * connectTelemetry is an optional trusted host adapter, with an abort signal
 * for subscription cleanup. Never source it from plugin config or requests. */
export function mountDesktopQueryService(ctx, directory, {start = startOrAttach, report = console.error, sharedUsb = false,
  connectTelemetry, statusV2, statusPush = false} = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory !== normalize(directory) ||
      basename(directory) !== 'ipc') throw new Error('managed_desktop_runtime_directory');
  const root = dirname(directory);
  let access;
  ctx.effect(() => {
    let disposed = false, disposal, untrack, sources, releaseTelemetry;
    const lifetime = new AbortController();
    const revoke = () => { access = undefined; untrack?.(); lifetime.abort(); sources?.close(); };
    const closeOwner = async service => {
      const results = await Promise.allSettled([sources?.battery.drain(), Promise.resolve().then(() => releaseTelemetry?.())]);
      if (service?.role === 'owner') await service.close();
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    };
    const prior = releasing.get(directory);
    const ready = (async () => {
      await prior;
      if (disposed) return;
      const config = await readDesktopQueryConfig(root);
      if (disposed) return;
      const openTty = sharedUsb ? desktopUsbOpener() : undefined;
      const deviceUpdate = prepareDesktopQuery(root, config, {openTty, statusV2});
      const service = await start({directory, deviceUpdate, onDeviceLocalStop() {
        revoke();
        void ready.then(closeOwner)
          .catch(() => report('[dsh-pet-hub] Desktop query service stop failed.'));
      }});
      if (!disposed && !lifetime.signal.aborted && service.role === 'owner') {
        if (sharedUsb) {
          try { untrack = trackDesktopUsbTarget('query', config.usbIdentity); }
          catch (error) { await service.close(); throw error; }
          const serial = {port: config.port, helper: join(root, 'tty'), identity: config.usbIdentity};
          sources = createDesktopStatusSources({usbStatus: desktopUsbStatus, lifetime: lifetime.signal, report,
            usbIdentity: config.usbIdentity, usbAttachment: () => desktopUsbAttachment(config.port),
            subscribe: statusPush ? ({signal, publish, yieldToForeground}) => subscribeUsbDeviceStatus({signal, publish,
              options: {...serial, openTty: desktopUsbOpener(undefined, undefined, {yieldToForeground})}}) : undefined,
            read: (signal, deviceStatus) => readDesktopBattery({...serial, openTty, sensors: true, deviceStatus, statusV2}, signal)});
          try {
            releaseTelemetry = connectTelemetry?.({usbIdentity: config.usbIdentity, attach: sources.attach, signal: lifetime.signal,
              usbReady: () => {
                const {usbBusy, sameUsbTarget} = desktopUsbStatus();
                return sameUsbTarget === true && !usbBusy && Boolean(desktopUsbAttachment(config.port));
              }});
          } catch {
            sources.close();
            report('[dsh-pet-hub] Desktop network telemetry unavailable.');
          }
        }
        const options = signal => ({signal: AbortSignal.any([lifetime.signal, signal]),
          reviewToken: config.operatorToken, expectedInstanceId: service.instanceId});
        access = Object.freeze({
          instanceId: service.instanceId,
          ...(sources ? {usbStatus: desktopUsbStatus, battery: sources.battery, statusSource: sources.snapshot} : {}),
          status: signal => service.client.request('GET', '/v1/device-update/status', undefined, options(signal)),
          query: (revision, signal) => service.client.request('POST', '/v1/device-update/command',
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
