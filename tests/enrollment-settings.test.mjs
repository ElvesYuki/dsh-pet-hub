import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {generateKeyPairSync, sign} from 'node:crypto';
import {once} from 'node:events';
import {chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';
import {mountEnrollmentSettings} from '../apps/dsh-plugin/enrollment-routes.mjs';
import {openDeviceBindingIndex} from '../packages/runtime/device-binding-index.mjs';
import {createEnrollmentCoordinator} from '../packages/runtime/device-enrollment-owner.mjs';
import {compileBootPeer, hasCryptoPeer} from './fixtures/device-enrollment-cpp.mjs';

const rawKind = line => Buffer.from(line.slice('VP8PAIR1 '.length).trimEnd(), 'base64')[5];
const pending = {phase: 'pending', keyRef: 'fixture-key', target: {
  device: '11'.repeat(16), controller: '22'.repeat(16), binding: '33'.repeat(16),
  epoch: '9007199254740993', keySha256: 'aa'.repeat(32),
}};

function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vp8-boot-settings-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  return directory;
}

function input(view, operation) { return {operation, instanceId: view.instanceId, revision: view.revision}; }

function makeKey() {
  const {publicKey, privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const {x, y} = publicKey.export({format: 'jwk'});
  return {ref: pending.keyRef, publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]),
    signTranscript: bytes => sign('sha256', bytes, {key: privateKey, dsaEncoding: 'ieee-p1363'})};
}

async function eventually(owner, done) {
  for (let i = 0; i < 200; i++) {
    const state = owner.status();
    if (done(state)) return state;
    await delay(5);
  }
  assert.fail(JSON.stringify(owner.status()));
}

test('BOOT index preserves CAS, phase and key reference across reopen and fails closed on unsafe or uncertain files', t => {
  const directory = scratch(t), options = {directory, create: true};
  const file = join(directory, 'device-binding.json'), lock = join(directory, 'device-binding.write.lock');
  let fail;
  const a = openDeviceBindingIndex({...options, fault(stage) { if (stage === fail) throw Error('fixture'); }});
  const b = openDeviceBindingIndex(options);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  fail = 'before_rename';
  assert.throws(() => a.commit('0', pending), {code: 'device_index_write_failed'});
  assert.equal(a.read().record, null);
  fail = undefined;
  assert.throws(() => a.commit('0', {...pending, keyRef: undefined}));
  assert.throws(() => a.commit('0', {...pending, privateKey: 'forbidden'}));
  a.commit('0', pending);
  assert.throws(() => b.commit('0', pending), {code: 'revision_conflict'});
  fail = 'after_rename';
  assert.throws(() => a.commit('1', {...pending, phase: 'bound'}), {code: 'device_index_commit_unknown'});
  assert.throws(() => a.read(), {code: 'device_index_commit_unknown'});
  const reopened = openDeviceBindingIndex({directory});
  assert.deepEqual(reopened.read(), {revision: '2', record: {...pending, phase: 'bound'}});
  writeFileSync(lock, '', {mode: 0o600});
  assert.throws(() => openDeviceBindingIndex(options), {code: 'device_index_locked'});
  assert.throws(() => reopened.read(), {code: 'device_index_locked'});
  rmSync(lock);
  chmodSync(file, 0o644);
  assert.throws(() => openDeviceBindingIndex(options), {code: 'device_index_invalid'});
  chmodSync(file, 0o600);
  writeFileSync(file, readFileSync(file, 'utf8').replace('bound', 'pending'));
  assert.throws(() => openDeviceBindingIndex(options), {code: 'device_index_invalid'});
  assert.match(readFileSync(file, 'utf8'), /pending/);
  rmSync(file);
  symlinkSync(join(directory, 'missing'), file);
  assert.throws(() => openDeviceBindingIndex(options), {code: 'device_index_invalid'});
});

