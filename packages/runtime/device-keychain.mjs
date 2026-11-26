import {spawn} from 'node:child_process';
import {constants, lstatSync, realpathSync} from 'node:fs';
import {open, unlink} from 'node:fs/promises';
import {userInfo} from 'node:os';
import {basename, dirname, join} from 'node:path';
import {requireThat} from '../core/protocol.mjs';
import {privatePath} from './paths.mjs';

const scopeName = /^device-enrollment-[a-f0-9]{32}$/;
export const enrollmentRoot = () => join(userInfo().homedir, '.dsh-pet-hub-enrollment');

/** An explicitly provisioned private enrollment root with a stable scope name. */
export function enrollmentDirectory(directory) {
  requireThat(typeof directory === 'string' && scopeName.test(basename(directory)) &&
    join(dirname(directory), basename(directory)) === directory, 'device_review_directory');
  const parent = dirname(directory);
  if (parent !== '/private/tmp') {
    requireThat(parent === enrollmentRoot(), 'device_review_directory');
    privatePath(parent, 'directory');
    requireThat(realpathSync(parent) === parent && (lstatSync(parent).mode & 0o777) === 0o700, 'device_review_directory');
  }
  privatePath(directory, 'directory');
  requireThat(realpathSync(directory) === directory && (lstatSync(directory).mode & 0o777) === 0o700,
    'device_review_directory');
  return directory;
}

function signatureP1363(der) {
  requireThat(der.length >= 8 && der.length <= 72 && der[0] === 0x30 && der[1] === der.length - 2,
    'device_keychain_signature');
  const raw = Buffer.alloc(64);
  let offset = 2;
  for (let field = 0; field < 2; field++) {
    const tag = der[offset++], length = der[offset++], first = der[offset], next = der[offset + 1];
    requireThat(tag === 2 && length >= 1 && length <= 33 && offset + length <= der.length && first < 128 &&
      (first !== 0 || (length > 1 && next >= 128)) && (length !== 33 || first === 0), 'device_keychain_signature');
    const value = der.subarray(offset + (first === 0 ? 1 : 0), offset + length);
    value.copy(raw, (field + 1) * 32 - value.length);
    offset += length;
  }
  requireThat(offset === der.length, 'device_keychain_signature');
  return raw;
}

function call(helper, args, password, input, caller) {
  const signal = AbortSignal.any([AbortSignal.timeout(4000), ...(caller ? [caller] : [])]);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(helper, args, {stdio: ['pipe', 'pipe', 'ignore', password.fd],
      env: {PATH: '/usr/bin:/bin'}});
    const output = Buffer.alloc(73);
    let bytes = 0, failed = false;
    const abort = () => { child.kill('SIGKILL'); };
    signal.addEventListener('abort', abort, {once: true});
    child.stdout.on('data', chunk => {
      if (bytes + chunk.length > output.length) { failed = true; abort(); return; }
      chunk.copy(output, bytes);
      bytes += chunk.length;
    });
    child.stdin.on('error', () => {});
    child.once('error', () => { failed = true; });
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) return reject(signal.reason);
      if (!failed && code === 0) return resolve(output.subarray(0, bytes));
      if (code === 2 && args[0] === 'lookup') return resolve(undefined);
      const error = code === 3 ? 'device_keychain_unavailable' : 'device_keychain_failed';
      reject(Object.assign(new Error(error), {code: error}));
    });
    if (signal.aborted) abort();
    child.stdin.end(input);
  });
}

/** P-256 file-Keychain adapter. Only init creates the Keychain. A prepare may
 * generate a key for this scope; lookup and sign never create or replace it. */
export function createBootKeychain(directory) {
  requireThat(process.platform === 'darwin', 'device_keychain_platform');
  const root = enrollmentDirectory(directory), scope = root.slice(-32);
  const filename = join(root, 'enrollment.keychain-db'), helper = join(root, 'keychain-helper');
  const unlock = join(root, 'keychain-unlock'), lock = join(root, 'keychain.write.lock');
  const prefix = 'vp8-' + scope + '-';
  const deviceId = /^[a-f0-9]{32}$/;
  const checkRef = ref => requireThat(typeof ref === 'string' && ref.startsWith(prefix) &&
    deviceId.test(ref.slice(prefix.length)), 'device_keychain_reference');

  async function run(operation, {ref, bytes, signal} = {}) {
    enrollmentDirectory(root);
    if (ref !== undefined) checkRef(ref);
    signal?.throwIfAborted();
    const executable = lstatSync(helper);
    requireThat(executable.isFile() && executable.uid === process.getuid() && executable.nlink === 1 &&
      (executable.mode & 0o777) === 0o700, 'device_keychain_helper');
    const password = await open(unlock, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await password.stat();
      requireThat(stat.isFile() && stat.uid === process.getuid() && stat.nlink === 1 &&
        (stat.mode & 0o777) === 0o600 && stat.size === 64, 'device_keychain_unlock');
      return await call(helper, [operation, filename, ...(ref ? [ref] : [])], password, bytes, signal);
    } finally { await password.close(); }
  }

  async function mutate(operation, context) {
    const owner = await open(lock, 'wx', 0o600);
    try { return await run(operation, context); }
    finally {
      try { await owner.close(); }
      finally { await unlink(lock); }
    }
  }

  function key(ref, publicKey) {
    if (!publicKey) return undefined;
    requireThat(publicKey.length === 65 && publicKey[0] === 4, 'device_keychain_public_key');
    return Object.freeze({ref, publicKey, async signTranscript(bytes, {signal} = {}) {
      requireThat(bytes instanceof Uint8Array && bytes.length >= 1 && bytes.length <= 256, 'device_keychain_transcript');
      return signatureP1363(await run('sign', {ref, bytes: Buffer.from(bytes), signal}));
    }});
  }

  return Object.freeze({
    async init({signal} = {}) {
      await mutate('init', {signal});
    },
    async health({signal} = {}) { await run('health', {signal}); },
    async prepare({device, signal}) {
      requireThat(typeof device === 'string' && deviceId.test(device), 'device_keychain_reference');
      const ref = prefix + device;
      return key(ref, await mutate('prepare', {ref, signal}));
    },
    async lookup(ref, {signal} = {}) { return key(ref, await run('lookup', {ref, signal})); },
  });
}
