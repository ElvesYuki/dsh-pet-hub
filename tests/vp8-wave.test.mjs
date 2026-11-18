import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {createVp8ActionOwner, prepareVp8ActionUpdate} from '../packages/runtime/vp8-action-update.mjs';

const identity = '1/001122334455';
const usb = '@VP8_DAILY REQUEST source=usb at_us=10';
const first = '@VP8_FIRST 4-400 local_us=20 boot_to_dma_us=30';
const end = '@VP8_DAILY END clip=4-400 eof=1';
const shown = '@VP8_RESULT 4-400 frames=241 span_us=10970000 late=0 dropped=0';
const idle = '@VP8_FIRST 0-400 local_us=20 boot_to_dma_us=11000000';
const receipts = [usb, first, end, shown, idle];

function setup({enabled = true, lines = receipts, peer = identity, version = '0.1.4', busy = 0, stale = []} = {}) {
  let bytes = Buffer.from(stale.join('\n') + (stale.length ? '\n' : '')), closed = 0;
  const commands = [];
  const owner = createVp8ActionOwner(prepareVp8ActionUpdate({
    port: '/dev/ttys00', helper: '/fixture/tty', protocol: 'media2', queryOnly: true, usbIdentity: identity,
    operatorToken: 'ac'.repeat(32), waveTest: enabled,
  }, {
    identifyUsb: () => peer,
    waveTimeoutMs: 120,
    openTty: async () => ({
      async read(buffer) {
        if (!bytes.length) throw Object.assign(Error(), {code: 'EAGAIN'});
        const part = bytes.subarray(0, 11);
        part.copy(buffer);
        bytes = bytes.subarray(part.length);
        return {bytesRead: part.length};
      },
      async write(data) {
        const command = data.toString('ascii');
        commands.push(command);
        const rows = command === 'STATUS2\n' ? [`@VP8_OTA STATUS busy=${busy} selected=0 slot=ota_0 version=${version}`] : lines;
        bytes = Buffer.from(rows.join('\r\n') + (rows.length ? '\r\n' : ''));
        return {bytesWritten: data.length};
      },
      async close() { closed++; },
    }),
  }), 'fixture');
  const send = (operation = 'wave', extra = {}) =>
    owner.command({operation, instanceId: 'fixture', revision: owner.snapshot().revision, ...extra});
  async function done() {
    for (let n = 0; n < 85; n++) {
      const wave = owner.snapshot().wave;
      if (['complete', 'unknown', 'rejected'].includes(wave.phase)) return wave;
      await delay(15);
    }
    assert.fail('wave still active');
  }
  return {owner, send, done, commands, closed: () => closed};
}

test('Desktop wave confirms 241 displayed frames and the next idle DMA, with one fixed command', async t => {
  const fixture = setup();
  t.after(() => fixture.owner.close());
  assert.throws(() => fixture.send('wave', {action: 9}), {status: 409});
  assert.throws(() => fixture.send('wave', {instanceId: 'wrong'}), {status: 409});
  assert.throws(() => fixture.send('install'), {status: 409});
  fixture.send();
  assert.throws(() => fixture.send(), {status: 409});
  assert.throws(() => fixture.send('query'), {status: 409});
  assert.deepEqual(await fixture.done(), {available: false, phase: 'complete', sent: true, frames: 241, returnedIdle: true, error: null});
  assert.deepEqual(fixture.commands, ['STATUS2\n', 'WAVE\n']);
  assert.equal(fixture.closed(), 1);
  assert.throws(() => fixture.send(), {status: 409});
});

test('Desktop wave denies default mode, wrong USB, and busy or old firmware before WAVE', async t => {
  const disabled = setup({enabled: false});
  assert.throws(() => disabled.send(), {status: 409});
  await disabled.owner.close();
  for (const options of [{peer: '2/001122334455'}, {version: '0.1.3'}, {busy: 1}]) {
    const fixture = setup(options);
    t.after(() => fixture.owner.close());
    fixture.send();
    assert.equal((await fixture.done()).phase, 'rejected');
    assert.deepEqual(fixture.commands, options.peer ? [] : ['STATUS2\n']);
  }
});

test('Desktop wave refuses stale, touch-only, short and missing idle receipts without replay', async t => {
  for (const options of [
    {stale: receipts, lines: []}, {lines: [usb.replace('=usb', '=touch'), first, end, shown, idle]},
    {lines: [usb, first, end, shown.replace('241', '240'), idle]}, {lines: [usb, first, end, shown]},
  ]) {
    const fixture = setup(options);
    t.after(() => fixture.owner.close());
    fixture.send();
    const result = await fixture.done();
    assert.equal(result.phase, 'unknown');
    assert.equal(result.returnedIdle, false);
    assert.deepEqual(fixture.commands, ['STATUS2\n', 'WAVE\n']);
    assert.equal(fixture.closed(), 1);
  }
});
