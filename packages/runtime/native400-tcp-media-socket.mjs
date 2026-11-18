import {isIPv4, Socket} from 'node:net';
import {decodeMediaFrame, encodeMediaFrame, mediaHeader, MEDIA_HEADER_BYTES} from '../core/native400-tcp-media-wire.mjs';

export function openMediaLoopbackIO(socket) {
  return openBoundMediaIO(socket, value => value.localAddress === '127.0.0.1' && value.remoteAddress === '127.0.0.1',
    'media_loopback_required');
}

export function isPrivateMediaIPv4(address) {
  if (!isIPv4(address)) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function openMediaLanIO(socket, {address, port}) {
  return openBoundMediaIO(socket, value => isPrivateMediaIPv4(address) && value.localAddress === address &&
    value.localPort === port && isPrivateMediaIPv4(value.remoteAddress), 'media_lan_endpoint', true);
}

function openBoundMediaIO(socket, matches, reason, noDelay = false) {
  if (!(socket instanceof Socket) || socket.destroyed || !matches(socket) || socket.readableFlowing === true) throw new Error(reason);
  if (noDelay) socket.setNoDelay(true);
  let partial = null;
  const ignoreSocketError = () => {};
  socket.on('error', ignoreSocketError);
  const closed = new Promise(resolve => socket.once('close', () => {
    socket.off('error', ignoreSocketError);
    resolve();
  }));

  async function read(length, signal) {
    if (!Number.isSafeInteger(length) || length < 1 || length > 4160) throw new Error('media_invalid_frame');
    partial ??= {bytes: Buffer.alloc(length), used: 0};
    if (partial.bytes.length !== length) throw new Error('media_invalid_frame');
    while (partial.used < length) {
      signal?.throwIfAborted();
      const available = Math.min(socket.readableLength, length - partial.used);
      const bytes = available ? socket.read(available) : socket.read(0);
      if (bytes !== null) {
        bytes.copy(partial.bytes, partial.used);
        partial.used += bytes.length;
        continue;
      }
      if (socket.readableEnded || socket.destroyed) {
        throw new Error(partial.used ? 'media_truncated' : 'media_disconnected');
      }
      await new Promise((resolve, reject) => {
        const finish = error => {
          socket.off('readable', readable);
          socket.off('end', readable);
          socket.off('close', readable);
          signal?.removeEventListener('abort', abort);
          if (error) reject(error);
          else resolve();
        };
        const readable = () => finish();
        const abort = () => finish(signal.reason);
        socket.once('readable', readable);
        socket.once('end', readable);
        socket.once('close', readable);
        signal?.addEventListener('abort', abort, {once: true});
      });
    }
    const bytes = partial.bytes;
    partial = null;
    return bytes;
  }

  return {read,
    async write(packet) {
      if (socket.destroyed) throw new Error('media_disconnected');
      if (!(packet instanceof Uint8Array) || packet.length < 1 || packet.length > 4160) throw new Error('media_invalid_frame');
      // write completion waits for this entire frame, including queued bytes.
      await new Promise((resolve, reject) => socket.write(packet, error => error ? reject(error) : resolve()));
    },
    async close() {
      socket.destroy();
      await closed;
    }
  };
}

export function openMediaLoopback(socket) {
  const io = openMediaLoopbackIO(socket);
  let header = null;
  return {
    async receive(signal) {
      header ??= await io.read(MEDIA_HEADER_BYTES, signal);
      const payload = await io.read(mediaHeader(header).length, signal);
      const frame = decodeMediaFrame(header, payload);
      header = null;
      return frame;
    },
    send(frame, onAttempt) {
      const packet = encodeMediaFrame(frame);
      onAttempt?.();
      return io.write(packet);
    },
    close: io.close
  };
}
