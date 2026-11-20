import {connectCodexUnix} from './codex-unix-rpc.mjs';
import {validatePetUrl} from '../source-pet/index.mjs';
import {readPetSessionState} from '../source-pet/session-state.mjs';
import {projectCodexTask, projectDshTaskPage} from './task-phase-projections.mjs';

export function openPetTaskSource(base) {
  validatePetUrl(base);
  return {read: ({signal}) => readPetSessionState(base, {signal})};
}

// Native snapshots may change phase without increasing the durable log cursor.
function phaseSource(sessionId, read, close, now = () => performance.now()) {
  let previous, visible, observedActive, terminalAt, counter = 0;
  return {async read({signal}) {
    let reading;
    try { reading = await read(signal); signal.throwIfAborted(); }
    catch (error) { previous = undefined; observedActive = false; throw error; }
    const {turnId, state} = reading;
    const terminal = turnId !== undefined && (state === 'success' || state === 'error');
    if (previous?.state !== state || previous?.turnId !== turnId) {
      if (previous?.turnId !== turnId) observedActive = false;
      terminalAt = terminal && observedActive ? now() : undefined;
      if (terminal) observedActive = false;
      else if (turnId !== undefined && ['thinking', 'working', 'result', 'waiting'].includes(state)) observedActive = true;
      previous = reading;
    }
    const phase = terminal && (terminalAt === undefined || now() - terminalAt >= 5000) ? null : state;
    if (visible?.state !== phase || visible?.turnId !== turnId) {
      visible = {state: phase, turnId};
      counter++;
    }
    return {sessionId, state: phase, counter, ...(turnId === undefined ? {} : {turnId})};
  }, close};
}

export function openDshTaskSource(sessionId, readState, readEvents, {now} = {}) {
  let cursor = -1;
  let projection;
  return phaseSource(sessionId, async signal => {
    const state = await readState({sessionId}, signal);
    if (!Number.isSafeInteger(state?.cursor) || state.cursor < -1 || typeof state.active !== 'boolean' ||
        typeof state.running !== 'boolean' || !Array.isArray(state.pendingInput) || state.pendingInput.length > 3 ||
        state.pendingInput.some(value => !['approval', 'question', 'other'].includes(value))) throw Error('dsh_task_state');
    if (state.cursor < cursor) { cursor = state.cursor; projection = undefined; throw Error('dsh_task_state_reset'); }
    if (readEvents && state.cursor >= 0 && (state.cursor !== cursor || projection === undefined)) {
      const page = await readEvents({address: {kind: 'session', sessionId}, throughSeq: state.cursor,
        maxMessages: 8, turnWindow: {minMessages: 1, minTurns: 1}}, signal);
      signal.throwIfAborted();
      projection = projectDshTaskPage(page, state.cursor, projection);
    }
    cursor = state.cursor;
    const running = state.active && state.running;
    if (state.pendingInput.length) return {turnId: projection?.turnId, state: 'waiting'};
    if (projection?.state === 'success' || projection?.state === 'error')
      return {turnId: projection.turnId, state: projection.state};
    return {turnId: projection?.turnId, state: running ? projection?.state ?? 'working' : null};
  }, undefined, now);
}

// A fresh connection is established only to the explicitly selected local service.
export function openCodexTaskSource(sessionId, {socket}, {now} = {}) {
  let current;
  let detailed = true;
  return phaseSource(sessionId, async signal => {
    if (current?.closed) {
      await current.close();
      current = undefined;
      detailed = true;
      throw Error('codex_task_connection_reset');
    }
    if (!current) {
      try {
        current = connectCodexUnix(socket, signal);
        await current.ready();
        await current.request('initialize', {clientInfo: {name: 'dsh_pet_hub', version: '0.0.8'}, capabilities: {}}, signal);
        signal.throwIfAborted();
        current.send({method: 'initialized'});
      } catch (error) {
        await current?.close();
        current = undefined;
        throw error;
      }
    }
    const result = await current.request('thread/read', {threadId: sessionId, includeTurns: false}, signal);
    const status = result?.thread?.status;
    if (result?.thread?.id !== sessionId) throw Error('codex_task_thread');
    if (status?.type === 'systemError') return {state: 'error'};
    if (!['idle', 'active'].includes(status?.type)) throw Error('codex_task_state');
    let turn;
    if (detailed) {
      try {
        const page = await current.request('thread/turns/list', {threadId: sessionId, limit: 1,
          sortDirection: 'desc', itemsView: 'summary'}, signal);
        if (!Array.isArray(page?.data) || page.data.length > 1) throw Error('codex_task_turn');
        turn = page.data[0];
      } catch (error) {
        if ([-32601, -32602].includes(error.rpcCode)) detailed = false;
        else if (error.rpcCode !== -32600) throw error;
        // A new or ephemeral thread can have runtime state before turn pagination is available.
      }
    }
    return projectCodexTask(status, turn);
  }, () => current?.close(), now);
}
