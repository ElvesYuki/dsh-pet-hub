import {randomBytes} from 'node:crypto';
import {exchangeUsbDeviceStatus} from './usb-status-wire.mjs';

/** Probe on the verified descriptor before sending one explicitly requested mutation. */
export async function exchangeDesktopSettings(session, input, signal, beforeMutation, wire, statusV2) {
  async function exchange(operation, beforeWrite) {
    signal.throwIfAborted();
    const id = randomBytes(4).toString('hex');
    const command = wire.encode(id, operation, input);
    try {
      return await session.exchangeDesktop(command, {signal, beforeWrite, prefix: wire.prefix,
        allowTimeout: operation === 'info', match: line => wire.decode(line, id, operation, input)});
    } finally { command.fill(0); }
  }
  const info = await exchange('info');
  if (!info) {
    const version = statusV2 ? (await exchangeUsbDeviceStatus(session, signal))?.version :
      await session.exchangeDesktop(Buffer.from('STATUS2\n'), {signal,
      prefix: '@VP8_OTA STATUS ', allowTimeout: true, match: line =>
        /^@VP8_OTA STATUS busy=[01] selected=[01] slot=ota_[01] version=([A-Za-z0-9][A-Za-z0-9._+-]{0,30})\r?\n$/.exec(line)?.[1]});
    return version ? {status: 'unsupported', version} : {status: 'no_reply'};
  }
  if (input.operation === 'info' || info.status !== 'ok') return info;
  return await exchange(input.operation, beforeMutation) ?? {status: 'unknown'};
}
