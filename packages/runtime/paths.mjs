import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
export const defaultRuntimeDirectory = () => join(homedir(), '.dsh-pet-hub');
export function privatePath(path, kind) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 ||
      (kind === 'directory' ? !stat.isDirectory() : !stat.isFile())) throw new Error('unsafe runtime permissions');
}
export function runtimePaths(directory = defaultRuntimeDirectory(), create = false) {
  if (process.platform === 'win32') throw new Error('Windows IPC not implemented');
  const dir = resolve(directory);
  if (create) { try { mkdirSync(dir, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  privatePath(dir, 'directory');
  const canonicalDir = realpathSync(dir);
  const socket = join(canonicalDir, 'hub.sock');
  if (Buffer.byteLength(socket) > 100) throw new Error('runtime path too long');
  return { dir: canonicalDir, socket, descriptor: join(canonicalDir, 'service.json'), config: join(canonicalDir, 'config.json') };
}
export function descriptorAt(paths) {
  privatePath(paths.descriptor, 'file');
  const value = JSON.parse(readFileSync(paths.descriptor, 'utf8'));
  if (value.protocol !== 'hub-ipc/1' || typeof value.instanceId !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('invalid service descriptor');
  return value;
}
