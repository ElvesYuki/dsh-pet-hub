import {open, lstat, realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute, normalize, join} from 'node:path';
import {createHash, randomBytes} from 'node:crypto';
import {native400SourceCandidate} from '../core/native400-identity.mjs';
import {NATIVE400_BOOT_NAMESPACE} from '../core/native400-bootstrap.mjs';
import {encodeMediaFrame, MEDIA_BLOCK_MAX} from '../core/native400-tcp-media-wire.mjs';
import {sha256} from './material-import.mjs';
import {openMediaLoopback, openMediaLoopbackIO, openMediaLanIO} from './native400-tcp-media-socket.mjs';
import {authenticateMediaLoopback, mediaAuthPairing} from './native400-media-auth.mjs';

const CANCEL = new Error('media_cancel_requested');
const DEADLINE = new Error('media_deadline');
const CLOSED = new Error('media_closed');
const activeBoots = new Set();
const identityFields = ['boot', 'root', 'generation'];
const decisionFields = ['profile', 'purpose', 'approval_id', 'license_ref', 'source_manifest_sha256',
  'source_index_sha256', 'namespace', 'action', ...identityFields];

function need(condition, message) {
  if (!condition) throw new Error(message);
}

function uint64(value) {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 0xffffffffffffffffn;
}

function fingerprint(stat, bytes) {
  need(stat.isFile() && stat.size === BigInt(bytes) && stat.uid === BigInt(process.getuid()) &&
    stat.nlink === 1n && (stat.mode & 0o022n) === 0n, 'media_source_file');
  return ['dev', 'ino', 'size', 'uid', 'mode', 'nlink', 'mtimeNs', 'ctimeNs'].map(key => stat[key]).join(':');
}

/** Explicit local maintenance decision for one action and directory generation.
 * The caller supplies the independent usage decision and hands off an owned,
 * isolated loopback socket. This API has no listener or remote approval route.
 */
export function prepareNative400MediaTransfer(options) {
  return prepareTransfer(options);
}

/** Explicit PMA1 loopback entry for a trusted local owner. The binding acquires
 * a current {key: KeyObject, revoked: AbortSignal} per verified identity hint.
 * authorize(request) synchronously issues {request, id, expiresAt} for the
 * exact frozen request. expiresAt uses the local performance.now() clock.
 * start/query take ownership of an isolated IPv4 loopback socket. No listener
 * or key storage is opened, and close waits for the operation's real exit.
 */
export function prepareNative400AuthenticatedMediaTransfer(options) {
  need(options?.enabled === true && typeof options.authorize === 'function', 'media_auth_disabled');
  return prepareTransfer(options, {pairing: mediaAuthPairing(options.pairing), authorize: options.authorize});
}

// This sender is owned by the one-shot LAN caller, never by the regular service.
export function prepareNative400LanMediaTransfer(options, endpoint) {
  need(options.enabled === true && typeof options.authorize === 'function' && options.pairing?.boot, 'media_lan_disabled');
  return prepareTransfer(options, {pairing: mediaAuthPairing(options.pairing), authorize: options.authorize, endpoint,
    tailTiming: options.tailTiming === true});
}

