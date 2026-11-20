import {mkdirSync, realpathSync, writeFileSync} from 'node:fs';
import {createConnection} from 'node:net';
import {isAbsolute, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkCodexHookSocket, codexHookEvents, codexHookFrame} from '../packages/runtime/codex-hook-wire.mjs';
import {privatePath} from '../packages/runtime/paths.mjs';

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

function prepare(project, socketPath) {
  const root = realpathSync(project);
  privatePath(root, 'directory');
  checkCodexHookSocket(socketPath);
  const folder = join(root, '.codex');
  try { mkdirSync(folder, {mode: 0o700}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  privatePath(folder, 'directory');
  const command = [process.execPath, fileURLToPath(import.meta.url), 'forward', root, socketPath].map(quote).join(' ');
  const hooks = Object.fromEntries(Object.keys(codexHookEvents).map(name => [name, [{hooks: [{type: 'command', command, timeout: 1}]}]]));
  writeFileSync(join(folder, 'hooks.json'), JSON.stringify({hooks}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
}

async function forward(project, socketPath) {
  const sentAt = Date.now(), chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes <= 1024 * 1024) chunks.push(chunk);
  }
  if (bytes > 1024 * 1024) return;
  const payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks, bytes)));
  const frame = codexHookFrame(payload, sentAt);
  if (!frame || typeof payload.cwd !== 'string' || !isAbsolute(payload.cwd)) return;
  const subdirectory = relative(project, realpathSync(payload.cwd));
  if (subdirectory === '..' || subdirectory.startsWith('../') || isAbsolute(subdirectory)) return;
  checkCodexHookSocket(socketPath, true);
  await new Promise(resolve => {
    const peer = createConnection(socketPath);
    const deadline = setTimeout(() => peer.destroy(), 200);
    peer.once('error', () => peer.destroy());
    peer.once('close', () => { clearTimeout(deadline); resolve(); });
    peer.once('connect', () => peer.end(JSON.stringify(frame)));
  });
}

const [mode, project, socket] = process.argv.slice(2);
if (mode === 'forward') {
  // Transparent observer. A missing Hub, unknown hook version or bad input never alters Codex's decision.
  try { await forward(project, socket); }
  catch { /* Event dropped. */ }
  process.stdout.write('{}\n');
} else if (mode === 'prepare' && project && socket) prepare(project, socket);
else throw Error('usage: node scripts/prepare-codex-hooks.mjs prepare <private-project> <private-unix-socket>');
