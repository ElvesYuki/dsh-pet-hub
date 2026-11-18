import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {crc32} from 'node:zlib';
import {decodePbp1Frame, encodePbp1Frame, pbp1Header, PBP1_FRAME_MAX} from '../packages/core/native400-pbp1-wire.mjs';
import {createNative400UsbPairing} from '../packages/runtime/index.mjs';
import {pbp1Fingerprint} from '../packages/runtime/native400-usb-pairing.mjs';
import {mockPbp1Usb} from './fixtures/native400-pbp1.mjs';
import {createPbp1ConfirmationPrompt} from '../scripts/native400-pbp1-pair.mjs';

const vectors = JSON.parse(await readFile(new URL('../docs/protocol/vectors/native400-pbp1-draft-v1.json', import.meta.url)));
const {boot, device, controller: hub, binding, epoch, proposal, fingerprint, syntheticPsk} = vectors.inputs;
const identity = {device, hub, binding, epoch};
const options = (usb, changes = {}) => ({enabled: true, transport: usb.transport, identity, pollMs: 5,
  confirmFingerprint: () => usb.screen(), ...changes});
const frame = kind => Buffer.from(vectors.frames[kind], 'hex');

test('PBP1 independent vectors cover exact header, all messages and HMAC scope with u64 values', () => {
  for (const name of Object.keys(vectors.frames)) {
    const packet = frame(name);
    assert.ok(packet.length <= PBP1_FRAME_MAX);
    assert.equal(pbp1Header(packet.subarray(0, 16)).length, packet.length - 16);
    assert.deepEqual(Buffer.from(encodePbp1Frame(decodePbp1Frame(packet))), packet, name);
  }
  assert.deepEqual(decodePbp1Frame(frame('offer')), {kind: 'offer', boot, device, controller: hub, binding, epoch,
    psk: Buffer.from(syntheticPsk, 'hex')});
  assert.deepEqual(decodePbp1Frame(frame('pending')), {kind: 'state', boot, device, proposal, fingerprint,
    phase: 'pending', event: 'ok'});
  assert.equal(pbp1Fingerprint(frame('offer'), proposal), fingerprint);
  assert.notEqual(pbp1Fingerprint(frame('offer'), proposal + 1), fingerprint);
  assert.notEqual(pbp1Fingerprint(encodePbp1Frame({...decodePbp1Frame(frame('offer')), boot: '9'}), proposal), fingerprint);
});

test('PBP1 rejects invalid bounds, version, CRC, reserved bytes and unknown enum values', () => {
  const reject = packet => assert.throws(() => decodePbp1Frame(packet), /pbp_invalid_frame/);
  for (const [offset, value] of [[0, 0], [4, 2], [5, 127], [7, 1], [8, 99], [12, 0], [16, 0]]) {
    const packet = frame('pending');
    assert.notEqual(packet[offset], value);
    packet[offset] = value;
    reject(packet);
  }
  for (const [offset, value] of [[44, 4], [45, 3], [46, 1], [47, 1]]) {
    const packet = frame('pending');
    packet[16 + offset] = value;
    packet.writeUInt32LE(crc32(packet.subarray(16), crc32(packet.subarray(0, 12))), 12);
    reject(packet);
  }
  reject(frame('pending').subarray(0, 63));
  reject(Buffer.concat([frame('pending'), Buffer.alloc(1)]));
  const oversized = frame('offer').subarray(0, 16);
  oversized.writeUInt32LE(0xffffffff, 8);
  assert.throws(() => pbp1Header(oversized), /pbp_invalid_frame/);
});

test('USB pairing is opt-in and publishes a boot-pinned lease only after host confirmation and fresh device press', async t => {
  const usb = mockPbp1Usb({boot, device});
  const shown = Promise.withResolvers(), answer = Promise.withResolvers();
  assert.throws(() => createNative400UsbPairing(options(usb, {enabled: false})), /pbp_disabled/);
  const owner = createNative400UsbPairing(options(usb, {confirmFingerprint(view) { shown.resolve(view); return answer.promise; }}));
  t.after(() => owner.close());
  assert.throws(() => createNative400UsbPairing(options(usb)), /pbp_transport/);
  const outcome = owner.start();
  let active = false;
  void outcome.then(() => { active = true; }, () => {});
  const prompt = await shown.promise;
  assert.deepEqual(Object.keys(prompt).sort(), ['boot', 'device', 'fingerprint', 'proposal']);
  assert.ok(Object.isFrozen(prompt));
  assert.equal(prompt.fingerprint, usb.screen());
  assert.deepEqual(usb.history, ['info', 'offer']);
  assert.ok(usb.offerCleared);
  assert.equal(usb.longPress(), false);
  answer.resolve(usb.screen().toUpperCase());
  await usb.confirmed;
  assert.equal(active, false);
  assert.equal(usb.longPress(), true);
  const provider = await outcome;
  assert.deepEqual(provider.identity, identity);
  assert.equal(provider.boot, boot);
  assert.equal(usb.closeCount, 1);
  const {key, revoked} = provider.acquire(identity);
  assert.equal(key.symmetricKeySize, 32);
  assert.equal(key.export().toString('hex'), usb.activeSecret());
  assert.throws(() => provider.acquire({...identity, epoch: '1'}), /pbp_lease/);
  await owner.close();
  assert.equal(revoked.aborted, true);
  assert.throws(() => provider.acquire(identity), /pbp_lease/);
  assert.throws(() => owner.start(), /pbp_used/);
  assert.equal(usb.closeCount, 1);
});

