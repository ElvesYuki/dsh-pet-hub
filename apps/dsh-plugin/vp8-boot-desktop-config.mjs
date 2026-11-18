import {keys, requireThat} from '../../packages/core/protocol.mjs';
import {vp8BootReviewDirectory} from '../../packages/runtime/vp8-boot-keychain.mjs';
import {createVp8BootReviewOwner} from './host-vp8-boot-rc3.mjs';
import {registerVp8BootSettings} from './vp8-boot-settings.mjs';

const processSlot = Symbol.for('dsh-pet-hub.vp8-usb-enrollment.desktop/1');
const desktop = ctx => process.platform === 'darwin' && Boolean(process.versions.electron) &&
  ctx.get('profileContext')?.name === 'desktop';

/** Explicit config for the independent rc.3 package. A replacement waits for
 * old I/O to close even if the loader begins remount before awaiting disposal. */
export function applyVp8BootDesktopConfig(ctx, config = {}, {isDesktop = desktop, checkRoot = vp8BootReviewDirectory,
  createOwner = createVp8BootReviewOwner, scope = globalThis, report = console.error, sharedUsb = false} = {}) {
  keys(config, ['enabled', 'enrollmentDirectory']);
  requireThat(config.enabled === undefined || typeof config.enabled === 'boolean', 'vp8_desktop_config');
  requireThat(config.enrollmentDirectory === undefined || typeof config.enrollmentDirectory === 'string',
    'vp8_desktop_config');
  if (!config.enabled) return;
  requireThat(isDesktop(ctx), 'vp8_review_profile');
  const directory = checkRoot(config.enrollmentDirectory);
  const slot = scope[processSlot] ??= {};
  ctx.effect(() => {
    const prior = slot.current;
    requireThat(!prior || prior.draining, 'vp8_desktop_in_use');
    const entry = {};
    slot.current = entry;
    let disposed = false, unregister;
    function start() {
      if (disposed) return;
      requireThat(isDesktop(ctx) && checkRoot(directory) === directory, 'vp8_review_profile');
      const owner = createOwner(directory, {usbEnrollment: true, sharedUsb});
      unregister = registerVp8BootSettings(ctx, {owner, transport: 'desktop-rc3-connection', usbEnrollment: true,
        authorize: () => !disposed && isDesktop(ctx) && checkRoot(directory) === directory});
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
      entry.draining = unregister ? unregister() : ready.then(() => unregister?.());
      void entry.draining.then(() => {
        if (slot.current === entry) delete slot.current;
      }, () => report('[dsh-pet-hub-boot-review] USB enrollment release not confirmed.'));
      return entry.draining;
    };
  }, 'pet-hub: explicitly enabled Desktop USB enrollment');
}
