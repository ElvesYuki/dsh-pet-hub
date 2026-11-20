import assert from 'node:assert/strict';
import test from 'node:test';
import {createDesktopBatterySampler, readDesktopBattery} from '../packages/runtime/usb-battery-sampler.mjs';
import {desktopUsbOpener, desktopUsbStatus, trackDesktopUsbTarget} from '../packages/runtime/desktop-usb-ownership.mjs';
import {makeDesktopDevicePage} from '../packages/ui/device-settings-page.mjs';

const ok = 'status=ok present=1 usb_power=1 percent=0 mv=4191 flow=charging phase=cv';
const ttyFixture = (...replies) => {
  let written = '', receivedId, reads, closed = 0;
  return {
    get receivedId() { return receivedId; },
    get closed() { return closed; },
    async write(data, offset, length) {
      const bytesWritten = Math.min(length, 3);
      written += data.toString('ascii', offset, offset + bytesWritten);
      if (written.endsWith('\n')) {
        receivedId = /^BATTERY1 ([a-f0-9]{8})\n$/.exec(written)?.[1];
        assert.ok(receivedId);
      }
      return {bytesWritten};
    },
    async read(target) {
      assert.ok(receivedId);
      reads ??= replies.map(part => part.replaceAll('{id}', receivedId));
      if (!reads.length) throw Object.assign(new Error(), {code: 'EAGAIN'});
      return {bytesRead: target.write(reads.shift(), 'ascii')};
    },
    async close() { closed++; },
  };
};

const batteryOptions = io => ({
  identity: 'fixture-target',
  identifyUsb: async () => 'fixture-target',
  openTty: async () => io,
});
const signal = () => new AbortController().signal;
const response = line => '@VP8_BATTERY1 id={id} ' + line + '\n';

test('BATTERY1 assembles short writes and complete matching lines while ignoring diagnostics and invalid replies', async () => {
  const io = ttyFixture('log: animation\n@VP8_BATTERY1 id=INVALID ' + ok + '\n',
    response('status=ok present=1 usb_power=1 percent=101 mv=4191 flow=charging phase=cv'),
    response('status=ok present=1 usb_power=1 percent=62 mv=65535 flow=charging phase=cv'),
    '@VP8_BATTERY1 id={id} status=ok present=1 usb_power=1 ', 'percent=0 mv=4191 flow=charging phase=cv\r\n');
  assert.deepEqual(await readDesktopBattery(batteryOptions(io), signal()), {status: 'ok', present: true,
    usbPower: true, percent: 0, mv: 4191, flow: 'charging', phase: 'cv'});
  assert.equal(io.closed, 1);
  const next = ttyFixture(response('status=ok present=1 usb_power=0 percent=na mv=na flow=standby phase=full'));
  assert.deepEqual(await readDesktopBattery(batteryOptions(next), signal()), {status: 'ok', present: true,
    usbPower: false, percent: null, mv: null, flow: 'standby', phase: 'full'});
});

test('no battery, busy, rate limiting, unavailable, old firmware and disconnect are distinct', async () => {
  const missing = ttyFixture(response('status=ok present=0 usb_power=1 percent=na mv=na flow=na phase=na'));
  assert.deepEqual(await readDesktopBattery(batteryOptions(missing), signal()), {status: 'ok', present: false,
    usbPower: true, percent: null, mv: null, flow: null, phase: null});
  for (const status of ['busy', 'rate_limited', 'unavailable', 'disconnected', 'no_reply']) {
    const lines = status === 'disconnected' ? [''] : status === 'no_reply' ?
      ['@VP8_BATTERY1 id={id} status=ok present=1'] : [response('status=' + status)];
    const io = ttyFixture(...lines);
    assert.deepEqual(await readDesktopBattery(batteryOptions(io), signal()), {status});
    assert.equal(io.closed, 1);
  }
});

