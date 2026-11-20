import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {readDesktopBattery} from '../packages/runtime/usb-battery-sampler.mjs';
import {exchangeDesktopNetwork} from '../packages/runtime/usb-wifi-settings.mjs';
import {exchangeDesktopWeather} from '../packages/runtime/usb-weather-settings.mjs';
import {decodeStatusV2} from '../packages/runtime/device-status-wire.mjs';
import {decodeVpl1Status, openVpl1, sealVpl1, VPL1, vpl1Keys, vpl1Tag, vpl1Transcript} from '../packages/runtime/device-tcp-wire.mjs';
import {desktopDeviceCard} from '../packages/ui/device-settings-page.mjs';
import {minimalStatusV2, usbStatus3Reply} from './fixtures/device-status-fixture.mjs';

const root = process.env.ROUND_PET_VPL1_PEER_ROOT, binary = process.env.ROUND_PET_VPL1_V2_PEER_BIN;
const vectors = root && JSON.parse(readFileSync(join(root, 'docs/protocol/vectors/round-pet-vp8-status-v2.json')));
const hex = key => Buffer.from(vectors[key], 'hex');

test('Status v2 shared vectors agree for USB, VPL1 and actual firmware C++', {skip: !vectors}, () => {
  for (const name of ['full', 'minimal']) {
    const status = decodeStatusV2(hex('status_' + name));
    const usb = hex('usb_' + name + '_reply').toString();
    assert.equal(hex('usb_request').toString(), 'STATUS3 4a01c0de\n');
    assert.equal(usb.replace('\n', '\r\n'), usbStatus3Reply('STATUS3 4a01c0de', hex('status_' + name)));
    assert.deepEqual(decodeVpl1Status(hex('status_' + name + '_tcp'), 2).value, {schema: 1, ...status});
    assert.deepEqual([status.busy, status.selected], name === 'full' ? [true, false] : [false, true]);
    assert.equal(status.battery?.percent, name === 'full' ? 83 : undefined);
    assert.equal(status.slot, 'ota_1');
  }
  assert.throws(() => decodeStatusV2(hex('status_bad_maintenance')), {code: 'vpl1_status'});
  for (let size = 0; size < hex('status_full').length; size++)
    assert.throws(() => decodeStatusV2(hex('status_full').subarray(0, size)), {code: 'vpl1_status'});
  const transcript = vpl1Transcript(hex('device_hello_body'), hex('hub_auth_prefix'));
  assert.deepEqual(transcript, hex('transcript_sha256'));
  const keys = vpl1Keys(hex('ecdh_test_secret'), transcript);
  assert.deepEqual(keys.fromDevice, hex('k_device_to_hub'));
  assert.deepEqual(keys.toDevice, hex('k_hub_to_device'));
  const serial = Buffer.of(1, 0, 0, 0);
  assert.deepEqual(vpl1Tag(keys.fromDevice, 'device-finish', transcript, serial), hex('device_finish_session1'));
  assert.deepEqual(vpl1Tag(keys.toDevice, 'hub-finish', transcript, serial), hex('hub_finish_session1'));
  const encoded = sealVpl1(VPL1.status, 3, hex('status_full_tcp'), hex('record_test_key'));
  assert.deepEqual(encoded, hex('record_status_counter3'));
  assert.deepEqual(openVpl1(encoded, 3, hex('record_test_key')), hex('status_full_tcp'));
  if (binary) execFileSync(binary, ['vectors', ...['status_full', 'status_minimal', 'record_status_counter3', 'device_hello_body',
    'hub_auth_prefix', 'transcript_sha256', 'ecdh_test_secret', 'k_device_to_hub', 'k_hub_to_device', 'usb_request',
    'usb_full_reply', 'usb_minimal_reply', 'status_bad_maintenance'].map(key => vectors[key])], {timeout: 5000});
});

test('USB fallback sends one STATUS3, ignores stale ID and noncanonical Base64, and projects maintenance', async () => {
  const commands = [];
  let incoming = Buffer.alloc(0), closed = 0;
  const signal = new AbortController().signal;
  const status = vectors ? hex('status_minimal') : minimalStatusV2('0.1.32-l-battery-usb-pair-test', 1, 2);
  const result = await readDesktopBattery({identity: 'same', identifyUsb: () => 'same', sensors: true, statusV2: true,
    openTty: () => ({
      read(view) {
        if (!incoming.length) throw Object.assign(Error(), {code: 'EAGAIN'});
        const part = incoming.subarray(0, 13);
        part.copy(view);
        incoming = incoming.subarray(part.length);
        return {bytesRead: part.length};
      },
      write(data) {
        const query = data.toString('ascii');
        commands.push(query);
        const valid = usbStatus3Reply(query, status), other = query.includes('00000000') ? 'ffffffff' : '00000000';
        const bogus = usbStatus3Reply(query, minimalStatusV2('1.0.0', 0, 1));
        incoming = Buffer.from(bogus.replace(/id=[a-f0-9]{8}/, 'id=' + other) +
          bogus.replace('\r\n', '=\r\n') + valid);
        return {bytesWritten: data.length};
      },
      close() { closed++; },
    })}, signal);
  assert.equal(closed, 1);
  assert.equal(commands.length, 1);
  assert.equal(result.status, 'not_reported');
  assert.equal(result.sensors.status, 'not_reported');
  assert.deepEqual(result.device, {version: '0.1.32-l-battery-usb-pair-test', slot: 'ota_1', busy: false, selected: true});
  const card = desktopDeviceCard({query: {instanceId: 'test', update: {phase: 'ready', sameUsbTarget: true,
    usbPresent: true, usbDevice: result.device, batteryAvailable: true}}});
  assert.equal(card.source, 'usb');
  assert.equal(card.queryStatus, '已选择启动槽，等待重启。');
  assert.equal(card.busy, true);
});

test('Wi-Fi and weather fallback version checks use STATUS3 only in the v2 candidate', async () => {
  for (const [exchange, prefix] of [[exchangeDesktopNetwork, '@VP8_DESKNET2 '],
    [exchangeDesktopWeather, '@VP8_DESKWEATHER1 ']]) {
    const commands = [];
    const session = {exchangeDesktop(data, options) {
      const command = data.toString();
      commands.push(command);
      if (options.prefix === prefix) return null;
      assert.equal(options.prefix, '@VP8_STATUS3 ');
      return options.match(usbStatus3Reply(command, minimalStatusV2('0.1.32', 0, 1)));
    }};
    assert.deepEqual(await exchange(session, {operation: 'info'}, new AbortController().signal, assert.fail, {statusV2: true}),
      {status: 'unsupported', version: '0.1.32'});
    assert.equal(commands.length, 2);
    assert.match(commands[1], /^STATUS3 [0-9a-f]{8}\n$/);
  }
});
