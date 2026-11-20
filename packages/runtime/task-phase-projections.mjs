const dshFailure = new Set(['error', 'timeout', 'max-tokens']);

/** Project a bounded DSH event page. The result contains no task text or tool data. */
export function projectDshTaskPage(page, cursor, prior) {
  if (page?.cursor !== cursor || !Array.isArray(page.records) || page.records.length > 512) return null;
  const firstSeq = page.records[0]?.event?.seq;
  const contiguous = prior && Number.isSafeInteger(firstSeq) && firstSeq <= prior.cursor + 1;
  let {turnId, state, automatic = false, goalClose, anonymous = 0} = contiguous ? prior : {};
  let at = -1;
  const pending = new Set(contiguous ? prior.pending : []);
  for (const record of page.records) {
    const event = record?.event;
    if (record?.type !== 'event' || !Number.isSafeInteger(event?.seq) || event.seq <= at || event.seq > cursor ||
        (at !== -1 && event.seq !== at + 1)) return null;
    at = event.seq;
    if (contiguous && at <= prior.cursor) continue;
    const data = event.data;
    if (event.type === 'turn/start') {
      turnId = String(at);
      state = 'thinking';
      automatic = false;
      goalClose = undefined;
      pending.clear();
      anonymous = 0;
      continue;
    }
    if (turnId === undefined || state === null || state === 'success' || state === 'error') continue;
    if (event.type === 'user/message' && data?.source?.kind === 'goal') automatic = true;
    if (event.type === 'tool/call' || event.type === 'tool/result') {
      const id = data?.message?.source?.callId ?? data?.callId;
      const known = typeof id === 'string' && id.length > 0 && id.length <= 256;
      if (event.type === 'tool/call') {
        if (known) pending.add(id);
        else anonymous++;
        if (pending.size + anonymous > 512) return null;
        state = 'working';
        if (data?.name === 'update_goal' && typeof data.arguments === 'string' && data.arguments.length <= 4096) {
          try {
            const {action} = JSON.parse(data.arguments) ?? {};
            if (action === 'complete' || action === 'blocked') goalClose = action;
          } catch { /* Unreadable tool arguments do not provide goal completion evidence. */ }
        }
      } else {
        if (known) pending.delete(id);
        else if (anonymous) anonymous--;
        state = pending.size || anonymous ? 'working' : 'result';
      }
    }
    if (event.type === 'turn/end') {
      const reason = data?.reason?.kind;
      state = reason === 'completed' ? !automatic || goalClose === 'complete' ? 'success' :
        goalClose === 'blocked' ? 'error' : null : dshFailure.has(reason) ? 'error' : null;
    }
  }
  return at !== cursor || turnId === undefined ? null : {cursor, turnId, state, automatic, goalClose, anonymous, pending};
}

const codexTools = new Set(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall',
  'webSearch', 'imageView', 'imageGeneration']);
const codexToolEnds = new Set(['completed', 'failed', 'declined', 'interrupted']);
const codexWaiting = new Set(['waitingOnApproval', 'waitingOnUserInput']);

/** Latest turn summary plus independent waiting flags. Retain only enums and turn identity. */
export function projectCodexTask(status, turn) {
  const flags = status.activeFlags ?? [];
  if (status.type === 'active' && (!Array.isArray(status.activeFlags) || flags.length > 2 ||
      !flags.every(flag => codexWaiting.has(flag)))) throw Error('codex_task_state');
  if (!turn) return {state: status.type === 'active' ? flags.length ? 'waiting' : 'working' : null};
  const turnId = turn.id;
  if (typeof turnId !== 'string' || !turnId || turnId.length > 256) throw Error('codex_task_turn');
  if (flags.length) return {turnId, state: 'waiting'};
  if (turn.status === 'interrupted') return {turnId, state: null};
  if (turn.status === 'failed') return {turnId, state: 'error'};
  if (turn.status === 'completed') return {turnId, state: 'success'};
  if (turn.status !== 'inProgress' || !Array.isArray(turn.items) || turn.items.length > 512) throw Error('codex_task_turn');
  if (status.type !== 'active') return {turnId, state: null};
  let recent = 'thinking';
  for (const item of turn.items) {
    if (codexTools.has(item?.type)) {
      if (item.status === 'inProgress') return {turnId, state: 'working'};
      recent = codexToolEnds.has(item.status) || item.status === undefined ? 'result' : 'thinking';
    } else if (item?.type === 'functionCallOutput') recent = 'result';
  }
  return {turnId, state: recent};
}
