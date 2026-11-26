const activeActions = new Map([['thinking', 1], ['working', 2], ['result', 2]]);
const aggregatePriority = new Map([['working', 4], ['waiting', 3], ['thinking', 2], ['result', 1]]);

/** Project a set of conversation phases as one task scope. Terminal phases do not represent the group. */
export function createTaskStateAggregate(sessionId) {
  let state = null, counter = 0;
  return function sample(states) {
    let next = null, rank = 0;
    for (const phase of states) {
      const priority = aggregatePriority.get(phase);
      if (priority > rank) { next = phase; rank = priority; }
    }
    if (next !== state) { state = next; counter++; }
    return {sessionId, state, counter};
  };
}

/** Derive motion only from observed transitions on a single connection and task scope. */
export function createTaskMotion(sessionId, {extended = false, now = () => performance.now()} = {}) {
  let previous, connection, activeTask = false, resultSince, terminalTurn;
  const actionFor = state => extended && state === 'waiting' ? 41 : activeActions.get(state);

  function sustainedResult() {
    if (resultSince === undefined || now() - resultSince < 1000) return;
    resultSince = undefined;
    return 43;
  }

  return function observe(sample, target) {
    const baseline = previous;
    previous = sample;
    const continuous = target && target === connection;
    connection = target;
    if (!continuous || !sample || !baseline || sample.counter < baseline.counter) {
      activeTask = false;
      resultSince = undefined;
      return;
    }
    if (sample.counter === baseline.counter) {
      if (sample.sessionId !== baseline.sessionId || sample.state !== baseline.state || sample.turnId !== baseline.turnId) {
        activeTask = false;
        previous = undefined;
        resultSince = undefined;
        return;
      }
      return sustainedResult();
    }
    if (sample.sessionId !== sessionId || sample.state === null) {
      activeTask = false;
      resultSince = undefined;
      return;
    }
    const sameTurn = sample.turnId === baseline.turnId;
    const sameScope = sameTurn && baseline.sessionId === sessionId;
    if (!sameTurn) activeTask = false;
    if (!sameScope || sample.state !== 'result') resultSince = undefined;
    if (extended && sample.state === 'result' && (!sameScope || baseline.state !== 'result')) resultSince = now();
    if (sample.state === 'success' || sample.state === 'error') {
      const eligible = activeTask && sameScope && (extended || sample.state === 'success');
      activeTask = false;
      if (!eligible || (extended && sample.turnId !== undefined && sample.turnId === terminalTurn)) return;
      terminalTurn = sample.turnId;
      return sample.state === 'success' ? 3 : 42;
    }
    const action = actionFor(sample.state);
    if (action !== undefined) {
      if (!sameScope || action !== actionFor(baseline.state)) {
        activeTask = true;
        return action;
      }
    }
    return sustainedResult();
  };
}
