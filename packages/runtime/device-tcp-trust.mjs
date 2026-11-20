import {createHash, verify} from 'node:crypto';
import {isIPv4} from 'node:net';
import {requireThat, same} from '../core/protocol.mjs';
import {createPbp1BindingVerifier} from './native400-pbp1-binding.mjs';
import {validateBootState} from './device-enrollment.mjs';

function point(bytes) {
  requireThat(bytes instanceof Uint8Array && bytes.length === 65 && bytes[0] === 4, 'vpl1_public_key');
  return createPbp1BindingVerifier(Buffer.from(bytes));
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function bindingScope(target) {
  const scope = Buffer.alloc(88);
  for (const [index, name] of ['device', 'controller', 'binding'].entries())
    scope.set(Buffer.from(target[name], 'hex'), index * 16);
  scope.writeBigUInt64LE(BigInt(target.epoch), 48);
  scope.set(Buffer.from(target.keySha256, 'hex'), 56);
  return scope;
}

/** Trusted host provisioning only. The caller supplies the attributed ARM
 * public key from the same physically identified, Fence-verified USB session. */
export function createDeviceTcpTrust({store, keychain, revision, usbIdentity, devicePublicKey}) {
  const binding = validateBootState(store.read(), {requireKeyRef: true});
  requireThat(typeof usbIdentity === 'string' && /^\d+\/[a-f0-9:-]{8,48}$/.test(usbIdentity) &&
    binding.revision === revision && binding.record?.phase === 'bound', 'vpl1_binding');
  const {target, keyRef} = binding.record;
  const scope = bindingScope(target), deviceKey = point(devicePublicKey);
  const stop = new AbortController();
  function assertCurrent() {
    stop.signal.throwIfAborted();
    try { requireThat(same(binding, store.read()), 'vpl1_binding_changed'); }
    catch (error) { stop.abort(); throw error; }
  }
  return Object.freeze({
    usbIdentity, signal: stop.signal, assertCurrent, revoke: () => stop.abort(),
    matches: value => scope.equals(value),
    verifyDevice: (message, signature) => verify('sha256', message, {key: deviceKey, dsaEncoding: 'ieee-p1363'}, signature),
    async sign(message, signal) {
      assertCurrent();
      const key = await keychain.lookup(keyRef, {signal});
      signal.throwIfAborted();
      requireThat(key?.ref === keyRef && key.publicKey instanceof Uint8Array && digest(key.publicKey) === target.keySha256,
        'vpl1_controller_key');
      const publicKey = point(key.publicKey);
      const signature = await key.signTranscript(message, {signal});
      signal.throwIfAborted();
      assertCurrent();
      requireThat(signature instanceof Uint8Array && signature.length === 64 &&
        verify('sha256', message, {key: publicKey, dsaEncoding: 'ieee-p1363'}, signature), 'vpl1_controller_signature');
      return signature;
    },
  });
}

/** Side-effecting candidate command. Use only after a Fence on this descriptor. */
export async function armDeviceTcpOverUsb(session, {address, port}, signal, beforeWrite) {
  const first = typeof address === 'string' ? Number(address.split('.')[0]) : NaN;
  requireThat(isIPv4(address) && first > 0 && first !== 127 && first < 224 &&
    Number.isInteger(port) && port > 0 && port <= 65535, 'vpl1_arm_address');
  let queued = false;
  const key = await session.exchangeDesktop(Buffer.from(`VPCNET1 ARM ${address} ${port}\n`), {
    signal, beforeWrite, prefix: '@VP8_VPCNET1 ', match(line) {
      if (/^@VP8_VPCNET1 QUEUED\r?\n$/.test(line)) queued = true;
      const hex = /^@VP8_VPCNET1 ARMED key=(04[a-f0-9]{128})\r?\n$/.exec(line)?.[1];
      if (queued && hex) return Buffer.from(hex, 'hex');
      requireThat(!/^@VP8_VPCNET1 (BUSY|INVALID|UNAVAILABLE|KEY_UNAVAILABLE)\r?\n$/.test(line), 'vpl1_arm_rejected');
    },
  });
  point(key);
  return key;
}
