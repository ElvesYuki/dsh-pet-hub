import {lstatSync} from 'node:fs';
import {dirname, isAbsolute} from 'node:path';
import {isPetSessionId} from '../source-pet/session-state.mjs';
import {privatePath} from './paths.mjs';

export const codexHookEvents = Object.freeze({UserPromptSubmit: 'start', PreToolUse: 'tool-start',
  PostToolUse: 'tool-end', PermissionRequest: 'permission', Stop: 'stop', Interrupt: 'interrupt',
  PreModelRequest: 'model-start', PostModelRequest: 'model-stopped'});
export const codexHookFrameLimit = 1024;
const events = new Set(Object.values(codexHookEvents));
const toolEvent = event => event === 'tool-start' || event === 'tool-end';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,256}$/.test(value);

/** Only these versioned fields can travel to Hub. Project paths and input content stay in the hook process. */
export function validCodexHookFrame(value) {
  return value?.v === 1 && validId(value.sessionId) && isPetSessionId(value.sessionId) && validId(value.turnId) &&
    events.has(value.event) && Number.isSafeInteger(value.sentAt) && value.sentAt > 0 &&
    Object.keys(value).length === (toolEvent(value.event) ? 6 : 5) &&
    (toolEvent(value.event) ? validId(value.callId) : !Object.hasOwn(value, 'callId'));
}

export function codexHookFrame(input, sentAt) {
  const event = input?.hook_event_name;
  if (typeof event !== 'string' || !Object.hasOwn(codexHookEvents, event)) return null;
  if ((event === 'PreModelRequest' || event === 'PostModelRequest') && (input.agent_id != null || input.agent_type != null)) return null;
  if (event === 'PostModelRequest' && !['failed', 'cancelled'].includes(input.status)) return null;
  const frame = {v: 1, sessionId: input.session_id, turnId: input.turn_id, event: codexHookEvents[event], sentAt};
  if (toolEvent(frame.event)) frame.callId = input.tool_use_id;
  return validCodexHookFrame(frame) ? frame : null;
}

/** macOS Unix pathname bound; use a dedicated owner-only directory and refuse symlinks at the socket. */
export function checkCodexHookSocket(path, connecting = false) {
  if (!isAbsolute(path) || Buffer.byteLength(path) > 100 || path.includes('\0')) throw Error('codex_hook_endpoint');
  privatePath(dirname(path), 'directory');
  if (connecting) {
    const stat = lstatSync(path);
    if (!stat.isSocket() || stat.uid !== process.getuid()) throw Error('codex_hook_endpoint');
  }
}
