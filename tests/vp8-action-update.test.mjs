import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';
import {openExclusiveNative400Tty} from '../packages/runtime/native400-pbp1-serial.mjs';
import {prepareVp8ActionUpdate, readVp8ActionObject, VP8_ACTION_BYTES, VP8_ACTION_ROUTE, VP8_MEDIA67} from '../packages/runtime/vp8-action-update.mjs';
import {loadTrustedVp8Release} from '../packages/runtime/vp8-release.mjs';

const realObject = process.env.ROUND_PET_MEDIA_ROOT && join(process.env.ROUND_PET_MEDIA_ROOT, '.cache/vp8-action-update/export/1-400.ivf');
const media67 = process.env.ROUND_PET_MEDIA_ROOT && join(process.env.ROUND_PET_MEDIA_ROOT, '.cache/vp8-cache/export-full/67-400.ivf');
const token = 'ab'.repeat(32);
const scope = '/dsh-pet-hub/vp8-action';
const reply = body => `@VP8_UPDATE ${body}\r\n`;

test('VP8 refuses a same-length unapproved object and a symlink', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hub-vp8-hash-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const file = join(root, 'object');
  await writeFile(file, Buffer.alloc(VP8_ACTION_BYTES));
  await assert.rejects(readVp8ActionObject(file), /vp8_object/);
  const {symlink} = await import('node:fs/promises');
  await symlink(file, join(root, 'alias'));
  await assert.rejects(readVp8ActionObject(join(root, 'alias')), {code: 'ELOOP'});
});

test('VP8 release requires an explicit trusted signature and exact compatible image', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hub-vp8-release-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const paths = Object.fromEntries(['manifest', 'signature', 'trustKey', 'image'].map(field => [field, join(root, field)]));
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const pem = publicKey.export({type: 'spki', format: 'pem'});
  paths.trustKeySha256 = createHash('sha256').update(publicKey.export({type: 'spki', format: 'der'})).digest('hex');
  const image = Buffer.alloc(8192, 0xff);
  image[0] = 0xe9;
  image[4096] = 0xe7;
  image[4097] = 2;
  const data = {schema: 1, product: 'round-pet-175c-en-vp8', version: '0.1.5', fromVersions: ['0.1.4'],
    bytes: image.length, sha256: createHash('sha256').update(image).digest('hex')};
  const publish = async manifest => {
    const bytes = Buffer.from(JSON.stringify(manifest));
    await writeFile(paths.manifest, bytes);
    await writeFile(paths.signature, sign(null, bytes, privateKey));
  };
  assert.equal(await loadTrustedVp8Release(), undefined);
  await writeFile(paths.trustKey, pem);
  await writeFile(paths.image, image);
  await publish(data);
  assert.deepEqual(await loadTrustedVp8Release(paths), {version: data.version, fromVersions: data.fromVersions,
    file: paths.image, bytes: data.bytes, sha256: data.sha256, route: '/firmware.bin'});
  assert.equal(await loadTrustedVp8Release({...paths, trustKeySha256: undefined}), undefined);
  await writeFile(paths.manifest, JSON.stringify(data) + '\n');
  assert.equal(await loadTrustedVp8Release(paths), undefined);
  for (const bad of [{product: 'another-board'}, {fromVersions: ['0.1.5']}, {version: '0.1.5-power-test'}, {bytes: 2097153}]) {
    await publish({...data, ...bad});
    assert.equal(await loadTrustedVp8Release(paths), undefined);
  }
  await publish(data);
  const wrongKey = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'pem'});
  await writeFile(paths.trustKey, wrongKey);
  assert.equal(await loadTrustedVp8Release(paths), undefined);
  await writeFile(paths.trustKey, pem);
  await writeFile(paths.image, Buffer.alloc(image.length));
  assert.equal(await loadTrustedVp8Release(paths), undefined);
});