function prepareTransfer({directory, sourceBytes, indexBytes, decision, timeoutMs = 30000}, authentication) {
  need(typeof directory === 'string' && isAbsolute(directory) && normalize(directory) === directory &&
    !directory.includes('\0'), 'media_source_directory');
  need(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= (authentication ? 30000 : 120000), 'media_timeout');
  need(decision && Object.keys(decision).length === decisionFields.length &&
    decisionFields.every(key => Object.hasOwn(decision, key)), 'media_usage_required');
  const approval = structuredClone(decision);
  const endpoint = authentication?.endpoint;
  need(approval.profile === 'native400-media-maintenance/1' &&
    (endpoint ? approval.purpose === 'lan-action1-repair' && approval.action === 1 : approval.purpose === 'offline-loopback-repair') &&
    typeof approval.approval_id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(approval.approval_id) &&
    approval.namespace === NATIVE400_BOOT_NAMESPACE && [1, 11].includes(approval.action) &&
    identityFields.every(key => uint64(approval[key]) && approval[key] !== '0') &&
    approval.root !== '18446744073709551615' && approval.generation !== '18446744073709551615',
  'media_usage_required');
  need(authentication?.pairing.boot === undefined || authentication.pairing.boot === approval.boot, 'media_auth_binding');
  need(sourceBytes instanceof Uint8Array && indexBytes instanceof Uint8Array &&
    sourceBytes.length <= 1048576 && indexBytes.length <= 1048576, 'media_source_metadata');
  const candidate = native400SourceCandidate({sourceBytes, indexBytes, hash: sha256});
  const identity = candidate.identity;
  need(approval.source_manifest_sha256 === identity.source_manifest_sha256 &&
    approval.source_index_sha256 === identity.source_index_sha256 &&
    approval.license_ref === candidate.manifest.license_ref, 'media_source_pin');
  const action = approval.action;
  const asset = candidate.manifest.actions[action];
  const frames = candidate.package.content.timing[action].frames;
  const file = join(directory, `${action}.pet`);
  const job = randomBytes(16).toString('hex');
  const begin = Object.freeze({kind: 'begin', job, boot: approval.boot, root: approval.root,
    generation: approval.generation, action, bytes: asset.bytes, frames, sha256: asset.sha256, namespace: approval.namespace});
  const source = {manifestSha: approval.source_manifest_sha256, indexSha: approval.source_index_sha256,
    licenseRef: approval.license_ref, sourceApprovalId: approval.approval_id};
  const state = {job, action, total: asset.bytes, sent: 0, confirmed: 0, status: 'prepared', saved: null, reason: null};
  let active = null;
  let closed = false;
  let cancelRequested = false;
  let began = false;
  let endAttempted = false;
  let generationFloor = 0n;
  let expires = 0;
  let fd = null;
  const upload = new AbortController();
  const timing = endpoint ? {count: 0, sumMs: 0, maxMs: null, pendingAt: null, dataWriteMs: 0} : null;

  function confirmAck(bytes, markTail) {
    state.confirmed = bytes;
    if (timing && timing.pendingAt !== null) {
      const elapsed = performance.now() - timing.pendingAt;
      timing.pendingAt = null;
      timing.count++;
      timing.sumMs += elapsed;
      timing.maxMs = Math.max(timing.maxMs ?? 0, elapsed);
    }
    if (bytes === asset.bytes) markTail?.('lastAck');
  }

  function result(frame) {
    need(frame.job === job && frame.kind === 'result', 'media_result_identity');
    if (frame.status === 'saved') {
      need(endAttempted && frame.sha256 === asset.sha256 && BigInt(frame.root) === BigInt(approval.root) + 1n &&
        BigInt(frame.generation) > generationFloor,
      'media_saved_identity');
      state.saved = {root: frame.root, generation: frame.generation, sha256: frame.sha256};
    }
    state.status = frame.status;
    state.reason = frame.status === 'unknown' ? 'media_device_unknown' : null;
  }

  async function transfer(link, sessionSignal, markTail) {
    const signal = AbortSignal.any([upload.signal, sessionSignal]);
    const hello = await link.receive(signal);
    need(hello.kind === 'hello' && hello.boot === approval.boot && hello.root === approval.root &&
      hello[`generation${action}`] === approval.generation, 'media_directory_changed');
    for (const sequence of [hello.root, hello.generation1, hello.generation11].map(BigInt)) {
      if (sequence > generationFloor) generationFloor = sequence;
    }

    need(await realpath(directory) === directory, 'media_source_directory');
    fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const original = fingerprint(await fd.stat({bigint: true}), asset.bytes);
    const stable = async () => {
      need(fingerprint(await fd.stat({bigint: true}), asset.bytes) === original &&
        fingerprint(await lstat(file, {bigint: true}), asset.bytes) === original, 'media_source_changed');
    };
    const buffer = Buffer.alloc(MEDIA_BLOCK_MAX);
    const read = async offset => {
      const count = Math.min(buffer.length, asset.bytes - offset);
      let filled = 0;
      while (filled < count) {
        signal.throwIfAborted();
        const {bytesRead} = await fd.read(buffer, filled, count - filled, offset + filled);
        need(bytesRead > 0, 'media_short_source');
        filled += bytesRead;
      }
      signal.throwIfAborted();
      return buffer.subarray(0, count);
    };

    const preflight = createHash('sha256');
    for (let offset = 0; offset < asset.bytes; offset += buffer.length) preflight.update(await read(offset));
    await stable();
    need(preflight.digest('hex') === asset.sha256, 'media_source_hash');
    signal.throwIfAborted();

    if (link.authorize) {
      await link.authorize(begin, signal);
      signal.throwIfAborted();
    }
    await link.send(begin, () => { began = true; });
    const ready = await link.receive(signal);
    if (ready.kind === 'result') return result(ready);
    need(ready.kind === 'ready' && ready.job === job, 'media_ready_identity');
    const hash = createHash('sha256');
    state.status = 'sending';
    while (state.sent < asset.bytes) {
      const data = await read(state.sent);
      signal.throwIfAborted();
      hash.update(data);
      const writeStarted = timing && performance.now();
      await link.send({kind: 'data', job, offset: state.sent, data});
      if (timing) {
        timing.pendingAt = performance.now();
        timing.dataWriteMs += timing.pendingAt - writeStarted;
      }
      state.sent += data.length;
      const ack = await link.receive(signal);
      if (ack.kind === 'result') return result(ack);
      need(ack.kind === 'ack' && ack.job === job && ack.bytes === state.sent, 'media_ack_offset');
      confirmAck(ack.bytes, markTail);
    }
    await stable();
    need(hash.digest('hex') === asset.sha256, 'media_source_hash');
    markTail?.('sourceVerified');
    signal.throwIfAborted();
    state.status = 'awaiting_result';
    await link.send({kind: 'end', job, bytes: state.sent}, () => {
      endAttempted = true;
      markTail?.('endAttempted');
    });
    markTail?.('endWritten');
    result(await link.receive(signal));
    markTail?.('resultValidated');
  }

  async function cancelTransfer(link, signal, markTail) {
    if (!began) {
      state.status = 'cancelled';
      return;
    }
    state.status = 'cancelling';
    await link.send({kind: 'cancel', job});
    let frame = await link.receive(signal);
    // One reply can have been in flight when the operator cancelled.
    if (frame.job === job && ((frame.kind === 'ready' && state.sent === 0) ||
        (frame.kind === 'ack' && frame.bytes === state.sent && state.confirmed < state.sent))) {
      if (frame.kind === 'ack') confirmAck(frame.bytes, markTail);
      frame = await link.receive(signal);
    }
    result(frame);
  }

  function attach(socket, query) {
    need(!closed && !active && !fd && !activeBoots.has(approval.boot), 'media_busy');
    if (query) {
      need(!endpoint && state.status === 'unknown' && began && performance.now() < expires, 'media_query_unavailable');
    } else {
      need(state.status === 'prepared', 'media_already_started');
      if (!authentication) expires = performance.now() + timeoutMs + 120000;
    }
    const owned = endpoint ? openMediaLanIO(socket, endpoint) : authentication ? openMediaLoopbackIO(socket) : openMediaLoopback(socket);
    let link = owned;
    activeBoots.add(approval.boot);
    const controller = new AbortController();
    const now = performance.now();
    const end = query ? Math.min(now + 5000, expires) : now + timeoutMs;
    let cutoff = end, timeout;
    const tail = authentication?.tailTiming ? {lastAck: null, sourceVerified: null, endAttempted: null,
      endWritten: null, resultValidated: null, finished: null} : null;
    const markTail = tail ? (stage, at = performance.now()) => {
      tail[stage] = {atMs: at - now, remainingMs: cutoff - at};
    } : undefined;
    function setDeadline(value) {
      cutoff = value;
      clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(DEADLINE), Math.max(0, Math.ceil(cutoff - performance.now())));
    }
    function checkDeadline() {
      if (performance.now() >= cutoff) controller.abort(DEADLINE);
      controller.signal.throwIfAborted();
    }
    setDeadline(authentication ? Math.min(now + 5000, end) : end);
    const abort = () => { void owned.close(); };
    controller.signal.addEventListener('abort', abort, {once: true});
    async function authenticate(signal) {
      link = await authenticateMediaLoopback(owned, {...authentication, source, mode: query ? 'query' : 'repair',
        signal, checkDeadline, deadline: () => cutoff, tighten: setDeadline, invalidate: reason => controller.abort(reason)});
      checkDeadline();
      setDeadline(end);
    }
    state.status = query ? 'querying' : 'starting';
    state.reason = null;
    active = {controller, promise: (async () => {
      try {
        if (query) {
          if (authentication) await authenticate(controller.signal);
          const hello = await link.receive(controller.signal);
          need(hello.kind === 'hello' && hello.boot === approval.boot, 'media_query_boot');
          await link.send({kind: 'query', job});
          result(await link.receive(controller.signal));
        } else {
          try {
            if (authentication) await authenticate(AbortSignal.any([upload.signal, controller.signal]));
            await transfer(link, controller.signal, markTail);
          } catch (error) {
            if (error !== CANCEL || controller.signal.aborted) throw error;
            await cancelTransfer(link, controller.signal, markTail);
          }
        }
      } catch (error) {
        state.status = began ? 'unknown' : 'failed';
        const reason = controller.signal.aborted ? controller.signal.reason : error;
        state.reason = /^media_[a-z_]+$/.test(reason?.message) ? reason.message : 'media_io_failed';
      } finally {
        if (timing) {
          const ended = performance.now();
          state.timing = {tcpMs: ended - now, dataWriteMs: timing.dataWriteMs,
            ack: {count: timing.count, meanMs: timing.count ? timing.sumMs / timing.count : null, maxMs: timing.maxMs,
              unacknowledgedMs: timing.pendingAt === null ? null : ended - timing.pendingAt}};
          if (tail) {
            markTail('finished', ended);
            state.timing.tail = tail;
          }
        }
        try {
          await owned.close();
          if (fd) {
            await fd.close();
            fd = null;
          }
        } finally {
          link.dispose?.();
          clearTimeout(timeout);
          if (authentication && !query && state.status === 'unknown') expires = performance.now() + 120000;
          activeBoots.delete(approval.boot);
          active = null;
        }
      }
      return structuredClone(state);
    })()};
    return active.promise;
  }

  return Object.freeze({
    ...(endpoint ? {plan: Object.freeze({begin, beginSha: sha256(encodeMediaFrame(begin))})} : {}),
    start: socket => attach(socket, false),
    query: socket => attach(socket, true),
    cancel() {
      if (!active || cancelRequested || !['starting', 'sending', 'awaiting_result'].includes(state.status)) return false;
      cancelRequested = true;
      upload.abort(CANCEL);
      return true;
    },
    snapshot: () => structuredClone(state),
    resources: () => ({connection: active !== null, openFiles: Number(fd !== null), blockBytes: MEDIA_BLOCK_MAX}),
    async close() {
      closed = true;
      active?.controller.abort(CLOSED);
      await active?.promise;
      if (fd) {
        await fd.close();
        fd = null;
      }
    }
  });
}
