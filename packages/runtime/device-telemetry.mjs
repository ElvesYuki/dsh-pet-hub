import {requireThat} from '../core/protocol.mjs';

const probeMs = 3000, staleMs = 6000, closeMs = 9000;
const versionPattern = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,30}$/;
const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const vector = (value, length, min, max) => Array.isArray(value) && value.length === length &&
  Array.from(value).every(item => inRange(item, min, max));

function batteryView(value) {
  if (typeof value?.present !== 'boolean' || typeof value.usbPower !== 'boolean') return;
  const {present, usbPower, percent, mv, flow, phase} = value;
  if (!present && [percent, mv, flow, phase].some(item => item !== null)) return;
  if (present && ((percent !== null && !inRange(percent, 0, 100)) || (mv !== null && !inRange(mv, 1, 8191)) ||
    !['standby', 'charging', 'discharging', 'unknown'].includes(flow) ||
    !['trickle', 'precharge', 'cc', 'cv', 'full', 'idle', 'unknown'].includes(phase))) return;
  return Object.freeze({present, usbPower, percent, mv, flow, phase});
}

function sensorView(value) {
  const {touch, motion} = value ?? {};
  if (!['up', 'down', 'unknown'].includes(touch?.state) ||
      !(touch.last === null || vector(touch.last, 2, 0, 465))) return;
  if (motion !== null && !(vector(motion?.accelerationMg, 3, -4000, 4000) &&
    vector(motion?.rotationMdps, 3, -256000, 256000))) return;
  return Object.freeze({
    touch: Object.freeze({state: touch.state, last: touch.last && Object.freeze([...touch.last])}),
    motion: motion && Object.freeze({accelerationMg: Object.freeze([...motion.accelerationMg]),
      rotationMdps: Object.freeze([...motion.rotationMdps])}),
  });
}

function statusView(value) {
  if (value?.schema !== 1 || typeof value.version !== 'string' || !versionPattern.test(value.version) ||
    !['ota_0', 'ota_1'].includes(value.slot)) return;
  const battery = value.battery == null ? null : batteryView(value.battery);
  const sensors = value.sensors == null ? null : sensorView(value.sensors);
  if (battery === undefined || sensors === undefined) return;
  const {busy, selected} = value;
  if ((busy !== undefined || selected !== undefined) && (typeof busy !== 'boolean' || typeof selected !== 'boolean')) return;
  return Object.freeze({device: Object.freeze({version: value.version, slot: value.slot,
    ...(busy === undefined ? {} : {busy, selected})}), battery, sensors});
}

/**
 * Own one status session. Call attach only from a trusted adapter after
 * verifying the current binding, device/boot identity and message integrity.
 * The adapter must disconnect on revocation, socket close or authentication
 * failure, and call receive only with replies from that verified connection.
 * The input schema here is a host object, independent of the VPC1 wire format.
 */
export function createDeviceTelemetry({usbIdentity, onFresh, now = () => performance.now(), wallNow = Date.now,
  schedule = setTimeout, unschedule = clearTimeout}) {
  let current, stopped = false;

  function end(session) {
    if (session !== current) return;
    current = undefined;
    unschedule(session.timer);
    session.close();
  }

  function tick(session) {
    if (session !== current) return;
    const time = now();
    const age = time - session.contact;
    if (age >= closeMs) return end(session);
    const send = !session.push && time >= session.nextProbe;
    if (send) session.nextProbe = time + probeMs;
    const next = session.push ? closeMs - age : Math.min(session.nextProbe - time, closeMs - age);
    session.timer = schedule(() => tick(session), next);
    session.timer?.unref?.();
    if (!send) return;
    if (session.sequence === 0xffffffff) return end(session);
    session.pending = ++session.sequence;
    try { session.probe(session.pending); }
    catch { end(session); }
  }

  return {
    attach({usbIdentity: verifiedTarget, probe, close, push = false}) {
      requireThat(!stopped && verifiedTarget === usbIdentity &&
        (push ? probe === undefined : typeof probe === 'function') && typeof close === 'function', 'device_desktop_telemetry_target');
      if (current) end(current);
      const time = now();
      const session = {probe, close, push, sequence: 0, contact: time, nextProbe: time};
      current = session;
      tick(session);
      return {
        receive(sequence, value) {
          const expected = session.push ? session.sequence + 1 : session.pending;
          if (session !== current || expected === undefined || sequence !== expected || sequence > 0xffffffff) return false;
          const time = now();
          if (time - session.contact >= closeMs) { end(session); return false; }
          const status = statusView(value);
          if (!status) return false;
          session.status = Object.freeze({...status, lastHeartbeatAt: wallNow()});
          session.pending = undefined;
          if (session.push) session.sequence = sequence;
          session.contact = time;
          onFresh?.();
          return true;
        },
        disconnect() { end(session); },
      };
    },
    snapshot() {
      return current?.status && now() - current.contact < staleMs ? current.status : null;
    },
    close() {
      stopped = true;
      if (current) end(current);
    },
  };
}