test('Desktop VP8 Connection admits only an authorized query with an exact instance and revision', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hub-vp8-desktop-')));
  t.after(() => rm(root, {recursive: true, force: true}));
  let count = 0;
  const claim = prepareVp8ActionUpdate({port: '/dev/ttys00', helper: join(root, 'tty'), file: join(root, 'unused'),
    ssid: 'fixture', password: '', address: '192.168.20.1', operatorToken: token, protocol: 'media2', queryOnly: true}, {
    openTty() { count++; throw Error('fixture stop'); },
  });
  const hub = await startOrAttach({directory: root, vp8Update: claim});
  t.after(() => hub.close());
  const routes = new Map(), cleanup = [];
  createHostPlugin(hub.client, {vp8DesktopQuery: true})({
    effect: register => cleanup.push(register()),
    connection: {fetch: {register(route) {
      routes.set(route.path, route.fetch);
      return () => routes.delete(route.path);
    }}},
    webServer: {register: () => () => {}},
  });
  t.after(() => cleanup.reverse().forEach(close => close()));
  function send(path, body, authorized = true) {
    const route = '/api/pet-hub-vp8/' + path;
    return routes.get(route)(new Request('http://127.0.0.1' + route, {
      method: body ? 'POST' : 'GET',
      headers: {'X-Pet-Hub-Operator': authorized ? token : 'cd'.repeat(32), 'Content-Type': 'application/json', 'X-Pet-Hub': '1'},
      ...(body ? {body: JSON.stringify(body)} : {}),
    }));
  }
  const input = {operation: 'query', instanceId: hub.instanceId, revision: 0};
  assert.equal((await send('status', undefined, false)).status, 401);
  assert.equal((await send('command', {...input, operation: 'install'})).status, 403);
  assert.equal((await send('command', {...input, operation: 'wave'})).status, 403);
  assert.equal((await send('command', {...input, instanceId: 'replaced'})).status, 409);
  assert.equal((await send('command', {...input, revision: 1})).status, 409);
  await assert.rejects(hub.client.request('POST','/v1/vp8-action/command',{...input, operation: 'install'},
    {reviewToken: token}), {status: 409});
  assert.equal(count, 0);
  assert.equal((await (await send('status')).json()).update.queryOnly, true);
  assert.equal((await send('command', input)).status, 200);
  assert.equal(count, 1);
});

