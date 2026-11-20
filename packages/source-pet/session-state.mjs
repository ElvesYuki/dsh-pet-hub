import {parsePetState} from './schema.mjs';
import {requestPetState} from './index.mjs';

export function isPetSessionId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    value === value.trim() && value !== 'unknown';
}

export function parsePetSessionState(payload) {
  const state = parsePetState(payload);
  const sessionId = payload.sections.workStatus.data?.sessionId;
  return {...state, sessionId: state.state !== null && isPetSessionId(sessionId) ? sessionId : null};
}

export function readPetSessionState(base, {signal} = {}) {
  return requestPetState(base, signal, parsePetSessionState);
}
