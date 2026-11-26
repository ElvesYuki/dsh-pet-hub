import {lstatSync} from 'node:fs';
import {createServer} from 'node:net';
import {checkCodexHookSocket, codexHookFrameLimit, validCodexHookFrame} from './codex-hook-wire.mjs';
import {createTaskStateAggregate} from '../core/task-motion.mjs';

const utf8 = new TextDecoder('utf-8', {fatal: true});
const activeTtl = 120000;
const wireTtl = 2000;
const maxThreads = 32;

function createThread(opened) {
  const calls = new Map();
  let turnId, state = null, phaseUntil = 0, startAt = opened - 1, toolAt = 0, modelAt = 0, retryUntil = 0;
  let counter = 0, idleSince = 0;

  function update(next, time) {
    if (state !== next) {
      counter++;
      if (next === null) idleSince = time;
    }
    state = next;
    phaseUntil = next ? time + activeTtl : 0;
  }
  function expire(time) {
    if (state && time >= phaseUntil) update(null, time);
  }
  function accept(frame, time) {
    expire(time);
    if (frame.event === 'start') {
      if (frame.turnId === turnId || frame.sentAt <= startAt) return;
      turnId = frame.turnId;
      startAt = toolAt = modelAt = frame.sentAt;
      retryUntil = 0;
      calls.clear();
      counter++;
      update('thinking', time);
    } else if (frame.turnId === turnId && frame.sentAt >= startAt) {
      if (frame.event === 'stop' || frame.event === 'interrupt') {
        retryUntil = 0;
        update(null, time);
      } else if (frame.event === 'model-start' && frame.sentAt > modelAt) {
        modelAt = frame.sentAt;
        if (!state && time < retryUntil) {
          retryUntil = 0;
          update('thinking', time);
        }
      } else if (state && frame.event === 'model-stopped' && frame.sentAt >= modelAt) {
        modelAt = frame.sentAt;
        if (state !== 'waiting' && ![...calls.values()].some(Boolean)) {
          retryUntil = time + activeTtl;
          update(null, time);
        }
      } else if (!state) return;
      else if (frame.event === 'permission') {
        if (state !== 'waiting' && frame.sentAt > toolAt) {
          toolAt = frame.sentAt;
          update('waiting', time);
        }
      } else if (frame.event === 'tool-start' && !calls.has(frame.callId)) {
        if (calls.size >= 128) { update(null, time); return; }
        calls.set(frame.callId, frame.sentAt);
        if (state !== 'waiting' || frame.sentAt >= toolAt) {
          toolAt = Math.max(toolAt, frame.sentAt);
          update('working', time);
        }
      } else if (frame.event === 'tool-end') {
        const started = calls.get(frame.callId);
        if (!started || frame.sentAt < started) return;
        calls.set(frame.callId, 0);
        if (state !== 'waiting' || frame.sentAt >= toolAt) {
          toolAt = Math.max(toolAt, frame.sentAt);
          update([...calls.values()].some(Boolean) ? 'working' : 'result', time);
        }
      }
    }
  }
  return {accept, sample(time) {
    expire(time);
    return {turnId, state, counter};
  }, idle(time) {
    expire(time);
    return state === null && time >= retryUntil && time - idleSince > wireTtl;
  }};
}

/** Listen for the selected thread or aggregate an authorized project's threads on one private socket. */
export function openCodexHookTaskSource(sessionId, path, {all = false, wall = Date.now, now = () => performance.now()} = {}) {
  checkCodexHookSocket(path);
  // Preserve any prior file or endpoint, including a socket left by a different instance.
  try { lstatSync(path); throw Error('codex_hook_endpoint_busy'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const opened = wall(), peers = new Set(), threads = new Map();
  const selected = all ? undefined : createThread(opened);
  const aggregate = all ? createTaskStateAggregate(sessionId) : undefined;
  let failed = false, closing;

  function accept(frame) {
    if (!validCodexHookFrame(frame) || frame.sentAt < opened || (!all && frame.sessionId !== sessionId)) return;
    const age = wall() - frame.sentAt;
    if (age < 0 || age > wireTtl) return;
    const time = now();
    let thread = selected ?? threads.get(frame.sessionId);
    if (!thread) {
      if (frame.event !== 'start') return;
      for (const [id, existing] of threads) if (existing.idle(time)) threads.delete(id);
      if (threads.size >= maxThreads) return;
      thread = createThread(opened);
      threads.set(frame.sessionId, thread);
    }
    thread.accept(frame, time);
  }

  const server = createServer(peer => {
    peers.add(peer);
    let bytes = 0;
    const chunks = [];
    const deadline = setTimeout(() => peer.destroy(), 300);
    peer.on('error', () => peer.destroy());
    peer.once('close', () => { clearTimeout(deadline); peers.delete(peer); });
    peer.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > codexHookFrameLimit) { peer.destroy(); return; }
      chunks.push(chunk);
    });
    peer.once('end', () => {
      if (closing || failed || !bytes || bytes > codexHookFrameLimit) return;
      try { accept(JSON.parse(utf8.decode(Buffer.concat(chunks, bytes)))); }
      catch { /* A malformed local message contributes no state. */ }
    });
  });
  server.maxConnections = 8;
  const ready = new Promise(resolve => {
    server.on('error', () => { failed = true; resolve(); });
    server.listen({path, backlog: 8}, resolve);
  });
  return {async read({signal}) {
    await ready;
    signal.throwIfAborted();
    if (failed || closing) throw Error('codex_hook_unavailable');
    const time = now();
    if (all) return aggregate([...threads.values()].map(thread => thread.sample(time).state));
    const sample = selected.sample(time);
    if (!sample.turnId) throw Error('codex_hook_unavailable');
    return {sessionId, ...sample};
  }, close() {
    closing ??= ready.then(() => new Promise(resolve => {
      for (const peer of peers) peer.destroy();
      server.close(() => resolve());
    }));
    return closing;
  }};
}
