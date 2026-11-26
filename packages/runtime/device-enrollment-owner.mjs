import {createHash, randomBytes, randomUUID, verify} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {encodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {id, increment, keys, requireThat, uint64} from '../core/protocol.mjs';
import {createPbp1BindingVerifier, pbp1BindingTranscript, pbp1EnrollmentBody} from './native400-pbp1-binding.mjs';
import {createBootEnrollment} from './device-enrollment.mjs';
import {createBootProof, decodeBootReply, encodeBootRequest, supportsUsbEnrollment} from './device-enrollment-wire.mjs';
import {exchangeDesktopNetwork} from './usb-wifi-settings.mjs';
import {exchangeDesktopWeather} from './usb-weather-settings.mjs';
import {armDeviceTcpOverUsb, createDeviceTcpTrust, setDeviceLanDiscoveryOverUsb} from './device-tcp-trust.mjs';

const wire = {allowBinding: true};
const keyHash = bytes => createHash('sha256').update(bytes).digest('hex');

function signingKey(candidate) {
  const {ref, publicKey, signTranscript} = candidate ?? {};
  id(ref);
  requireThat(publicKey instanceof Uint8Array && publicKey.length === 65 && publicKey[0] === 4 &&
    typeof signTranscript === 'function', 'device_boot_key_unavailable');
  const bytes = Buffer.from(publicKey);
  return {ref, bytes, verifier: createPbp1BindingVerifier(bytes), signTranscript};
}

/** Explicit offline candidate. A trusted provider opens one exclusive, identity-
 * pinned text exchange for each job and closes it when the job exits. The key
 * provider retains private keys and returns only references and signing handles.
 * The caller owns the index and closes it after the owner has stopped. */
export function createEnrollmentCoordinator({store, openSession, keys: keyProvider, now, poll = delay, usbEnrollment = false,
  networkAllowed, lanUsbIdentity, lanPins, statusV2 = false} = {}) {
  requireThat(typeof openSession === 'function' && typeof keyProvider?.prepare === 'function' &&
    typeof keyProvider.lookup === 'function' && typeof poll === 'function' && typeof usbEnrollment === 'boolean' &&
    (networkAllowed === undefined || typeof networkAllowed === 'function') && typeof statusV2 === 'boolean' &&
    (lanUsbIdentity === undefined || (usbEnrollment && typeof networkAllowed === 'function' &&
      typeof lanUsbIdentity === 'string' && /^\d+\/[a-f0-9:-]{8,48}$/.test(lanUsbIdentity))),
    'device_boot_owner_dependencies');
  const flow = createBootEnrollment({store, now});
  const instanceId = randomUUID();
  let revision = '0', current, issue = null, checkedRevision, closed = false, closeFailed = false;
  let lanAttempted = false, lanTrust;
  const advance = () => { revision = increment(revision); };

  function status() {
    let snapshot;
    try { snapshot = flow.snapshot(); }
    catch { snapshot = {phase: 'storage_unavailable'}; }
    return {instanceId, revision, phase: snapshot.phase, busy: Boolean(current), issue,
      deviceChecked: snapshot.phase === 'bound' && snapshot.revision === checkedRevision};
  }

  async function run(job, operation, expected, desktop, caller) {
    const direct = operation === 'enroll-usb';
    const signal = AbortSignal.any([job.cancel.signal, AbortSignal.timeout(25000), ...(caller ? [caller] : [])]);
    let session, ticket, checked, writeStarted = false;
    async function exchange(line, scope = signal) {
      scope.throwIfAborted();
      const reply = await session.exchange(line, {signal: scope});
      scope.throwIfAborted();
      return reply;
    }
    const request = (kind, body, probe, options) =>
      exchange(encodeBootRequest(encodePbp1Frame({kind, body}, wire), probe, options));

    try {
      signal.throwIfAborted();
      session = await openSession({signal});
      requireThat(typeof session?.exchange === 'function' && typeof session.close === 'function', 'device_boot_peer_unavailable');
      const read = await request('binding-info', Buffer.alloc(0));
      requireThat(read != null, 'device_enrollment_no_reply');
      const probe = decodeBootReply(read);
      const {device, boot, epoch, phase, result} = probe.state ?? {};
      requireThat(probe.kind === 'binding-status' && probe.supported, 'device_enrollment_unsupported');
      requireThat(result === 0, 'device_boot_unconfirmed');

      if (operation === 'recover' || operation === 'verify' || desktop) {
        const stored = store.read();
        requireThat(stored.revision === expected && stored.record?.target.device === device,
          'device_enrollment_recovery_target');
        const {keyRef, target} = stored.record;
        if (operation === 'recover') ticket = flow.recover({capability: true, revision: expected, boot, device});
        else requireThat(stored.record.phase === 'bound', 'device_boot_unconfirmed');
        const attempt = ticket ?? {attempt: randomUUID(), boot, target};
        const proof = createBootProof({mode: 'fence', probe, attempt});
        const receipt = proof.accept(await exchange(proof.line));
        requireThat(receipt.evidence, 'device_boot_unconfirmed');
        if (receipt.evidence.kind === 'verified_bound') {
          const key = signingKey(await keyProvider.lookup(keyRef, {signal}));
          signal.throwIfAborted();
          requireThat(key.ref === keyRef && keyHash(key.bytes) === target.keySha256, 'device_boot_key_unavailable');
        }
        if (ticket) flow.finish(receipt.evidence);
        else {
          requireThat(receipt.evidence.kind === 'verified_bound' && store.read().revision === expected,
            'device_boot_unconfirmed');
          checked = expected;
        }
        if (desktop) {
          requireThat(networkAllowed() && typeof session.exchangeDesktop === 'function', 'device_network_target');
          return await desktop.exchange(session, desktop.input, signal, () => {
            requireThat(networkAllowed() && store.read().revision === expected, 'device_network_target');
            writeStarted = true;
          }, {revision: expected, statusV2});
        }
        return;
      }

      if (direct) requireThat(supportsUsbEnrollment(probe), 'device_usb_enrollment_unsupported');
      requireThat(phase === 0, 'device_enrollment_device_conflict');
      const key = signingKey(await keyProvider.prepare({device, signal}));
      signal.throwIfAborted();
      const randomId = () => randomBytes(16).toString('hex');
      const target = {device, controller: randomId(), binding: randomId(), epoch: increment(epoch),
        keySha256: keyHash(key.bytes)};
      const identity = {...target, hub: target.controller};
      ticket = flow.begin({capability: true, revision: expected, deviceState: 'unbound', boot, target, keyRef: key.ref});
      const exchangeMode = {operation: direct ? 3 : 1, probe};
      const nonce = decodeBootReply(await request('binding-challenge', Buffer.from([exchangeMode.operation]), probe,
        exchangeMode), exchangeMode);
      requireThat(nonce.kind === 'binding-nonce' && nonce.result === 0, 'device_boot_unconfirmed');
      const transcript = pbp1BindingTranscript(1, identity, boot, nonce.challenge, key.bytes);
      const signature = await key.signTranscript(Buffer.from(transcript), {signal});
      signal.throwIfAborted();
      requireThat(signature instanceof Uint8Array && signature.length === 64 &&
        verify('sha256', transcript, {key: key.verifier, dsaEncoding: 'ieee-p1363'}, signature), 'device_boot_key_unavailable');
      const body = pbp1EnrollmentBody(identity, nonce.reference, key.bytes, signature);
      const waiting = decodeBootReply(await request('binding-enroll', body, probe, {...exchangeMode, nonce}),
        {...exchangeMode, boot, reference: nonce.reference});
      requireThat(waiting.kind === 'binding-enrolled' && waiting.state.device === device, 'device_boot_unconfirmed');
      if (direct) {
        requireThat(waiting.state.epoch === target.epoch && waiting.state.hub === target.controller &&
          waiting.state.binding === target.binding && waiting.state.keyDigest.toString('hex') === target.keySha256.slice(0, 32),
          'device_boot_unconfirmed');
        flow.confirmingUsb(ticket);
        const proof = createBootProof({mode: 'fence', probe, attempt: ticket});
        const {evidence} = proof.accept(await exchange(proof.line));
        requireThat(evidence?.kind === 'verified_bound', 'device_boot_unconfirmed');
        flow.finish(evidence);
        checked = increment(increment(expected));
        return;
      }
      requireThat(waiting.state.epoch === epoch, 'device_boot_unconfirmed');
      flow.waiting(ticket);
      const waitSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
      while (flow.snapshot().phase === 'awaiting_boot') {
        await poll(200, undefined, {signal: waitSignal});
        waitSignal.throwIfAborted();
        const proof = createBootProof({mode: 'poll', probe, waiting, attempt: ticket});
        const receipt = proof.accept(await exchange(proof.line, waitSignal));
        if (receipt.evidence) { flow.finish(receipt.evidence); return; }
        requireThat(receipt.result === 0 && receipt.phase === 1, 'device_boot_unconfirmed');
      }
      requireThat(false, 'device_boot_unconfirmed');
    } catch (error) {
      issue = signal.aborted ? 'interrupted' :
        error.code === 'device_desktop_usb_busy' ? 'usb_busy' :
        error.code === 'device_enrollment_no_reply' ? 'usb_not_ready' :
        (error.code === 'device_usb_enrollment_unsupported' ||
          (direct && error.code === 'device_enrollment_unsupported')) ? 'usb_unsupported' :
        error.code === 'device_enrollment_unsupported' ? 'unsupported' :
        ['device_enrollment_device_conflict', 'device_enrollment_recovery_target', 'device_boot_proof_binding'].includes(error.code) ?
          'device_conflict' : 'unconfirmed';
      if (desktop) {
        const status = writeStarted ? 'unknown' : issue === 'usb_busy' ? 'busy' :
          issue === 'device_conflict' || error.code === 'device_network_target' ? 'device_conflict' : 'unavailable';
        if (checked) issue = null;
        return {status};
      }
    } finally {
      desktop?.input.password?.fill(0);
      if (ticket) flow.interrupt(ticket.attempt);
      try {
        await session?.close();
        if (!signal.aborted && !closed) checkedRevision = checked;
      }
      catch { closeFailed = true; issue = 'transport_unavailable'; }
      finally { current = undefined; advance(); }
    }
  }

  function desktopOperation(exchange) {
    return (input, {signal} = {}) => {
      requireThat(!closed && !closeFailed && input.instanceId === instanceId && input.revision === revision,
        'device_boot_stale');
      requireThat(!current, 'device_boot_busy');
      const expected = flow.snapshot();
      requireThat(expected.phase === 'bound', 'device_boot_wrong_phase');
      if (!networkAllowed()) return {status: 'device_conflict'};
      const job = {cancel: new AbortController(), done: undefined};
      current = job;
      issue = null;
      checkedRevision = undefined;
      advance();
      job.done = Promise.resolve().then(() => run(job, 'desktop', expected.revision, {input, exchange}, signal));
      return job.done;
    };
  }

  function setLanTrust(revision, devicePublicKey) {
    lanTrust = createDeviceTcpTrust({store, keychain: keyProvider, revision, usbIdentity: lanUsbIdentity, devicePublicKey});
    return lanTrust;
  }

  const armLan = lanUsbIdentity && desktopOperation(async (session, input, signal, beforeWrite, {revision}) => {
    const publicKey = await armDeviceTcpOverUsb(session, input, signal, () => {
      beforeWrite();
      lanAttempted = true;
    });
    signal.throwIfAborted();
    requireThat(networkAllowed(), 'device_network_target');
    if (lanPins) {
      const binding = store.read();
      requireThat(binding.revision === revision, 'vpl1_binding_changed');
      lanPins.prepare(binding, publicKey);
      await setDeviceLanDiscoveryOverUsb(session, publicKey, signal, beforeWrite);
      signal.throwIfAborted();
      requireThat(networkAllowed() && store.read().revision === revision, 'vpl1_binding_changed');
      lanPins.confirm(binding, publicKey);
    }
    return {status: 'ok', trust: setLanTrust(revision, publicKey)};
  });
  const disableDiscovery = lanUsbIdentity && desktopOperation(async (session, input, signal, beforeWrite, {revision}) => {
    await setDeviceLanDiscoveryOverUsb(session, null, signal, beforeWrite);
    lanTrust?.revoke();
    const binding = store.read();
    requireThat(binding.revision === revision, 'vpl1_binding_changed');
    lanPins?.withdraw(binding);
    return {status: 'ok'};
  });

  return Object.freeze({
    status,
    command(input) {
      keys(input, ['operation', 'instanceId', 'revision']);
      requireThat(!closed && !closeFailed && input.instanceId === instanceId && input.revision === revision,
        'device_boot_stale');
      if (input.operation === 'cancel') {
        requireThat(current && !current.cancel.signal.aborted, 'device_boot_busy');
        current.cancel.abort();
        advance();
        return status();
      }
      const expected = flow.snapshot();
      const enrollOperation = usbEnrollment ? 'enroll-usb' : 'enroll';
      requireThat(!current && ((input.operation === enrollOperation && expected.phase === 'unregistered') ||
        (input.operation === 'recover' && expected.phase === 'recovery_required') ||
        (input.operation === 'verify' && expected.phase === 'bound')), 'device_boot_wrong_phase');
      current = {cancel: new AbortController(), done: undefined};
      issue = null;
      checkedRevision = undefined;
      advance();
      const job = current;
      job.done = Promise.resolve().then(() => run(job, input.operation, expected.revision));
      return status();
    },
    ...(networkAllowed ? {network: desktopOperation(exchangeDesktopNetwork),
      weather: desktopOperation(exchangeDesktopWeather)} : {}),
    ...(lanPins ? {lanLoad() {
      requireThat(!closed && !current && !lanTrust && !lanAttempted && networkAllowed(), 'device_lan_pin_state');
      const binding = store.read(), point = lanPins.load(binding);
      return point ? setLanTrust(binding.revision, point) : null;
    }} : {}),
    ...(armLan ? {lanDisableDiscovery: disableDiscovery, async lanArm(input, options) {
      requireThat(!lanAttempted, 'vpl1_arm_already_attempted');
      const result = await armLan(input, options);
      if (!closed && !closeFailed) return result;
      lanTrust?.revoke();
      return {status: 'unknown'};
    }} : {}),
    async close() {
      closed = true;
      lanTrust?.revoke();
      const job = current;
      job?.cancel.abort();
      await job?.done;
      requireThat(!closeFailed, 'device_boot_release_failed');
    },
  });
}
