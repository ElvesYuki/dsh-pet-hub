import {setTimeout as delay} from 'node:timers/promises';
import {createTaskMotion} from '../core/task-motion.mjs';
import {isPetSessionId} from '../source-pet/session-state.mjs';
import {openPetTaskSource} from './local-task-sources.mjs';

/** One abortable reader. Pin the current authenticated connection across each HTTP read. */
export function startDesktopTaskMotion({source, sessionId}, {lan, wait = delay} = {}) {
  return startTaskSource(openPetTaskSource(source), sessionId, {lan, wait});
}

/** Poll one local reader and optionally project it into the current device connection. */
export function startTaskSource(reader, sessionId, {lan, wait = delay, onSample = () => {}} = {}) {
  if (!isPetSessionId(sessionId)) throw new Error('device_task_motion_session');
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  const observe = createTaskMotion(sessionId);
  const done = (async () => {
    while (!signal.aborted) {
      const target = lan?.actionTarget();
      let sample;
      try { sample = await reader.read({signal: AbortSignal.any([signal, AbortSignal.timeout(2000)])}); }
      catch { /* A failed observation invalidates the current transition history. */ }
      if (signal.aborted) break;
      onSample(sample);
      const action = observe(sample, target === lan?.actionTarget() ? target : undefined);
      if (action !== undefined) target.play(0, action, 1500);
      try { await wait(1000, undefined, {signal, ref: false}); }
      catch (error) { if (!signal.aborted) throw error; }
    }
  })().finally(() => reader.close?.());
  return Object.freeze({done, close() { lifetime.abort(); return done; }});
}
