import {closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync} from 'node:fs';
import {join} from 'node:path';
import {keys, requireThat, same} from '../../packages/core/protocol.mjs';
import {openVp8BootIndex} from '../../packages/runtime/vp8-boot-index.mjs';
import {createVp8BootKeychain, vp8BootReviewDirectory} from '../../packages/runtime/vp8-boot-keychain.mjs';
import {createVp8BootOwner} from '../../packages/runtime/vp8-boot-owner.mjs';
import {createVp8BootSerial} from '../../packages/runtime/vp8-boot-serial.mjs';
import {desktopUsbOpener, trackDesktopUsbTarget} from '../../packages/runtime/vp8-desktop-usb.mjs';
import {privatePath} from '../../packages/runtime/paths.mjs';
import {mountVp8BootSettings} from './vp8-boot-settings.mjs';

export const name = 'dsh-pet-hub-boot-review';
export const inject = ['connection'];

function readPeer(root) {
  const fd = openSync(join(root, 'review-peer.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const raw = Buffer.alloc(1025);
  let peer;
  try {
    const stat = fstatSync(fd);
    requireThat(stat.isFile() && stat.uid === process.getuid() && stat.nlink === 1 &&
      (stat.mode & 0o777) === 0o600 && stat.size > 0 && stat.size < raw.length, 'vp8_review_peer');
    let size = 0;
    while (size < raw.length) {
      const count = readSync(fd, raw, size, raw.length - size);
      if (!count) break;
      size += count;
    }
    requireThat(size === stat.size, 'vp8_review_peer');
    peer = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(raw.subarray(0, size)));
  } finally { closeSync(fd); }
  keys(peer, ['schema', 'mode', 'port', 'usbIdentity']);
  requireThat(peer.schema === 1 && ['pty', 'usb'].includes(peer.mode), 'vp8_review_peer');
  return peer;
}

function openPeer(root, peer, openTty) {
  const helper = join(root, 'tty-helper');
  privatePath(helper, 'file');
  const stat = lstatSync(helper);
  requireThat(stat.nlink === 1 && (stat.mode & 0o777) === 0o700, 'vp8_review_peer');
  return createVp8BootSerial({port: peer.port, usbIdentity: peer.usbIdentity, helper, fixture: peer.mode === 'pty'},
    {openTty});
}

/** Only the separate review package uses this entry. An authorized Connection
 * owner has already passed the packaged rc.3 cookie gate before dispatch. */
export function apply(ctx) {
  const root = vp8BootReviewDirectory(process.env.DSH_PET_HUB_BOOT_REVIEW);
  const home = join(root, 'dsh'), userData = join(root, 'electron');
  privatePath(home, 'directory');
  privatePath(userData, 'directory');
  const authorized = () => process.platform === 'darwin' && Boolean(process.versions.electron) &&
    ctx.get('profileContext')?.name === 'desktop' && process.env.DSH_HOME === home &&
    realpathSync(home) === home && realpathSync(userData) === userData;
  requireThat(authorized(), 'vp8_review_profile');
  const mode = process.env.DSH_PET_HUB_BOOT_MODE;
  requireThat(mode === undefined || mode === 'boot' || mode === 'usb', 'vp8_review_mode');
  const usbEnrollment = mode === 'usb';
  const owner = createVp8BootReviewOwner(root, {usbEnrollment});
  try { mountVp8BootSettings(ctx, {owner, authorize: authorized, transport: 'desktop-rc3-connection', usbEnrollment}); }
  catch (error) { void owner.close(); throw error; }
}

/** Shared by the dedicated rc.3 package and the isolated native smoke test. */
export function createVp8BootReviewOwner(directory, {usbEnrollment = false, sharedUsb = false} = {}) {
  const root = vp8BootReviewDirectory(directory), keys = createVp8BootKeychain(root);
  const identity = lstatSync(root, {bigint: true});
  const selected = sharedUsb ? readPeer(root) : undefined;
  const openTty = sharedUsb ? desktopUsbOpener() : undefined;
  const store = openVp8BootIndex({directory: root});
  let untrack, owner;
  try {
    if (selected?.mode === 'usb') untrack = trackDesktopUsbTarget('binding', selected.usbIdentity);
    owner = createVp8BootOwner({store, keys, usbEnrollment, openSession(options) {
      const current = lstatSync(root, {bigint: true});
      requireThat(current.dev === identity.dev && current.ino === identity.ino &&
        vp8BootReviewDirectory(root) === root, 'vp8_review_peer');
      const peer = readPeer(root);
      requireThat(!selected || same(peer, selected), 'vp8_review_peer_changed');
      return openPeer(root, peer, openTty)(options);
    }});
  } catch (error) { untrack?.(); store.close(); throw error; }
  return {status: owner.status, command: owner.command,
    async close() { try { await owner.close(); } finally { untrack?.(); store.close(); } }};
}
