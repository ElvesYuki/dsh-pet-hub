import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {serialLines} from './serial-lines.mjs';
import {decodeStatusV2} from './device-status-wire.mjs';

export const usbStatusPrefix = '@VP8_STATUS3 ';

export function decodeUsbStatusBody(source) {
  if (source.length < 8 || source.length > 92 || !/^[A-Za-z0-9+/]+={0,2}$/.test(source)) return;
  const bytes = Buffer.from(source, 'base64');
  if (bytes.toString('base64') !== source) return;
  try { return decodeStatusV2(bytes); }
  catch (error) { if (error.code !== 'vpl1_status') throw error; }
}

function status3Request() {
  const id = randomBytes(4).toString('hex'), prefix = 'id=' + id + ' data=';
  return {command: 'STATUS3 ' + id + '\n', decode(line) {
    if (!line.startsWith(prefix)) return;
    return decodeUsbStatusBody(line.slice(prefix.length));
  }};
}

/** Read the common Status v2 payload on an already verified descriptor. */
export async function readUsbDeviceStatus(io, signal, onProbe) {
  const tty = serialLines(io, usbStatusPrefix);
  do { signal.throwIfAborted(); } while (await tty.read({discard: true}));
  const request = status3Request();
  onProbe?.('write');
  await tty.write(request.command, signal);
  onProbe?.('read');
  for (;;) {
    signal.throwIfAborted();
    const lines = await tty.read();
    signal.throwIfAborted();
    for (const line of lines ?? []) {
      const status = request.decode(line);
      if (status) return status;
    }
    await delay(10, undefined, {signal});
  }
}

/** Use the same Status v2 decoder in an exclusive setup session. */
export function exchangeUsbDeviceStatus(session, signal) {
  const request = status3Request();
  return session.exchangeDesktop(Buffer.from(request.command), {signal, prefix: usbStatusPrefix, allowTimeout: true,
    match: line => request.decode(line.slice(usbStatusPrefix.length).replace(/\r?\n$/, ''))});
}
