import { parsePetState } from './schema.mjs';
import { readPetState, validatePetUrl } from './index.mjs';

/** Exactly one source mode per service. No DSH session listeners. */
export function createSource({ mode = 'disabled', base, intervalMs = 1000, leaseMs = 3500, clock = Date.now } = {}) {
  if (!['disabled', 'http', 'page'].includes(mode)) throw new Error('invalid source mode');
  if (mode === 'http') validatePetUrl(base);
  if (!Number.isFinite(intervalMs) || intervalMs < 20) throw new Error('invalid poll interval');
  let value = { mode, status: mode === 'disabled' ? 'disabled' : 'pending', state: null, counter: null };
  let timer, controller, stopped = false, owner = null, expires = 0;
  const snapshot = () => ({ ...value, ...(mode === 'page' && expires > 0 && clock() >= expires ? { status: 'unavailable', state: null, counter: null } : {}) });
  async function poll() {
    if (stopped) return;
    controller = new AbortController();
    try {
      const next = await readPetState(base, { signal: controller.signal });
      if (!stopped) value = { mode, status: 'connected', ...next };
    } catch {
      if (!stopped) value = { mode, status: 'unavailable', state: null, counter: null };
    }
    if (!stopped) timer = setTimeout(poll, intervalMs);
  }
  return {
    snapshot,
    start() { if (mode === 'http' && !controller && !stopped) void poll(); },
    stop() { stopped = true; clearTimeout(timer); controller?.abort(); },
    publish(input) {
      if (mode !== 'page' || stopped) throw new Error('page source disabled');
      const { clientId, status, state, counter } = input ?? {};
      if (typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(clientId) || !['ready', 'pending', 'unsupported', 'unavailable'].includes(status)) throw new Error('invalid page report');
      const next = status === 'ready' ? parsePetState({ sections: { workStatus: { counter, data: { state } } } }) : { state: null, counter: null };
      // Unsupported/error reports do not acquire ownership or steal a live lease.
      if (owner && clock() < expires && clientId !== owner) return false;
      if (status === 'ready' || status === 'pending') { owner = clientId; expires = clock() + leaseMs; }
      else { owner = null; expires = 0; }
      value = { mode, status: status === 'ready' ? 'connected' : status, ...next };
      return true;
    },
  };
}
