import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import vm from 'node:vm';
import { startOrAttach, createHubClient } from '../packages/runtime/index.mjs';
import { createSource } from '../packages/source-pet/assembly.mjs';
import { createHostPlugin } from '../apps/dsh-plugin/index.mjs';
import { renderHubPanel, hubViewModel, makeHubPanel } from '../packages/ui/index.mjs';
const temp = t => { const dir = mkdtempSync(join(tmpdir(), 'hub-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const waitFor = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('condition timeout'); };

test('UDS election, client detach, config CAS, auth and orderly restart', async t => {
  const directory = temp(t);
  const candidates = await Promise.all([startOrAttach({ directory }), startOrAttach({ directory })]);
  const owner = candidates.find(s => s.role === 'owner'), attached = candidates.find(s => s.role === 'attached');
  t.after(() => owner.close());
  assert.ok(owner && attached); assert.equal(owner.instanceId, attached.instanceId);
  assert.equal(statSync(join(directory, 'service.json')).mode & 0o777, 0o600);
  assert.equal(statSync(join(directory, 'hub.sock')).mode & 0o777, 0o600);
  await attached.close(); assert.equal((await owner.client.request('GET', '/v1/status')).source.mode, 'disabled');
  const config = (await owner.client.request('GET', '/v1/config')).config;
  const changes = await Promise.allSettled([owner.client.request('PUT', '/v1/config', { ...config, displayName: 'A' }), owner.client.request('PUT', '/v1/config', { ...config, displayName: 'B' })]);
  assert.equal(changes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(changes.find(r => r.status === 'rejected').reason.status, 409);
  await assert.rejects(owner.client.request('POST', '/stop'), { status: 404 });
  await assert.rejects(owner.client.request('POST', '/v1/source/page', { clientId: 'x', status: 'pending' }), { status: 400 });
  const unauth = await new Promise((resolve, reject) => {
    const req = http.get({ socketPath: join(directory, 'hub.sock'), path: '/v1/status' }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject);
  }); assert.equal(unauth, 401);
  await owner.close(); assert.equal(existsSync(join(directory, 'service.json')), false);
  const restart = await startOrAttach({ directory }); t.after(() => restart.close());
  assert.notEqual(restart.instanceId, owner.instanceId);
  assert.equal((await restart.client.request('GET', '/v1/config')).config.revision, 1);
  await assert.rejects(startOrAttach({ directory, source: { mode: 'page' } }), /mode or endpoint differs/);
});

test('unsafe directory permissions are rejected without modification', async t => {
  const directory = temp(t); chmodSync(directory, 0o755);
  await assert.rejects(startOrAttach({ directory }), /permissions/);
  assert.equal(statSync(directory).mode & 0o777, 0o755);
});

test('separate processes attach to one owner, SIGTERM cleans up; crash requires offline recovery', async t => {
  const directory = temp(t), children = [];
  t.after(() => { for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  function launch() {
    const child = spawn(process.execPath, ['apps/service/main.mjs', '--runtime-dir', directory], { stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
    const exited = new Promise(resolve => child.once('exit', resolve));
    const ready = new Promise((resolve, reject) => {
      let output = '', error = '';
      child.stdout.on('data', data => { output += data; if (output.includes('\n')) resolve(JSON.parse(output.split('\n')[0])); });
      child.stderr.on('data', data => { error += data; }); child.once('error', reject);
      child.once('exit', code => { if (!output) reject(new Error(`child failed ${code}: ${error}`)); });
    }); return { child, ready, exited };
  }
  const a = launch(), b = launch(); const ready = await Promise.all([a.ready, b.ready]);
  assert.deepEqual(ready.map(r => r.role).sort(), ['attached', 'owner']);
  assert.equal(ready[0].instanceId, ready[1].instanceId);
  const owner = ready[0].role === 'owner' ? a : b;
  owner.child.kill('SIGTERM'); await owner.exited;
  assert.equal(existsSync(join(directory, 'hub.sock')), false);
  const crashed = launch(); await crashed.ready; crashed.child.kill('SIGKILL'); await crashed.exited;
  assert.equal(existsSync(join(directory, 'hub.sock')), true);
  await assert.rejects(startOrAttach({ directory }), /stale socket/);
});

test('page source has one live lease, filters data and expires without reporting idle', () => {
  let now = 0; const source = createSource({ mode: 'page', clock: () => now, leaseMs: 100 });
  assert.equal(source.publish({ clientId: 'a', status: 'pending' }), true);
  assert.equal(source.publish({ clientId: 'b', status: 'ready', state: 'error', counter: 1 }), false);
  source.publish({ clientId: 'a', status: 'ready', state: 'working', counter: 3, task: 'PRIVATE' });
  assert.deepEqual(source.snapshot(), { mode: 'page', status: 'connected', state: 'working', counter: 3 });
  now = 101; assert.equal(source.snapshot().status, 'unavailable');
  assert.equal(source.publish({ clientId: 'b', status: 'ready', state: null, counter: 1 }), true);
  assert.equal(source.snapshot().status, 'connected');
  assert.throws(() => source.publish({ clientId: 'b', status: 'ready', state: 'unknown', counter: 2 }));
  source.stop(); assert.throws(() => source.publish({ clientId: 'b', status: 'pending' }));
});

test('HTTP assembly serially recovers and cancels in-flight requests', async t => {
  let broken = true, requests = 0, hold = false;
  const server = http.createServer((req, res) => {
    requests++; assert.equal(req.method, 'GET'); assert.equal(req.url, '/dsh-pet-7340/state');
    if (hold) return;
    if (broken) { res.writeHead(503); res.end(); }
    else res.end(JSON.stringify({ sections: { workStatus: { counter: 1, data: { state: 'thinking', task: 'PRIVATE' } } } }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); return new Promise(r => server.close(r)); });
  const source = createSource({ mode: 'http', base: `http://127.0.0.1:${server.address().port}/dsh-pet-7340`, intervalMs: 20 });
  t.after(() => source.stop()); source.start(); source.start();
  await waitFor(() => source.snapshot().status === 'unavailable'); broken = false;
  await waitFor(() => source.snapshot().status === 'connected');
  assert.equal(source.snapshot().state, 'thinking'); hold = true;
  const before = requests; await waitFor(() => requests > before); source.stop();
  const stopped = source.snapshot(); await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(source.snapshot(), stopped);
});

test('host proxy uses whitelist, drops private keys and never stops service on unload', async t => {
  const directory = temp(t); const hub = await startOrAttach({ directory, source: { mode: 'page' } }); t.after(() => hub.close());
  let route; let dispose;
  createHostPlugin(createHubClient(directory))({ effect(fn) { dispose = fn(); }, webServer: { register(value) { route = value; return () => { route = null; }; } } });
  const server = http.createServer((req, res) => route.handler(req, res));
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/dsh-pet-hub`;
  const res = await fetch(`${base}/status`); const body = await res.json();
  assert.equal(body.source.mode, 'page'); assert.equal('instanceId' in body, false);
  assert.equal((await fetch(`${base}/source/page`, { method: 'POST', body: '{}' })).status, 403);
  const report = await fetch(`${base}/source/page`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pet-Hub': '1' }, body: JSON.stringify({ clientId: 'page', status: 'ready', state: 'working', counter: 1, task: 'PRIVATE' }) });
  assert.equal(report.status, 200); assert.equal((await hub.client.request('GET', '/v1/status')).source.state, 'working');
  assert.equal((await fetch(`${base}/config`, { method: 'PUT' })).status, 404);
  dispose(); assert.equal(route, null); assert.equal((await hub.client.request('GET', '/v1/status')).source.mode, 'page');
});

test('built client registers unique setting slot; shared UI cancels outstanding request', async () => {
  let module, effect, signal;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => [initial, () => {}], useEffect: fn => { effect = fn; } };
  const Panel = makeHubPanel(React, { status: s => { signal = s; return new Promise(() => {}); } }, () => ({ status: 'pending' }));
  Panel(); const cleanup = effect(); assert.equal(signal.aborted, false); cleanup(); assert.equal(signal.aborted, true);
  vm.runInNewContext(readFileSync('dist/client.js', 'utf8'), { window: { __ModuleLoader__: { load(info) { module = info; } } } });
  assert.equal(module.id, 'dsh-pet-hub');
  const plugin = module.factory(name => { assert.equal(name, 'react'); return React; });
  let registration;
  plugin.apply({ slots: { inject(name, generator) { assert.equal(name, 'settings.section'); [...generator()]; }, register(meta, Component) { registration = { meta, Component }; return () => {}; } } });
  assert.equal(registration.meta.id, 'dsh-pet-hub-settings');
  assert.equal(typeof registration.Component, 'function');
  const tree = renderHubPanel(React.createElement, hubViewModel());
  assert.ok(JSON.stringify(tree).includes('暂无已接入设备'));
});

test('unloading host cancels in-flight IPC without writing a second response', async t => {
  let dispose, route, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const client = { request(_method, _path, _body, { signal }) { entered(); return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); } };
  createHostPlugin(client)({ effect(fn) { dispose = fn(); }, webServer: { register(value) { route = value; return () => {}; } } });
  const server = http.createServer((req, res) => route.handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const response = fetch(`http://127.0.0.1:${server.address().port}/dsh-pet-hub/status`);
  await started; dispose(); assert.equal((await response).status, 503);
});

test('candidate exposes native host Config entry and React external contract', () => {
  const manifest = JSON.parse(readFileSync('dist/package.json', 'utf8'));
  assert.equal(manifest.main, 'apps/dsh-plugin/host.mjs');
  assert.equal(manifest.exports['.'], './apps/dsh-plugin/host.mjs');
  assert.deepEqual(manifest.dsh.client.external, ['react']);
  assert.equal(manifest.peerDependencies['@deepseek-ai/schemastery'], '3.18.5');
  assert.ok(existsSync(`dist/${manifest.main}`));
});