test('BOOT cancel fences a late probe and keeps the owner occupied until USB teardown', async t => {
  const store = openDeviceBindingIndex({directory: scratch(t), create: true});
  const arrival = Promise.withResolvers(), response = Promise.withResolvers();
  const closing = Promise.withResolvers(), release = Promise.withResolvers();
  let opens = 0;
  const owner = createEnrollmentCoordinator({store, keys: {prepare: assert.fail, lookup: assert.fail},
    async openSession() {
      opens++;
      return {
        async exchange() { arrival.resolve(); return response.promise; },
        async close() { closing.resolve(); await release.promise; },
      };
    }});
  t.after(async () => { response.resolve(null); release.resolve(); await owner.close(); store.close(); });
  const view = owner.status(), start = owner.command(input(view, 'enroll'));
  assert.equal(start.busy, true);
  await arrival.promise;
  assert.throws(() => owner.command(input(view, 'cancel')), {code: 'device_boot_stale'});
  assert.equal(owner.command(input(start, 'cancel')).busy, true);
  response.resolve(null);
  await closing.promise;
  assert.throws(() => owner.command(input(owner.status(), 'enroll')), {code: 'device_boot_wrong_phase'});
  release.resolve();
  assert.equal((await eventually(owner, state => !state.busy)).issue, 'interrupted');
  assert.equal(opens, 1);
  assert.deepEqual(store.read(), {revision: '0', record: null});
});

test('settings candidate registers separately from the default desktop slot and renders physical confirmation', () => {
  for (const [asset, expected] of [['client.connection.js', false], ['client.boot-review.js', true]]) {
    let bundled;
    runInNewContext(readFileSync('dist/' + asset, 'utf8'), {
      location: {protocol: 'dsh-app:', hostname: 'app'},
      window: {__ModuleLoader__: {load: value => { bundled = value; }}},
    });
    const state = [{phase: 'awaiting_boot', busy: true}];
    const react = {useEffect() {}, useRef: value => ({current: value}), useState: value => [state.shift() ?? value, () => {}],
      createElement: (tag, props, ...children) => ({tag, props, children})};
    const registered = new Map();
    bundled.factory(() => react).apply({slots: {
      inject(name, slot) { assert.equal(name, 'settings.section'); [...slot()]; },
      register(spec, component) { registered.set(spec.id, component); },
    }});
    assert.ok(registered.get('dsh-pet-hub-settings'));
    const boot = registered.get('dsh-pet-hub-enrollment-settings');
    assert.equal(Boolean(boot), expected);
    if (boot) {
      const tree = JSON.stringify(boot());
      assert.match(tree, /短按并松开 BOOT.*停止等待/);
      assert.doesNotMatch(tree, /本地授权码/);
    }
  }
});

