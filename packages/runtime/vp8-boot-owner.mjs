import {createHash, randomBytes, randomUUID, verify} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {encodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {id, increment, keys, requireThat, uint64} from '../core/protocol.mjs';
import {createPbp1BindingVerifier, pbp1BindingTranscript, pbp1EnrollmentBody} from './native400-pbp1-binding.mjs';
import {createVp8BootEnrollment} from './vp8-boot-enrollment.mjs';
import {createVp8BootProof, decodeVp8BootReply, encodeVp8BootRequest, supportsVp8UsbEnrollment} from './vp8-boot-wire.mjs';

const wire = {allowBinding: true};
const keyHash = bytes => createHash('sha256').update(bytes).digest('hex');

function signingKey(candidate) {
  const {ref, publicKey, signTranscript} = candidate ?? {};
  id(ref);
  requireThat(publicKey instanceof Uint8Array && publicKey.length === 65 && publicKey[0] === 4 &&
    typeof signTranscript === 'function', 'vp8_boot_key_unavailable');
  const bytes = Buffer.from(publicKey);
  return {ref, bytes, verifier: createPbp1BindingVerifier(bytes), signTranscript};
}

/** Explicit offline candidate. A trusted provider opens one exclusive, identity-
 * pinned text exchange for each job and closes it when the job exits. The key
 * provider retains private keys and returns only references and signing handles.
 * The caller owns the index and closes it after the owner has stopped. */
export function createVp8BootOwner({store, openSession, keys: keyProvider, now, poll = delay, usbEnrollment = false} = {}) {
  requireThat(typeof openSession === 'function' && typeof keyProvider?.prepare === 'function' &&
    typeof keyProvider.lookup === 'function' && typeof poll === 'function' && typeof usbEnrollment === 'boolean',
    'vp8_boot_owner_dependencies');
  const flow = createVp8BootEnrollment({store, now});
  const instanceId = randomUUID();
  let revision = '0', current, issue = null, checkedRevision, closed = false, closeFailed = false;
  const advance = () => { revision = increment(revision); };

  function status() {
    let snapshot;
    try { snapshot = flow.snapshot(); }
    catch { snapshot = {phase: 'storage_unavailable'}; }
    return {instanceId, revision, phase: snapshot.phase, busy: Boolean(current), issue,
      deviceChecked: snapshot.phase === 'bound' && snapshot.revision === checkedRevision};
  }

  async function run(job, operation, expected) {
    const direct = operation === 'enroll-usb';
    const signal = AbortSignal.any([job.cancel.signal, AbortSignal.timeout(25000)]);
    let session, ticket, checked;
    async function exchange(line, scope = signal) {
      scope.throwIfAborted();
      const reply = await session.exchange(line, {signal: scope});
      scope.throwIfAborted();
      return reply;
    }
    const request = (kind, body, probe, options) =>
      exchange(encodeVp8BootRequest(encodePbp1Frame({kind, body}, wire), probe, options));

    try {
      signal.throwIfAborted();
      session = await openSession({signal});
      requireThat(typeof session?.exchange === 'function' && typeof session.close === 'function', 'vp8_boot_peer_unavailable');
      const read = await request('binding-info', Buffer.alloc(0));
      requireThat(read != null, 'vp8_enrollment_no_reply');
      const probe = decodeVp8BootReply(read);
      const {device, boot, epoch, phase, result} = probe.state ?? {};
      requireThat(probe.kind === 'binding-status' && probe.supported, 'vp8_enrollment_unsupported');
      requireThat(result === 0, 'vp8_boot_unconfirmed');

      if (operation === 'recover' || operation === 'verify') {
        const stored = store.read();
        requireThat(stored.revision === expected && stored.record?.target.device === device,
          'vp8_enrollment_recovery_target');
        const {keyRef, target} = stored.record;
        if (operation === 'recover') ticket = flow.recover({capability: true, revision: expected, boot, device});
        else requireThat(stored.record.phase === 'bound', 'vp8_boot_unconfirmed');
        const attempt = ticket ?? {attempt: randomUUID(), boot, target};
        const proof = createVp8BootProof({mode: 'fence', probe, attempt});
        const receipt = proof.accept(await exchange(proof.line));
        requireThat(receipt.evidence, 'vp8_boot_unconfirmed');
        if (receipt.evidence.kind === 'verified_bound') {
          const key = signingKey(await keyProvider.lookup(keyRef, {signal}));
          signal.throwIfAborted();
          requireThat(key.ref === keyRef && keyHash(key.bytes) === target.keySha256, 'vp8_boot_key_unavailable');
        }
        if (ticket) flow.finish(receipt.evidence);
        else {
          requireThat(receipt.evidence.kind === 'verified_bound' && store.read().revision === expected,
            'vp8_boot_unconfirmed');
          checked = expected;
        }
        return;
      }

      if (direct) requireThat(supportsVp8UsbEnrollment(probe), 'vp8_usb_enrollment_unsupported');
      requireThat(phase === 0, 'vp8_enrollment_device_conflict');
      const key = signingKey(await keyProvider.prepare({device, signal}));
      signal.throwIfAborted();
      const randomId = () => randomBytes(16).toString('hex');
      const target = {device, controller: randomId(), binding: randomId(), epoch: increment(epoch),
        keySha256: keyHash(key.bytes)};
      const identity = {...target, hub: target.controller};
      ticket = flow.begin({capability: true, revision: expected, deviceState: 'unbound', boot, target, keyRef: key.ref});
      const exchangeMode = {operation: direct ? 3 : 1, probe};
      const nonce = decodeVp8BootReply(await request('binding-challenge', Buffer.from([exchangeMode.operation]), probe,
        exchangeMode), exchangeMode);
      requireThat(nonce.kind === 'binding-nonce' && nonce.result === 0, 'vp8_boot_unconfirmed');
      const transcript = pbp1BindingTranscript(1, identity, boot, nonce.challenge, key.bytes);
      const signature = await key.signTranscript(Buffer.from(transcript), {signal});
      signal.throwIfAborted();
      requireThat(signature instanceof Uint8Array && signature.length === 64 &&
        verify('sha256', transcript, {key: key.verifier, dsaEncoding: 'ieee-p1363'}, signature), 'vp8_boot_key_unavailable');
      const body = pbp1EnrollmentBody(identity, nonce.reference, key.bytes, signature);
      const waiting = decodeVp8BootReply(await request('binding-enroll', body, probe, {...exchangeMode, nonce}),
        {...exchangeMode, boot, reference: nonce.reference});
      requireThat(waiting.kind === 'binding-enrolled' && waiting.state.device === device, 'vp8_boot_unconfirmed');
      if (direct) {
        requireThat(waiting.state.epoch === target.epoch && waiting.state.hub === target.controller &&
          waiting.state.binding === target.binding && waiting.state.keyDigest.toString('hex') === target.keySha256.slice(0, 32),
          'vp8_boot_unconfirmed');
        flow.confirmingUsb(ticket);
        const proof = createVp8BootProof({mode: 'fence', probe, attempt: ticket});
        const {evidence} = proof.accept(await exchange(proof.line));
        requireThat(evidence?.kind === 'verified_bound', 'vp8_boot_unconfirmed');
        flow.finish(evidence);
        checked = increment(increment(expected));
        return;
      }
      requireThat(waiting.state.epoch === epoch, 'vp8_boot_unconfirmed');
      flow.waiting(ticket);
      const waitSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
      while (flow.snapshot().phase === 'awaiting_boot') {
        await poll(200, undefined, {signal: waitSignal});
        waitSignal.throwIfAborted();
        const proof = createVp8BootProof({mode: 'poll', probe, waiting, attempt: ticket});
        const receipt = proof.accept(await exchange(proof.line, waitSignal));
        if (receipt.evidence) { flow.finish(receipt.evidence); return; }
        requireThat(receipt.result === 0 && receipt.phase === 1, 'vp8_boot_unconfirmed');
      }
      requireThat(false, 'vp8_boot_unconfirmed');
    } catch (error) {
      issue = signal.aborted ? 'interrupted' :
        error.code === 'vp8_desktop_usb_busy' ? 'usb_busy' :
        error.code === 'vp8_enrollment_no_reply' ? 'usb_not_ready' :
        (error.code === 'vp8_usb_enrollment_unsupported' ||
          (direct && error.code === 'vp8_enrollment_unsupported')) ? 'usb_unsupported' :
        error.code === 'vp8_enrollment_unsupported' ? 'unsupported' :
        ['vp8_enrollment_device_conflict', 'vp8_enrollment_recovery_target', 'vp8_boot_proof_binding'].includes(error.code) ?
          'device_conflict' : 'unconfirmed';
    } finally {
      if (ticket) flow.interrupt(ticket.attempt);
      try {
        await session?.close();
        if (!signal.aborted && !closed) checkedRevision = checked;
      }
      catch { closeFailed = true; issue = 'transport_unavailable'; }
      finally { current = undefined; advance(); }
    }
  }

  return Object.freeze({
    status,
    command(input) {
      keys(input, ['operation', 'instanceId', 'revision']);
      requireThat(!closed && !closeFailed && input.instanceId === instanceId && input.revision === revision,
        'vp8_boot_stale');
      if (input.operation === 'cancel') {
        requireThat(current && !current.cancel.signal.aborted, 'vp8_boot_busy');
        current.cancel.abort();
        advance();
        return status();
      }
      const expected = flow.snapshot();
      const enrollOperation = usbEnrollment ? 'enroll-usb' : 'enroll';
      requireThat(!current && ((input.operation === enrollOperation && expected.phase === 'unregistered') ||
        (input.operation === 'recover' && expected.phase === 'recovery_required') ||
        (input.operation === 'verify' && expected.phase === 'bound')), 'vp8_boot_wrong_phase');
      current = {cancel: new AbortController(), done: undefined};
      issue = null;
      checkedRevision = undefined;
      advance();
      const job = current;
      job.done = Promise.resolve().then(() => run(job, input.operation, expected.revision));
      return status();
    },
    async close() {
      closed = true;
      const job = current;
      job?.cancel.abort();
      await job?.done;
      requireThat(!closeFailed, 'vp8_boot_release_failed');
    },
  });
}