test('lost OFFER, CONFIRM and Active replies are reconciled by INFO without repeating mutations', async t => {
  let activeReplies = 0;
  const usb = mockPbp1Usb({boot, device, intercept(kind, reply) {
    if (kind === 'offer' || kind === 'confirm' || (reply.phase === 'active' && ++activeReplies === 1)) return null;
  }});
  const owner = createNative400UsbPairing(options(usb));
  t.after(() => owner.close());
  const result = owner.start();
  await usb.confirmed;
  assert.ok(usb.longPress());
  assert.equal((await result).boot, boot);
  assert.equal(activeReplies, 2);
  assert.deepEqual(usb.history.filter(kind => kind !== 'info'), ['offer', 'confirm']);
  assert.ok(usb.history.filter(kind => kind === 'info').length >= 4);
});

test('USB decline sends scoped CANCEL and never publishes a lease', async t => {
  for (const answer of [null, true, '00'.repeat(16)]) {
    const usb = mockPbp1Usb({boot, device});
    const owner = createNative400UsbPairing(options(usb, {confirmFingerprint: () => answer}));
    t.after(() => owner.close());
    await assert.rejects(owner.start(), /pbp_confirmation_denied/);
    assert.deepEqual(usb.history, ['info', 'offer', 'cancel']);
    assert.ok(usb.offerCleared);
    assert.equal(usb.closeCount, 1);
  }
});

test('explicit BOOT mode still rejects an invalid Pending HMAC and device timeout without a press', async t => {
  for (const badFingerprint of [true, false]) {
    let prompts = 0;
    const usb = mockPbp1Usb({boot, device, intercept(kind, reply) {
      if (badFingerprint && kind === 'offer') return {...reply, fingerprint: '00'.repeat(16)};
      if (kind === 'info' && reply.phase === 'host-confirmed') {
        return {...reply, phase: 'empty', proposal: 0, fingerprint: '00'.repeat(16), event: 'timed-out'};
      }
    }});
    const owner = createNative400UsbPairing(options(usb, {confirmFingerprint: createPbp1ConfirmationPrompt({button: true,
      terminal: {question: () => assert.fail('unexpected keyboard prompt')}, print: () => { prompts++; }})}));
    t.after(() => owner.close());
    await assert.rejects(owner.start(), badFingerprint ? /pbp_fingerprint/ : /pbp_timeout/);
    assert.equal(prompts, Number(!badFingerprint));
    assert.deepEqual(usb.history.filter(kind => kind !== 'info'), badFingerprint ? ['offer'] : ['offer', 'confirm']);
    assert.equal(usb.closeCount, 1);
  }
});

test('USB pairing rejects unrelated device, existing Active and unverified Pending before prompting', async t => {
  for (const variant of ['other device', 'active', 'fingerprint', 'premature active']) {
    const usb = mockPbp1Usb({boot, device: variant === 'other device' ? 'ff'.repeat(16) : device,
      initial: variant === 'active' ? {phase: 'active', proposal, fingerprint} : {},
      intercept(kind, reply) {
        if (kind === 'offer' && variant === 'fingerprint') return {...reply, fingerprint: '00'.repeat(16)};
        if (kind === 'offer' && variant === 'premature active') return {...reply, phase: 'active'};
      }});
    let prompts = 0;
    const owner = createNative400UsbPairing(options(usb, {confirmFingerprint: () => { prompts++; }}));
    t.after(() => owner.close());
    await assert.rejects(owner.start(), /pbp_(device|device_busy|fingerprint|pending_required)/);
    assert.equal(prompts, 0);
    assert.equal(usb.history.includes('confirm'), false);
    assert.equal(usb.history.includes('cancel'), false);
  }
});

test('USB refuses Active with different scope, terminal expiry and unconfirmed CONFIRM', async t => {
  for (const change of [{boot: '1'}, {proposal: 18}, {fingerprint: 'ff'.repeat(16)}, {event: 'timed-out'}, {event: 'rejected'}, {phase: 'pending'}]) {
    const usb = mockPbp1Usb({boot, device, intercept(kind, reply) {
      if (kind === 'confirm') return {...reply, phase: 'active', ...change};
    }});
    const owner = createNative400UsbPairing(options(usb));
    t.after(() => owner.close());
    await assert.rejects(owner.start(), /pbp_(device_changed|proposal_changed|timeout|rejected|confirmation_unconfirmed)/);
    assert.deepEqual(usb.history, ['info', 'offer', 'confirm']);
    assert.equal(usb.closeCount, 1);
  }
});

test('close and expiry ignore late prompts and wait for actual USB I/O exit', async t => {
  const usb = mockPbp1Usb({boot, device});
  const prompted = Promise.withResolvers(), answer = Promise.withResolvers();
  const pending = createNative400UsbPairing(options(usb, {confirmFingerprint(view) { prompted.resolve(view); return answer.promise; }}));
  const cancelled = assert.rejects(pending.start(), /pbp_closed/);
  const view = await prompted.promise;
  await pending.close();
  await cancelled;
  answer.resolve(view.fingerprint);
  assert.deepEqual(usb.history, ['info', 'offer']);

  const ended = Promise.withResolvers(), entered = Promise.withResolvers(), release = Promise.withResolvers();
  const stalled = createNative400UsbPairing({enabled: true, identity, timeoutMs: 40,
    transport: {exchange() { return ended.promise; }, async close() { entered.resolve(); await release.promise; ended.resolve(null); }},
    confirmFingerprint: () => assert.fail('not prompted')});
  t.after(() => { release.resolve(); return stalled.close(); });
  let settled = false;
  const timeout = assert.rejects(stalled.start(), /pbp_timeout/).then(() => { settled = true; });
  await entered.promise;
  await delay(0);
  assert.equal(settled, false);
  release.resolve();
  await timeout;
});