test('approval is checked before and after open; USB cancellation waits until the exclusive handle actually closes', async () => {
  const scope = {}, lifetime = new AbortController(), request = new AbortController();
  const wrong = {identity: 'approved', identifyUsb: async () => 'other', openTty: assert.fail};
  assert.deepEqual(await readDesktopBattery(wrong, signal()), {status: 'disconnected'});
  let opens = 0, checks = 0;
  const afterOpen = ttyFixture();
  assert.deepEqual(await readDesktopBattery({identity: 'approved',
    identifyUsb: async () => ++checks === 1 ? 'approved' : 'other', openTty: async () => { opens++; return afterOpen; }},
  signal()), {status: 'disconnected'});
  assert.equal(opens, 1);
  assert.equal(afterOpen.closed, 1);

  const reading = Promise.withResolvers(), closing = Promise.withResolvers(), release = Promise.withResolvers();
  const options = batteryOptions({async write(input, offset, bytesWritten) { return {bytesWritten}; },
    async read() { reading.resolve(); throw Object.assign(new Error(), {code: 'EAGAIN'}); },
    async close() { closing.resolve(); await release.promise; }});
  options.openTty = desktopUsbOpener(options.openTty, scope);
  let clock = 100;
  const sampler = createDesktopBatterySampler({read: active => readDesktopBattery(options, active),
    usbStatus: () => desktopUsbStatus(scope), lifetime: lifetime.signal, now: () => clock});
  sampler.cancel('early');
  assert.deepEqual(sampler.sample('early', signal()), {status: 'cancelled'});
  const active = sampler.sample('current', request.signal);
  const cancelled = assert.rejects(active, {name: 'AbortError'});
  await reading.promise;
  assert.deepEqual(sampler.sample('another', signal()), {status: 'busy'});
  await assert.rejects(desktopUsbOpener(assert.fail, scope)({}), {code: 'device_desktop_usb_busy'});
  sampler.cancel('current');
  await closing.promise;
  assert.equal(desktopUsbStatus(scope).usbBusy, true);
  release.resolve();
  await cancelled;
  await sampler.drain();
  assert.equal(desktopUsbStatus(scope).usbBusy, false);
  assert.deepEqual(sampler.sample('another', signal()), {status: 'rate_limited'});
  clock += 5000;
  const untrackQuery = trackDesktopUsbTarget('query', 'one', scope);
  const untrackBinding = trackDesktopUsbTarget('binding', 'two', scope);
  assert.deepEqual(sampler.sample('conflict', signal()), {status: 'conflict'});
  untrackQuery();
  untrackBinding();
});

test('device page status ticks do not trigger USB and unmount cancels the exact running battery request', async t => {
  const callbacks = new Map(), calls = [];
  let sequence = 0, cleanup, view = {}, batteryReady = Promise.withResolvers();
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    callbacks.set(++sequence, {fn, delay});
    return sequence;
  });
  t.mock.method(globalThis, 'clearTimeout', value => callbacks.delete(value));
  const runTimer = delay => {
    const [id, {fn}] = [...callbacks].find(([, value]) => value.delay === delay);
    callbacks.delete(id);
    return fn();
  };
  const ref = {current: null};
  const react = {createElement() {}, useEffect() {},
    useRef: () => ref, useState: initial => typeof initial === 'boolean' ? [false, () => {}] :
      [view, update => { view = update(view); }]};
  let available = false, networkStatus, usbPresent = false, mount;
  react.useEffect = effect => { mount = effect; };
  const render = makeDesktopDevicePage(react, {
    binding: async () => ({phase: 'bound'}),
    query: async () => ({instanceId: 'owner', update: {queryOnly: true, batteryAvailable: available,
      sameUsbTarget: null, networkStatus, usbPresent}}),
    async battery(body, signal) {
      calls.push({body, signal});
      if (body.operation === 'sample') return batteryReady.promise;
      return {status: 'cancelled'};
    },
  });
  assert.equal(calls.length, 0);
  render();
  cleanup = mount();
  await Promise.resolve();
  await Promise.resolve();
  await runTimer(650);
  assert.equal(calls.length, 0);
  available = true;
  await runTimer(650);
  assert.equal(calls.length, 0);
  usbPresent = true;
  await runTimer(650);
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.requestId, /^[a-f0-9]{32}$/);
  await runTimer(650);
  assert.equal(calls.length, 1);
  networkStatus = {device: {version: '0.1.29', slot: 'ota_0'}, battery: null, sensors: null};
  await runTimer(650);
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(calls[1].body, {...calls[0].body, operation: 'cancel'});
  batteryReady.resolve({status: 'ok', present: true, percent: 99});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(view.battery, null);
  assert.ok(![...callbacks.values()].some(timer => timer.delay === 5000));
  batteryReady = Promise.withResolvers();
  networkStatus = undefined;
  await runTimer(650);
  assert.equal(calls.length, 3);
  batteryReady.resolve({status: 'ok', present: true, percent: 0});
  await Promise.resolve();
  await Promise.resolve();
  batteryReady = Promise.withResolvers();
  void runTimer(5000);
  assert.equal(calls.length, 4);
  cleanup();
  assert.equal(calls[3].signal.aborted, true);
  assert.deepEqual(calls[4].body, {...calls[3].body, operation: 'cancel'});
  batteryReady.resolve({status: 'disconnected'});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(callbacks.size, 0);
  assert.equal(view.battery.status, 'ok');
});
