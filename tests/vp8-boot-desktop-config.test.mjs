import assert from 'node:assert/strict';
import {setImmediate as turn} from 'node:timers/promises';
import test from 'node:test';
import {applyVp8BootDesktopConfig} from '../apps/dsh-plugin/vp8-boot-desktop-config.mjs';
import {createVp8BootOwner} from '../packages/runtime/vp8-boot-owner.mjs';

const prefix = '/api/pet-hub-vp8-boot/';
const root = '/synthetic-enrollment-root';
const enabled = {enabled: true, enrollmentDirectory: root};

function host() {
  const routes = new Map(), effects = [];
  const ctx = {effect(setup) { effects.push(setup()); },
    connection: {fetch: {register(route) {
      assert.equal(routes.has(route.path), false);
      routes.set(route.path, route.fetch);
      return () => routes.delete(route.path);
    }}}};
  const request = (path, data, fetch = routes.get(prefix + path)) => fetch(new Request('http://dsh.internal' + prefix + path,
    data ? {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}, body: JSON.stringify(data)} : {}));
  return {ctx, effects, routes, request};
}

test('native settings default to off and enabled entry checks profile and private directory', () => {
  const {ctx, effects, routes} = host();
  const denied = {isDesktop: () => false, checkRoot: assert.fail, createOwner: assert.fail};
  applyVp8BootDesktopConfig(ctx, {}, denied);
  applyVp8BootDesktopConfig(ctx, {enabled: false, enrollmentDirectory: root}, denied);
  assert.throws(() => applyVp8BootDesktopConfig(ctx, {enabled: 'true'}, denied), {code: 'vp8_desktop_config'});
  assert.throws(() => applyVp8BootDesktopConfig(ctx, enabled, denied), {code: 'vp8_review_profile'});
  const mock = {...denied, isDesktop: () => true, checkRoot: () => { throw new Error('unsafe root'); }};
  assert.throws(() => applyVp8BootDesktopConfig(ctx, enabled, mock), /unsafe root/);
  assert.equal(effects.length, 0);
  assert.equal(routes.size, 0);
});

test('same-process replacement revokes routes immediately and waits until the old raw session closes', async t => {
  const {ctx, effects, routes, request} = host();
  const arrived = Promise.withResolvers(), proof = Promise.withResolvers();
  const closing = Promise.withResolvers(), release = Promise.withResolvers();
  let profile = true, opens = 0, owners = 0, closed = 0;
  const scope = {}, errors = [];
  const options = {scope, report: msg => errors.push(msg), isDesktop: () => profile, checkRoot: path => path,
    createOwner(directory, {usbEnrollment}) {
      assert.equal(directory, root);
      assert.equal(usbEnrollment, true);
      owners++;
      return createVp8BootOwner({usbEnrollment, store: {
        read: () => ({revision: '0', record: null}), commit: assert.fail,
      }, keys: {prepare: assert.fail, lookup: assert.fail}, async openSession() {
        opens++;
        return {async exchange(_frame, {signal}) { arrived.resolve(signal); return proof.promise; },
          async close() { closing.resolve(); await release.promise; closed++; }};
      }});
    }};
  t.after(async () => {
    proof.resolve(null);
    release.resolve();
    await Promise.allSettled(effects.map(close => close()));
  });

  applyVp8BootDesktopConfig(ctx, enabled, options);
  assert.equal(owners, 1);
  assert.equal(opens, 0);
  assert.throws(() => applyVp8BootDesktopConfig(ctx, enabled, options), {code: 'vp8_desktop_in_use'});
  const status = await (await request('status')).json();
  assert.equal(status.usbEnrollment, true);
  const command = {operation: 'enroll-usb', instanceId: status.instanceId, revision: status.revision};
  profile = false;
  assert.equal((await request('command', command)).status, 401);
  assert.equal(opens, 0);
  profile = true;
  assert.equal((await request('command', command)).status, 200);
  const signal = await arrived.promise;
  const stale = routes.get(prefix + 'command');
  const stopping = effects[0]();
  assert.equal(signal.aborted, true);
  assert.equal(routes.size, 0);
  assert.notEqual((await request('command', command, stale)).status, 200);

  applyVp8BootDesktopConfig(ctx, enabled, options);
  await turn();
  assert.equal(routes.size, 0);
  assert.equal(owners, 1);
  proof.resolve(null);
  await closing.promise;
  assert.equal(closed, 0);
  release.resolve();
  await stopping;
  assert.equal(closed, 1);
  assert.equal(owners, 2);
  const newer = await (await request('status')).json();
  assert.notEqual(newer.instanceId, status.instanceId);
  assert.equal((await request('command', command)).status, 409);
  assert.equal(opens, 1);
  await effects[1]();
  applyVp8BootDesktopConfig(ctx, {enabled: false, enrollmentDirectory: ''}, options);
  assert.equal(routes.size, 0);
  assert.deepEqual(errors, []);
});

test('release errors block a new configured candidate in the same process', async () => {
  const {ctx, effects, routes} = host();
  let owners = 0;
  const errors = [], options = {scope: {}, isDesktop: () => true, checkRoot: v => v,
    report: msg => errors.push(msg), createOwner() { owners++; return {status: assert.fail, command: assert.fail,
      async close() { throw new Error('fixture close failed'); }}; }};
  applyVp8BootDesktopConfig(ctx, enabled, options);
  await assert.rejects(effects[0](), /fixture close failed/);
  assert.equal(routes.size, 0);
  applyVp8BootDesktopConfig(ctx, enabled, options);
  await turn();
  assert.equal(owners, 1);
  assert.equal(routes.size, 0);
  await assert.rejects(effects[1](), /fixture close failed/);
  assert.match(errors.join('\n'), /release not confirmed/);
});

test('a silent Type 6 during startup is retryable with no enrollment write', async () => {
  const {ctx, effects, request} = host();
  const wires = [];
  const options = {scope: {}, isDesktop: () => true, checkRoot: value => value,
    createOwner() { return createVp8BootOwner({usbEnrollment: true,
      store: {read: () => ({revision: '0', record: null}), commit: assert.fail},
      keys: {prepare: assert.fail, lookup: assert.fail},
      async openSession() {
        return {async exchange(frame) { wires.push(Buffer.from(frame.slice(9).trim(), 'base64')[5]); return null; }, close() {}};
      }}); }};
  applyVp8BootDesktopConfig(ctx, enabled, options);
  try {
    for (let i = 0; i < 2; i++) {
      const {instanceId, revision} = await (await request('status')).json();
      assert.equal((await request('command', {operation: 'enroll-usb', instanceId, revision})).status, 200);
      await turn();
      const after = await (await request('status')).json();
      assert.equal(after.issue, 'usb_not_ready');
      assert.equal(after.phase, 'unregistered');
      assert.equal(after.deviceChecked, false);
    }
    assert.deepEqual(wires, [6, 6]);
  } finally { await effects[0](); }
});
