import {createHash, createPublicKey, verify} from 'node:crypto';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {readVp8FirmwareObject, vp8ReleaseDescriptor} from './vp8-action-update.mjs';

async function readFile(path, limit) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('vp8_release_path');
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await fd.stat();
    if (!stat.isFile() || !stat.size || stat.size > limit) throw new Error('vp8_release_file');
    const bytes = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < bytes.length) {
      const {bytesRead} = await fd.read(bytes, size, bytes.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size !== stat.size) throw new Error('vp8_release_file');
    return bytes.subarray(0, size);
  } finally { await fd.close(); }
}

/** Load approved release metadata and verify the referenced image. Failure leaves OTA disabled. */
export async function loadTrustedVp8Release(source) {
  if (!source) return undefined;
  try {
    const [manifest, signature, pem] = await Promise.all([
      readFile(source.manifest, 4096), readFile(source.signature, 64), readFile(source.trustKey, 1024),
    ]);
    if (typeof source.trustKeySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.trustKeySha256) ||
        !pem.toString('ascii').trim().startsWith('-----BEGIN PUBLIC KEY-----')) return undefined;
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'ed25519' ||
        createHash('sha256').update(key.export({type: 'spki', format: 'der'})).digest('hex') !== source.trustKeySha256 ||
        signature.length !== 64 || !verify(null, manifest, key, signature))
      return undefined;
    const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(manifest));
    const fields = ['schema', 'product', 'version', 'fromVersions', 'bytes', 'sha256'];
    if (Object.keys(data).length !== fields.length || !fields.every(field => Object.hasOwn(data, field)) ||
        data.schema !== 1 || data.product !== 'round-pet-175c-en-vp8') return undefined;
    const release = vp8ReleaseDescriptor({...data, file: source.image});
    await readVp8FirmwareObject(release);
    return release;
  } catch { return undefined; }
}