test('built plugin settings and exact command proxy use the shared runtime', {timeout: 30000}, async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hub-vp8-')));
  t.after(() => rm(root, {recursive: true, force: true}));
  const helper = join(root, 'tty'), bridge = join(root, 'pty');
  const cc = ['-std=c11', '-D_DEFAULT_SOURCE', '-Wall', '-Wextra', '-Werror'];
  execFileSync('cc', [...cc, 'native/native400-pbp1-tty.c', '-o', helper]);
  execFileSync('cc', [...cc, 'tests/fixtures/native400-pbp1-pty.c', '-o', bridge,
    ...(process.platform === 'linux' ? ['-lutil'] : [])]);
  const {apply} = await import('../dist/apps/dsh-plugin/index.mjs');
  let registered;
  runInNewContext(await readFile('dist/client.js', 'utf8'), {window: {__ModuleLoader__: {load(value) { registered = value; }}}});
  let uiValues = [];
  const react = {useEffect() {}, useRef(value) { return {current: value}; },
    useState(value) { return [uiValues.length ? uiValues.shift() : value, () => {}]; },
    createElement(tag, props, ...children) { return {tag, props, children}; }};
  const settings = registered.factory(() => react);
  let panel;
  settings.apply({slots: {inject(name, slot) { assert.equal(name, 'settings.section'); slot().next(); },
    register(spec, component) { panel = {spec, component}; }}});
  assert.equal(panel.spec.id, 'dsh-pet-hub-settings');
  const panelType = enabled => {
    uiValues = [{vp8ActionUpdate: enabled, deviceMode: 'disabled', serviceInstanceId: 'fixture'}];
    return panel.component().children.find(child => child?.tag?.name === 'Vp8ActionPanel');
  };
  assert.equal(panelType(false), undefined);
  const slot = panelType(true);
  assert.ok(slot);
  uiValues = ['', {phase: 'saved', saved: null}];
  assert.match(JSON.stringify(slot.tag(slot.props)), /结果未知/);
  uiValues = ['', {phase: 'saved', saved: true}];
  assert.match(JSON.stringify(slot.tag(slot.props)), /设备已保存/);
  uiValues = ['', {protocol: 'media2', phase: 'ready', device: {version: '0.1.3', slot: 'ota_1'}}];
  assert.match(JSON.stringify(slot.tag(slot.props)), /0\.1\.3.*ota_1.*安装动作 67/);
  for (const [availability, message] of [['unavailable', /暂无可信固件发布/], ['current', /已是发布版本/],
    ['reconcile_required', /上次升级结果未知/]]) {
    uiValues = ['', {protocol: 'media2', phase: 'ready', upgradeAvailability: availability,
      ...(availability !== 'unavailable' ? {ota: {targetVersion: '0.1.4'}} : {})}];
    const body = slot.tag(slot.props);
    assert.match(JSON.stringify(body), message);
    const upgrade = body.children.find(child => child?.children?.includes('升级到 0.1.4'));
    assert.equal(upgrade?.props.disabled, availability === 'unavailable' ? undefined : true);
  }

  let handler;
  const web = createServer((req, res) => handler ? handler(req, res) : res.writeHead(404).end());
  web.listen(0, '127.0.0.1');
  await once(web, 'listening');
  t.after(() => new Promise(resolve => { web.close(resolve); web.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${web.address().port}`;
  let unmount;
  const ctx = {effect(register) { unmount = register(); }, webServer: {register(route) {
    assert.equal(route.path, '/dsh-pet-hub');
    handler = route.handler;
    return () => { handler = null; };
  }}};
  const request = (route, {authorized = true, body, source = origin} = {}) => fetch(origin + route, {
    method: body ? 'POST' : 'GET', headers: {...(authorized ? {'X-Pet-Hub-Operator': token} : {}),
      ...(body ? {Origin: source, 'X-Pet-Hub': '1', 'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(3000),
  });

  const disabledDir = await mkdtemp(join(root, 'off-'));
  const disabled = await startOrAttach({directory: disabledDir});
  t.after(() => disabled.close());
  apply(ctx, {runtimeDirectory: disabledDir});
  assert.equal((await request(scope + '/status')).status, 404);
  assert.equal((await (await request('/dsh-pet-hub/status')).json()).vp8ActionUpdate, undefined);
  unmount();
  await disabled.close();

  let nextPeer, beforeTtyClose, opens = 0, publications = 0, mediaPort;
  let usbIdentity = 'fixture-board';
  const failures = [];
  const runDir = await mkdtemp(join(root, 'run-'));
  const options = {port: '/dev/ttys00', helper, address: '192.168.20.1', ssid: 'test', password: '', operatorToken: token};
  const hooks = {
    timeoutMs: 3500,
    reconnectMs: 1450,
    identifyUsb() { return usbIdentity; },
    async openTty({enabled}) {
      opens++;
      const drain = beforeTtyClose;
      const handlePeer = nextPeer;
      const child = spawn(bridge, [], {stdio: ['pipe', 'pipe', 'ignore']});
      const exit = once(child, 'close');
      child.stdin.on('error', () => {});
      const input = createInterface({input: child.stdout});
      const lines = input[Symbol.asyncIterator]();
      const io = await openExclusiveNative400Tty({enabled, helper, port: (await lines.next()).value});
      child.stdin.write('!');
      const usbTask = Promise.resolve().then(() => handlePeer({
        async command() { return (await lines.next()).value; },
        write: value => child.stdin.write(value), disconnect: () => child.stdin.end(),
      })).catch(error => { failures.push(error); child.stdin.end(); });
      return {
        read: io.read.bind(io),
        write: io.write.bind(io),
        async close() {
          if (drain) await Promise.race([drain, delay(400)]);
          await io.close(); child.stdin.end(); await exit; await usbTask;
        },
      };
    },
    listen(server, address, ready) {
      assert.equal(address, '192.168.20.1');
      publications++;
      server.listen(0, '127.0.0.1', () => { mediaPort = server.address().port; ready(); });
    },
  };
  const legacyHub = await startOrAttach({directory: runDir, vp8Update: prepareVp8ActionUpdate({
    ...options, file: realObject || join(root, 'absent')}, hooks)});
  let hub = legacyHub;
  t.after(() => legacyHub.close());
  apply(ctx, {runtimeDirectory: runDir, vp8UpdateOrigin: origin});
  assert.equal((await (await request('/dsh-pet-hub/status')).json()).vp8ActionUpdate, true);
  assert.equal((await request(scope + '/status', {authorized: false})).status, 401);
  assert.equal((await request(scope + '/command', {body: {operation: 'install'}, source: 'http://example.invalid'})).status, 403);
  assert.equal(opens, 0);
  const snapshot = async () => {
    const response = await request(scope + '/status');
    assert.equal(response.status, 200);
    const {instanceId, update} = await response.json();
    assert.equal(instanceId, hub.instanceId);
    return update;
  };
  const command = async (operation, revision, expected = 200) => {
    const response = await request(scope + '/command', {body: {operation, revision: revision ?? (await snapshot()).revision,
      instanceId: hub.instanceId}});
    assert.equal(response.status, expected);
    return response.json();
  };
  const waitFor = async phase => {
    for (let i = 0; i < 500; i++) {
      const status = await snapshot();
      if (status.phase === phase) return status;
      if (failures.length) throw failures[0];
      await delay(10);
    }
    assert.fail(`did not reach ${phase}, last status ${JSON.stringify(await snapshot())}`);
  };
  const probe = async (peer, committed = 0, busy = 0) => {
    assert.equal(await peer.command(), 'STATUS1');
    peer.write('unrelated device log\n' + 'x'.repeat(200) + '@VP8_UPDATE STATUS committed=1 busy=0\n@VP8_');
    await delay(15);
    peer.write(`UPDATE STATUS committed=${committed} busy=${busy}\r\n`);
  };
  const accepted = async peer => {
    await probe(peer);
    assert.equal(await peer.command(), `UPDATE1 192.168.20.1 ${mediaPort} 74657374 -`);
    peer.write(reply('STA_READY') + reply('ACCEPTED'));
  };

  nextPeer = peer => probe(peer);
  const initial = await snapshot();
  await command('query', initial.revision);
  await command('install', initial.revision, 409);
  assert.equal((await waitFor('not_saved')).saved, false);
  assert.equal(publications, 0);

  if (realObject) {
    const want = await readVp8ActionObject(realObject);
    const allowSaved = Promise.withResolvers(), downloaded = Promise.withResolvers();
    t.after(() => allowSaved.resolve());
    nextPeer = async peer => {
      await accepted(peer);
      const endpoint = `http://127.0.0.1:${mediaPort}`;
      assert.equal((await fetch(endpoint + '/wrong')).status, 404);
      assert.equal((await fetch(endpoint + VP8_ACTION_ROUTE, {headers: {Range: 'bytes=0-0'}})).status, 404);
      const response = await fetch(endpoint + VP8_ACTION_ROUTE);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-length'), String(VP8_ACTION_BYTES));
      assert.equal(response.headers.get('transfer-encoding'), null);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), want);
      assert.equal((await fetch(endpoint + VP8_ACTION_ROUTE)).status, 404);
      downloaded.resolve();
      await allowSaved.promise;
      peer.write(reply('SAVED id=1 existing=0'));
    };
    await command('install');
    await downloaded.promise;
    assert.equal((await waitFor('updating')).saved, null);
    allowSaved.resolve();
    assert.equal((await waitFor('saved')).existing, false);

    nextPeer = peer => probe(peer, 1);
    await command('install');
    assert.equal((await waitFor('saved')).existing, true);
    assert.equal(publications, 1);

    nextPeer = async peer => { await accepted(peer); peer.write(reply('FAILED reason=download')); };
    await command('install');
    assert.equal((await waitFor('failed')).error, 'device_failed');

    nextPeer = async peer => {
      await accepted(peer);
      assert.equal(await peer.command(), 'CANCEL1');
      peer.write(reply('CANCELLED'));
      assert.equal(await peer.command(), undefined);
    };
    await command('install');
    await waitFor('updating');
    await command('cancel');
    assert.equal((await waitFor('cancelled')).saved, null);

    nextPeer = async peer => { await accepted(peer); peer.disconnect(); };
    await command('install');
    assert.equal((await waitFor('unknown')).saved, null);
    await command('install', undefined, 409);
    nextPeer = async peer => { assert.equal(await peer.command(), 'STATUS1'); peer.disconnect(); };
    await command('query');
    await waitFor('unknown');
    await command('install', undefined, 409);
    nextPeer = peer => probe(peer, 1);
    await command('query');
    assert.equal((await waitFor('saved')).saved, true);

    nextPeer = accepted;
    await command('install');
    assert.equal((await waitFor('unknown')).error, 'deadline_or_closed');
    assert.equal(publications, 5);
    await assert.rejects(fetch(`http://127.0.0.1:${mediaPort}${VP8_ACTION_ROUTE}`));

    nextPeer = peer => probe(peer);
    await command('query');
    await waitFor('not_saved');
    nextPeer = accepted;
    await command('install');
    await waitFor('updating');
  } else {
    nextPeer = peer => probe(peer, 1);
    await command('query');
    assert.equal((await waitFor('saved')).saved, true);
    assert.equal(publications, 0);
    t.diagnostic('Fixed object HTTP and terminal branches require ROUND_PET_MEDIA_ROOT with the approved export.');
  }

  unmount();
  assert.equal((await request(scope + '/status')).status, 404);
  assert.equal((await hub.client.request('GET', '/v1/status')).instanceId, hub.instanceId);
  if (realObject) {
    await hub.close();
    await assert.rejects(fetch(`http://127.0.0.1:${mediaPort}${VP8_ACTION_ROUTE}`));
  }
  await legacyHub.close();

  const newDir = await mkdtemp(join(root, 'media2-'));
  const firmware = Buffer.alloc(8192, 0xff);
  firmware[0] = 0xe9;
  firmware[4096] = 0xe7;
  firmware[4097] = 2;
  const release = {file: join(root, 'fixture-firmware.bin'), version: '0.1.4', bytes: firmware.length,
    sha256: createHash('sha256').update(firmware).digest('hex')};
  await writeFile(release.file, firmware);
  assert.throws(() => prepareVp8ActionUpdate({...options, file: release.file, release}, hooks), /vp8_ota_release/);
  assert.throws(() => prepareVp8ActionUpdate({...options, file: release.file, protocol: 'media2',
    release: {...release, bytes: 2097153}}, hooks), /vp8_ota_release/);
  const mediaHub = await startOrAttach({directory: newDir, vp8Update: prepareVp8ActionUpdate({
    ...options, file: media67 || join(root, 'absent'), protocol: 'media2', release}, hooks)});
  hub = mediaHub;
  t.after(() => mediaHub.close());
  apply(ctx, {runtimeDirectory: newDir, vp8UpdateOrigin: 'loopback-listener'});
  assert.equal((await (await request('/dsh-pet-hub/status')).json()).vp8ActionUpdate, true);
  assert.equal((await request(scope + '/command', {body: {operation: 'upgrade'}, source: 'http://example.invalid'})).status, 403);
  const ota = message => `@VP8_OTA ${message}\n`;
  const status2 = (peer, selected, version, slot) => {
    peer.write(reply('STATUS committed=1 busy=0') + ota(`STATUS busy=0 selected=${selected} slot=${slot} version=${version}`));
  };
  const probe2 = async (peer, selected = 0) => {
    assert.equal(await peer.command(), 'STATUS2');
    status2(peer, selected, '0.1.3', 'ota_1');
  };
  const beforeMedia = publications;
  assert.equal((await snapshot()).upgradeAvailability, 'query_required');
  await command('upgrade', undefined, 409);
  nextPeer = peer => probe2(peer);
  await command('query');
  const ready = await waitFor('ready');
  assert.equal(ready.upgradeAvailability, 'available');
  assert.deepEqual(ready.device, {busy: false, selected: false, slot: 'ota_1', version: '0.1.3'});
  assert.equal(ready.saved, null);
  nextPeer = peer => probe2(peer, 1);
  await command('install');
  assert.equal((await waitFor('blocked')).device.selected, true);
  assert.equal(publications, beforeMedia);

  if (media67) {
    const want = await readVp8ActionObject(media67, 'media2');
    const startMedia = async peer => {
      await probe2(peer);
      const {sha256} = VP8_MEDIA67;
      assert.equal(await peer.command(), `MEDIA2 192.168.20.1 ${mediaPort} 0 67 1 241 440248 ${sha256} 74657374 -`);
      peer.write(ota('MEDIA_SAVED') + ota('ACCEPTED'));
    };
    let allowReceipt = Promise.withResolvers(), transferred = Promise.withResolvers();
    t.after(() => allowReceipt.resolve());
    nextPeer = async peer => {
      await startMedia(peer);
      const endpoint = `http://127.0.0.1:${mediaPort}`;
      assert.equal((await fetch(endpoint + VP8_ACTION_ROUTE)).status, 404);
      const result = await fetch(endpoint + '/asset.ivf');
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('content-length'), '440248');
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), want);
      transferred.resolve();
      await allowReceipt.promise;
      peer.write(ota('MEDIA_SAVED'));
    };
    await command('install');
    await Promise.race([transferred.promise, delay(5000, undefined, {ref: false}).then(() => {
      throw failures[0] ?? new Error('MEDIA2 fixture did not transfer');
    })]);
    assert.equal((await waitFor('updating')).saved, null);
    allowReceipt.resolve();
    assert.equal((await waitFor('saved')).receipt, 'MEDIA_SAVED');
    await assert.rejects(fetch(`http://127.0.0.1:${mediaPort}/asset.ivf`));

    nextPeer = async peer => { await startMedia(peer); peer.disconnect(); };
    await command('install');
    assert.equal((await waitFor('unknown')).receipt, null);
    nextPeer = peer => probe2(peer);
    await command('query');
    await waitFor('unknown');
    assert.equal((await snapshot()).saved, null);
    assert.equal(publications, beforeMedia + 2);

    nextPeer = async peer => { await startMedia(peer); peer.write(ota('MEDIA_EXISTING')); };
    await command('install');
    assert.equal((await waitFor('saved')).existing, true);

    nextPeer = async peer => { await startMedia(peer); peer.write(ota('MEDIA_FAILED')); };
    await command('install');
    assert.equal((await waitFor('failed')).saved, null);

    nextPeer = startMedia;
    await command('install');
    assert.equal((await waitFor('unknown')).error, 'deadline_or_closed');
  }

  const startOta = async peer => {
    await probe2(peer);
    assert.equal(await peer.command(), `OTA2 192.168.20.1 ${mediaPort} 8192 ${release.sha256} 74657374 -`);
  };
  const upgrades = publications;
  await writeFile(release.file, Buffer.alloc(8192));
  nextPeer = peer => probe2(peer);
  await command('upgrade');
  assert.equal((await waitFor('failed')).error, 'object_rejected');
  assert.equal(publications, upgrades);
  await writeFile(release.file, firmware);

  nextPeer = async peer => { await startOta(peer); peer.write(ota('ACCEPTED') + ota('INVALID_IMAGE')); };
  await command('upgrade');
  assert.deepEqual((await waitFor('failed')).ota, {targetVersion: '0.1.4', selectedSeen: false, rebootSent: false, success: false});
  nextPeer = async peer => { await startOta(peer); peer.write(ota('SELECTED')); peer.disconnect(); };
  await command('upgrade');
  const unknown = await waitFor('unknown');
  assert.deepEqual(unknown.ota, {targetVersion: '0.1.4', selectedSeen: false, rebootSent: false, success: null});
  assert.equal(unknown.upgradeAvailability, 'reconcile_required');

  for (const verifyMode of ['old', 'same-slot', 'changed-usb', 'upgraded']) {
    let rebootCount = 0, reconnectCount = 0;
    const rebootObserved = Promise.withResolvers();
    usbIdentity = 'fixture-board';
    const beforeQuery = opens;
    await command('upgrade', undefined, 409);
    assert.equal(opens, beforeQuery);
    nextPeer = peer => probe2(peer);
    await command('query');
    assert.equal((await waitFor(media67 ? 'unknown' : 'ready')).upgradeAvailability, 'available');
    beforeTtyClose = rebootObserved.promise;
    nextPeer = async peer => {
      await startOta(peer);
      const endpoint = `http://127.0.0.1:${mediaPort}`;
      assert.equal((await fetch(endpoint + '/asset.ivf')).status, 404);
      const response = await fetch(endpoint + '/firmware.bin');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-length'), String(firmware.length));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), firmware);
      peer.write(ota('ACCEPTED') + ota('SELECTED'));
      assert.equal(await peer.command(), 'REBOOT2');
      rebootCount++;
      if (verifyMode === 'changed-usb') usbIdentity = 'different-board';
      beforeTtyClose = undefined;
      nextPeer = async next => {
        const probe = await next.command();
        if (probe === undefined && (verifyMode === 'old' || verifyMode === 'same-slot') && reconnectCount > 0) return;
        assert.equal(probe, 'STATUS2');
        reconnectCount++;
        status2(next, 0, verifyMode === 'old' ? '0.1.3' : '0.1.4', verifyMode === 'same-slot' ? 'ota_1' : 'ota_0');
      };
      await assert.rejects(fetch(endpoint + '/firmware.bin'));
      rebootObserved.resolve();
      assert.equal(await peer.command(), undefined);
    };
    await command('upgrade');
    const final = await waitFor(verifyMode === 'upgraded' ? 'upgraded' : 'unknown');
    assert.equal(rebootCount, 1);
    assert.equal(reconnectCount > 0, verifyMode !== 'changed-usb');
    assert.equal(final.ota.selectedSeen, true);
    assert.equal(final.ota.rebootSent, true);
    assert.equal(final.ota.success, verifyMode === 'upgraded' ? true : null);
    assert.equal(final.saved, null);
    if (verifyMode === 'upgraded') assert.deepEqual(final.device, {busy: false, selected: false, slot: 'ota_0', version: '0.1.4'});
  }
  assert.equal((await snapshot()).upgradeAvailability, 'current');
  await command('upgrade', undefined, 409);
  nextPeer = async peer => {
    assert.equal(await peer.command(), 'STATUS2');
    status2(peer, 0, '0.1.2', 'ota_1');
  };
  await command('query');
  assert.equal((await waitFor(media67 ? 'unknown' : 'ready')).upgradeAvailability, 'ineligible');
  await command('upgrade', undefined, 409);
  unmount();
  assert.equal((await request(scope + '/status')).status, 404);
  await mediaHub.close();
  assert.deepEqual(failures, []);
});
