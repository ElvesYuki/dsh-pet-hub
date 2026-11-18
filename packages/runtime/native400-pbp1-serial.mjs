import {spawn} from 'node:child_process';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute, normalize} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {decodePbp1Frame, pbp1Header, PBP1_FRAME_MAX, PBP1_HEADER_BYTES} from '../core/native400-pbp1-wire.mjs';

const MAGIC = Buffer.from('PBP1');
const INPUT_LIMIT = 256 * 1024;
const CLOSED = new Error('pbp_serial_closed');
const BINDING_REPLIES = new Map([['binding-info', 'binding-status'], ['binding-challenge', 'binding-nonce'],
  ['binding-enroll', 'binding-enrolled'], ['binding-resume', 'binding-active']]);

function need(condition, code) {
  if (!condition) throw new Error(code);
}

function configure(helper, fd) {
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [], {stdio: ['ignore', 'ignore', 'ignore', fd]});
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    let failed = false;
    child.once('error', () => { failed = true; });
    child.once('close', code => {
      clearTimeout(timer);
      if (!failed && code === 0) resolve();
      else reject(new Error('pbp_serial_exclusive'));
    });
  });
}

function responseDecoder(expected, options, accept) {
  const frame = Buffer.alloc(PBP1_FRAME_MAX);
  let used = 0;
  function skip() {
    frame.copyWithin(0, 1, used);
    --used;
  }
  return {
    push(bytes) {
      for (const byte of bytes) {
        frame[used++] = byte;
        while (used) {
          if (!frame.subarray(0, Math.min(used, MAGIC.length)).equals(MAGIC.subarray(0, used))) {
            skip();
            continue;
          }
          if (used < PBP1_HEADER_BYTES) break;
          let decoded;
          try {
            const {kind, length} = pbp1Header(frame.subarray(0, PBP1_HEADER_BYTES), options);
            if (!options.allowBinding && kind !== expected) {
              skip();
              continue;
            }
            if (used < PBP1_HEADER_BYTES + length) break;
            decoded = decodePbp1Frame(frame.subarray(0, used), options);
          } catch {
            // Slide one byte to retain a valid frame that overlaps a false prefix.
            skip();
            continue;
          }
          if (decoded.kind === expected && (!accept || accept(decoded))) return Uint8Array.from(frame.subarray(0, used));
          frame.fill(0, 0, used);
          used = 0;
        }
      }
      return null;
    },
    clear: () => frame.fill(0)
  };
}

function unavailable(error) {
  return error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK' || error.code === 'EINTR';
}

/** Adapt an owned, raw nonblocking TTY description. Used by the POSIX opener
 * and deterministic short-I/O tests. The description closes after I/O exits. */
export function createPbp1SerialTransport(io, {timeoutMs = 1000, allowLanArm = false, allowBinding = false} = {}) {
  need(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 5000, 'pbp_serial_timeout');
  const stop = new AbortController();
  const options = {allowBinding};
  let active, closing;

  async function exchange(packet, caller, expected, accept) {
    const expires = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([stop.signal, expires, ...(caller ? [caller] : [])]);
    const buffer = Buffer.alloc(512);
    const parser = responseDecoder(expected, options, accept);
    let writing = false;
    let readBytes = 0;
    async function read() {
      signal.throwIfAborted();
      try {
        const {bytesRead} = await io.read(buffer, 0, buffer.length, null);
        need(bytesRead > 0 && bytesRead <= buffer.length, 'pbp_serial_disconnected');
        readBytes += bytesRead;
        need(readBytes <= INPUT_LIMIT, 'pbp_serial_input_busy');
        return bytesRead;
      } catch (error) {
        if (unavailable(error)) return 0;
        throw error;
      }
    }
    try {
      // Drop bytes already queued before this request, including any old reply.
      while (await read()) {}
      writing = true;
      for (let offset = 0; offset < packet.length;) {
        signal.throwIfAborted();
        try {
          const {bytesWritten} = await io.write(packet, offset, packet.length - offset, null);
          need(bytesWritten > 0 && bytesWritten <= packet.length - offset, 'pbp_serial_write');
          offset += bytesWritten;
        } catch (error) {
          if (!unavailable(error)) throw error;
          await delay(5, undefined, {signal});
        }
      }
      writing = false;
      for (;;) {
        const count = await read();
        signal.throwIfAborted();
        if (!count) await delay(5, undefined, {signal});
        const frame = parser.push(buffer.subarray(0, count));
        if (frame) return frame;
      }
    } catch (error) {
      if (writing || !signal.aborted) {
        // A partial request must not share the wire with a subsequent request.
        void close().catch(() => {});
        if (writing) throw new Error('pbp_serial_write');
        throw error;
      }
      if (stop.signal.aborted) throw CLOSED;
      return null;
    } finally {
      parser.clear();
      buffer.fill(0);
    }
  }

  function close() {
    if (!closing) {
      closing = Promise.resolve().then(async () => {
        if (active) await Promise.allSettled([active]);
        await io.close();
      });
      stop.abort(CLOSED);
    }
    return closing;
  }
  return Object.freeze({
    exchange(packet, {signal, accept} = {}) {
      need(!closing, 'pbp_serial_closed');
      need(!active, 'pbp_serial_busy');
      const {kind} = decodePbp1Frame(packet, options);
      const bindingReply = BINDING_REPLIES.get(kind);
      const legacy = kind === 'info' || kind === 'offer' || kind === 'confirm' || kind === 'cancel';
      need(bindingReply || (legacy && !allowBinding) || (kind === 'lan-arm' && allowLanArm === true), 'pbp_serial_request');
      active = Promise.resolve().then(() => exchange(packet, signal, bindingReply ?? 'state', accept)).finally(() => { active = undefined; });
      return active;
    },
    close
  });
}

/** Open only the explicit POSIX port. The trusted native helper configures fd 3
 * and exits before any request. No device discovery or modem-line commands. */
export async function openNative400Pbp1Serial({enabled = false, port, helper, timeoutMs, allowLanArm, allowBinding} = {}) {
  const io = await openExclusiveNative400Tty({enabled, port, helper});
  try { return createPbp1SerialTransport(io, {timeoutMs, allowLanArm, allowBinding}); }
  catch (error) { await io.close(); throw error; }
}

/** Shared raw POSIX TTY opener. The caller owns the returned file handle. */
export async function openExclusiveNative400Tty({enabled = false, port, helper} = {}) {
  need(enabled === true, 'pbp_serial_disabled');
  need(typeof port === 'string' && /^\/dev\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(port) &&
    normalize(port) === port && typeof helper === 'string' && isAbsolute(helper) && !helper.includes('\0'), 'pbp_serial_path');
  const io = await open(port, constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    need((await io.stat()).isCharacterDevice(), 'pbp_serial_device');
    await configure(helper, io.fd);
    return io;
  } catch (error) {
    try { await io.close(); }
    catch (cause) {
      throw Object.assign(new Error('pbp_serial_release', {cause}), {usbReleaseUnconfirmed: true});
    }
    throw error;
  }
}
