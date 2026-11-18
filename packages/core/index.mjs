/** P0 in-memory model; no transport, persistence or hardware claims. */
export class DevicePlayback {
  #devices = new Map();
  register(deviceId, bootId) {
    if (![deviceId, bootId].every(v => typeof v === 'string' && v.length > 0)) throw new Error('invalid identity');
    this.#devices.set(deviceId, { deviceId, bootId, revision: 0, actionId: null, playing: false });
  }
  target(deviceId, actionId) {
    const state = this.#get(deviceId);
    if (!Number.isSafeInteger(actionId) || actionId < 0) throw new Error('invalid action');
    state.actionId = actionId;
    state.revision++;
    state.playing = false;
    return this.snapshot(deviceId);
  }
  confirm({ deviceId, bootId, revision, actionId }) {
    const state = this.#get(deviceId);
    if (state.bootId !== bootId || state.revision !== revision || state.actionId !== actionId || state.actionId === null) return false;
    state.playing = true;
    return true;
  }
  snapshot(deviceId) { return { ...this.#get(deviceId) }; }
  #get(id) {
    const state = this.#devices.get(id);
    if (!state) throw new Error('unknown device');
    return state;
  }
}
