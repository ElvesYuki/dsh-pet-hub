import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {registerHooks} from 'node:module';
import {createConnection} from 'node:net';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';

const [root, repo, app, single, oldMain, oldBoot] = process.argv.slice(2);
const asar = join(app, 'Contents/Resources/app.asar');
const bundle = pathToFileURL(join(asar, 'dsh/node_modules/@deepseek-ai') + '/');
const url = file => pathToFileURL(file).href;
const nn = 'dsh-pet-hub', old = 'dsh-pet-hub-boot-review';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
assert.equal(json(join(asar, 'package.json')).version, '0.2.2-rc.5');
assert.ok(process.versions.electron);
const {planDesktopPluginMigration} = await import(url(join(repo, 'scripts/lib/desktop-plugin-migration.mjs')));
const {loadProfileDirectory, getDshRuntimeVersion} = await import(new URL('dsh-app-boot/lib/index.js', bundle));
const {Context} = await import(new URL('cordis/lib/index.js', bundle));
const connection = await import(new URL('dsh-client-connection/lib/index.js', bundle));
assert.equal(getDshRuntimeVersion(), '0.2.2-rc.5');
registerHooks({resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/schemastery')
    return {url: new URL('schemastery/lib/index.mjs', bundle).href, format: 'module', shortCircuit: true};
  return next(specifier, context);
}});

const enrollment = '/private/tmp/device-enrollment-' + randomBytes(16).toString('hex');
const runtimeDirectory = join(root, 'query', 'ipc'), profile = join(root, 'desktop');
const bootPath = '/api/pet-hub-enrollment/', queryPath = '/api/pet-hub-device/';
const motionPath = '/api/pet-hub-task-source/';
const config = {runtimeDirectory, desktopDeviceQuery: true, managedDesktopDevice: true, desktopDeviceNoCode: true};
const original = {bundles: [nn, old], patches: [{id: nn, config},
  {id: old, config: {enabled: true, enrollmentDirectory: enrollment}}]};
const manifestPath = join(profile, 'package.json'), patchPath = join(profile, 'cordis.patch.yml');
const installAnchor = join(asar, 'dsh/package.json');
const load = () => loadProfileDirectory('dsh', profile, installAnchor);
const handles = [];
let server;

function profileFiles(data) {
  writeFileSync(manifestPath, JSON.stringify({name: 'synthetic-profile', private: true,
    dependencies: Object.fromEntries(data.bundles.map(name => [name, '*'])), dsh: {profile: {bundles: data.bundles}}}));
  writeFileSync(patchPath, JSON.stringify(data.patches));
}

