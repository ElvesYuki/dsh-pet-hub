const activeActions = new Map([['thinking', 1], ['working', 2], ['result', 2]]);

/** Derive motion only from observed transitions on a single connection and task scope. */
export function createTaskMotion(sessionId) {
  let previous, connection, activeTask = false;

  return function observe(sample, target) {
    const baseline = previous;
    previous = sample;
    const continuous = target && target === connection;
    connection = target;
    if (!continuous || !sample || !baseline || sample.counter < baseline.counter) {
      activeTask = false;
      return;
    }
    if (sample.counter === baseline.counter) {
      if (sample.sessionId !== baseline.sessionId || sample.state !== baseline.state || sample.turnId !== baseline.turnId) {
        activeTask = false;
        previous = undefined;
      }
      return;
    }
    if (sample.sessionId !== sessionId || sample.state === null || sample.state === 'error') {
      activeTask = false;
      return;
    }
    const sameTurn = sample.turnId === baseline.turnId;
    if (!sameTurn) activeTask = false;
    const action = activeActions.get(sample.state);
    if (action !== undefined) {
      if (!sameTurn || baseline.sessionId !== sessionId || action !== activeActions.get(baseline.state)) {
        activeTask = true;
        return action;
      }
    } else if (sample.state === 'success') {
      const eligible = activeTask && sameTurn && baseline.sessionId === sessionId;
      activeTask = false;
      if (eligible) return 3;
    }
  };
}
