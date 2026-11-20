import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {createServer} from 'node:http';
import {isAbsolute} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openExclusiveNative400Tty} from './native400-pbp1-serial.mjs';
import {isPrivateMediaIPv4} from './native400-tcp-media-socket.mjs';
import {identifyMaintenanceUsb, openVerifiedDeviceTty} from './device-maintenance-usb.mjs';
import {serialLines} from './serial-lines.mjs';
import {observeWave} from './usb-wave.mjs';
import {readUsbDeviceStatus} from './usb-status-wire.mjs';

export const LEGACY_MEDIA_BYTES = 418536;
export const LEGACY_MEDIA_SHA256 = 'c47eae037765066dfd9c5c632ee32019487d22f831a8e9a83e4ab1a51710838c';
export const LEGACY_MEDIA_ROUTE = '/vp8/update/1-400.ivf';
export const MEDIA_INSTALL_OBJECT = Object.freeze({role: 0, action: 67, version: 1, frames: 241, bytes: 440248,
  sha256: '8a5f277f72213615a722f230047888e8adf60191cb4e19ad2c8d1b75b11b60c8', route: '/asset.ivf'});
const legacyObject = {bytes: LEGACY_MEDIA_BYTES, sha256: LEGACY_MEDIA_SHA256, route: LEGACY_MEDIA_ROUTE};
const claims = new WeakMap();
const mediaErrors = new Set(['INVALID', 'INVALID_MEDIA', 'NETWORK_FAILED', 'MEDIA_FAILED', 'CACHE_FULL', 'NO_MEMORY', 'CANCELLED']);
const otaErrors = new Set(['INVALID', 'INVALID_IMAGE', 'NETWORK_FAILED', 'OTA_FAILED', 'NO_MEMORY', 'CANCELLED', 'BUSY']);

export function parseUpdateStatus(line, media2) {
  if (!media2) {
    const match = /^STATUS committed=([01]) busy=([01])$/.exec(line);
    return match && {committed: match[1] === '1', busy: match[2] === '1'};
  }
  const match = /^STATUS busy=([01]) selected=([01]) slot=(ota_[01]) version=([0-9A-Za-z][0-9A-Za-z._+-]{0,30})$/.exec(line);
  return match && {busy: match[1] === '1', selected: match[2] === '1', slot: match[3], version: match[4]};
}

function need(ok, code, status = 400) {
  if (!ok) throw Object.assign(new Error(code), {status});
}

const stableVersion = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/;
const versionOrder = value => value.split('.').reduce((sum, part) => sum * 10000 + Number(part), 0);

export function releaseDescriptor({version, fromVersions, file, bytes, sha256}) {
  need(typeof version === 'string' && stableVersion.test(version) && Array.isArray(fromVersions) &&
    fromVersions.length >= 1 && fromVersions.length <= 16 && new Set(fromVersions).size === fromVersions.length &&
    fromVersions.every(from => typeof from === 'string' && stableVersion.test(from) && versionOrder(from) < versionOrder(version)) &&
    typeof file === 'string' && isAbsolute(file) && Number.isSafeInteger(bytes) && bytes >= 8192 && bytes <= 2097152 &&
    bytes % 4096 === 0 && typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256), 'device_ota_release');
  return {version, fromVersions: [...fromVersions], file, bytes, sha256, route: '/firmware.bin'};
}

