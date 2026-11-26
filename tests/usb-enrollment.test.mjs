import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {mountEnrollmentSettings} from '../apps/dsh-plugin/enrollment-routes.mjs';
import {encodePbp1Frame, decodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {openDeviceBindingIndex} from '../packages/runtime/device-binding-index.mjs';
import {openDeviceLanPins} from '../packages/runtime/device-lan-pin.mjs';
import {createEnrollmentCoordinator} from '../packages/runtime/device-enrollment-owner.mjs';
import {rotateDeviceBinding} from '../packages/runtime/device-key-rotation.mjs';
import {createBootProof, decodeBootReply, encodeBootRequest} from '../packages/runtime/device-enrollment-wire.mjs';
import {makeEnrollmentSettings} from '../packages/ui/enrollment-settings.mjs';
import {compileBootPeer, firmwareHostTests, hasCryptoPeer} from './fixtures/device-enrollment-cpp.mjs';

const wire = {allowBinding: true, allowBootProof: true};
const device = Buffer.alloc(16, 0x11), boot = 9007199254740999n;
const packet = (kind, body) => encodePbp1Frame({kind, body}, wire);
const line = (kind, body) => '@VP8_PAIR1 ' + Buffer.from(packet(kind, body)).toString('base64') + '\n';
const raw = text => Buffer.from(text.slice(9).trimEnd(), 'base64');
const hash = data => createHash('sha256').update(data).digest();

function status({caps = 15, record, reference = 0, waiting = false} = {}) {
  const body = Buffer.alloc(reference ? 88 : 84);
  body[1] = waiting ? 1 : record ? 2 : 0;
  body[2] = caps;
  body.writeBigUInt64LE(boot, 4);
  device.copy(body, 12);
  if (record && !waiting) {
    body.writeBigUInt64LE(record.epoch, 28);
    record.ids.copy(body, 36);
    record.fingerprint.copy(body, 68, 0, 16);
  }
  if (reference) body.writeUInt32LE(reference, 84);
  return line(reference ? 'binding-enrolled' : 'binding-status', body);
}

function challenge(operation = 3) {
  const body = Buffer.alloc(40, 0x55);
  body.fill(0, 0, 8);
  body[1] = operation;
  body.writeUInt32LE(42, 4);
  return line('binding-nonce', body);
}

function makeOwner(t, {openSession, directory, usbEnrollment = true, lanUsbIdentity, lanPins} = {}) {
  const root = directory ?? mkdtempSync(join(tmpdir(), 'vp8-usb-enroll-'));
  if (!directory) t.after(() => rmSync(root, {recursive: true, force: true}));
  const store = openDeviceBindingIndex({directory: root, create: true});
  const pair = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const {x, y} = pair.publicKey.export({format: 'jwk'});
  const key = {ref: 'synthetic', publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'),
    Buffer.from(y, 'base64url')]), signTranscript: data => sign('sha256', data, {key: pair.privateKey, dsaEncoding: 'ieee-p1363'})};
  let owner, prepares = 0;
  function reopen() {
    owner = createEnrollmentCoordinator({store, usbEnrollment, openSession, poll: assert.fail, lanUsbIdentity, lanPins,
      networkAllowed: lanUsbIdentity ? () => true : undefined,
      keys: {prepare: () => { prepares++; return key; }, lookup: reference => reference === key.ref ? key : undefined}});
    return owner;
  }
  reopen();
  t.after(async () => { await owner.close(); store.close(); });
  return {reopen, get owner() { return owner; }, get prepares() { return prepares; }, store, key};
}

function input({instanceId, revision}, operation) { return {instanceId, revision, operation}; }

async function idle(owner) {
  for (let n = 0; n < 300; n++) {
    const view = owner.status();
    if (!view.busy) return view;
    await delay(5);
  }
  assert.fail('owner not released');
}

