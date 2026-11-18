import { parsePetState } from './schema.mjs';
/** Public page-scoped Cordis API. Never mutate or forward its shared snapshot. */
export function readPetPageState(ctx) {
  const api = ctx.get('petApi7340');
  if (typeof api?.getState !== 'function') return { status: 'unsupported' };
  const snapshot = api.getState();
  if (snapshot === null) return { status: 'pending' };
  return { status: 'ready', ...parsePetState(snapshot) };
}