/** Private owner configuration. The optional hooks are trusted host test dependencies. */
export function prepareDeviceUpdate({port, helper, file, address, ssid, password, operatorToken, protocol = 'update1',
  release, queryOnly = false, usbIdentity, waveTest = false, statusV2 = false, afterUpgradeStatusV2 = statusV2}, hooks = {}) {
  need(protocol === 'update1' || protocol === 'media2', 'device_protocol');
  need(typeof statusV2 === 'boolean' && typeof afterUpgradeStatusV2 === 'boolean' &&
    (protocol === 'media2' || (!statusV2 && !afterUpgradeStatusV2)) &&
    (release !== undefined || afterUpgradeStatusV2 === statusV2), 'device_status_profile');
  need(typeof queryOnly === 'boolean' && (!queryOnly || (protocol === 'media2' && release === undefined)), 'device_query_only');
  need((process.platform === 'darwin' && /^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]*$/.test(port)) ||
    (hooks.openTty && /^\/dev\/(?:ttys\d+|pts\/\d+)$/.test(port)), 'device_usb_target');
  need([helper, ...(queryOnly ? [] : [file])].every(value => typeof value === 'string' && isAbsolute(value)), 'device_path');
  need(typeof operatorToken === 'string' && /^[a-f0-9]{32,64}$/.test(operatorToken), 'device_config');
  need(usbIdentity === undefined || (queryOnly && typeof usbIdentity === 'string' &&
    /^\d+\/[a-f0-9:-]{8,48}$/.test(usbIdentity)), 'device_usb_target');
  need(typeof waveTest === 'boolean' && (!waveTest || (queryOnly && usbIdentity)), 'device_wave_test');
  if (!queryOnly) {
    need(isPrivateMediaIPv4(address), 'device_config');
    need(typeof ssid === 'string' && typeof password === 'string' && !ssid.includes('\0') && !password.includes('\0') &&
      Buffer.byteLength(ssid) >= 1 && Buffer.byteLength(ssid) <= 32 &&
      (!password || (Buffer.byteLength(password) >= 8 && Buffer.byteLength(password) <= 63)), 'device_wifi_config');
  }
  let firmware;
  if (release !== undefined) {
    need(protocol === 'media2' && release, 'device_ota_release');
    firmware = releaseDescriptor({...release, fromVersions: release.fromVersions ?? ['0.1.3']});
  }
  const option = Object.freeze({});
  const config = {port, helper, file, address, ssid, password, protocol, firmware, queryOnly, usbIdentity, waveTest, token: Buffer.from(operatorToken),
    statusV2, afterUpgradeStatusV2,
    openTty: hooks.openTty ?? openExclusiveNative400Tty, identifyUsb: hooks.identifyUsb ?? identifyMaintenanceUsb,
    listen: hooks.listen, timeoutMs: hooks.timeoutMs ?? 60000, reconnectMs: hooks.reconnectMs ?? 45000,
    waveTimeoutMs: hooks.waveTimeoutMs ?? 20000};
  claims.set(option, config);
  return option;
}

export function deviceMediaDescriptor(option) {
  const config = claims.get(option);
  need(config, 'device_config');
  return createHmac('sha256', config.token).update(JSON.stringify([config.port, config.helper, config.file, config.address,
    config.ssid, config.password, config.protocol, ...(config.firmware ? [config.firmware] : []),
    ...(config.queryOnly ? ['query-only', config.usbIdentity] : []), ...(config.waveTest ? ['wave-test'] : []),
    ...(config.statusV2 || config.afterUpgradeStatusV2 ? ['status-v2', config.statusV2, config.afterUpgradeStatusV2] : [])])).digest('hex');
}

/** Read one bounded snapshot and keep the exact verified bytes for HTTP. */
export async function readDeviceMediaObject(file, protocol = 'update1') {
  need(protocol === 'update1' || protocol === 'media2', 'device_protocol');
  const object = protocol === 'media2' ? MEDIA_INSTALL_OBJECT : legacyObject;
  return readPinnedObject(file, object);
}

export async function readFirmwareObject(release) {
  const data = await readPinnedObject(release.file, release);
  need(data[0] === 0xe9 && data.at(-4096) === 0xe7 && data.at(-4095) === 2, 'device_object');
  return data;
}

async function readPinnedObject(file, object) {
  const fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await fd.stat();
    need(stat.isFile() && stat.size === object.bytes, 'device_object');
    const data = Buffer.alloc(object.bytes);
    for (let offset = 0; offset < data.length;) {
      const {bytesRead} = await fd.read(data, offset, data.length - offset, offset);
      need(bytesRead > 0, 'device_object');
      offset += bytesRead;
    }
    need(createHash('sha256').update(data).digest('hex') === object.sha256, 'device_object');
    return data;
  } finally { await fd.close(); }
}

async function readDeviceStatus(tty, media2, signal, onProbe) {
  do { signal.throwIfAborted(); } while (await tty.read({discard: true}));
  onProbe?.('write');
  await tty.write(media2 ? 'STATUS2\n' : 'STATUS1\n', signal);
  onProbe?.('read');
  for (;;) {
    signal.throwIfAborted();
    const lines = await tty.read();
    signal.throwIfAborted();
    for (const line of lines ?? []) {
      const status = parseUpdateStatus(line, media2);
      if (status) return status;
    }
    await delay(10, undefined, {signal});
  }
}

