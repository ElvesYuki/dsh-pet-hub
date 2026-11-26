import assert from 'node:assert/strict';
import {access, mkdtemp, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {mountDesktopQueryService} from '../apps/dsh-plugin/desktop-query-service.mjs';
import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';
import {createHubClient} from '../packages/runtime/client.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {prepareDeviceUpdate} from '../packages/runtime/device-update.mjs';
import {prepareDesktopQuery} from '../packages/runtime/desktop-device-query.mjs';

const config = {schema: 1, port: '/dev/cu.usbmodem-hub-fixture', usbIdentity: '1/001122334455', operatorToken: 'fd'.repeat(32)};
const auth = {reviewToken: config.operatorToken};

async function setup(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-managed-'))), directory = join(root, 'ipc');
  const disposers = [];
  t.after(async () => {
    for (const dispose of disposers.reverse()) await dispose();
    await rm(root, {recursive: true, force: true});
  });
  await writeFile(join(root, 'query.json'), JSON.stringify(config), {mode: 0o600});
  const client = createHubClient(directory), status = () => client.request('GET', '/v1/device-update/status', undefined, auth);
  function mount(options) {
    let dispose;
    const access = mountDesktopQueryService({effect(install) { dispose = install(); }}, directory, options);
    disposers.push(dispose);
    return {dispose, access};
  }
  async function ready() {
    for (let n = 0; n < 60; n++) {
      try { return await status(); }
      catch { await delay(15); }
    }
    assert.fail('managed service did not start');
  }
  async function released() {
    for (const name of ['hub.sock', 'service.json']) await assert.rejects(access(join(directory, name)), {code: 'ENOENT'});
  }
  return {root, directory, mount, ready, released, status, client, disposers};
}

test('desktop lifecycle releases owned IPC and serializes a rapid re-enable', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop owner');
  const fixture = await setup(t);
  let last;
  const start = async options => (last = await startOrAttach(options));
  const beforeReady = fixture.mount({start});
  await beforeReady.dispose();
  assert.equal(last, undefined);
  const {dispose: close} = fixture.mount({start});
  const first = await fixture.ready();
  assert.equal(first.update.queryOnly, true);
  assert.equal(first.update.status2Sent, false);
  assert.equal(first.update.wave, undefined);
  const closing = close();
  const {dispose: closeNext} = fixture.mount({start});
  await closing;
  const second = await fixture.ready();
  assert.notEqual(first.instanceId, second.instanceId);
  await closeNext();
  await fixture.released();
});

test('desktop lifecycle attaches without taking over either the external owner or incompatible wave', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop owner');
  const fixture = await setup(t);
  const external = await startOrAttach({directory: fixture.directory, deviceUpdate: prepareDesktopQuery(fixture.root, config),
    onDeviceLocalStop() {}});
  fixture.disposers.push(() => external.close());
  const attach = Promise.withResolvers();
  const {dispose: close, access} = fixture.mount({start: async options => {
    const ticket = await startOrAttach(options);
    attach.resolve(ticket.role);
    return ticket;
  }});
  assert.equal(await attach.promise, 'attached');
  assert.equal(access(), undefined);
  await close();
  assert.equal((await fixture.status()).instanceId, external.instanceId);
  await external.close();

  const wave = await startOrAttach({directory: fixture.directory, deviceUpdate: prepareDesktopQuery(fixture.root, config, {waveTest: true}),
    onDeviceLocalStop() {}});
  fixture.disposers.push(() => wave.close());
  const failed = Promise.withResolvers();
  const {dispose: reject, access: conflictAccess} = fixture.mount({report: () => failed.resolve()});
  await failed.promise;
  assert.equal(conflictAccess(), undefined);
  await reject();
  assert.equal((await fixture.status()).instanceId, wave.instanceId);
});

test('desktop disposer awaits exclusive serial close during a status request', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop owner');
  const fixture = await setup(t);
  const written = Promise.withResolvers(), release = Promise.withResolvers();
  t.after(() => release.resolve());
  const claim = prepareDeviceUpdate({...config, port: '/dev/ttys00', helper: '/fixture/tty',
    protocol: 'media2', queryOnly: true}, {
    identifyUsb: () => config.usbIdentity,
    openTty: async () => ({
      async write(bytes) {
        assert.equal(bytes.toString(), 'STATUS2\n');
        written.resolve();
        return {bytesWritten: bytes.length};
      },
      async read() { throw Object.assign(Error(), {code: 'EAGAIN'}); },
      async close() { await release.promise; },
    }),
  });
  const {dispose} = fixture.mount({start: options => startOrAttach({...options, deviceUpdate: claim})});
  const {instanceId, update} = await fixture.ready();
  await fixture.client.request('POST', '/v1/device-update/command', {instanceId, revision: update.revision, operation: 'query'}, auth);
  await written.promise;
  let finished = false;
  const closing = dispose().then(() => { finished = true; });
  try {
    await delay(40);
    assert.equal(finished, false);
    await access(join(fixture.directory, 'hub.sock'));
  } finally { release.resolve(); }
  await closing;
  await fixture.released();
});

