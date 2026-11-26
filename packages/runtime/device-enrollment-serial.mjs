import {lstat} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {decodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {requireThat as need} from '../core/protocol.mjs';
import {openExclusiveTty} from './exclusive-tty.mjs';
import {identifyMaintenanceUsb} from './device-maintenance-usb.mjs';

const allow = {allowBinding: true, allowBootProof: true};
const replies = new Map([['binding-info', 'binding-status'], ['binding-challenge', 'binding-nonce'],
  ['binding-enroll', 'binding-enrolled'], ['vp8-binding-proof', 'vp8-binding-proof-result']]);
const transient = new Set(['EINTR', 'EAGAIN', 'EWOULDBLOCK']);
const limit = 65536;
const devicePath = /^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]{1,80}$/;
const fixturePath = /^\/dev\/(?:ttys[0-9]{3,4}|pts\/[0-9]{1,5})$/;

function decodeLine(line, reply) {
  const prefix = reply ? '@VP8_PAIR1 ' : 'VP8PAIR1 ';
  need(typeof line === 'string' && line.startsWith(prefix) && line.endsWith('\n') && line.length <= 278,
    'device_serial_frame');
  const encoded = line.slice(prefix.length, reply && line.endsWith('\r\n') ? -2 : -1);
  const packet = Buffer.from(encoded, 'base64');
  need(encoded.length <= 264 && packet.toString('base64') === encoded, 'device_serial_frame');
  return decodePbp1Frame(packet, allow);
}

function sameNode(a, b) {
  return a.isCharacterDevice() && b.isCharacterDevice() &&
    ['dev', 'ino', 'rdev'].every(field => a[field] === b[field]);
}

/** Explicitly selected USB callout or isolated PTY. USB identity is verified
 * on both sides of opening, then the fd never changes during the attempt. */
export function createBootSerial({port, usbIdentity, helper, fixture = false, timeoutMs = 1500},
  {identify = identifyMaintenanceUsb, openTty = openExclusiveTty, inspect = lstat} = {}) {
  need((fixture ? fixturePath : devicePath).test(port) && (fixture ? usbIdentity === undefined :
    typeof usbIdentity === 'string' && /^\d+\/[a-f0-9:-]{8,48}$/.test(usbIdentity)), 'device_serial_endpoint');
  need(Number.isInteger(timeoutMs) && timeoutMs >= 25 && timeoutMs <= 5000, 'device_serial_timeout');
  let occupied = false;
  const stat = () => inspect(port, {bigint: true});
  async function confirmUsb(signal) {
    signal.throwIfAborted();
    if (!fixture) need(await identify(port, {signal}) === usbIdentity, 'device_serial_identity');
    signal.throwIfAborted();
  }

  return async function openSession({signal = new AbortController().signal} = {}) {
    need(!occupied, 'device_serial_busy');
    occupied = true;
    let io;
    try {
      const node = await stat();
      need(node.isCharacterDevice(), 'device_serial_identity');
      await confirmUsb(signal);
      need(sameNode(node, await stat()), 'device_serial_identity');
      io = await openTty({enabled: true, port, helper});
      const fd = await io.stat({bigint: true});
      need(sameNode(fd, node), 'device_serial_identity');
      await confirmUsb(signal);
      need(sameNode(fd, await stat()), 'device_serial_identity');
      signal.throwIfAborted();
      const session = serialSession(io, timeoutMs, async () => {
        need(sameNode(fd, await stat()), 'device_serial_identity');
      });
      let closing;
      return Object.freeze({exchange: session.exchange, exchangeDesktop: session.exchangeDesktop, close() {
        return closing ??= session.close().then(() => { occupied = false; });
      }});
    } catch (error) {
      await io?.close();
      occupied = false;
      throw error;
    }
  };
}

function serialSession(io, timeoutMs, confirmNode) {
  const stop = new AbortController();
  let active, closed, failed = false;
  async function run(request, {prefix, match, signal: caller, beforeWrite, allowTimeout, bindingProbe}) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([stop.signal, deadline, ...(caller ? [caller] : [])]);
    const bytes = Buffer.alloc(512), word = Buffer.alloc(prefix === '@VP8_DESKNET3 ' ? 512 : 383);
    const start = Buffer.from(prefix, 'ascii');
    let total = 0, used = 0, discard = false, sent = false;

    async function read() {
      signal.throwIfAborted();
      try {
        const {bytesRead} = await io.read(bytes, 0, bytes.length, null);
        total += bytesRead;
        need(bytesRead > 0 && bytesRead <= bytes.length && total <= limit, 'device_serial_disconnected');
        return bytesRead;
      } catch (error) {
        if (transient.has(error.code)) return 0;
        throw error;
      }
    }

    try {
      await confirmNode();
      while (await read()) {}
      await confirmNode();
      signal.throwIfAborted();
      beforeWrite?.();
      for (let offset = 0; offset < request.length;) {
        signal.throwIfAborted();
        try {
          const {bytesWritten} = await io.write(request, offset, request.length - offset, null);
          need(bytesWritten > 0 && bytesWritten <= request.length - offset, 'device_serial_write');
          offset += bytesWritten;
        } catch (error) {
          if (!transient.has(error.code)) throw error;
          await delay(5, undefined, {signal});
        }
      }
      sent = true;
      request.fill(0);
      for (;;) {
        const size = await read();
        if (!size) await delay(5, undefined, {signal});
        for (const byte of bytes.subarray(0, size)) {
          if (byte === 10) {
            const reply = !discard && used >= start.length && word.subarray(0, start.length).equals(start) ?
              match(word.toString('latin1', 0, used) + '\n') : undefined;
            used = 0;
            discard = false;
            if (!reply) continue;
            await confirmNode();
            signal.throwIfAborted();
            return reply;
          }
          if (used === word.length || byte < 0x0d || byte > 0x7e || (byte > 0x0d && byte < 0x20)) discard = true;
          if (!discard) word[used++] = byte;
        }
      }
    } catch (error) {
      const timedOut = sent && deadline.aborted && !caller?.aborted && !stop.signal.aborted;
      if (timedOut && allowTimeout) return null;
      failed = true;
      if (timedOut && bindingProbe) return null;
      throw error;
    } finally { bytes.fill(0); word.fill(0); request.fill(0); }
  }

  function start(request, options) {
    active = run(request, options).finally(() => { active = undefined; });
    return active;
  }

  return {
    exchange(line, {signal} = {}) {
      need(!active && !closed && !failed, 'device_serial_busy');
      const {kind} = decodeLine(line, false), expected = replies.get(kind);
      need(expected, 'device_serial_frame');
      return start(Buffer.from(line, 'ascii'), {signal, bindingProbe: kind === 'binding-info', prefix: '@VP8_PAIR1 ',
        match(candidate) {
          try { return decodeLine(candidate, true).kind === expected ? candidate : null; }
          catch { return null; }
        }});
    },
    exchangeDesktop(request, options) {
      need(!active && !closed && !failed, 'device_serial_busy');
      need(Buffer.isBuffer(request) && request.length <= 383 && request.at(-1) === 10 &&
        ['@VP8_DESKNET2 ', '@VP8_DESKNET3 ', '@VP8_DESKWEATHER1 ', '@VP8_OTA STATUS ', '@VP8_VPCNET1 ', '@VP8_STATUS3 ', '@BINDKEY '].includes(options.prefix),
      'device_serial_frame');
      return start(request, options);
    },
    close() {
      stop.abort();
      return closed ??= (async () => { if (active) await Promise.allSettled([active]); await io.close(); })();
    },
  };
}
