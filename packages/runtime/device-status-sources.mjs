import {lstatSync} from 'node:fs';
import {createDesktopBatterySampler} from './usb-battery-sampler.mjs';
import {createDeviceTelemetry} from './device-telemetry.mjs';
import {createUsbStatusSubscription} from './usb-status-subscription.mjs';

export function desktopUsbAttachment(port) {
  try {
    const stat = lstatSync(port, {bigint: true, throwIfNoEntry: false});
    if (stat?.isCharacterDevice()) return [stat.dev, stat.ino, stat.birthtimeNs, stat.rdev].join('/');
  } catch (error) {
    if (error.code !== 'EACCES' && error.code !== 'EPERM') throw error;
  }
}

/** Single owner for status selection and periodic reads of the registered TTY. */
export function createDesktopStatusSources({usbIdentity, lifetime, usbStatus, usbAttachment, read, subscribe, clock, report}) {
  let usb, usbDevice;
  const sampler = !subscribe && createDesktopBatterySampler({usbStatus, lifetime, now: clock?.now, read: async signal => {
    const attachment = usb;
    const result = await read(signal, usbDevice === undefined);
    signal.throwIfAborted();
    if (usbAttachment() !== attachment) {
      usb = usbDevice = undefined;
      return {status: 'disconnected'};
    }
    if (result.device !== undefined) {
      const {device, ...battery} = result;
      usbDevice = device;
      return battery;
    }
    if (result.status === 'disconnected') usbDevice = undefined;
    return result;
  }});
  const telemetry = createDeviceTelemetry({usbIdentity, ...clock, onFresh() {
    if (push) push.refresh();
    else sampler.suspend();
  }});
  const push = subscribe && createUsbStatusSubscription({lifetime, usbStatus, usbAttachment, subscribe, clock, report,
    networkFresh: () => Boolean(telemetry.snapshot())});

  function snapshot() {
    const networkStatus = telemetry.snapshot();
    if (networkStatus) return {networkStatus};
    if (push) {
      const {usbPresent, status} = push.snapshot();
      const usbDevice = status && {version: status.version, slot: status.slot, busy: status.busy, selected: status.selected};
      return {usbPresent, usbDevice};
    }
    const attachment = usbAttachment();
    if (attachment !== usb) {
      sampler.suspend();
      usb = attachment;
      usbDevice = undefined;
    }
    return {usbPresent: Boolean(usb), usbDevice: usbStatus().sameUsbTarget === false ? null : usbDevice ?? null};
  }

  const cancelled = new Set();
  const projectedBattery = push ? {
    sample(id, signal) {
      if (signal.aborted || lifetime.aborted || cancelled.delete(id)) return {status: 'cancelled'};
      if (telemetry.snapshot()) return {status: 'network_active'};
      const {usbPresent, status} = push.snapshot();
      if (!usbPresent) return {status: 'disconnected'};
      if (!status) return {status: 'no_reply', sensors: {status: 'no_reply'}};
      return {status: status.battery ? 'ok' : 'not_reported', ...status.battery,
        sensors: {status: status.sensors ? 'ok' : 'not_reported', ...status.sensors}};
    },
    cancel(id) {
      cancelled.add(id);
      if (cancelled.size > 16) cancelled.delete(cancelled.values().next().value);
    },
    drain: push.close,
  } : {
    async sample(id, signal) {
      try {
        const result = await sampler.sample(id, signal, () => {
          const source = snapshot();
          return source.networkStatus ? 'network_active' : !source.usbPresent ? 'disconnected' : null;
        });
        return result.status !== 'cancelled' && telemetry.snapshot() ? {status: 'network_active'} : result;
      } catch (error) {
        if (error.name === 'AbortError' && !signal.aborted && !lifetime.aborted && telemetry.snapshot())
          return {status: 'network_active'};
        throw error;
      }
    },
    cancel: sampler.cancel,
    drain: sampler.drain,
  };
  return {
    attach: telemetry.attach,
    close: telemetry.close,
    snapshot,
    battery: projectedBattery,
  };
}
