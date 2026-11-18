import {FRAME_RESPONSE_BYTES,SMALL_RESPONSE_BYTES} from '../core/material-profile.mjs';
import http from 'node:http';
import { runtimePaths, descriptorAt } from './paths.mjs';
export function createHubClient(directory) {
  return {
    async request(method, path, body, { signal, reviewToken, expectedInstanceId } = {}) {
      const paths = runtimePaths(directory);
      const descriptor = descriptorAt(paths);
      if(expectedInstanceId!==undefined&&descriptor.instanceId!==expectedInstanceId)throw Object.assign(new Error('controls_stale_instance'),{code:'controls_stale_instance',status:409});
      return new Promise((resolve, reject) => {
        const data = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request({ socketPath: paths.socket, path, method, signal, agent: false,
          headers: { Authorization: `Bearer ${descriptor.token}`, 'X-Hub-Instance': descriptor.instanceId,
            ...(reviewToken?{'X-Hub-Review':reviewToken}:{}),
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) },
        }, res => {
          const chunks = []; let size = 0;
          const limit=method==='POST'&&path==='/v1/roles/frame'?FRAME_RESPONSE_BYTES:SMALL_RESPONSE_BYTES;
          res.on('data', chunk => { size += chunk.length; if (size > limit) req.destroy(new Error('IPC response too large')); else chunks.push(chunk); });
          res.on('error', reject);
          res.on('end', () => {
            try {
              const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (value.instanceId !== descriptor.instanceId) throw new Error('instance mismatch');
              if (res.statusCode !== 200) { const error = new Error(value.error ?? 'IPC rejected'); error.status = res.statusCode; throw error; }
              resolve(value);
            } catch (e) { reject(e); }
          });
        });
        const timer = setTimeout(() => req.destroy(new Error('IPC timeout')), 2500);
        req.on('close', () => clearTimeout(timer)); req.on('error', reject);
        req.end(data);
      });
    },
  };
}
