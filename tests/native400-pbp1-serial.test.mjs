import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash, createHmac, createPrivateKey, sign} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {decodePbp1Frame, encodePbp1Frame, pbp1Header} from '../packages/core/native400-pbp1-wire.mjs';
import {createPbp1SerialTransport, openNative400Pbp1Serial} from '../packages/runtime/native400-pbp1-serial.mjs';
import {createNative400PersistentUsbPairing, createNative400UsbPairing} from '../packages/runtime/index.mjs';
import {mockPbp1Usb} from './fixtures/native400-pbp1.mjs';
import {createPbp1ConfirmationPrompt} from '../scripts/native400-pbp1-pair.mjs';
import {native400UsbPairingScope, pbp1Fingerprint} from '../packages/runtime/native400-usb-pairing.mjs';
import {createNative400LanMaintenance} from '../packages/runtime/native400-pma1-lan.mjs';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {native400IdentityFixture} from '../packages/simulator/native400-identity-fixture.mjs';

const boot = '9007199254740999', device = '18'.repeat(16);
const info = encodePbp1Frame({kind: 'info'});
const state = encodePbp1Frame({kind: 'state', boot, device, proposal: 0, fingerprint: '00'.repeat(16),
  phase: 'empty', event: 'ok'});
const again = Object.assign(new Error('try again'), {code: 'EAGAIN'});
const bindingWire = {allowBinding: true};
const frameVectors = JSON.parse(readFileSync(new URL('../docs/protocol/vectors/native400-pbp1-persistent-wire-draft-v1.json', import.meta.url)));
const signingVectors = JSON.parse(readFileSync(new URL('../docs/protocol/vectors/native400-pbp1-persistent-draft-v1.json', import.meta.url)));
const {controller: hub, ...bindingIdentity} = signingVectors.binding;
const identity = {...bindingIdentity, hub};
const publicKey = Buffer.from(signingVectors.public_key_sec1_hex, 'hex');
const privateKey = createPrivateKey({format: 'jwk', key: {kty: 'EC', crv: 'P-256',
  x: publicKey.subarray(1, 33).toString('base64url'), y: publicKey.subarray(33).toString('base64url'),
  d: Buffer.from('00'.repeat(31) + '01', 'hex').toString('base64url')}});
const frame = id => Buffer.from(frameVectors.accept.find(sample => sample.id === id).frame_hex, 'hex');
const bindingFrame = (kind, body) => encodePbp1Frame({kind, body}, bindingWire);
const bindingBody = id => Buffer.from(decodePbp1Frame(frame(id), bindingWire).body);
const splitVectors = JSON.parse(readFileSync(new URL('../docs/protocol/vectors/native400-pbp1-split-enroll-proposal-v1.json', import.meta.url)));
const splitFrame = id => Buffer.from([...splitVectors.accept, ...splitVectors.context_reject].find(sample => sample.id === id).frame_hex, 'hex');

function activeFrame(resume, transcript) {
  const psk = resume.subarray(4, 36);
  const proposal = 42;
  const offer = encodePbp1Frame({kind: 'offer', ...identity, controller: hub, psk});
  const fingerprint = Buffer.from(pbp1Fingerprint(offer, proposal), 'hex');
  const body = Buffer.alloc(56);
  body.writeUInt32LE(proposal, 4);
  body.set(fingerprint, 8);
  const digest = createHash('sha256').update(transcript).digest();
  const mac = createHmac('sha256', psk).update('PBP1/persist/active/v1').update(digest)
    .update(body.subarray(4, 24)).digest();
  body.set(mac, 24);
  return bindingFrame('binding-active', body);
}

test('PBP1 serial transport handles short writes and aborts an incomplete write before releasing', async () => {
  const wire = [];
  let reads = 0, closed = 0;
  const good = createPbp1SerialTransport({
    read(buffer) {
      if (!reads++) throw again;
      buffer.set(state);
      return {bytesRead: state.length};
    },
    write(packet, offset, length) {
      const bytesWritten = Math.min(3, length);
      wire.push(...packet.subarray(offset, offset + bytesWritten));
      return {bytesWritten};
    },
    close() { closed++; }
  });
  assert.deepEqual(await good.exchange(info), state);
  assert.deepEqual(wire, [...info]);
  await good.close();
  assert.equal(closed, 1);

  const first = Promise.withResolvers(), release = Promise.withResolvers();
  const controller = new AbortController();
  const partial = createPbp1SerialTransport({
    read() { throw again; },
    async write() { first.resolve(); await release.promise; return {bytesWritten: 1}; },
    close() { closed++; }
  });
  const result = assert.rejects(partial.exchange(info, {signal: controller.signal}), /pbp_serial_write/);
  await first.promise;
  assert.throws(() => partial.exchange(info), /pbp_serial_busy/);
  controller.abort();
  const exited = partial.close();
  assert.equal(closed, 1);
  release.resolve();
  await result;
  await exited;
  assert.equal(closed, 2);
  assert.throws(() => partial.exchange(info), /pbp_serial_closed/);
});

