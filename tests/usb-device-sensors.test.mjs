import assert from 'node:assert/strict';
import test from 'node:test';
import {readDesktopBattery} from '../packages/runtime/usb-battery-sampler.mjs';
import {sensorReply} from '../packages/runtime/usb-device-sensors.mjs';
import {desktopDeviceCard} from '../packages/ui/device-settings-page.mjs';

const motion = 'status=ok touch=up x=465 y=0 imu=ok ax=8 ay=-14 az=1001 gx=15 gy=-84 gz=7';
const expected = {status: 'ok', touch: {state: 'up', last: [465, 0]},
  motion: {accelerationMg: [8, -14, 1001], rotationMdps: [15, -84, 7]}};
const battery = 'status=ok present=1 usb_power=1 percent=60 mv=3984 flow=charging phase=cc';

test('SENSORS1 validates target ID, units, coordinates and independent IMU failure', () => {
  const id = '4a01c0de', parse = payload => sensorReply(`id=${id} ${payload}`, id);
  assert.deepEqual(parse(motion), expected);
  assert.deepEqual(parse('status=ok touch=unknown x=na y=na imu=unavailable'),
    {status: 'ok', touch: {state: 'unknown', last: null}, motion: null});
  for (const bad of [motion.replace('x=465', 'x=466'), motion.replace('x=465', 'x=na'),
    motion.replace('gz=7', 'gz=256001'), motion.replace('ax=8', 'ax=4001'), motion + ' overrun']) assert.equal(parse(bad), undefined);
  assert.equal(sensorReply(`id=4a01c0dd ${motion}`, id), undefined);
});

async function read(deviceStatus, ...parts) {
  const signal = new AbortController().signal;
  let pending = '', id, opens = 0, closes = 0;
  const tty = {
    async write(data, offset, length) {
      const bytesWritten = Math.min(4, length);
      pending += data.toString('ascii', offset, offset + bytesWritten);
      if (pending.endsWith('\n') && pending.includes('BATTERY1')) {
        const commands = deviceStatus ? pending.replace(/^STATUS2\n/, '') : pending;
        if (deviceStatus) assert.ok(pending.startsWith('STATUS2\n'));
        id = /^SENSORS1 ([0-9a-f]{8})\nBATTERY1 \1\n$/.exec(commands)?.[1];
        assert.ok(id);
      }
      return {bytesWritten};
    },
    async read(target) {
      if (deviceStatus && !id) throw Object.assign(new Error(), {code: 'EAGAIN'});
      assert.ok(id);
      if (!parts.length) throw Object.assign(new Error(), {code: 'EAGAIN'});
      return {bytesRead: target.write(parts.shift().replaceAll('{id}', id), 'ascii')};
    },
    async close() { closes++; },
  };
  const response = await readDesktopBattery({identity: 'same', identifyUsb: async () => 'same',
    openTty: async () => { opens++; return tty; }, sensors: true, deviceStatus}, signal);
  assert.equal(opens, 1);
  assert.equal(closes, 1);
  return response;
}

test('samples legacy battery and delayed sensors in the same USB session', async () => {
  const result = await read(false, `@VP8_BATTERY1 id={id} ${battery}\n@VP8_SENSORS1 id=00112233 ${motion}\n`,
    '@VP8_SENSORS1 id={id} status=ok touch=up x=465 ', `y=0 imu=ok ${motion.split('imu=ok ')[1]}\n`);
  assert.equal(result.percent, 60);
  assert.deepEqual(result.sensors, expected);
  const legacy = await read(false, `@VP8_BATTERY1 id={id} ${battery}\n`);
  assert.equal(legacy.percent, 60);
  assert.deepEqual(legacy.sensors, {status: 'no_reply'});
  const onlySensors = await read(false, `@VP8_SENSORS1 id={id} ${motion}\n`, '@VP8_BATTERY1 id={id} status=unavailable\n');
  assert.equal(onlySensors.status, 'unavailable');
  assert.deepEqual(onlySensors.sensors, expected);
});

test('first USB fallback sample takes STATUS2, battery and sensors on the same verified serial handle', async () => {
  const result = await read(true, '@VP8_OTA STATUS busy=0 selected=0 slot=ota_0 version=0.1.29\n',
    `@VP8_BATTERY1 id={id} ${battery}\n@VP8_SENSORS1 id={id} ${motion}\n`);
  assert.deepEqual(result.device, {version: '0.1.29', slot: 'ota_0', selected: false, busy: false});
  assert.equal(result.percent, 60);
  assert.deepEqual(result.sensors, expected);
});

test('device card hides conflicted or expired readings and distinguishes touch from IMU', () => {
  const card = (sameUsbTarget, clock) => desktopDeviceCard({clock,
    query: {instanceId: 'owner', update: {batteryAvailable: true, sameUsbTarget}},
    battery: {instanceId: 'owner', sensors: {status: 'ok', sample: {...expected, at: 0}}}});
  assert.deepEqual(card(true, 1).sensorReading.motion, expected.motion);
  assert.equal(card(null, 1).batteryIndependent, true);
  assert.equal(card(false, 1).sensorReading, null);
  assert.equal(card(true, 8000).sensorStale, true);
  assert.equal(card(true, 15000).sensorReading, null);
});
