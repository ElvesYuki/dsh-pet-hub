import assert from 'node:assert/strict';
import {once} from 'node:events';
import {connect, createServer} from 'node:net';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {createDesktopStatusSources} from '../packages/runtime/device-status-sources.mjs';
import {createDeviceTelemetry} from '../packages/runtime/device-telemetry.mjs';
import {desktopDeviceCard} from '../packages/ui/device-settings-page.mjs';
import {renderDesktopDevice} from '../packages/ui/device-settings-view.mjs';

const identity = 'fixture';
const device = {version: '0.1.29', slot: 'ota_0'};
const status = {schema: 1, ...device};

test('battery icon shows USB inside the battery and marks only fresh readings below 20%', () => {
  const h = (tag, props, ...children) => ({tag, ...props, children});
  const find = (node, className) => node?.className === className ? node :
    node?.children?.map(child => find(child, className)).find(Boolean);
  const view = (percent, usbPower, {stale = false, present = true, phase = 'idle'} = {}) => renderDesktopDevice(h, {
    card: {source: 'tcp', batteryAvailable: true, batteryStale: stale, batteryStatus: 'ok',
      batteryReading: {present, percent, usbPower, flow: usbPower && phase !== 'full' ? 'charging' : 'standby', phase}},
  });
  for (const percent of [0, 19, 20, 100]) {
    for (const usb of [true, false]) {
      const tree = view(percent, usb, {phase: percent === 100 ? 'full' : 'cc'});
      const value = find(tree, 'pet-device-battery-value');
      const icon = find(value, 'pet-device-battery-icon');
      assert.equal(value['data-level'], percent < 20 ? 'low' : 'normal');
      assert.ok(value.children.includes(`${percent}%`));
      assert.equal(Boolean(find(icon, 'pet-device-battery-bolt')), usb);
      assert.equal(find(icon, 'pet-device-battery-fill')?.style.width, percent > 0 ? `${percent}%` : undefined);
      assert.match(JSON.stringify(tree), usb ? /USB 供电/ : /电池供电/);
      if (usb) assert.match(JSON.stringify(tree), percent === 100 ? /已充满/ : /充电中/);
    }
  }
  const stale = view(19, true, {stale: true});
  assert.equal(find(stale, 'pet-device-battery-value')['data-level'], 'muted');
  assert.equal(find(stale, 'pet-device-battery-bolt'), undefined);
  assert.match(JSON.stringify(stale), /上次读取/);
  const unknown = view(null, true);
  assert.equal(find(unknown, 'pet-device-battery-value')['data-level'], 'muted');
  assert.ok(find(unknown, 'pet-device-battery-bolt'));
  assert.equal(find(unknown, 'pet-device-battery-fill'), undefined);
  assert.equal(find(view(null, false, {present: false}), 'pet-device-battery-icon'), undefined);
});

function fakeClock() {
  let time = 0;
  const timers = new Map();
  return {
    now: () => time,
    schedule(fn, delay) {
      const id = Symbol();
      timers.set(id, {fn, due: time + delay});
      return id;
    },
    unschedule: id => timers.delete(id),
    to(end) {
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        const [id, {fn, due}] = next;
        time = due;
        timers.delete(id);
        fn();
      }
      time = end;
    },
  };
}

test('status cadence, freshness, missed probes, replay and connection replacement are independent of USB', () => {
  const clock = fakeClock();
  let closes = 0;
  const probes = [];
  let wall = 1_795_500_000_000;
  const owner = createDeviceTelemetry({usbIdentity: identity, ...clock, wallNow: () => wall});
  const attach = (usbIdentity = identity) => owner.attach({usbIdentity,
    probe: n => probes.push([clock.now(), n]), close: () => closes++});
  const first = attach();
  assert.throws(() => attach('other'), {code: 'device_desktop_telemetry_target'});
  assert.equal(owner.snapshot(), null);
  assert.equal(first.receive(1, {...status, schema: 2}), false);
  assert.equal(first.receive(1, {...status, sensors: {touch: {state: 'up', last: [466, 0]}}}), false);
  clock.to(40);
  assert.equal(first.receive(1, {...status, lastHeartbeatAt: wall + 100, privateAddress: 'test-only',
    battery: {present: false, usbPower: true, percent: null, mv: null, flow: null, phase: null, secret: 'test-only'}}), true);
  assert.deepEqual(owner.snapshot(), {device, sensors: null, lastHeartbeatAt: wall,
    battery: {present: false, usbPower: true, percent: null, mv: null, flow: null, phase: null}});
  const firstHeartbeat = wall;
  wall += 90_000; // Wall-clock changes do not advance the heartbeat or the freshness deadline.
  clock.to(6000);
  assert.deepEqual(probes, [[0, 1], [3000, 2], [6000, 3]]);
  assert.equal(first.receive(1, status), false);
  assert.equal(first.receive(2, status), false);
  assert.equal(owner.snapshot().lastHeartbeatAt, firstHeartbeat);
  clock.to(6040);
  assert.equal(owner.snapshot(), null);
  clock.to(9040);
  assert.equal(first.receive(4, status), false);
  assert.equal(closes, 1);
  assert.deepEqual(probes[3], [9000, 4]);
  const second = attach();
  assert.equal(second.receive(1, status), true);
  const third = attach();
  assert.equal(closes, 2);
  second.disconnect();
  assert.equal(second.receive(1, status), false);
  assert.equal(owner.snapshot(), null);
  wall += 3000;
  assert.equal(third.receive(1, status), true);
  assert.equal(owner.snapshot().lastHeartbeatAt, wall);
  third.disconnect(); // Same boundary used for credential revocation.
  assert.equal(owner.snapshot(), null);
  owner.close();
  assert.equal(closes, 3);
  assert.throws(() => attach(), {code: 'device_desktop_telemetry_target'});
});

