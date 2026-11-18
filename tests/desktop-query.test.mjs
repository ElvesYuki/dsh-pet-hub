import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {once} from 'node:events';
import {chmod, mkdtemp, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {promisify} from 'node:util';
import {createHubClient} from '../packages/runtime/client.mjs';

test('Desktop manual owner starts once, restricts stopping and releases private IPC', {timeout: 10000}, async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop launcher');
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'hub-desktop-query-')));
  const config = join(directory, 'query.json'), runtime = join(directory, 'ipc');
  const operatorToken = 'fe'.repeat(32);
  const args = ['apps/service/desktop-query.mjs', directory];
  const run = action => promisify(execFile)(process.execPath, [...args, action], {timeout: 6500});
  let child, exit;
  t.after(async () => {
    if (child?.exitCode === null) child.kill('SIGTERM');
    await exit;
    await rm(directory, {recursive: true, force: true});
  });
  await writeFile(config, JSON.stringify({schema: 1, port: '/dev/cu.usbmodem-hub-fixture',
    usbIdentity: '1/001122334455', operatorToken}), {mode: 0o644});
  await assert.rejects(run('start'), error => /private_config_permissions/.test(error.stderr));
  await chmod(config, 0o600);
  child = spawn(process.execPath, [...args, 'start'], {stdio: ['ignore', 'pipe', 'inherit']});
  exit = once(child, 'close');
  const client = createHubClient(runtime);
  const auth = {reviewToken: operatorToken};
  let initial;
  for (let attempt = 0; attempt < 50 && !initial; attempt++) {
    try { initial = await client.request('GET', '/v1/vp8-action/status', undefined, auth); }
    catch { await delay(25); }
  }
  assert.equal(initial?.update.queryOnly, true);
  assert.equal(initial.update.wave, undefined);
  assert.equal(initial.update.status2Sent, false);
  assert.match((await run('start')).stdout, /已在运行/);
  await assert.rejects(run('start-wave'), error => /operation_failed/.test(error.stderr));
  await assert.rejects(client.request('POST', '/v1/desktop-query/stop'), {status: 401});
  await assert.rejects(client.request('POST', '/v1/desktop-query/stop', undefined, {
    ...auth, expectedInstanceId: 'other-instance',
  }), {status: 409});
  assert.equal((await client.request('GET', '/v1/vp8-action/status', undefined, auth)).instanceId, initial.instanceId);
  assert.match((await run('stop')).stdout, /已停止/);
  assert.deepEqual(await exit, [0, null]);
  assert.match((await run('stop')).stdout, /已停止/);
  assert.match((await run('status')).stdout, /已停止/);
});
