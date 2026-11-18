import {lstat} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {decodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {requireThat as need} from '../core/protocol.mjs';
import {openExclusiveNative400Tty} from './native400-pbp1-serial.mjs';
import {identifyVp8OtaUsb} from './vp8-ota-usb.mjs';

const allow = {allowBinding: true, allowVp8BootProof: true};
const replies = new Map([['binding-info', 'binding-status'], ['binding-challenge', 'binding-nonce'],
  ['binding-enroll', 'binding-enrolled'], ['vp8-binding-proof', 'vp8-binding-proof-result']]);
const transient = new Set(['EINTR', 'EAGAIN', 'EWOULDBLOCK']);
const limit = 65536;
const devicePath = /^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]{1,80}$/;
const fixturePath = /^\/dev\/(?:ttys[0-9]{3,4}|pts\/[0-9]{1,5})$/;

function decodeLine(line, reply) {
  const prefix = reply ? '@VP8_PAIR1 ' : 'VP8PAIR1 ';
  need(typeof line === 'string' && line.startsWith(prefix) && line.endsWith('\n') && line.length <= 278,
    'vp8_serial_frame');
  const encoded = line.slice(prefix.length, reply && line.endsWith('\r\n') ? -2 : -1);
  const packet = Buffer.from(encoded, 'base64');
  need(encoded.length <= 264 && packet.toString('base64') === encoded, 'vp8_serial_frame');
  return decodePbp1Frame(packet, allow);
}

function sameNode(a, b) {
  return a.isCharacterDevice() && b.isCharacterDevice() &&
    ['dev', 'ino', 'rdev'].every(field => a[field] === b[field]);
}

/** Explicitly selected USB callout or isolated PTY. USB identity is verified
 * on both sides of opening, then the fd never changes during the attempt. */
export function createVp8BootSerial({port, usbIdentity, helper, fixture = false, timeoutMs = 1500},
  {identify = identifyVp8OtaUsb, openTty = openExclusiveNative400Tty, inspect = lstat} = {}) {
  need((fixture ? fixturePath : devicePath).test(port) && (fixture ? usbIdentity === undefined :
    typeof usbIdentity === 'string' && /^\d+\/[a-f0-9:-]{8,48}$/.test(usbIdentity)), 'vp8_serial_endpoint');
  need(Number.isInteger(timeoutMs) && timeoutMs >= 25 && timeoutMs <= 5000, 'vp8_serial_timeout');
  let occupied = false;
  const stat = () => inspect(port, {bigint: true});
  async function confirmUsb(signal) {
    signal.throwIfAborted();
    if (!fixture) need(await identify(port, {signal}) === usbIdentity, 'vp8_serial_identity');
    signal.throwIfAborted();
  }

  return async function openSession({signal = new AbortController().signal} = {}) {
    need(!occupied, 'vp8_serial_busy');
    occupied = true;
    let io;
    try {
      const node = await stat();
      need(node.isCharacterDevice(), 'vp8_serial_identity');
      await confirmUsb(signal);
      need(sameNode(node, await stat()), 'vp8_serial_identity');
      io = await openTty({enabled: true, port, helper});
      const fd = await io.stat({bigint: true});
      need(sameNode(fd, node), 'vp8_serial_identity');
      await confirmUsb(signal);
      need(sameNode(fd, await stat()), 'vp8_serial_identity');
      signal.throwIfAborted();
      const session = serialSession(io, timeoutMs, async () => {
        need(sameNode(fd, await stat()), 'vp8_serial_identity');
      });
      let closing;
      return Object.freeze({exchange: session.exchange, close() {
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
  async function run(line, kind, expected, caller) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([stop.signal, deadline, ...(caller ? [caller] : [])]);
    const request = Buffer.from(line, 'ascii'), bytes = Buffer.alloc(512), word = Buffer.alloc(383);
    let total = 0, used = 0, discard = false, sent = false;

    async function read() {
      signal.throwIfAborted();
      try {
        const {bytesRead} = await io.read(bytes, 0, bytes.length, null);
        total += bytesRead;
        need(bytesRead > 0 && bytesRead <= bytes.length && total <= limit, 'vp8_serial_disconnected');
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
      for (let offset = 0; offset < request.length;) {
        signal.throwIfAborted();
        try {
          const {bytesWritten} = await io.write(request, offset, request.length - offset, null);
          need(bytesWritten > 0 && bytesWritten <= request.length - offset, 'vp8_serial_write');
          offset += bytesWritten;
        } catch (error) {
          if (!transient.has(error.code)) throw error;
          await delay(5, undefined, {signal});
        }
      }
      sent = true;
      for (;;) {
        const size = await read();
        if (!size) await delay(5, undefined, {signal});
        for (const byte of bytes.subarray(0, size)) {
          if (byte === 10) {
            const candidate = !discard && word.toString('latin1', 0, used) + '\n';
            used = 0;
            discard = false;
            if (!candidate || !candidate.startsWith('@VP8_PAIR1 ')) continue;
            let match = false;
            try { match = decodeLine(candidate, true).kind === expected; }
            catch { /* Drop malformed line within the total input and time limits. */ }
            if (!match) continue;
            await confirmNode();
            signal.throwIfAborted();
            return candidate;
          }
          if (used === word.length || byte < 0x0d || byte > 0x7e || (byte > 0x0d && byte < 0x20)) discard = true;
          if (!discard) word[used++] = byte;
        }
      }
    } catch (error) {
      failed = true;
      if (sent && kind === 'binding-info' && deadline.aborted && !caller?.aborted && !stop.signal.aborted) return null;
      throw error;
    } finally { bytes.fill(0); word.fill(0); request.fill(0); }
  }

  return {
    exchange(line, {signal} = {}) {
      need(!active && !closed && !failed, 'vp8_serial_busy');
      const {kind} = decodeLine(line, false), expected = replies.get(kind);
      need(expected, 'vp8_serial_frame');
      active = run(line, kind, expected, signal).finally(() => { active = undefined; });
      return active;
    },
    close() {
      stop.abort();
      return closed ??= (async () => { if (active) await Promise.allSettled([active]); await io.close(); })();
    },
  };
}