test('USB fallback checks presence, reads device once per attachment and fences late results after TCP', async () => {
  const clock = fakeClock(), lifetime = new AbortController();
  let usb, running, block;
  const reads = [];
  const owner = createDesktopStatusSources({usbIdentity: identity, lifetime: lifetime.signal, clock,
    usbAttachment: () => usb, usbStatus: () => ({sameUsbTarget: true, usbBusy: false}),
    async read(signal, deviceStatus) {
      reads.push(deviceStatus);
      if (block) {
        running = signal;
        await block.promise;
      }
      return {status: 'ok', ...(deviceStatus ? {device} : {})};
    }});
  const sample = id => owner.battery.sample(id, lifetime.signal);
  assert.deepEqual(owner.snapshot(), {usbPresent: false, usbDevice: null});
  assert.deepEqual(await sample('absent'), {status: 'disconnected'});
  assert.deepEqual(reads, []);
  usb = 'first-plug';
  assert.deepEqual(await sample('plugged'), {status: 'ok'});
  assert.deepEqual(owner.snapshot().usbDevice, device);
  clock.to(5000);
  await sample('poll');
  assert.deepEqual(reads, [true, false]);
  clock.to(10000);
  usb = undefined;
  assert.equal(owner.snapshot().usbDevice, null);
  usb = 'new-plug';
  block = Promise.withResolvers();
  const pending = sample('new-plug');
  await Promise.resolve();
  const remote = owner.attach({usbIdentity: identity, probe() {}, close() {}});
  assert.equal(remote.receive(1, status), true);
  assert.equal(running.aborted, true);
  assert.deepEqual(await sample('with-network'), {status: 'network_active'});
  assert.deepEqual(reads, [true, false, true]);
  block.resolve();
  assert.deepEqual(await pending, {status: 'network_active'});
  block = null;
  const query = {instanceId: 'owner', update: {batteryAvailable: true, sameUsbTarget: true, ...owner.snapshot()}};
  const card = desktopDeviceCard({query, battery: {instanceId: 'owner', status: 'ok', sample: {at: 10000, percent: 20}}, clock: 10000});
  assert.equal(card.source, 'tcp');
  assert.equal(card.batteryReading, null);
  assert.equal(card.sensorStatus, 'not_reported');
  clock.to(16000);
  assert.equal(owner.snapshot().usbDevice, null);
  assert.deepEqual(await sample('fallback'), {status: 'ok'});
  assert.deepEqual(reads, [true, false, true, true]);
  owner.close();
  lifetime.abort();
  await owner.battery.drain();
});

test('an isolated loopback TCP peer feeds the adapter and socket closure clears status', {timeout: 5000}, async t => {
  const server = createServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen({host: '127.0.0.1', port: 0});
  await once(server, 'listening');
  const connected = once(server, 'connection');
  const client = connect({host: '127.0.0.1', port: server.address().port});
  const [peer] = await connected;
  t.after(() => { peer.destroy(); client.destroy(); });
  const lines = createInterface({input: peer});
  lines.on('line', line => peer.write(JSON.stringify({sequence: Number(line), value: status}) + '\n'));
  const owner = createDeviceTelemetry({usbIdentity: identity});
  t.after(() => owner.close());
  // Test-only transport and preselected identity. No ESP wire format or authentication claim.
  const session = owner.attach({usbIdentity: identity, probe: sequence => client.write(sequence + '\n'), close: () => client.destroy()});
  const reply = createInterface({input: client});
  const closed = once(client, 'close');
  client.on('close', session.disconnect);
  const [line] = await once(reply, 'line');
  const {sequence, value} = JSON.parse(line);
  assert.equal(session.receive(sequence, value), true);
  assert.deepEqual(owner.snapshot().device, device);
  peer.end();
  await closed;
  assert.equal(owner.snapshot(), null);
});
