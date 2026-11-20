import {randomUUID} from 'node:crypto';
import {closeSync, constants, fstatSync, openSync, readSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {privatePath} from './paths.mjs';
import {startTaskSource} from './desktop-task-motion.mjs';
import {isPetSessionId} from '../source-pet/session-state.mjs';

const sources = new Set(['off', 'dsh', 'codex', 'pet']);
const validChoice = ({source, sessionId}) => sources.has(source) &&
  (source === 'off' ? sessionId === '' : isPetSessionId(sessionId));
const errorWith = code => Object.assign(Error(code), {code});

/** A host owns one board and the persisted choice. Endpoint parameters stay outside the UI. */
export function openTaskSelection({directory, defaults, readers, lan, start = startTaskSource}) {
  privatePath(directory, 'directory');
  const file = join(directory, 'task-source.json'), lock = file + '.lock';
  const instance = randomUUID();
  let selection = load(), motion, generation = 0, closed = false, ready = Promise.resolve();
  let state = null, status = 'off';

  function load() {
    privatePath(directory, 'directory');
    let fd;
    try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (error.code === 'ENOENT') return {...defaults, revision: 'initial'}; throw error; }
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600 ||
          stat.size < 1 || stat.size > 2048) throw Error('task_source_storage');
      const buffer = Buffer.alloc(2049);
      let bytes = 0;
      while (bytes < buffer.length) {
        const length = readSync(fd, buffer, bytes, buffer.length - bytes, null);
        if (!length) break;
        bytes += length;
      }
      const value = JSON.parse(buffer.toString('utf8', 0, bytes));
      if (bytes !== stat.size || !value || Object.keys(value).length !== 4 || value.schema !== 1 ||
          !/^[0-9a-f-]{36}$/.test(value.revision) || !validChoice(value)) throw Error('task_source_storage');
      return {source: value.source, sessionId: value.sessionId, revision: value.revision};
    } finally { closeSync(fd); }
  }

  function view() {
    return {instance, ...selection, status, state, available: ['off', ...Object.keys(readers)]};
  }

  function switchReader() {
    const round = ++generation;
    const {source, sessionId} = selection;
    const previous = motion?.close();
    motion = undefined;
    state = null;
    status = source === 'off' ? 'off' : 'pending';
    ready = Promise.allSettled([ready, previous]).then(() => {
      if (closed || round !== generation || source === 'off') return;
      try {
        const reader = readers[source]?.(sessionId);
        if (!reader) throw Error('task_source_not_configured');
        motion = start(reader, sessionId, {lan, onSample(sample) {
          if (closed || round !== generation) return;
          status = sample ? 'ready' : 'unavailable';
          state = sample?.sessionId === sessionId ? sample.state : null;
        }});
        void motion.done.catch(() => {
          if (!closed && round === generation) { status = 'unavailable'; state = null; }
        });
      } catch { status = 'unavailable'; }
    });
  }

  function select(input) {
    const fields = ['instance', 'revision', 'source', 'sessionId'];
    if (!input || Object.keys(input).length !== fields.length || !fields.every(key => Object.hasOwn(input, key)) ||
        !validChoice(input) || (input.source !== 'off' && !Object.hasOwn(readers, input.source)))
      throw errorWith('task_source_invalid');
    if (closed || input.instance !== instance || input.revision !== selection.revision) throw errorWith('task_source_conflict');
    if (selection.source === input.source && selection.sessionId === input.sessionId) return view();

    privatePath(directory, 'directory');
    let lease;
    try { lease = openSync(lock, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw errorWith('task_source_conflict'); throw error; }
    try {
      if (load().revision !== selection.revision) throw errorWith('task_source_conflict');
      const next = {source: input.source, sessionId: input.sessionId, revision: randomUUID()};
      const temp = file + '.' + next.revision;
      let written = false;
      try {
        const fd = openSync(temp, 'wx', 0o600);
        written = true;
        try { writeFileSync(fd, JSON.stringify({schema: 1, ...next})); }
        finally { closeSync(fd); }
        renameSync(temp, file);
        written = false;
      } finally { if (written) unlinkSync(temp); }
      selection = next;
      switchReader();
      return view();
    } finally { closeSync(lease); unlinkSync(lock); }
  }

  switchReader();
  let closing;
  return {view, select, close() {
    if (!closing) {
      closed = true;
      closing = Promise.allSettled([ready, motion?.close()]);
    }
    return closing;
  }};
}
