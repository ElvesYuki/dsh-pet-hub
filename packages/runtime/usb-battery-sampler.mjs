import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {openVerifiedDeviceTty} from './device-maintenance-usb.mjs';
import {sensorReply} from './usb-device-sensors.mjs';
import {serialLines} from './serial-lines.mjs';
import {parseUpdateStatus} from './device-update.mjs';
import {readUsbDeviceStatus} from './usb-status-wire.mjs';

const intervalMs = 5000;
const failureReply = /^status=(busy|rate_limited|unavailable)$/;
const readingReply = /^status=ok present=([01]) usb_power=([01]) percent=(na|0|[1-9][0-9]{0,2}) mv=(na|[1-9][0-9]{0,3}) flow=(na|standby|charging|discharging|unknown) phase=(na|trickle|precharge|cc|cv|full|idle|unknown)$/;

function batteryReply(line, id) {
  const prefix = 'id=' + id + ' ';
  if (!line.startsWith(prefix)) return;
  const payload = line.slice(prefix.length);
  const failure = failureReply.exec(payload);
  if (failure) return {status: failure[1]};
  const fields = readingReply.exec(payload);
  if (!fields) return;
  const [, present, power, percent, mv, flow, phase] = fields;
  if (present === '0' ? [percent, mv, flow, phase].some(value => value !== 'na') :
    flow === 'na' || phase === 'na' || Number(percent) > 100 || Number(mv) > 8191) return;
  return {status: 'ok', present: present === '1', usbPower: power === '1',
    percent: percent === 'na' ? null : Number(percent), mv: mv === 'na' ? null : Number(mv),
    flow: flow === 'na' ? null : flow, phase: phase === 'na' ? null : phase};
}

/** One read-only snapshot over the existing exclusive USB handle. */
export async function readDesktopBattery(options, signal) {
  signal.throwIfAborted();
  if (!options.identity) return {status: 'disconnected'};
  let io;
  try { io = await openVerifiedDeviceTty({...options, signal}); }
  catch (error) {
    signal.throwIfAborted();
    if (error.code === 'device_desktop_usb_busy' || error.message === 'pbp_serial_exclusive') return {status: 'busy'};
    if (error.usbReleaseUnconfirmed) throw error;
    return {status: 'disconnected'};
  }
  let battery, sensors, device;
  const observed = result => ({...result, ...(options.deviceStatus ? {device: device ?? null} : {})});
  try {
    if (options.statusV2) {
      const {battery, sensors, ...device} = await readUsbDeviceStatus(io,
        AbortSignal.any([signal, AbortSignal.timeout(1250)]));
      return {status: battery ? 'ok' : 'not_reported', ...battery, device,
        sensors: {status: sensors ? 'ok' : 'not_reported', ...sensors}};
    }
    const tty = serialLines(io, '@VP8_');
    const id = randomBytes(4).toString('hex');
    const probe = AbortSignal.any([signal, AbortSignal.timeout(options.deviceStatus ? 1250 : options.sensors ? 475 : 900)]);
    const sensorRequest = options.sensors ? 'SENSORS1 ' + id + '\n' : '';
    if (options.deviceStatus) {
      do { probe.throwIfAborted(); } while (await tty.read({discard: true}));
    }
    await tty.write((options.deviceStatus ? 'STATUS2\n' : '') + sensorRequest + 'BATTERY1 ' + id + '\n', probe);
    for (;;) {
      probe.throwIfAborted();
      const lines = await tty.read();
      probe.throwIfAborted();
      for (const line of lines ?? []) {
        if (!battery && line.startsWith('BATTERY1 ')) battery = batteryReply(line.slice(9), id);
        if (options.sensors && !sensors && line.startsWith('SENSORS1 ')) sensors = sensorReply(line.slice(9), id);
        if (options.deviceStatus && !device && line.startsWith('OTA ')) device = parseUpdateStatus(line.slice(4), true);
      }
      if (battery && (!options.sensors || sensors) && (!options.deviceStatus || device))
        return observed(sensors ? {...battery, sensors} : battery);
      await delay(10, undefined, {signal: probe});
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      if (options.statusV2) return {status: 'no_reply', device: null, sensors: {status: 'no_reply'}};
      return observed(options.sensors ? {...(battery ?? {status: 'no_reply'}), sensors: sensors ?? {status: 'no_reply'}} :
        {status: 'no_reply'});
    }
    return {status: 'disconnected'};
  } finally { await io.close(); }
}

/** A single per-owner in-flight probe and a bounded, expiring cancellation set. */
export function createDesktopBatterySampler({read, usbStatus, lifetime, now = () => performance.now()}) {
  let current, nextStart = 0;
  const cancelled = new Map();
  function prune(time) {
    for (const [id, expires] of cancelled) if (time >= expires) cancelled.delete(id);
  }
  return {
    sample(id, requestSignal, blocked) {
      const time = now();
      prune(time);
      if (lifetime.aborted || requestSignal.aborted || cancelled.has(id)) return {status: 'cancelled'};
      const reason = blocked?.();
      if (reason) return {status: reason};
      const {sameUsbTarget, usbBusy} = usbStatus();
      if (sameUsbTarget === false) return {status: 'conflict'};
      if (current || usbBusy) return {status: 'busy'};
      if (time < nextStart) return {status: 'rate_limited'};
      nextStart = time + intervalMs;
      const controller = new AbortController();
      const signal = AbortSignal.any([lifetime, requestSignal, controller.signal]);
      const task = Promise.resolve().then(() => read(signal)).finally(() => { current = undefined; });
      current = {id, controller, task};
      return task;
    },
    cancel(id) {
      const time = now();
      prune(time);
      cancelled.delete(id);
      cancelled.set(id, time + intervalMs);
      if (cancelled.size > 16) cancelled.delete(cancelled.keys().next().value);
      if (current?.id === id) current.controller.abort();
    },
    suspend() { current?.controller.abort(); },
    async drain() { await Promise.allSettled([current?.task]); },
  };
}
