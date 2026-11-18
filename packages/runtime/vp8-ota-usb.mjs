import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

/** Resolve the nominated ESP32-S3 callout path to its private USB identity. */
export async function identifyVp8OtaUsb(port, {signal} = {}) {
  const {stdout} = await promisify(execFile)('/usr/sbin/ioreg', ['-r', '-c', 'IOUSBHostDevice', '-l', '-w0'],
    {signal, timeout: 1500, maxBuffer: 1024 * 1024});
  const tree = [];
  for (const line of stdout.split('\n')) {
    const entry = /^([ |]*)\+-o .*?<class ([^,>]+)/.exec(line);
    if (entry) {
      tree.length = entry[1].length / 2;
      tree.push({kind: entry[2]});
      continue;
    }
    const node = tree.at(-1);
    const property = /^[ |]*"(idVendor|idProduct|locationID|USB Serial Number|IOCalloutDevice)" = (?:"([^"]*)"|(\d+))$/.exec(line);
    if (!node || !property) continue;
    const [, key, str, number] = property;
    if (node.kind === 'IOUSBHostDevice') node[key] = str ?? number;
    if (node.kind === 'IOSerialBSDClient' && key === 'IOCalloutDevice' && str === port) {
      const usb = tree.findLast(parent => parent?.kind === 'IOUSBHostDevice');
      const serial = usb?.['USB Serial Number'];
      if (usb?.idVendor === '12346' && usb.idProduct === '4097' && /^\d+$/.test(usb.locationID ?? '') &&
          /^[a-fA-F0-9:-]{8,48}$/.test(serial ?? '')) return `${usb.locationID}/${serial.toLowerCase()}`;
      break;
    }
  }
  throw new Error('vp8_ota_usb_identity');
}

/** Check the configured USB identity before and after obtaining the exclusive TTY. */
export async function openVerifiedVp8Tty({port, helper, identity, identifyUsb = identifyVp8OtaUsb, openTty, signal}) {
  async function verifyIdentity() {
    if (!identity) return;
    try {
      if (await identifyUsb(port, {signal}) !== identity) throw new Error('vp8_ota_usb_identity');
    } catch (cause) { throw new Error('vp8_ota_usb_identity', {cause}); }
  }
  await verifyIdentity();
  const tty = await openTty({enabled: true, port, helper});
  try {
    signal.throwIfAborted();
    await verifyIdentity();
    signal.throwIfAborted();
    return tty;
  } catch (error) { await tty.close(); throw error; }
}
