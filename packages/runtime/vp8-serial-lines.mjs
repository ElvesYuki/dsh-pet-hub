import {setTimeout as delay} from 'node:timers/promises';

const busyIo = new Set(['EAGAIN', 'EWOULDBLOCK', 'EINTR']);

export function vp8SerialLines(io, prefix) {
  const chunk = Buffer.alloc(512);
  const line = Buffer.alloc(256);
  let used = 0;
  return {
    async read({discard = false} = {}) {
      let bytesRead;
      try { ({bytesRead} = await io.read(chunk, 0, chunk.length, null)); }
      catch (error) { if (busyIo.has(error.code)) return null; throw error; }
      if (bytesRead <= 0) throw Object.assign(new Error('vp8_usb_disconnected'), {status: 400});
      const lines = [];
      try {
        if (discard) return lines;
        for (const byte of chunk.subarray(0, bytesRead)) {
          if (byte === 10) {
            if (used <= line.length) {
              const text = line.toString('latin1', 0, used).replace(/\r$/, '');
              if (text.startsWith(prefix)) lines.push(text.slice(prefix.length));
            }
            used = 0;
          } else if (used < line.length) line[used++] = byte;
          else used = line.length + 1;
        }
        return lines;
      } finally { chunk.fill(0); }
    },
    async write(payload, signal) {
      const data = Buffer.from(payload, 'ascii');
      try {
        for (let offset = 0; offset < data.length;) {
          signal.throwIfAborted();
          try {
            const {bytesWritten} = await io.write(data, offset, data.length - offset, null);
            if (bytesWritten <= 0) throw Object.assign(new Error('vp8_usb_disconnected'), {status: 400});
            offset += bytesWritten;
          } catch (error) { if (!busyIo.has(error.code)) throw error; await delay(10, undefined, {signal}); }
        }
      } finally { data.fill(0); }
    },
  };
}
