import assert from 'node:assert/strict';

export function minimalStatusV2(version, slot, maintenance = 0) {
  return Buffer.concat([Buffer.from([2, slot, 0, version.length, maintenance]), Buffer.from(version)]);
}

export function usbStatus3Reply(query, payload) {
  const id = /^STATUS3 ([0-9a-f]{8})\n?$/.exec(query)?.[1];
  assert.ok(id, 'expected only STATUS3');
  return '@VP8_STATUS3 id=' + id + ' data=' + payload.toString('base64') + '\r\n';
}