test('native PBP1 TTY and injected pairing over owned PTYs',
  {skip: !['darwin', 'linux'].includes(process.platform), timeout: 20000}, async t => {
    const root = mkdtempSync(join(tmpdir(), 'pbp1-pty-'));
    const helper = join(root, 'tty'), bridge = join(root, 'pty');
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const cc = ['-std=c11', '-D_DEFAULT_SOURCE', '-Wall', '-Wextra', '-Werror'];
    execFileSync('cc', [...cc, 'native/native400-pbp1-tty.c', '-o', helper], {timeout: 5000});
    execFileSync('cc', [...cc, 'tests/fixtures/native400-pbp1-pty.c', '-o', bridge,
      ...(process.platform === 'linux' ? ['-lutil'] : [])], {timeout: 5000});

    async function setup(sub, timeoutMs = 300, options = {}) {
      const child = spawn(bridge, [], {stdio: ['pipe', 'pipe', 'ignore']});
      const exited = once(child, 'close');
      child.stdin.on('error', () => {});
      const output = child.stdout[Symbol.asyncIterator]();
      const first = await output.next();
      const port = first.value?.toString().trim();
      assert.match(port, /^\/dev\/(?:ttys[0-9]+|pts\/[0-9]+)$/);
      sub.after(async () => { child.stdin.end(); await exited; });
      const transport = await openNative400Pbp1Serial({enabled: true, port, helper, timeoutMs, ...options});
      sub.after(() => transport.close());
      child.stdin.write('!');
      let pending = Buffer.alloc(0);
      return {port, transport, exited, write: bytes => child.stdin.write(bytes), async request() {
        for (;;) {
          if (pending.length >= 16) {
            const end = 16 + pbp1Header(pending.subarray(0, 16), options).length;
            if (pending.length >= end) {
              const packet = pending.subarray(0, end);
              pending = pending.subarray(end);
              return packet;
            }
          }
          const part = await output.next();
          assert.equal(part.done, false);
          pending = Buffer.concat([pending, part.value]);
        }
      }};
    }

    await t.test('exclusive open and fragmentation through text, CRC errors and false magic', async sub => {
      const pty = await setup(sub, 1000);
      await assert.rejects(openNative400Pbp1Serial({enabled: true, port: pty.port, helper}));
      const pending = pty.transport.exchange(info);
      assert.deepEqual(decodePbp1Frame(await pty.request()), {kind: 'info'});
      const corrupt = Buffer.from(state);
      corrupt[12] ^= 1;
      pty.write(Buffer.concat([Buffer.from('status\r\nPPBP1 noise '), corrupt, Buffer.from(state.subarray(0, 13))]));
      await delay(15);
      pty.write(state.subarray(13));
      assert.deepEqual(await pending, state);
      await pty.transport.close();
    });

    await t.test('timeout clears a split frame, new INFO resynchronizes and cancellation waits for close', async sub => {
      const pty = await setup(sub);
      const first = pty.transport.exchange(info);
      assert.equal(decodePbp1Frame(await pty.request()).kind, 'info');
      pty.write(state.subarray(0, 20));
      assert.equal(await first, null);
      pty.write(state.subarray(20));
      const second = pty.transport.exchange(info);
      assert.equal(decodePbp1Frame(await pty.request()).kind, 'info');
      pty.write(state);
      assert.deepEqual(await second, state);
      const abort = new AbortController();
      const cancelled = pty.transport.exchange(info, {signal: abort.signal});
      assert.equal(decodePbp1Frame(await pty.request()).kind, 'info');
      abort.abort();
      assert.equal(await cancelled, null);
      await pty.transport.close();
      assert.throws(() => pty.transport.exchange(info), /pbp_serial_closed/);
    });

    await t.test('existing pairing owner obtains a RAM lease through PTY, with no raw logging', async sub => {
      const pty = await setup(sub, 1000);
      const usb = mockPbp1Usb({boot, device});
      const owner = createNative400UsbPairing({enabled: true, transport: pty.transport,
        identity: {device, hub: '23'.repeat(16), binding: '27'.repeat(16), epoch: '1'}, pollMs: 5,
        confirmFingerprint: () => usb.screen()});
      sub.after(() => owner.close());
      const paired = owner.start();
      const signal = new AbortController().signal;
      for (const expected of ['info', 'offer', 'confirm', 'info']) {
        const packet = await pty.request();
        try {
          assert.equal(decodePbp1Frame(packet).kind, expected);
          const reply = await usb.transport.exchange(packet, {signal});
          pty.write(reply);
          if (expected === 'confirm') assert.ok(usb.longPress());
        } finally { packet.fill(0); }
      }
      const provider = await paired;
      const lease = provider.acquire(provider.identity);
      assert.equal(lease.key.symmetricKeySize, 32);
      await owner.close();
      assert.equal(lease.revoked.aborted, true);
    });

    await t.test('explicit BOOT mode uses no keyboard input and waits for a fresh device press over PTY', async sub => {
      const pty = await setup(sub, 1000);
      const usb = mockPbp1Usb({boot, device});
      const prompts = [];
      const owner = createNative400UsbPairing({enabled: true, transport: pty.transport,
        identity: {device, hub: '23'.repeat(16), binding: '27'.repeat(16), epoch: '1'}, pollMs: 5,
        confirmFingerprint: createPbp1ConfirmationPrompt({button: true,
          terminal: {question: () => assert.fail('unexpected keyboard prompt')}, print: prompt => prompts.push(prompt)})});
      sub.after(() => owner.close());
      const paired = owner.start();
      let leased = false;
      void paired.then(() => { leased = true; }, () => {});
      const signal = new AbortController().signal;
      for (const expected of ['info', 'offer', 'confirm', 'info', 'info']) {
        const packet = await pty.request();
        try {
          const request = decodePbp1Frame(packet);
          assert.equal(request.kind, expected);
          if (expected === 'confirm') assert.equal(usb.pressBoot(), false);
          const reply = await usb.transport.exchange(packet, {signal});
          if (decodePbp1Frame(reply).phase === 'host-confirmed' && expected === 'info') {
            assert.equal(leased, false);
            assert.equal(usb.pressBoot(), true);
          }
          pty.write(reply);
        } finally { packet.fill(0); }
      }
      const provider = await paired;
      assert.equal(provider.boot, boot);
      assert.equal(provider.acquire(provider.identity).key.symmetricKeySize, 32);
      assert.equal(prompts.length, 1);
      assert.match(prompts[0], /15 秒.*BOOT/);
      assert.deepEqual(usb.history.filter(kind => kind !== 'info'), ['offer', 'confirm']);
    });

    await t.test('draft 129 cannot distinguish a late enroll reply after a new INFO request', async sub => {
      const pty = await setup(sub, 300, bindingWire);
      const enroll = pty.transport.exchange(frame('enroll-proof'));
      assert.deepEqual(await pty.request(), frame('enroll-proof'));
      assert.equal(await enroll, null);
      const lookup = pty.transport.exchange(frame('read-capabilities-and-binding'));
      assert.deepEqual(await pty.request(), frame('read-capabilities-and-binding'));
      pty.write(frame('enroll-pending-local'));
      assert.deepEqual(Buffer.from(await lookup), frame('enroll-pending-local'));
    });

    await t.test('candidate without split enroll reply stops before a write or signer call', async sub => {
      const pty = await setup(sub, 1000, bindingWire);
      const owner = createNative400PersistentUsbPairing({enabled: true, transport: pty.transport, identity,
        publicKey, signTranscript: () => assert.fail('unexpected signing'), enroll: true});
      const paired = assert.rejects(owner.start(), /pbp_binding_enroll_reply_unsupported/);
      assert.deepEqual(await pty.request(), frame('read-capabilities-and-binding'));
      pty.write(frame('unbound-after-unbind'));
      await paired;
      await pty.exited;
    });

    await t.test('enroll and resume ignore stale replies and publish only after the PTY closes', async sub => {
      const pty = await setup(sub, 1000, bindingWire);
      const closing = Promise.withResolvers(), release = Promise.withResolvers();
      const proofs = [];
      sub.after(() => release.resolve());
      const owner = createNative400PersistentUsbPairing({enabled: true, enroll: true, pollMs: 5, identity, publicKey,
        signTranscript(transcript) {
          proofs.push(transcript);
          return sign('sha256', transcript, {key: privateKey, dsaEncoding: 'ieee-p1363'});
        }, transport: {
          exchange: pty.transport.exchange,
          async close() {
            closing.resolve();
            await release.promise;
            await pty.transport.close();
            await pty.exited;
          },
        }});
      let published = false;
      const paired = owner.start();
      void paired.then(() => { published = true; }, () => {});
      assert.deepEqual(await pty.request(), frame('read-capabilities-and-binding'));
      pty.write(splitFrame('unbound-split-capability'));
      assert.deepEqual(await pty.request(), frame('request-enroll-challenge'));
      pty.write(frame('enroll-challenge'));
      const enrolled = decodePbp1Frame(await pty.request(), bindingWire).body;
      assert.deepEqual(Buffer.from(enrolled.subarray(0, 109)), bindingBody('enroll-proof').subarray(0, 109));
      assert.equal(proofs[0].toString('hex'), signingVectors.enroll.transcript_hex);
      const oldEnroll = splitFrame('enroll-reply-stale-reference');
      pty.write(Buffer.concat([splitFrame('legacy-129-on-enroll-lane'), oldEnroll, splitFrame('enroll-pending-reference-match')]));
      assert.deepEqual(await pty.request(), frame('read-capabilities-and-binding'));
      pty.write(Buffer.concat([oldEnroll, splitFrame('bound-split-capability')]));
      assert.deepEqual(await pty.request(), frame('request-resume-challenge'));
      pty.write(frame('challenge-busy'));
      assert.deepEqual(await pty.request(), frame('request-resume-challenge'));
      pty.write(frame('resume-challenge'));
      const resume = decodePbp1Frame(await pty.request(), bindingWire).body;
      const stale = frame('resume-active');
      const fresh = activeFrame(resume, proofs[1]);
      pty.write(Buffer.concat([stale, fresh.subarray(0, 19)]));
      await delay(10);
      pty.write(fresh.subarray(19));
      await closing.promise;
      assert.equal(published, false);
      release.resolve();
      const provider = await paired;
      assert.equal(native400UsbPairingScope(provider).proposal, 42);
      const lease = provider.acquire(identity);
      assert.equal(lease.key.symmetricKeySize, 32);

      const armPty = await setup(sub, 300, {allowLanArm: true});
      const source = native400IdentityFixture();
      const directory = realpathSync(root);
      writeFileSync(join(directory, '1.pet'), source.bytes(1), {mode: 0o600});
      const sha = bytes => createHash('sha256').update(bytes).digest('hex');
      let opened = 0;
      const maintenance = createNative400LanMaintenance({enabled: true, address: '192.168.17.9', port: 42001,
        pairing: provider, directory, sourceBytes: source.sourceBytes, indexBytes: source.indexBytes,
        decision: {profile: 'native400-media-maintenance/1', purpose: 'lan-action1-repair', approval_id: 'pty-fixture',
          license_ref: 'original-test-MIT', source_manifest_sha256: sha(source.sourceBytes), source_index_sha256: sha(source.indexBytes),
          namespace: NATIVE400_BOOT_NAMESPACE, action: 1, boot: provider.boot, root: '2', generation: '3'},
        authorize: () => assert.fail('no peer authorized'),
        openArmTransport() { opened++; return armPty.transport; }}, options => {
        const server = createServer(options);
        const listen = server.listen.bind(server);
        server.listen = () => listen({host: '127.0.0.1', port: 0});
        return server;
      });
      sub.after(() => maintenance.close());
      const wifi = () => ({ssid: Buffer.from('test-ssid'), password: Buffer.from('test-password')});
      const armed = assert.rejects(maintenance.run(wifi()), /media_lan_arm_unconfirmed/);
      const arm = decodePbp1Frame(await armPty.request());
      assert.equal(arm.kind, 'lan-arm');
      assert.equal(Buffer.from(arm.body).readUInt32LE(8), 42);
      await armed;
      await armPty.exited;
      assert.equal(opened, 1);
      assert.throws(() => maintenance.run(wifi()), /media_lan_used/);
      await owner.close();
      assert.equal(lease.revoked.aborted, true);
      assert.throws(() => provider.acquire(identity), /pbp_lease/);
    });

    await t.test('bound candidate drops a stale ACTIVE and closes on missing current reply', async sub => {
      const pty = await setup(sub, 300, bindingWire);
      const owner = createNative400PersistentUsbPairing({enabled: true, transport: pty.transport, identity, publicKey,
        signTranscript: transcript => sign('sha256', transcript, {key: privateKey, dsaEncoding: 'ieee-p1363'})});
      const paired = assert.rejects(owner.start(), /pbp_binding_reply_unknown/);
      assert.deepEqual(await pty.request(), frame('read-capabilities-and-binding'));
      pty.write(frame('bound-committed'));
      assert.deepEqual(await pty.request(), frame('request-resume-challenge'));
      pty.write(frame('resume-challenge'));
      assert.equal(decodePbp1Frame(await pty.request(), bindingWire).kind, 'binding-resume');
      pty.write(frame('resume-active'));
      await paired;
      await pty.exited;
      assert.throws(() => owner.start(), /pbp_binding_used/);
    });
  });
