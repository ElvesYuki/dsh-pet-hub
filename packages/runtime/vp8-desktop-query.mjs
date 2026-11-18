import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {join} from 'node:path';
import {privatePath} from './paths.mjs';
import {prepareVp8ActionUpdate} from './vp8-action-update.mjs';

export const desktopQueryPort = /^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]+$/;
const identityFormat = /^\d+\/[a-f0-9:-]{8,48}$/;

/** Local account configuration shared by the manual and Desktop owners. */
export async function readDesktopQueryConfig(directory) {
  privatePath(directory, 'directory');
  const fd = await open(join(directory, 'query.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const bytes = Buffer.alloc(1025);
  try {
    const stat = await fd.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 ||
        (stat.mode & 0o777) !== 0o600 || stat.size > 1024) throw new Error('private_config_permissions');
    let size = 0;
    while (size < bytes.length) {
      const {bytesRead} = await fd.read(bytes, size, bytes.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size !== stat.size) throw new Error('private_config_invalid');
    const value = JSON.parse(bytes.toString('utf8', 0, size));
    if (value?.schema !== 1 || Object.keys(value).length !== 4 ||
        typeof value.port !== 'string' || !desktopQueryPort.test(value.port) ||
        typeof value.usbIdentity !== 'string' || !identityFormat.test(value.usbIdentity) ||
        typeof value.operatorToken !== 'string' || !/^[a-f0-9]{64}$/.test(value.operatorToken))
      throw new Error('private_config_invalid');
    return value;
  } finally { bytes.fill(0); await fd.close(); }
}

export function prepareDesktopQuery(directory, {port, usbIdentity, operatorToken}, {waveTest = false, openTty} = {}) {
  return prepareVp8ActionUpdate({port, helper: join(directory, 'tty'), operatorToken, usbIdentity,
    protocol: 'media2', queryOnly: true, waveTest}, {openTty});
}