test('one-click wire requires a branded probe and single-use op3 reference', () => {
  const usb = decodeBootReply(status()), bootOnly = decodeBootReply(status({caps: 7}));
  const open = packet('binding-challenge', Buffer.from([3]));
  assert.throws(() => encodeBootRequest(open, usb), {code: 'device_boot_request'});
  assert.throws(() => encodeBootRequest(open, bootOnly, {operation: 3}), {code: 'device_usb_enrollment_unsupported'});
  assert.deepEqual(raw(encodeBootRequest(open, usb, {operation: 3})), Buffer.from(open));
  assert.throws(() => decodeBootReply(challenge(1), {operation: 3, probe: usb}), {code: 'device_boot_nonce'});
  const nonce = decodeBootReply(challenge(), {operation: 3, probe: usb});
  const body = Buffer.alloc(173);
  body.writeUInt32LE(nonce.reference + 1);
  assert.throws(() => encodeBootRequest(packet('binding-enroll', body), usb, {operation: 3, nonce}),
    {code: 'device_usb_enrollment_nonce'});
  body.writeUInt32LE(nonce.reference);
  assert.throws(() => encodeBootRequest(packet('binding-enroll', body), decodeBootReply(status()), {operation: 3, nonce}),
    {code: 'device_usb_enrollment_nonce'});
  assert.ok(encodeBootRequest(packet('binding-enroll', body), usb, {operation: 3, nonce}));
  assert.throws(() => encodeBootRequest(packet('binding-enroll', body), usb, {operation: 3, nonce}),
    {code: 'device_usb_enrollment_nonce'});
});