try {
  mkdirSync(join(profile, 'node_modules'), {recursive: true});
  symlinkSync(oldMain, join(profile, 'node_modules', nn));
  symlinkSync(oldBoot, join(profile, 'node_modules', old));
  profileFiles(original);
  const backup = [readFileSync(manifestPath), readFileSync(patchPath)];
  assert.deepEqual(load().skippedBundles.map(item => [item.packageName, item.reason.includes('is incompatible')]),
    [[nn, true], [old, true]]);
  const migrated = planDesktopPluginMigration({bundles: original.bundles, patches: load().patches});
  rmSync(join(profile, 'node_modules', nn));
  symlinkSync(single, join(profile, 'node_modules', nn));
  profileFiles(migrated);
  const loaded = load();
  assert.deepEqual(loaded.skippedBundles, []);
  assert.deepEqual(loaded.layers.map(layer => layer.packageName), [nn]);
  assert.deepEqual(loaded.layers[0].patches[0].insert, [{id: nn, name: nn}]);
  const manifest = json(join(single, 'package.json'));
  const plugin = await import(url(join(single, manifest.main)));
  const defaults = plugin.Config({});
  const {deviceEnrollment, unifiedDeviceStatus, deviceStatusPush, deviceLan, taskMotion, ...desktopDefaults} = defaults;
  const originalHost = await import(url(join(single, 'apps/dsh-plugin/connection-host.mjs')));
  assert.deepEqual(desktopDefaults, originalHost.Config({}));
  assert.deepEqual(deviceEnrollment, {enabled: false, enrollmentDirectory: ''});
  assert.equal(unifiedDeviceStatus, false);
  assert.equal(deviceStatusPush, false);
  assert.deepEqual(deviceLan, {enabled: false, address: '', port: '', discoveryInterface: ''});
  assert.deepEqual(taskMotion, {enabled: false, source: '', sessionId: '', codexSocket: '', codexHookSocket: ''});
  assert.equal(plugin.Config({unifiedDeviceStatus: true}).unifiedDeviceStatus, true);

  mkdirSync(enrollment, {mode: 0o700});
  mkdirSync(join(root, 'query'), {mode: 0o700});
  const peer = {schema: 1, port: '/dev/cu.usbmodemSYNTHETIC', usbIdentity: '1/f0f1f2f3'};
  writeFileSync(join(root, 'query/query.json'), JSON.stringify({...peer, operatorToken: 'a'.repeat(64)}), {mode: 0o600});
  writeFileSync(join(enrollment, 'review-peer.json'), JSON.stringify({...peer, mode: 'usb'}), {mode: 0o600});
  const {openDeviceBindingIndex} = await import(url(join(single, 'packages/runtime/device-binding-index.mjs')));
  const index = openDeviceBindingIndex({directory: enrollment, create: true});
  index.commit('0', {phase: 'bound', keyRef: 'synthetic', target: {device: '11'.repeat(16), controller: '22'.repeat(16),
    binding: '33'.repeat(16), epoch: '1', keySha256: 'ab'.repeat(32)}});
  index.close();
  const indexFile = join(enrollment, 'device-binding.json'), indexBytes = readFileSync(indexFile);

  const ctx = new Context(), routes = new Map();
  let credential;
  const services = {profileContext: {name: 'desktop'}, sessionController: {list(request, signal) {
    assert.deepEqual(request, {});
    signal.throwIfAborted();
    return {items: [{sessionId: 'local-fixture', running: true}, {sessionId: 'cold-fixture', running: false}]};
  }, state(request, signal) {
    assert.deepEqual(request, {sessionId: 'local-fixture'});
    signal.throwIfAborted();
    return {cursor: 3, active: true, running: true, pendingInput: [], queue: ['must not forward']};
  }, events(request, signal) {
    assert.deepEqual(request, {address: {kind: 'session', sessionId: 'local-fixture'}, throughSeq: 3,
      maxMessages: 8, turnWindow: {minMessages: 1, minTurns: 1}});
    signal.throwIfAborted();
    return {cursor: 3, records: [{type: 'event', event: {type: 'turn/start', seq: 3, data: {content: 'must not forward'}}}]};
  }}, credentials: {async modifyRecord(_key, change) {
    return credential = await change(credential) ?? credential;
  }}, webServer: {host: '127.0.0.1', protocol: 'http:', register(route) {
    assert.ok(!routes.has(route.path));
    routes.set(route.path, route);
    return () => routes.delete(route.path);
  }}};
  for (const [key, value] of Object.entries(services)) { ctx.provide(key); ctx.set(key, value); }
  const connectionHandle = ctx.plugin(connection, {});
  handles.push(connectionHandle);
  await connectionHandle;
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const route = routes.get(path) ?? (path.startsWith('/api/') && routes.get('/api'));
    if (!route) { res.writeHead(404); res.end(); return; }
    void Promise.resolve(route.handler(req, res)).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const grant = await fetch(ctx.get('connection').authenticatedUrl(origin + '/connect'), {redirect: 'manual'});
  assert.ok([302, 303].includes(grant.status));
  const cookie = grant.headers.get('set-cookie').split(';')[0];
  await grant.body?.cancel();

  const source = readFileSync(join(asar, 'lib/main.js'), 'utf8');
  const snippets = [/^const WITHHELD_RESPONSE_HEADERS = \[[\s\S]*?^\];/m, /^const PLUGIN_BUNDLE_PATH = .*;$/m,
    /^async function forwardWebRequest\(request, host, cookie\) \{[\s\S]*?^\}/m].map(re => source.match(re)?.[0]);
  assert.ok(snippets.every(Boolean));
  const forward = runInNewContext(snippets.join('\n') + '\nforwardWebRequest', {URL, Headers, Request, Response, fetch});
  const desktop = (path, init) => forward(new Request('dsh-app://app' + path, init), origin, cookie);
  assert.equal((await fetch(origin + bootPath + 'status')).status, 401);
  assert.equal((await desktop(bootPath + 'status')).status, 404);

  async function mount(overrides = {}) {
    const handle = ctx.plugin(plugin, {...loaded.patches[0].config, ...overrides});
    handles.push(handle);
    await handle;
    return handle;
  }
  async function binding() {
    const response = await desktop(bootPath + 'status');
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.phase, 'bound');
    assert.equal(state.deviceChecked, false);
    assert.equal(state.networkAvailable, true);
    assert.equal(state.weatherAvailable, true);
    return state;
  }
  const active = await mount();
  assert.equal((await desktop(motionPath + 'status')).status, 404);
  const first = await binding();
  let status;
  for (let attempt = 0; attempt < 100 && !status; attempt++) {
    const result = await desktop(queryPath + 'status');
    if (result.status === 200) status = await result.json();
    else { await result.body?.cancel(); await delay(10); }
  }
  assert.equal(status.update.sameUsbTarget, true);
  assert.equal(status.update.batteryAvailable, true);
  assert.equal(existsSync(join(runtimeDirectory, 'hub.sock')), true);
  const legacy = await import(url(join(oldBoot, json(join(oldBoot, 'package.json')).main)));
  assert.throws(() => legacy.apply({get: key => services[key], effect: setup => setup()},
    original.patches[1].config), {code: 'device_desktop_in_use'});
  await active.dispose();
  handles.pop();
  assert.equal((await desktop(bootPath + 'status')).status, 404);
  assert.equal((await desktop(queryPath + 'status')).status, 404);
  assert.equal(existsSync(join(runtimeDirectory, 'hub.sock')), false);
  const next = await mount({unifiedDeviceStatus: true, deviceStatusPush: true,
    deviceLan: {enabled: true, address: '127.0.0.1', port: '18551'}, taskMotion: {enabled: true}});
  assert.notEqual((await binding()).instanceId, first.instanceId);
  let nextStatus;
  for (let attempt = 0; attempt < 100 && !nextStatus; attempt++) {
    const result = await desktop(queryPath + 'status');
    if (result.status === 200) nextStatus = await result.json();
    else { await result.body?.cancel(); await delay(10); }
  }
  assert.equal(nextStatus.update.sameUsbTarget, true);
  assert.equal(nextStatus.update.networkStatus, undefined);
  assert.equal((await fetch(origin + motionPath + 'status')).status, 401);
  const sourceView = await (await desktop(motionPath + 'status')).json();
  assert.equal(sourceView.source, 'off');
  assert.deepEqual(sourceView.available, ['off', 'dsh']);
  const selectSource = body => desktop(motionPath + 'select', {method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}, body: JSON.stringify(body)});
  const choice = {instance: sourceView.instance, revision: sourceView.revision, source: 'dsh', sessionId: 'local-fixture'};
  assert.equal((await selectSource({...choice, endpoint: 'never writable'})).status, 400);
  assert.equal((await selectSource(choice)).status, 200);
  assert.equal((await selectSource(choice)).status, 409);
  let sourceStatus;
  for (let attempt = 0; attempt < 100; attempt++) {
    sourceStatus = await (await desktop(motionPath + 'status')).json();
    if (sourceStatus.status === 'ready') break;
    await delay(10);
  }
  assert.equal(sourceStatus.state, 'thinking');
  assert.ok(!JSON.stringify(sourceStatus).includes('must not forward'));
  assert.equal(json(join(root, 'query/task-source.json')).source, 'dsh');
  const stale = await desktop(bootPath + 'weather', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'},
    body: JSON.stringify({operation: 'info', instanceId: first.instanceId, revision: first.revision})});
  assert.equal(stale.status, 409);
  await stale.body?.cancel();
  await next.dispose();
  handles.pop();
  assert.equal((await desktop(motionPath + 'status')).status, 404);
  assert.deepEqual(readFileSync(indexFile), indexBytes);
  assert.equal(existsSync(join(runtimeDirectory, 'hub.sock')), false);

  const hookSocket = join(root, 'query', 'codex.sock');
  const hooks = await mount({taskMotion: {enabled: true, codexHookSocket: hookSocket}});
  const afterReload = await (await desktop(motionPath + 'status')).json();
  assert.deepEqual(afterReload.available, ['off', 'dsh', 'codex']);
  assert.deepEqual(afterReload.aggregateSources, ['dsh', 'codex']);
  assert.equal(afterReload.source, 'dsh');
  assert.equal(existsSync(hookSocket), false);
  assert.equal((await selectSource({instance: afterReload.instance, revision: afterReload.revision,
    source: 'codex', sessionId: 'app-fixture'})).status, 200);
  for (let attempt = 0; attempt < 100 && !existsSync(hookSocket); attempt++) await delay(10);
  const hookPeer = createConnection(hookSocket);
  hookPeer.on('connect', () => hookPeer.end(JSON.stringify({v: 1, sessionId: 'app-fixture', turnId: 'turn-1', event: 'start', sentAt: Date.now()})));
  await once(hookPeer, 'close');
  for (let attempt = 0; attempt < 125; attempt++) {
    sourceStatus = await (await desktop(motionPath + 'status')).json();
    if (sourceStatus.status === 'ready') break;
    await delay(10);
  }
  assert.equal(sourceStatus.state, 'thinking');
  assert.equal(sourceStatus.sessionId, 'app-fixture');
  async function selectScope(source, scope, sessionId) {
    const result = await selectSource({instance: sourceStatus.instance, revision: sourceStatus.revision, source, scope, sessionId});
    assert.equal(result.status, 200);
    sourceStatus = await result.json();
    assert.equal(sourceStatus.scope, scope);
    assert.equal(sourceStatus.sessionId, sessionId);
  }
  async function waitState(state) {
    for (let attempt = 0; attempt < 180; attempt++) {
      sourceStatus = await (await desktop(motionPath + 'status')).json();
      if (sourceStatus.status === 'ready' && sourceStatus.state === state) return;
      await delay(10);
    }
    assert.fail(`source did not reach ${state}`);
  }
  await selectScope('dsh', 'all', '');
  await waitState('thinking');
  for (let attempt = 0; attempt < 100 && existsSync(hookSocket); attempt++) await delay(10);
  assert.equal(existsSync(hookSocket), false);
  await selectScope('codex', 'all', '');
  await waitState(null);
  for (const sessionId of ['foreground-fixture', 'background-fixture']) {
    for (const event of ['start', 'tool-start']) {
      const peer = createConnection(hookSocket);
      peer.on('connect', () => peer.end(JSON.stringify({v: 1, sessionId, turnId: 'turn-1', event, sentAt: Date.now(),
        ...(event === 'tool-start' ? {callId: 'tool'} : {})})));
      await once(peer, 'close');
    }
  }
  await waitState('working');
  assert.ok(!JSON.stringify(sourceStatus).includes('foreground-fixture'));
  await selectScope('off', 'single', '');
  await hooks.dispose();
  handles.pop();
  assert.equal(existsSync(hookSocket), false);

  rmSync(join(profile, 'node_modules', nn));
  symlinkSync(oldMain, join(profile, 'node_modules', nn));
  writeFileSync(manifestPath, backup[0]);
  writeFileSync(patchPath, backup[1]);
  assert.deepEqual(load().patches, original.patches);
  assert.deepEqual(readFileSync(patchPath), backup[1]);
  console.log(JSON.stringify({rc5: true, oldSkipped: true, singleLayer: true, realConnection: true, realForward: true,
    originalIndexPreserved: true, oldOwnerExcluded: true, released: true, rollbackSnapshot: true, codexHooks: true}));
} finally {
  for (const handle of handles.reverse()) await handle.dispose();
  if (server) {
    const close = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await close;
  }
  rmSync(enrollment, {force: true, recursive: true});
}
