import {keys, requireThat} from '../../packages/core/protocol.mjs';
import {enrollmentDirectory} from '../../packages/runtime/device-keychain.mjs';
import {createDeviceEnrollmentOwner} from './enrollment-host.mjs';
import {registerEnrollmentRoutes} from './enrollment-routes.mjs';

const processSlot = Symbol.for('dsh-pet-hub.vp8-usb-enrollment.desktop/1');
const desktop = ctx => process.platform === 'darwin' && Boolean(process.versions.electron) &&
  ctx.get('profileContext')?.name === 'desktop';

/** Explicit config for the independent rc.3 package. A replacement waits for
 * old I/O to close even if the loader begins remount before awaiting disposal. */
export function applyBootDesktopConfig(ctx, config = {}, {isDesktop = desktop, checkRoot = enrollmentDirectory,
  createOwner = createDeviceEnrollmentOwner, scope = globalThis, report = console.error, sharedUsb = false, statusV2,
  connectLan} = {}) {
  keys(config, ['enabled', 'enrollmentDirectory']);
  requireThat(config.enabled === undefined || typeof config.enabled === 'boolean', 'device_desktop_config');
  requireThat(config.enrollmentDirectory === undefined || typeof config.enrollmentDirectory === 'string',
    'device_desktop_config');
  if (!config.enabled) return;
  requireThat(isDesktop(ctx), 'device_review_profile');
  const directory = checkRoot(config.enrollmentDirectory);
  const slot = scope[processSlot] ??= {};
  ctx.effect(() => {
    const prior = slot.current;
    requireThat(!prior || prior.draining, 'device_desktop_in_use');
    const entry = {};
    slot.current = entry;
    let disposed = false, unregister, releaseLan;
    const lifetime = new AbortController();
    function start() {
      if (disposed) return;
      requireThat(isDesktop(ctx) && checkRoot(directory) === directory, 'device_review_profile');
      const owner = createOwner(directory, {usbEnrollment: true, sharedUsb, ...(statusV2 ? {statusV2} : {}),
        ...(connectLan ? {lanCandidate: true} : {})});
      unregister = registerEnrollmentRoutes(ctx, {owner, transport: 'desktop-rc3-connection', usbEnrollment: true,
        authorize: () => !disposed && isDesktop(ctx) && checkRoot(directory) === directory});
      try { releaseLan = connectLan?.({owner, signal: lifetime.signal}); }
      catch { report('[dsh-pet-hub] Device LAN enrollment unavailable.'); }
    }
    const ready = (async () => {
      if (prior) await prior.draining;
      try { start(); }
      catch (error) {
        report('[dsh-pet-hub-boot-review] USB enrollment candidate unavailable.');
        await error.draining;
      }
    })();
    void ready.catch(() => report('[dsh-pet-hub-boot-review] USB enrollment candidate unavailable.'));
    return () => {
      if (entry.draining) return entry.draining;
      disposed = true;
      lifetime.abort();
      const unregisterOwner = unregister ? unregister() : ready.then(() => unregister?.());
      entry.draining = releaseLan ? Promise.allSettled([unregisterOwner, releaseLan()]).then(results => {
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
      }) : unregisterOwner;
      void entry.draining.then(() => {
        if (slot.current === entry) delete slot.current;
      }, () => report('[dsh-pet-hub-boot-review] USB enrollment release not confirmed.'));
      return entry.draining;
    };
  }, 'pet-hub: explicitly enabled Desktop USB enrollment');
}
