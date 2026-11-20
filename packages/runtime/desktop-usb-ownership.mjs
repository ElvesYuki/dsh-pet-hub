import {requireThat} from '../core/protocol.mjs';
import {openExclusiveTty} from './exclusive-tty.mjs';

const key = Symbol.for('dsh-pet-hub.desktop-usb/1');
const stateFor = (scope = globalThis) => scope[key] ??= {targets: new Map(), lease: null};

/** Run both Desktop packages through a single USB lease. POSIX flock and
 * TIOCEXCL still protect the descriptor across other processes. */
export function desktopUsbOpener(open = openExclusiveTty, scope = globalThis, {yieldToForeground} = {}) {
  const state = stateFor(scope);
  return async function acquire(options) {
    requireThat(!state.waiting, 'device_desktop_usb_busy');
    const lease = {yieldToForeground};
    if (!yieldToForeground && state.lease?.yieldToForeground) {
      state.waiting = true;
      try {
        await state.lease.yieldToForeground();
        requireThat(state.lease === null, 'device_desktop_usb_busy');
        state.lease = lease;
      } finally { state.waiting = false; }
    } else {
      requireThat(state.lease === null, 'device_desktop_usb_busy');
      state.lease = lease;
    }
    let io, closing;
    const release = () => { if (state.lease === lease) state.lease = null; };
    try { io = await open(options); }
    catch (error) {
      if (!error.usbReleaseUnconfirmed) release();
      throw error;
    }
    return {
      read: (...args) => io.read(...args),
      write: (...args) => io.write(...args),
      stat: (...args) => io.stat(...args),
      close() {
        return closing ??= Promise.resolve().then(() => io.close()).then(release);
      },
    };
  };
}

export function trackDesktopUsbTarget(role, target, scope = globalThis) {
  const {targets} = stateFor(scope);
  requireThat((role === 'query' || role === 'binding') && typeof target === 'string' && target.length > 0 &&
    !targets.has(role), 'device_desktop_usb_target');
  const entry = {target};
  targets.set(role, entry);
  return () => { if (targets.get(role) === entry) targets.delete(role); };
}

/** Only relationship/busy flags reach the UI. */
export function desktopUsbStatus(scope = globalThis) {
  const {targets, lease, waiting} = stateFor(scope);
  const query = targets.get('query'), binding = targets.get('binding');
  return {sameUsbTarget: query && binding ? query.target === binding.target : null,
    usbBusy: Boolean(waiting || (lease && !lease.yieldToForeground))};
}
