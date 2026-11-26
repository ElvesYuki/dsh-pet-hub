import {createHash, randomUUID} from 'node:crypto';
import {closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, openSync, readSync, realpathSync,
  unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {requireThat} from '../core/protocol.mjs';
import {roundPetCanonical} from '../core/round-pet-identity.mjs';
import {validateBootState} from './device-enrollment.mjs';
import {createPbp1BindingVerifier} from './native400-pbp1-binding.mjs';
import {privatePath} from './paths.mjs';

/** Store an immutable USB-attributed pin and a separate, durable confirmation. */
export function openDeviceLanPins(directory, usbIdentity) {
  requireThat(typeof usbIdentity === 'string' && /^\d+\/[a-f0-9:-]{8,48}$/.test(usbIdentity), 'device_lan_pin_usb');
  privatePath(directory, 'directory');
  const root = realpathSync(directory), identity = lstatSync(root);

  function checkDirectory() {
    privatePath(root, 'directory');
    const current = lstatSync(root);
    requireThat(current.dev === identity.dev && current.ino === identity.ino, 'device_lan_pin_directory');
  }

  function files(binding) {
    validateBootState(binding, {requireKeyRef: true});
    requireThat(binding.record?.phase === 'bound', 'device_lan_pin_binding');
    const scope = createHash('sha256').update(roundPetCanonical({binding, usbIdentity})).digest('hex');
    return {scope, pin: join(root, 'device-lan-pin-' + scope), enabled: join(root, 'device-lan-enabled-' + scope)};
  }

  function encode(scope, point) {
    requireThat(point instanceof Uint8Array && point.length === 65 && point[0] === 4, 'device_lan_pin_point');
    createPbp1BindingVerifier(Buffer.from(point));
    return roundPetCanonical({schema: 1, scope, publicKey: Buffer.from(point).toString('hex')});
  }

  function read(path, scope) {
    checkDirectory();
    let fd;
    try { fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    try {
      const stat = fstatSync(fd);
      requireThat(stat.isFile() && stat.uid === process.getuid() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600 &&
        stat.size > 0 && stat.size < 512, 'device_lan_pin_file');
      const buffer = Buffer.alloc(stat.size + 1);
      let count = 0;
      while (count < buffer.length) {
        const length = readSync(fd, buffer, count, buffer.length - count, null);
        if (!length) break;
        count += length;
      }
      const current = lstatSync(path);
      requireThat(count === stat.size && ['dev', 'ino', 'size', 'ctimeMs', 'mode', 'nlink'].every(key => stat[key] === current[key]),
        'device_lan_pin_file');
      const raw = buffer.toString('utf8', 0, count);
      const {publicKey} = JSON.parse(raw);
      requireThat(typeof publicKey === 'string' && /^04[a-f0-9]{128}$/.test(publicKey), 'device_lan_pin_point');
      const point = Buffer.from(publicKey, 'hex');
      requireThat(raw === encode(scope, point), 'device_lan_pin_file');
      return point;
    } finally { closeSync(fd); }
  }

  function persist(path, scope, point) {
    const raw = encode(scope, point), previous = read(path, scope);
    if (previous) requireThat(previous.equals(point), 'device_lan_pin_changed');
    else {
      const temp = join(root, '.device-lan-' + randomUUID());
      const fd = openSync(temp, 'wx', 0o600);
      try {
        try { writeFileSync(fd, raw); fsyncSync(fd); }
        finally { closeSync(fd); }
        checkDirectory();
        linkSync(temp, path);
      } finally { unlinkSync(temp); }
    }
    sync();
    requireThat(read(path, scope)?.equals(point), 'device_lan_pin_file');
  }

  function sync() {
    checkDirectory();
    const dir = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { fsyncSync(dir); } finally { closeSync(dir); }
  }

  return Object.freeze({
    prepare(binding, point) { const {scope, pin} = files(binding); persist(pin, scope, point); },
    confirm(binding, point) {
      const {scope, pin, enabled} = files(binding);
      requireThat(read(pin, scope)?.equals(point), 'device_lan_pin_changed');
      persist(enabled, scope, point);
    },
    load(binding) {
      if (binding.record?.phase !== 'bound') return null;
      const {scope, pin, enabled} = files(binding);
      const confirmed = read(enabled, scope);
      if (confirmed) requireThat(read(pin, scope)?.equals(confirmed), 'device_lan_pin_changed');
      return confirmed;
    },
    withdraw(binding) {
      const {scope, enabled} = files(binding);
      if (read(enabled, scope)) unlinkSync(enabled);
      sync();
    },
  });
}