test('isolated BOOT settings and default no-code query coexist across signed C++ pairing and lost receipt recovery',
  {skip: !hasCryptoPeer, timeout: 30000}, async t => {
    const directory = scratch(t);
    const cpp = compileBootPeer(directory, 'tests/fixtures/device-binding-proof-peer.cpp', 'peer');
    const child = spawn(cpp, ['--p256'], {stdio: ['pipe', 'pipe', 'inherit']});
    const exit = once(child, 'exit');
    const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
    t.after(async () => { child.stdin.end(); await exit; });
    let held = false, drop = true, readBackKey = false, approved = true, localQueries = 0, failPending = false;
    const sent = [];
    const key = makeKey();
    async function openSession() {
      assert.equal(held, false);
      held = true;
      return {
        async exchange(line) {
          const kind = rawKind(line);
          sent.push(kind);
          if (kind === 7) assert.equal(index.read().record.keyRef, key.ref);
          child.stdin.write(line);
          const {value, done} = await lines.next();
          assert.equal(done, false);
          if (kind === 10 && drop) throw new Error('fixture lost confirmation');
          return value + '\n';
        },
        close() { held = false; },
      };
    }
    const keys = {prepare: () => key, lookup: () => readBackKey ? key : undefined};
    let index = openDeviceBindingIndex({directory, create: true, fault(stage) {
      if (failPending && stage === 'before_rename') throw new Error('fixture pending failure');
    }});
    const poll = () => child.stdin.write('#tick 100000 1 0\n#tick 150000 1 0\n#tick 200000 1 1\n' +
      '#tick 250000 1 1\n#tick 300000 1 0\n#tick 350000 1 0\n');
    let owner = createEnrollmentCoordinator({store: index, keys, openSession, poll});
    let routes;
    function mount(withBoot) {
      routes = new Map();
      const disposers = [];
      const instanceId = 'existing-query';
      const update = {queryOnly: true, revision: 0, phase: 'ready'};
      const host = createHostPlugin(null, {desktopDeviceQuery: true,
        managedDeviceUpdate: () => ({instanceId, status: () => ({instanceId, update}),
          query: revision => { assert.equal(revision, 0); localQueries++; return {instanceId, update}; }}),
      });
      const ctx = {
        effect: setup => disposers.push(setup()),
        connection: {fetch: {register(route) {
          routes.set(route.path, route.fetch);
          return () => routes.delete(route.path);
        }}},
        webServer: {register: () => () => {}},
      };
      host(ctx);
      if (withBoot) mountEnrollmentSettings(ctx, {owner, authorize: () => approved});
      return async () => { for (const dispose of disposers.reverse()) await dispose(); };
    }
    const prefix = '/api/pet-hub-enrollment/';
    const request = (path, body, {origin = 'dsh-app://app', headers} = {}) =>
      routes.get(path)(new Request(origin + path, {method: body ? 'POST' : 'GET',
        headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1', ...headers},
        ...(body ? {body: JSON.stringify(body)} : {})}));

    await mount(false)();
    assert.equal(routes.has(prefix + 'command'), false);
    let unmount = mount(true);
    t.after(() => unmount());
    assert.equal((await request('/api/pet-hub-device/query',
      {operation: 'query', instanceId: 'existing-query', revision: 0})).status, 200);
    assert.equal(localQueries, 1);
    approved = false;
    assert.equal((await request(prefix + 'status')).status, 401);
    approved = true;
    assert.equal((await request(prefix + 'status', undefined, {origin: 'http://app'})).status, 404);
    assert.deepEqual(sent, []);
    const initial = await (await request(prefix + 'status')).json();
    assert.deepEqual(Object.keys(initial).sort(), ['busy', 'deviceChecked', 'instanceId', 'issue', 'phase', 'revision']);
    const enroll = input(initial, 'enroll');
    assert.equal((await request(prefix + 'command', {...enroll, device: pending.target.device})).status, 400);
    assert.equal((await request(prefix + 'command', {...enroll, revision: '01'})).status, 400);
    assert.equal((await request(prefix + 'command', {...enroll, revision: '9'})).status, 409);
    failPending = true;
    assert.equal((await request(prefix + 'command', enroll)).status, 200);
    assert.equal((await eventually(owner, state => !state.busy)).phase, 'unregistered');
    assert.deepEqual(sent, [6]);
    failPending = false;
    assert.equal((await request(prefix + 'command', input(owner.status(), 'enroll'))).status, 200);
    assert.equal((await request(prefix + 'command', enroll)).status, 409);
    assert.equal((await eventually(owner, state => !state.busy)).phase, 'recovery_required');
    assert.deepEqual(sent, [6, 6, 7, 8, 10]);
    assert.equal(index.read().record.phase, 'pending');
    assert.equal(held, false);
    await unmount();
    index.close();

    child.stdin.write('#reset\n');
    drop = false;
    index = openDeviceBindingIndex({directory});
    owner = createEnrollmentCoordinator({store: index, keys, openSession});
    unmount = mount(true);
    assert.equal((await request(prefix + 'command', enroll)).status, 409);
    assert.equal((await request(prefix + 'command', input(owner.status(), 'recover'))).status, 200);
    assert.equal((await eventually(owner, state => !state.busy)).phase, 'recovery_required');
    readBackKey = true;
    assert.equal((await request(prefix + 'command', input(owner.status(), 'recover'))).status, 200);
    assert.equal((await eventually(owner, state => !state.busy)).phase, 'bound');
    assert.equal(index.read().record.phase, 'bound');
    assert.equal(index.read().record.keyRef, key.ref);
    assert.deepEqual(sent, [6, 6, 7, 8, 10, 6, 10, 6, 10]);
    assert.equal(owner.status().deviceChecked, false);
    assert.equal((await request(prefix + 'command', input(owner.status(), 'verify'))).status, 200);
    assert.equal((await eventually(owner, state => !state.busy)).deviceChecked, true);
    assert.deepEqual(sent.slice(-2), [6, 10]);
    assert.equal(index.read().revision, '2');
    readBackKey = false;
    assert.equal((await request(prefix + 'command', input(owner.status(), 'verify'))).status, 200);
    const failed = await eventually(owner, state => !state.busy);
    assert.equal(failed.deviceChecked, false);
    assert.equal(failed.phase, 'bound');
    assert.equal((await request('/api/pet-hub-device/query',
      {operation: 'query', instanceId: 'existing-query', revision: 0})).status, 200);
    assert.equal(localQueries, 2);
    await unmount();
    assert.equal(routes.size, 0);
    assert.equal(held, false);
    index.close();
  });
