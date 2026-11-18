import http from 'node:http';
import { parsePetState } from './schema.mjs';
export { parsePetState } from './schema.mjs';
export { readPetPageState } from './page.mjs';
export function validatePetUrl(base) {
  const u = new URL(base);
  if (u.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(u.hostname) ||
      u.username || u.password || u.search || u.hash || u.pathname !== '/dsh-pet-7340') throw new Error('invalid pet URL');
  return new URL(`${u.href}/state`);
}
/** Node HTTP deliberately ignores proxy env and does not follow redirects. */
export function readPetState(base, { signal } = {}) {
  const url = validatePetUrl(base);
  return new Promise((resolve, reject) => {
    const req = http.get(url, { signal }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('pet HTTP rejected')); return; }
      const chunks = []; let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 262144) { req.destroy(new Error('pet response too large')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try { resolve(parsePetState(JSON.parse(Buffer.concat(chunks).toString('utf8')))); }
        catch { reject(new Error('invalid pet response')); }
      });
    });
    const deadline = setTimeout(() => req.destroy(new Error('pet timeout')), 2000);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', reject);
  });
}