test('managed Connection scopes credential use to exact status/query and denies swapped USB', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop owner');
  const fixture = await setup(t);
  let opens = 0;
  const claim = prepareDeviceUpdate({...config, port: '/dev/ttys00', helper: '/fixture/tty',
    protocol: 'media2', queryOnly: true}, {
    identifyUsb: () => '2/001122334455',
    openTty() { opens++; throw Error('unregistered board'); },
  });
  const {access, dispose} = fixture.mount({start: options => startOrAttach({...options, deviceUpdate: claim})});
  const routes = new Map();
  createHostPlugin(fixture.client, {desktopDeviceQuery: true, managedDeviceUpdate: access})({
    effect(install) { fixture.disposers.push(install()); },
    connection: {fetch: {register(route) {
      routes.set(route.path, route.fetch);
      return () => routes.delete(route.path);
    }}},
    webServer: {register: () => () => {}},
  });
  const prefix = '/api/pet-hub-device/';
  const send = (path, body, headers = {'X-Pet-Hub':'1'}, suffix = '') =>
    routes.get(prefix + path)(new Request('http://127.0.0.1' + prefix + path + suffix, {
      method: body ? 'POST' : 'GET',
      headers: {'Content-Type': 'application/json', ...headers},
      ...(body ? {body: JSON.stringify(body)} : {}),
    }));
  assert.equal(routes.has(prefix + 'command'), false);
  const initial = await fixture.ready();
  const request = {operation: 'query', instanceId: initial.instanceId, revision: 0};
  const snapshot = await (await send('status')).text();
  assert.equal(snapshot.includes(config.operatorToken), false);
  assert.equal(JSON.parse(snapshot).update.revision, 0);
  assert.equal((await send('status', undefined, {}, '?other=1')).status, 404);
  assert.equal((await send('status', undefined, {'X-Pet-Hub-Operator': config.operatorToken})).status, 401);
  assert.equal((await send('query', request, {})).status, 403);
  for (const operation of ['wave', 'install', 'upgrade']) {
    assert.equal((await send('query', {...request, operation})).status, 403);
  }
  assert.equal((await send('query', {...request, revision: 1})).status, 409);
  assert.equal((await send('query', {...request, instanceId: 'old'})).status, 409);
  assert.equal((await send('query', {...request, extra: 'STATUS2'})).status, 409);
  assert.equal((await fixture.status()).update.revision, 0);
  assert.equal((await send('query', request)).status, 200);
  for (let n = 0; n < 20 && (await fixture.status()).update.phase !== 'failed'; n++) await delay(10);
  const rejected = await (await send('status')).json();
  assert.equal(rejected.update.deviceUnavailable, true);
  assert.equal(opens, 0);
  const previous = access();
  await dispose();
  assert.equal((await send('status')).status, 409);
  await assert.rejects(previous.status(new AbortController().signal));
  await fixture.released();
});

test('managed owner supplies TCP status to local Connection and gates periodic USB requests', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS Desktop owner');
  const fixture = await setup(t);
  const connected = Promise.withResolvers();
  let closed = 0, subscription;
  const {access, dispose} = fixture.mount({sharedUsb: true, connectTelemetry({attach, usbIdentity, signal}) {
    subscription = signal;
    assert.equal(usbIdentity, config.usbIdentity);
    connected.resolve(attach({usbIdentity, probe: n => assert.equal(n, 1), close: () => closed++}));
  }});
  const session = await connected.promise;
  const routes = new Map();
  createHostPlugin(fixture.client, {desktopDeviceQuery: true, managedDeviceUpdate: access, desktopBattery: true})({
    effect(install) { fixture.disposers.push(install()); },
    connection: {fetch: {register(route) {
      routes.set(route.path, route.fetch);
      return () => routes.delete(route.path);
    }}},
    webServer: {register: () => () => {}},
  });
  async function call(path, body) {
    const route = '/api/pet-hub-device/' + path;
    const response = await routes.get(route)(new Request('http://dsh.internal' + route, body ? {method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}, body: JSON.stringify(body)} : {}));
    assert.equal(response.status, 200);
    return response.json();
  }
  const initial = await call('status');
  assert.equal(initial.update.usbPresent, false);
  assert.equal(initial.update.networkStatus, undefined);
  const sample = {operation: 'sample', instanceId: initial.instanceId, requestId: 'a'.repeat(32)};
  assert.deepEqual(await call('battery', sample), {status: 'disconnected'});
  const beforeHeartbeat = Date.now();
  assert.equal(session.receive(1, {schema: 1, version: '0.1.29', slot: 'ota_0', identity: config.usbIdentity}), true);
  const afterHeartbeat = Date.now();
  const {lastHeartbeatAt, ...networkStatus} = (await call('status')).update.networkStatus;
  assert.ok(lastHeartbeatAt >= beforeHeartbeat && lastHeartbeatAt <= afterHeartbeat);
  assert.deepEqual(networkStatus,
    {device: {version: '0.1.29', slot: 'ota_0'}, battery: null, sensors: null});
  assert.deepEqual(await call('battery', sample), {status: 'network_active'});
  await dispose();
  assert.equal(closed, 1);
  assert.equal(subscription.aborted, true);
  assert.equal(session.receive(1, {schema: 1, version: '0.1.29', slot: 'ota_0'}), false);
  await fixture.released();
});
