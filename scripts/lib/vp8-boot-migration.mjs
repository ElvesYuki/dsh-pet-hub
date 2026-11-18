import {createHash, randomBytes, verify} from 'node:crypto';
import {closeSync, constants, copyFileSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync,
  rmSync, unlinkSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {requireThat, same} from '../../packages/core/protocol.mjs';
import {createPbp1BindingVerifier} from '../../packages/runtime/native400-pbp1-binding.mjs';
import {openVp8BootIndex} from '../../packages/runtime/vp8-boot-index.mjs';
import {createVp8BootKeychain, vp8BootPersistentParent, vp8BootReviewDirectory} from '../../packages/runtime/vp8-boot-keychain.mjs';
import {privatePath} from '../../packages/runtime/paths.mjs';

const recoveryName = /^vp8-boot-recovery-([a-f0-9]{32})$/;

function sourceFile(root, name, {optional = false, mode = 0o600n} = {}) {
  const path = join(root, name);
  let stat;
  try { stat = lstatSync(path, {bigint: true}); }
  catch (error) { if (optional && error.code === 'ENOENT') return; throw error; }
  requireThat(stat.isFile() && stat.uid === BigInt(process.getuid()) && stat.nlink === 1n &&
    (stat.mode & 0o777n) === mode, 'vp8_migration_unsafe_source');
  return {path, stat};
}

function privateDirectory(path) {
  privatePath(path, 'directory');
  requireThat(realpathSync(path) === path && (lstatSync(path).mode & 0o777) === 0o700,
    'vp8_migration_destination');
}

function sync(path, directory = false) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | (directory ? constants.O_DIRECTORY : 0));
  try { fsyncSync(fd); }
  finally { closeSync(fd); }
}

/** Verify the same persisted non-exportable key and compare with the index. */
export async function confirmVp8IndexedSigner(root, record) {
  const chain = createVp8BootKeychain(root);
  await chain.health();
  const key = await chain.lookup(record.keyRef);
  requireThat(key?.ref === record.keyRef && createHash('sha256').update(key.publicKey).digest('hex') ===
    record.target.keySha256, 'vp8_migration_key_mismatch');
  const message = Buffer.concat([Buffer.from('dsh-pet-hub enrollment key continuity/1'), randomBytes(32)]);
  const signature = await key.signTranscript(message);
  requireThat(verify('sha256', message, {key: createPbp1BindingVerifier(key.publicKey), dsaEncoding: 'ieee-p1363'},
    signature), 'vp8_migration_signature');
}

/** Copy only the enrollment files, retaining the original signer bytes. The
 * caller must stop all owners of this scope. No command opens a serial port. */
async function copyEnrollment(source, destination, mode) {
  const parent = dirname(destination);
  const index = openVp8BootIndex({directory: source});
  let ownedDestination = false;
  const locks = [];
  try {
    const state = index.read();
    requireThat(state.record?.phase === 'bound', 'vp8_migration_record');
    for (const name of ['vp8-boot.write.lock', 'keychain.write.lock']) {
      const path = join(source, name);
      try { locks.push({path, fd: openSync(path, 'wx', 0o600)}); }
      catch (error) { if (error.code === 'EEXIST') throw Error('vp8_migration_locked'); throw error; }
    }
    if (mode !== 'restore') await confirmVp8IndexedSigner(source, state.record);
    const sources = ['vp8-boot.json', 'enrollment.keychain-db', 'keychain-unlock', 'keychain-helper', 'tty-helper',
      'review-peer.json'].map(name => ({name, ...sourceFile(source, name, {
        optional: name === 'review-peer.json', mode: name.endsWith('-helper') ? 0o700n : 0o600n,
      })})).filter(file => file.path);
    const peer = sources.find(file => file.name === 'review-peer.json');
    if (peer) {
      requireThat(peer.stat.size <= 1024n && JSON.parse(readFileSync(peer.path, 'utf8')).mode === 'usb',
        'vp8_migration_unsafe_source');
    }
    if (mode !== 'restore') {
      try { mkdirSync(parent, {mode: 0o700}); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      privateDirectory(parent);
    }
    try { mkdirSync(destination, {mode: 0o700}); }
    catch (error) { if (error.code === 'EEXIST') throw Error('vp8_migration_destination_exists'); throw error; }
    ownedDestination = true;
    for (const file of sources) {
      const target = join(destination, file.name);
      copyFileSync(file.path, target, constants.COPYFILE_EXCL);
      const copied = sourceFile(destination, file.name, {mode: file.stat.mode & 0o777n});
      requireThat(copied.stat.size === file.stat.size &&
        readFileSync(file.path).equals(readFileSync(target)), 'vp8_migration_changed');
    }
    for (const file of sources) {
      const current = lstatSync(file.path, {bigint: true});
      requireThat(['dev', 'ino', 'size', 'mode', 'uid', 'nlink', 'ctimeNs', 'mtimeNs']
        .every(field => file.stat[field] === current[field]), 'vp8_migration_changed');
    }
    const copied = openVp8BootIndex({directory: destination});
    try { requireThat(same(copied.read(), state), 'vp8_migration_changed'); }
    finally { copied.close(); }
    if (mode !== 'backup') {
      try { await confirmVp8IndexedSigner(destination, state.record); }
      catch (cause) {
        if (!['vp8_keychain_unavailable', 'vp8_keychain_failed'].includes(cause.code)) throw cause;
        throw Object.assign(new Error('vp8_migration_signer_unavailable', {cause}), {code: 'vp8_migration_signer_unavailable'});
      }
    }
    for (const file of sources) sync(join(destination, file.name));
    sync(destination, true);
    sync(parent, true);
    return destination;
  } catch (error) {
    if (ownedDestination) rmSync(destination, {recursive: true, force: true});
    throw error;
  } finally {
    index.close();
    for (const {path, fd} of locks.reverse()) {
      try { closeSync(fd); }
      finally { unlinkSync(path); }
    }
  }
}

/** A failed move keeps the original scope and signer usable. */
export function migrateVp8BootDirectory(directory) {
  const source = vp8BootReviewDirectory(directory);
  requireThat(dirname(source) === '/private/tmp', 'vp8_migration_source');
  return copyEnrollment(source, join(vp8BootPersistentParent(), basename(source)), 'migrate');
}

/** Archive a signed, bound scope for restoring at the original temporary path. */
export function backupVp8BootDirectory(directory) {
  const source = vp8BootReviewDirectory(directory);
  requireThat(dirname(source) === '/private/tmp', 'vp8_migration_source');
  return copyEnrollment(source, join(vp8BootPersistentParent(), 'vp8-boot-recovery-' + basename(source).slice(-32)), 'backup');
}

/** Restore only to an absent original path and prove signing before returning. */
export function restoreVp8BootDirectory(directory) {
  requireThat(typeof directory === 'string', 'vp8_migration_source');
  const parent = vp8BootPersistentParent(), name = basename(directory), scope = recoveryName.exec(name)?.[1];
  requireThat(scope && directory === join(parent, name), 'vp8_migration_source');
  privateDirectory(parent);
  privateDirectory(directory);
  return copyEnrollment(directory, join('/private/tmp', 'vp8-boot-review-' + scope), 'restore');
}
