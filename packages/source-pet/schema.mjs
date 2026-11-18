const states = new Set([null, 'thinking', 'working', 'result', 'success', 'waiting', 'error']);
export function parsePetState(payload) {
  const leaf = payload?.sections?.workStatus;
  const data = leaf?.data;
  if (!leaf || !Number.isSafeInteger(leaf.counter) || leaf.counter < 0 ||
      (data !== null && (typeof data !== 'object' || Array.isArray(data)))) throw new Error('invalid pet state');
  const state = data === null ? null : data.state;
  if (!states.has(state)) throw new Error('unsupported pet state');
  return { state, counter: leaf.counter };
}