test('USB route is opt-in and a lower capability reports unsupported without writing or switching to BOOT', async t => {
  const def = makeOwner(t, {usbEnrollment: false, openSession: assert.fail});
  assert.throws(() => def.owner.command(input(def.owner.status(), 'enroll-usb')), {code: 'device_boot_wrong_phase'});
  const seen = [];
  const direct = makeOwner(t, {openSession: async () => ({close() {}, async exchange(text) {
    seen.push(raw(text)[5]);
    return status({caps: 7});
  }})});
  const registered = new Map();
  let release;
  mountEnrollmentSettings({effect: cb => { release = cb(); }, connection: {fetch: {register(route) {
    registered.set(route.path, route.fetch); return () => registered.delete(route.path);
  }}}}, {owner: direct.owner, usbEnrollment: true, authorize: () => true});
  t.after(() => release());
  const base = 'dsh-app://app/api/pet-hub-enrollment/';
  const request = (kind, body) => registered.get('/api/pet-hub-enrollment/' + kind)(new Request(base + kind,
    body ? {method: 'POST', body: JSON.stringify(body), headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {}));
  const view = await (await request('status')).json();
  assert.equal(view.usbEnrollment, true);
  assert.deepEqual(seen, []);
  assert.equal((await request('command', input(view, 'enroll'))).status, 400);
  assert.equal((await request('command', input(view, 'enroll-usb'))).status, 200);
  assert.equal((await idle(direct.owner)).issue, 'usb_unsupported');
  assert.deepEqual(seen, [6]);
  assert.equal(direct.prepares, 0);
  assert.equal(direct.store.read().record, null);
  const react = {useState: fallback => [typeof fallback === 'object' ? {...view, issue: 'usb_unsupported'} : fallback, () => {}],
    useRef: () => ({}), useEffect() {}, createElement: (tag, props, ...children) => ({tag, props, children})};
  const screen = JSON.stringify(makeEnrollmentSettings(react, {})());
  assert.match(screen, /不支持 USB 一键绑定/);
  assert.match(screen, /绑定设备/);
  assert.doesNotMatch(screen, /BOOT/);
});

test('bad USB echoes and incomplete proofs leave durable pending without retransmitting Type 8', async t => {
  for (const mode of ['op', 'waiting', 'ref', 'digest', 'unbound', 'lost-fence']) {
    await t.test(mode, async t => {
      const received = [];
      let record;
      const f = makeOwner(t, {openSession: async () => ({close() {}, async exchange(text) {
        const frame = raw(text), {body} = decodePbp1Frame(frame, wire);
        received.push(frame[5]);
        switch (frame[5]) {
          case 6: return status();
          case 7: return challenge(mode === 'op' ? 1 : 3);
          case 8:
            record = {ids: body.slice(4, 36), epoch: Buffer.from(body).readBigUInt64LE(36), fingerprint: hash(body.slice(44, 109))};
            return status({record, reference: mode === 'ref' ? 43 : 42, waiting: mode === 'waiting'});
          case 10: {
            assert.equal(f.owner.status().phase, 'confirming_usb');
            assert.equal(f.store.read().record.phase, 'pending');
            assert.equal(body[0], 1);
            if (mode === 'lost-fence') throw Error('offline fixture disconnect');
            const reply = Buffer.alloc(136);
            reply.set(body.slice(4, 28), 4);
            reply.set(body.slice(28, 64), 100);
            reply[2] = 1;
            if (mode !== 'unbound') {
              reply[1] = 2;
              reply.writeBigUInt64LE(record.epoch, 28);
              reply.set(record.ids, 36);
              reply.set(record.fingerprint, 68);
              reply[99] ^= 1;
            }
            return line('vp8-binding-proof-result', reply);
          }
          default: assert.fail('unexpected request');
        }
      }})});
      f.owner.command(input(f.owner.status(), 'enroll-usb'));
      const after = await idle(f.owner);
      assert.equal(after.phase, 'recovery_required');
      assert.equal(after.deviceChecked, false);
      assert.equal(f.store.read().record.phase, 'pending');
      assert.deepEqual(received, mode === 'op' ? [6, 7] : ['waiting', 'ref'].includes(mode) ? [6, 7, 8] : [6, 7, 8, 10]);
    });
  }
});

const vectors = process.env.ROUND_PET_USB_VECTORS;
test('firmware fixed USB vectors match independently encoded Node status, accepted and fence replies',
  {skip: !hasCryptoPeer || !vectors, timeout: 30000}, t => {
    const root = mkdtempSync(join(tmpdir(), 'vp8-usb-vectors-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const generator = compileBootPeer(root, join(firmwareHostTests, 'test_boot_pairing.cpp'),
      'usb-vectors');
    const actual = execFileSync(generator, ['--usb-vectors'], {encoding: 'utf8', timeout: 5000});
    assert.equal(actual, readFileSync(vectors, 'utf8'));
    const ids = Buffer.concat([Buffer.alloc(16, 0x22), Buffer.alloc(16, 0x33)]);
    const publicKey = Buffer.alloc(65, 0x99);
    publicKey[0] = 4;
    const fingerprint = hash(publicKey), record = {ids, fingerprint, epoch: 1n};
    const info = status(), accepted = status({record, reference: 3}), probe = decodeBootReply(info);
    const target = {device: device.toString('hex'), controller: ids.toString('hex', 0, 16),
      binding: ids.toString('hex', 16), epoch: '1', keySha256: fingerprint.toString('hex')};
    const attempt = {attempt: 'fixed-usb-fixture', boot: boot.toString(), target};
    const proof = createBootProof({mode: 'fence', probe, attempt}, {nonce: Buffer.alloc(32, 0xcc)});
    const fields = Buffer.alloc(136);
    fields.set([0, 2, 1]);
    fields.writeBigUInt64LE(boot, 4);
    device.copy(fields, 12);
    fields.writeBigUInt64LE(1n, 28);
    ids.copy(fields, 36);
    fingerprint.copy(fields, 68);
    fields.fill(0xcc, 100, 132);
    const response = line('vp8-binding-proof-result', fields);
    assert.equal(actual, 'usb-info ' + info + 'usb-accepted ' + accepted + 'usb-fence ' + response);
    assert.equal(decodeBootReply(accepted, {operation: 3, probe, boot: attempt.boot, reference: 3}).state.epoch, '1');
    assert.deepEqual(proof.accept(response).evidence, {...attempt, kind: 'verified_bound'});
  });

test('real firmware C++ direct USB replies confirm immediately and recover a lost Type 132 after reboot',
  {skip: !hasCryptoPeer, timeout: 30000}, async t => {
    const root = mkdtempSync(join(tmpdir(), 'vp8-usb-cpp-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const binary = compileBootPeer(root, 'tests/fixtures/device-binding-proof-peer.cpp', 'peer');
    for (const lost of [false, true]) {
      await t.test(lost ? 'recover without replay' : 'immediate complete proof', async t => {
        const child = spawn(binary, ['--p256', '--usb'], {stdio: ['pipe', 'pipe', 'inherit']});
        const exited = once(child, 'exit');
        const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
        t.after(async () => { child.stdin.end(); await exited; });
        const sent = [];
        let lose = lost;
        const f = makeOwner(t, {openSession: async () => ({close() {}, async exchange(text) {
          const frame = raw(text);
          sent.push([frame[5], frame[16]]);
          child.stdin.write(text);
          const {value} = await lines.next();
          if (frame[5] === 8 && lose) { lose = false; throw Error('lost Type 132'); }
          if (frame[5] === 10 && sent.length === 4) assert.equal(f.store.read().record.phase, 'pending');
          return value + '\n';
        }})});
        f.owner.command(input(f.owner.status(), 'enroll-usb'));
        const initial = await idle(f.owner);
        assert.equal(initial.phase, lost ? 'recovery_required' : 'bound');
        assert.equal(initial.deviceChecked, !lost);
        assert.deepEqual(sent.slice(0, 3).map(([type]) => type), [6, 7, 8]);
        assert.deepEqual(sent[1], [7, 3]);
        assert.deepEqual(sent.slice(3), lost ? [] : [[10, 1]]);
        await f.owner.close();
        child.stdin.write('#reset\n');
        const reopened = f.reopen();
        assert.equal(reopened.status().deviceChecked, false);
        const length = sent.length;
        reopened.command(input(reopened.status(), lost ? 'recover' : 'verify'));
        assert.equal((await idle(reopened)).phase, 'bound');
        assert.deepEqual(sent.slice(length), [[6, undefined], [10, 1]]);
        assert.equal(f.store.read().revision, '2');
        assert.equal(f.prepares, 1);
      });
    }
  });

test('VPL1 ARM pins only after a C++ USB Fence on the same open descriptor and revokes on owner close',
  {skip: !hasCryptoPeer, timeout: 15000}, async t => {
    const root = mkdtempSync(join(tmpdir(), 'vp8-vpl1-fence-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const binary = compileBootPeer(root, 'tests/fixtures/device-binding-proof-peer.cpp', 'peer');
    const child = spawn(binary, ['--p256', '--usb'], {stdio: ['pipe', 'pipe', 'inherit']});
    const exited = once(child, 'exit');
    const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
    t.after(async () => { child.stdin.end(); await exited; });
    const {publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    const {x, y} = publicKey.export({format: 'jwk'});
    const sec1 = Buffer.concat([Buffer.of(4), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]);
    const lanUsbIdentity = '4/112233445566';
    let armed = 0, failure = false;
    const f = makeOwner(t, {lanUsbIdentity, async openSession() {
      const commands = [];
      return {close() {}, async exchange(text) {
        const frame = raw(text);
        commands.push(frame[5]);
        child.stdin.write(text);
        const {value} = await lines.next();
        if (frame[5] === 10 && failure) throw Error('USB fence receipt unavailable');
        return value + '\n';
      }, exchangeDesktop(command, {beforeWrite, match}) {
        assert.equal(command.toString(), 'VPCNET1 ARM 192.168.4.2 18000\n');
        assert.deepEqual(commands, [6, 10]);
        beforeWrite();
        armed++;
        match('@VP8_VPCNET1 QUEUED\n');
        return match('@VP8_VPCNET1 ARMED key=' + sec1.toString('hex') + '\n');
      }};
    }});
    f.owner.command(input(f.owner.status(), 'enroll-usb'));
    assert.equal((await idle(f.owner)).phase, 'bound');
    const arm = () => f.owner.lanArm({...input(f.owner.status(), 'arm'), address: '192.168.4.2', port: 18000});
    failure = true;
    assert.deepEqual(await arm(), {status: 'unavailable'});
    assert.equal(armed, 0);
    failure = false;
    const result = await arm();
    assert.equal(result.status, 'ok');
    assert.equal(result.trust.usbIdentity, lanUsbIdentity);
    assert.equal(result.trust.signal.aborted, false);
    assert.equal(armed, 1);
    await assert.rejects(arm(), {code: 'vpl1_arm_already_attempted'});
    await f.owner.close();
    assert.equal(result.trust.signal.aborted, true);
  });

test('discovery uses USB Fence, recovers an unconfirmed enable, then reopens without USB',
  {skip: !hasCryptoPeer, timeout: 15000}, async t => {
    const root = mkdtempSync(join(tmpdir(), 'vp8-discovery-fence-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const binary = compileBootPeer(root, 'tests/fixtures/device-binding-proof-peer.cpp', 'peer');
    const child = spawn(binary, ['--p256', '--usb'], {stdio: ['pipe', 'pipe', 'inherit']});
    const exited = once(child, 'exit');
    const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
    t.after(async () => { child.stdin.end(); await exited; });
    const {publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    const {x, y} = publicKey.export({format: 'jwk'});
    const point = Buffer.concat([Buffer.of(4), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]);
    const alternate = generateKeyPairSync('ec', {namedCurve: 'prime256v1'}).publicKey.export({format: 'jwk'});
    const otherPoint = Buffer.concat([Buffer.of(4), Buffer.from(alternate.x, 'base64url'), Buffer.from(alternate.y, 'base64url')]);
    const lanUsbIdentity = '4/112233445566', lanPins = openDeviceLanPins(root, lanUsbIdentity);
    let opened = 0, reply = false;
    const f = makeOwner(t, {directory: root, lanUsbIdentity, lanPins, async openSession() {
      opened++;
      const commands = [];
      return {close() {}, async exchange(text) {
        commands.push(raw(text)[5]);
        child.stdin.write(text);
        return (await lines.next()).value + '\n';
      }, exchangeDesktop(command, {beforeWrite, match}) {
        assert.deepEqual(commands, [6, 10]);
        beforeWrite();
        const wire = command.toString();
        if (wire.startsWith('VPCNET1 ARM ')) {
          match('@VP8_VPCNET1 QUEUED\n');
          return match('@VP8_VPCNET1 ARMED key=' + point.toString('hex') + '\n');
        }
        const [, id, operation] = /^VPCNET1 DISCOVERY ([a-f0-9]{8}) ([^\n]+)\n$/.exec(wire);
        if (operation === 'DISABLE') return match(`@VP8_VPCNET1 DISCOVERY id=${id} status=disabled\n`);
        assert.equal(operation, 'ENABLE ' + hash(point).toString('hex'));
        assert.equal(lanPins.load(f.store.read()), null);
        assert.throws(() => lanPins.prepare(f.store.read(), otherPoint), {code: 'device_lan_pin_changed'});
        return reply ? match(`@VP8_VPCNET1 DISCOVERY id=${id} status=enabled\n`) : undefined;
      }};
    }});
    f.owner.command(input(f.owner.status(), 'enroll-usb'));
    assert.equal((await idle(f.owner)).phase, 'bound');
    const arm = () => f.owner.lanArm({...input(f.owner.status(), 'arm'), address: '192.168.4.2', port: 18000});
    assert.deepEqual(await arm(), {status: 'unknown'});
    assert.equal(lanPins.load(f.store.read()), null);
    await f.owner.close();
    f.reopen();
    assert.equal(f.owner.lanLoad(), null);
    reply = true;
    assert.equal((await arm()).status, 'ok');
    assert.deepEqual(lanPins.load(f.store.read()), point);
    await f.owner.close();

    f.reopen();
    const before = opened, trust = f.owner.lanLoad();
    assert.equal(trust.usbIdentity, lanUsbIdentity);
    assert.equal(opened, before);
    assert.equal((await f.owner.lanDisableDiscovery(input(f.owner.status(), 'disable'))).status, 'ok');
    assert.equal(trust.signal.aborted, true);
    assert.equal(lanPins.load(f.store.read()), null);
  });

test('USB key rotation requires both signatures and recovers an acknowledged-on-device commit after reboot',
  {skip: !hasCryptoPeer, timeout: 15000}, async t => {
    const root = mkdtempSync(join(tmpdir(), 'vp8-key-rotation-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const binary = compileBootPeer(root, 'tests/fixtures/device-binding-proof-peer.cpp', 'peer');
    const child = spawn(binary, ['--p256', '--usb'], {stdio: ['pipe', 'pipe', 'inherit']});
    const exited = once(child, 'exit'), lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
    t.after(async () => { child.stdin.end(); await exited; });
    const send = async text => { child.stdin.write(text); return (await lines.next()).value + '\n'; };
    let fault, lastCommit, commands = 0, prepared = 0;
    const openSession = async () => ({close() {}, exchange: send, async exchangeDesktop(bytes, {beforeWrite, match}) {
      let wire = bytes.toString();
      beforeWrite();
      if (wire.includes(' COMMIT ')) {
        commands++;
        if (fault === 'old' || fault === 'new') {
          const [, prefix, encoded] = /^(.* COMMIT )([^\n]+)\n$/.exec(wire);
          const body = Buffer.from(encoded, 'base64');
          body[fault === 'old' ? 69 : 133] ^= 1;
          wire = prefix + body.toString('base64') + '\n';
        } else if (fault === 'expired') child.stdin.write('#tick 20000000 0 0\n');
        lastCommit = wire;
      }
      const reply = await send(wire);
      if (fault === 'lost' && wire.includes(' COMMIT ')) {
        assert.match(reply, / committed\n$/);
        throw Error('simulated lost acknowledgement');
      }
      return match(reply);
    }});
    const source = makeOwner(t, {directory: root, openSession});
    source.owner.command(input(source.owner.status(), 'enroll-usb'));
    assert.equal((await idle(source.owner)).phase, 'bound');
    const original = source.store.read();
    const directory = mkdtempSync(join(tmpdir(), 'vp8-replacement-key-'));
    const replacement = makeOwner(t, {directory, openSession: assert.fail});
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const oldKeys = {lookup: () => source.key};
    const newKeys = {prepare() { prepared++; return replacement.key; }, lookup: () => replacement.key};
    const rotate = (keys = oldKeys) => rotateDeviceBinding({source: source.store, destination: replacement.store,
      oldKeys: keys, newKeys, openSession});

    for (fault of ['old', 'new', 'expired']) {
      await assert.rejects(rotate(), {code: 'device_key_rotation_denied'});
      assert.equal(replacement.store.read().record.phase, 'pending');
      source.owner.command(input(source.owner.status(), 'verify'));
      assert.equal((await idle(source.owner)).deviceChecked, true);
    }
    fault = 'lost';
    await assert.rejects(rotate(), {code: 'device_key_rotation_unknown'});
    assert.equal(replacement.store.read().record.phase, 'pending');
    assert.match(await send(lastCommit), / denied\n$/);
    child.stdin.write('#reset\n');
    fault = undefined;
    assert.deepEqual(await rotate({lookup: assert.fail}), {verified: true});
    assert.deepEqual(await rotate({lookup: assert.fail}), {verified: true});
    assert.equal(commands, 4);
    assert.equal(prepared, 1);
    assert.deepEqual(source.store.read(), original);
    assert.deepEqual(replacement.store.read().record, {phase: 'bound', keyRef: replacement.key.ref,
      target: {...original.record.target, epoch: '2', keySha256: hash(replacement.key.publicKey).toString('hex')}});
  });