async function publishObject(data, config, route, signal) {
  let serving = false, served = false;
  const server = createServer({maxHeaderSize: 2048}, (req, res) => {
    res.setHeader('Connection', 'close');
    if (signal.aborted || !serving || served || req.method !== 'GET' || req.url !== route || req.headers.range !== undefined ||
        req.headers['content-length'] !== undefined || req.headers['transfer-encoding'] !== undefined) {
      res.writeHead(404, {'Content-Length': '0'}).end();
      return;
    }
    served = true;
    res.writeHead(200, {'Content-Length': data.length, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(data);
  });
  server.maxConnections = 4;
  server.requestTimeout = 3000;
  server.headersTimeout = 3000;
  server.setTimeout(5000, socket => socket.destroy());
  const close = () => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      (config.listen ?? ((target, address, ready) => target.listen({host: address, port: 0, exclusive: true}, ready)))(server, config.address, resolve);
    });
    signal.throwIfAborted();
    return {port: server.address().port, activate() { serving = true; }, close};
  } catch (error) { await close(); throw error; }
}

/** One runtime-owned USB job at a time. Browser commands enqueue, then poll snapshot(). */
export function createDeviceUpdateOwner(option, instanceId) {
  const config = claims.get(option);
  need(config, 'device_config');
  const media2 = config.protocol === 'media2';
  const statusProbeField = config.statusV2 ? 'status3Sent' : 'status2Sent';
  const mediaObject = media2 ? MEDIA_INSTALL_OBJECT : legacyObject;
  let state = {revision: 0, phase: 'idle', compatible: false, saved: null, existing: null, cancellable: false, error: null};
  if (media2) Object.assign(state, {protocol: 'media2', device: null, receipt: null,
    ...(config.queryOnly ? {queryOnly: true, [statusProbeField]: false} : {})});
  if (config.firmware) state.ota = {targetVersion: config.firmware.version, selectedSeen: false, rebootSent: false, success: null};
  if (config.waveTest) state.wave = {available: true, phase: 'idle', sent: false, frames: null, returnedIdle: false, error: null};
  let task, current, closed = false, queryRequired = false, otaUncertain = false, statusV2 = config.statusV2;
  const stop = new AbortController();
  const upgradeAvailability = () => {
    if (!config.firmware) return 'unavailable';
    if (otaUncertain) return 'reconcile_required';
    if (!state.device) return 'query_required';
    if (state.device.busy || state.device.selected) return 'device_busy';
    if (state.device.version === config.firmware.version) return 'current';
    return config.firmware.fromVersions.includes(state.device.version) ? 'available' : 'ineligible';
  };
  const snapshot = () => ({...state, ...(media2 ? {upgradeAvailability: upgradeAvailability()} : {})});
  const set = patch => { state = {...state, ...patch, revision: state.revision + 1}; };
  const setOta = patch => set({ota: {...state.ota, ...patch}});
  const setWave = patch => set({wave: {...state.wave, ...patch}});

  const openTty = (identity, signal) => openVerifiedDeviceTty({
    port: config.port, helper: config.helper, identity, identifyUsb: config.identifyUsb,
    openTty: config.openTty, signal,
  });
  async function readState(io, signal, onProbe, useV2 = statusV2) {
    if (!useV2) return readDeviceStatus(serialLines(io, media2 ? '@VP8_OTA ' : '@VP8_UPDATE '), media2, signal, onProbe);
    const {version, slot, busy, selected} = await readUsbDeviceStatus(io, signal, onProbe);
    return {version, slot, busy, selected};
  }

  async function confirmBoot(identity, originalSlot) {
    const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(config.reconnectMs)]);
    for (;;) {
      await delay(350, undefined, {signal});
      let fresh, device;
      try {
        fresh = await openTty(identity, signal);
        device = await readState(fresh, AbortSignal.any([signal, AbortSignal.timeout(2000)]), undefined,
          config.afterUpgradeStatusV2);
      } catch {
        signal.throwIfAborted();
      } finally { await fresh?.close(); }
      if (device) {
        set({device});
        if (device.version === config.firmware.version && device.slot !== originalSlot && !device.selected &&
            (!config.afterUpgradeStatusV2 || !device.busy)) {
          statusV2 = config.afterUpgradeStatusV2;
          return;
        }
      }
    }
  }

  async function runWave() {
    const check = AbortSignal.any([stop.signal, AbortSignal.timeout(5500)]);
    let io, attempted = false, result;
    try {
      io = await openTty(config.usbIdentity, check);
      const device = await readState(io, AbortSignal.any([check, AbortSignal.timeout(2500)]));
      set({device});
      need(!device.busy && !device.selected && (config.statusV2 || device.version === '0.1.4'), 'wave_device_unavailable');

      const tty = serialLines(io, '@VP8_'), observe = observeWave();
      do { check.throwIfAborted(); } while (await tty.read({discard: true}));
      check.throwIfAborted();
      const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(config.waveTimeoutMs)]);
      attempted = true;
      await tty.write('WAVE\n', signal);
      setWave({phase: 'awaiting', sent: true});
      while (!result) {
        signal.throwIfAborted();
        const lines = await tty.read();
        for (const line of lines ?? []) {
          signal.throwIfAborted();
          const observed = observe(line);
          if (observed?.phase === 'complete') { result = observed; break; }
          if (observed) setWave(observed);
        }
        if (!result && lines === null) await delay(10, undefined, {signal});
      }
    } catch (error) {
      const reasons = ['wave_incomplete', 'wave_device_unavailable', 'device_ota_usb_identity', 'pbp_serial_exclusive'];
      result = {phase: attempted ? 'unknown' : 'rejected', error: error.name === 'TimeoutError' ? 'wave_timeout' :
        stop.signal.aborted ? 'wave_stopped' : reasons.includes(error.message) ? error.message : 'wave_io'};
    } finally {
      try { await io?.close(); }
      catch { closed = true; result = {phase: 'unknown', error: 'cleanup_failed'}; }
    }
    setWave(result);
  }

  async function run(operation, job) {
    const ota = operation === 'upgrade';
    const object = ota ? config.firmware : mediaObject;
    const deadline = AbortSignal.timeout(config.timeoutMs);
    const signal = AbortSignal.any([stop.signal, deadline]);
    let io, published, attempted = false, probeStage = 'read';
    let result;
    try {
      const identity = ota ? await config.identifyUsb(config.port, {signal}) : config.usbIdentity;
      if (ota) need(identity, 'device_ota_usb_identity');
      io = await openTty(identity, signal);
      const tty = serialLines(io, media2 ? '@VP8_OTA ' : '@VP8_UPDATE ');
      const probeSignal = AbortSignal.any([signal, AbortSignal.timeout(2500)]);
      const status = await readState(io, probeSignal, config.queryOnly ? stage => {
        probeStage = stage;
        if (stage === 'read') set({[statusProbeField]: true});
      } : undefined);
      set({compatible: true, ...(media2 ? {device: status} : {})});
      if (media2 && operation === 'query' && !status.busy && !status.selected) otaUncertain = false;
      if (status.committed) {
        queryRequired = false;
        result = {phase: 'saved', saved: true, existing: true};
      }
      else if (media2 && (status.busy || status.selected)) result = {phase: 'blocked', error: 'device_busy'};
      else if (ota && !object.fromVersions.includes(status.version)) result = {phase: 'blocked', error: 'firmware_ineligible'};
      else if (status.busy) result = {phase: 'unknown', error: 'device_busy'};
      else if (operation === 'query') {
        if (media2) result = {phase: queryRequired ? 'unknown' : 'ready'};
        else {
          queryRequired = false;
          result = {phase: 'not_saved', saved: false};
        }
      }
      else if (job.cancel) result = {phase: 'cancelled'};
      else {
        const data = ota ? await readFirmwareObject(object) : await readPinnedObject(config.file, object);
        signal.throwIfAborted();
        published = await publishObject(data, config, object.route, signal);
        if (job.cancel) result = {phase: 'cancelled'};
        else {
          const ssid = Buffer.from(config.ssid), password = Buffer.from(config.password);
          try {
            attempted = true;
            published.activate();
            const endpoint = `${config.address} ${published.port}`;
            const command = ota ? `OTA2 ${endpoint} ${object.bytes} ${object.sha256}` :
              media2 ? `MEDIA2 ${endpoint} ${object.role} ${object.action} ${object.version} ${object.frames} ${object.bytes} ${object.sha256}` :
              `UPDATE1 ${endpoint}`;
            await tty.write(`${command} ${ssid.toString('hex')} ${password.toString('hex') || '-'}\n`, signal);
          } finally { ssid.fill(0); password.fill(0); }
          let accepted = false, cancelSent = false;
          while (!result) {
            signal.throwIfAborted();
            if (job.cancel && !cancelSent) {
              cancelSent = true;
              await tty.write('CANCEL1\n', signal);
              set({phase: 'cancelling', cancellable: false});
            }
            for (const line of await tty.read() ?? []) {
              signal.throwIfAborted();
              const saved = !media2 && /^SAVED id=1 existing=([01])$/.exec(line);
              if (line === 'ACCEPTED' && !accepted) {
                accepted = true;
                if (!cancelSent) set({phase: 'updating'});
              } else if (ota && accepted && line === 'SELECTED') {
                setOta({selectedSeen: true});
                result = {phase: 'selected'};
              } else if (ota && otaErrors.has(line)) result = {phase: 'failed', error: 'device_failed'};
              else if (accepted && saved) result = {phase: 'saved', saved: true, existing: saved[1] === '1'};
              else if (!ota && media2 && accepted && (line === 'MEDIA_SAVED' || line === 'MEDIA_EXISTING'))
                result = {phase: 'saved', saved: true, existing: line === 'MEDIA_EXISTING', receipt: line};
              else if (!ota && media2 && mediaErrors.has(line)) result = {phase: 'failed', error: 'device_failed'};
              else if (media2 && line === 'WIFI_CLEANUP_FAILED' && !accepted) result = {phase: 'failed', error: 'device_failed'};
              else if (accepted && cancelSent && line === 'CANCELLED') result = {phase: 'cancelled'};
              else if (line === 'BUSY') result = {phase: 'unknown', error: 'device_busy'};
              else if (/^FAILED reason=[a-z_]{1,32}$/.test(line)) result = {phase: 'failed', error: 'device_failed'};
              if (result) break;
            }
            if (!result) await delay(10, undefined, {signal});
          }
          if (ota && result.phase === 'selected') {
            await published.close();
            published = null;
            need(await config.identifyUsb(config.port, {signal}) === identity, 'device_ota_usb_identity');
            await tty.write('REBOOT2\n', signal);
            setOta({rebootSent: true});
            await io.close();
            io = null;
            set({phase: 'reconnecting'});
            await confirmBoot(identity, status.slot);
            result = {phase: 'upgraded'};
          }
        }
      }
    } catch (error) {
      let reason = error.message === 'device_object' ? 'object_rejected' : 'io_or_unsupported';
      if (config.queryOnly) {
        if (error.code === 'device_desktop_usb_busy') reason = 'usb_busy';
        else if (error.message === 'device_ota_usb_identity') reason = 'usb_identity_unavailable';
        else if (!io) reason = error.message === 'pbp_serial_exclusive' ? 'usb_exclusive_failed' : 'usb_open_failed';
        else reason = probeStage === 'read' ? 'usb_status_read_failed' : 'usb_status_write_failed';
      }
      result = {phase: attempted || (operation === 'query' && queryRequired) ? 'unknown' : 'failed',
        error: signal.aborted ? 'deadline_or_closed' : reason};
    } finally {
      const cleanup = await Promise.allSettled([published?.close(), io?.close()]);
      if (cleanup.some(item => item.status === 'rejected')) {
        closed = true;
        result = {...result, error: 'cleanup_failed'};
      }
    }
    if (!ota && result.phase === 'unknown') queryRequired = true;
    else if (result.phase === 'saved') queryRequired = false;
    if (ota) {
      otaUncertain = result.phase === 'unknown';
      setOta({success: result.phase === 'upgraded' ? true : otaUncertain ? null : false});
    }
    set({...result, cancellable: false});
  }

  return {
    snapshot,
    authorize(token) {
      const supplied = Buffer.from(typeof token === 'string' ? token : '');
      return supplied.length === config.token.length && timingSafeEqual(supplied, config.token);
    },
    command(input) {
      need(!closed && input && Object.keys(input).length === 3 && input.instanceId === instanceId &&
        Number.isSafeInteger(input.revision) && input.revision === state.revision, 'device_stale', 409);
      if (input.operation === 'wave') {
        need(!task && state.wave?.available, 'device_wave_unavailable', 409);
        setWave({available: false, phase: 'checking'});
        task = runWave().finally(() => { task = null; });
        return snapshot();
      }
      need(!config.queryOnly || input.operation === 'query', 'device_query_only', 409);
      if (input.operation === 'cancel') {
        need(task && state.cancellable, 'device_not_cancellable', 409);
        current.cancel = true;
        set({phase: 'cancelling', cancellable: false});
      } else {
        need(!task && (['query', 'install'].includes(input.operation) ||
          (input.operation === 'upgrade' && upgradeAvailability() === 'available')), 'device_busy_or_invalid', 409);
        need(input.operation !== 'install' || media2 || !queryRequired, 'device_query_required', 409);
        current = {cancel: false};
        if (input.operation === 'upgrade') setOta({selectedSeen: false, rebootSent: false, success: null});
        set({phase: input.operation === 'query' ? 'querying' : 'preparing', compatible: false, saved: null,
          existing: null, cancellable: input.operation === 'install' && !media2, error: null,
          ...(config.queryOnly ? {[statusProbeField]: false} : {}),
          ...(media2 ? {device: null, receipt: null} : {})});
        task = run(input.operation, current).finally(() => { task = null; });
      }
      return snapshot();
    },
    async close() { closed = true; stop.abort(); await task; },
  };
}
