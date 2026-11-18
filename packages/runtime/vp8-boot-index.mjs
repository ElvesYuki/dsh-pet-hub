import {createHash, randomUUID} from 'node:crypto';
import {closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, realpathSync, renameSync,
  unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {clone, increment, keys, requireThat, uint64} from '../core/protocol.mjs';
import {roundPetCanonical} from '../core/round-pet-identity.mjs';
import {privatePath} from './paths.mjs';
import {validateVp8BootState} from './vp8-boot-enrollment.mjs';

const limit = 2048;
const failure = (code, cause) => Object.assign(new Error(code, {cause}), {code});

function entry(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function encode(state) {
  validateVp8BootState(state, {requireKeyRef: true});
  requireThat(state.revision !== '0' || state.record === null, 'vp8_index_invalid');
  const sha256 = createHash('sha256').update(roundPetCanonical(state)).digest('hex');
  return roundPetCanonical({schema: 1, state, sha256});
}

/** Open a single-board private CAS index. A failed commit after rename requires
 * a fresh handle. The optional fault(stage) hook is synchronous and for tests. */
export function openVp8BootIndex({directory, create = false, fault = () => {}}) {
  privatePath(directory, 'directory');
  const dir = realpathSync(directory), identity = lstatSync(dir);
  const file = join(dir, 'vp8-boot.json'), lock = join(dir, 'vp8-boot.write.lock');
  let closed = false, uncertain = false, last;

  function checkDirectory() {
    privatePath(dir, 'directory');
    const current = lstatSync(dir);
    requireThat(current.dev === identity.dev && current.ino === identity.ino, 'vp8_index_invalid');
  }

  function active() {
    requireThat(!closed && !uncertain, uncertain ? 'vp8_index_commit_unknown' : 'vp8_index_closed');
    checkDirectory();
  }

  function load() {
    let fd;
    try {
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stat = fstatSync(fd);
      requireThat(stat.isFile() && stat.uid === process.getuid() && stat.nlink === 1 &&
        (stat.mode & 0o777) === 0o600 && stat.size > 0 && stat.size <= limit, 'vp8_index_invalid');
      const buffer = Buffer.alloc(stat.size + 1);
      let size = 0;
      while (size < buffer.length) {
        const count = readSync(fd, buffer, size, buffer.length - size, size);
        if (!count) break;
        size += count;
      }
      const current = lstatSync(file);
      requireThat(size === stat.size && ['dev', 'ino', 'size', 'uid', 'mode', 'nlink', 'ctimeMs', 'mtimeMs']
        .every(key => current[key] === stat[key]), 'vp8_index_invalid');
      const raw = buffer.toString('utf8', 0, size), envelope = JSON.parse(raw);
      keys(envelope, ['schema', 'state', 'sha256']);
      requireThat(envelope.schema === 1 && raw === encode(envelope.state), 'vp8_index_invalid');
      const revision = uint64(envelope.state.revision);
      requireThat(!last || revision > last.revision || (revision === last.revision && raw === last.raw),
        'vp8_index_rollback');
      last = {revision, raw};
      return envelope.state;
    } catch (cause) {
      if (cause.code === 'vp8_index_rollback') throw cause;
      throw failure('vp8_index_invalid', cause);
    } finally { if (fd !== undefined) closeSync(fd); }
  }

  function syncDirectory() {
    const fd = openSync(dir, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { fsyncSync(fd); }
    finally { closeSync(fd); }
  }

  function persist(expected, next) {
    active();
    const raw = encode(next);
    requireThat(Buffer.byteLength(raw) <= limit, 'vp8_index_invalid');
    let owner, lockIdentity, fd, temp, ownsTemp = false, renamed = false;
    try {
      try { owner = openSync(lock, 'wx', 0o600); }
      catch (cause) { throw failure('vp8_index_locked', cause); }
      lockIdentity = fstatSync(owner);
      requireThat(expected === null ? !entry(file) : load().revision === expected, 'revision_conflict');
      fault('before_write');
      temp = join(dir, '.vp8-boot-' + randomUUID() + '.tmp');
      fd = openSync(temp, 'wx', 0o600);
      ownsTemp = true;
      writeFileSync(fd, raw);
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      fault('before_rename');
      checkDirectory();
      renameSync(temp, file);
      renamed = true;
      fault('after_rename');
      syncDirectory();
      fault('after_sync');
      return load();
    } catch (cause) {
      if (renamed) {
        uncertain = true;
        throw failure('vp8_index_commit_unknown', cause);
      }
      if (['vp8_index_invalid', 'vp8_index_locked', 'vp8_index_rollback', 'revision_conflict'].includes(cause.code)) throw cause;
      throw failure('vp8_index_write_failed', cause);
    } finally {
      let cleanup;
      const release = work => { try { work(); } catch (error) { cleanup ??= error; } };
      if (fd !== undefined) release(() => closeSync(fd));
      if (ownsTemp && !renamed) release(() => { checkDirectory(); unlinkSync(temp); });
      if (owner !== undefined) {
        release(() => closeSync(owner));
        release(() => {
          checkDirectory();
          const current = lstatSync(lock);
          requireThat(current.dev === lockIdentity?.dev && current.ino === lockIdentity.ino, 'vp8_index_locked');
          unlinkSync(lock);
        });
      }
      if (cleanup) {
        uncertain ||= renamed;
        throw failure(renamed ? 'vp8_index_commit_unknown' : 'vp8_index_write_failed', cleanup);
      }
    }
  }

  requireThat(!entry(lock), 'vp8_index_locked');
  if (!entry(file)) {
    requireThat(create, 'vp8_index_missing');
    persist(null, {revision: '0', record: null});
  } else {
    active();
    load();
    syncDirectory();
  }
  return Object.freeze({
    read() {
      active();
      requireThat(!entry(lock), 'vp8_index_locked');
      return load();
    },
    commit(expected, record) { return persist(expected, {revision: increment(expected), record: clone(record)}); },
    close() { closed = true; },
  });
}
