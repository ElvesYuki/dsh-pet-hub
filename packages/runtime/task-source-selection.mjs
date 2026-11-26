import {randomUUID} from 'node:crypto';
import {closeSync, constants, fstatSync, openSync, readSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {privatePath} from './paths.mjs';
import {startTaskSource} from './desktop-task-motion.mjs';
import {isPetSessionId} from '../source-pet/session-state.mjs';

const sources = new Set(['off', 'dsh', 'codex', 'pet']);
const aggregateSession = 'task-source-aggregate';
const validChoice = ({source, sessionId, scope = 'single'}) => sources.has(source) &&
  (scope === 'single' ? (source === 'off' ? sessionId === '' : isPetSessionId(sessionId)) :
    scope === 'all' && (source === 'dsh' || source === 'codex') && sessionId === '');
const errorWith = code => Object.assign(Error(code), {code});

/** A host owns one board and the persisted choice. Endpoint parameters stay outside the UI. */
export function openTaskSelection({directory, defaults, readers, aggregateReaders = {}, lan, start = startTaskSource}) {
  privatePath(directory, 'directory');
  const file = join(directory, 'task-source.json'), lock = file + '.lock';
  const instance = randomUUID();
  let selection = load(), motion, generation = 0, closed = false, ready = Promise.resolve();
  let state = null, status = 'off';

  function load() {
    privatePath(directory, 'directory');
    let fd;
    try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (error.code === 'ENOENT') return {...defaults, scope: 'single', revision: 'initial'}; throw error; }
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
      const single = value?.schema === 1 && Object.keys(value).length === 4 && !Object.hasOwn(value, 'scope');
      const all = value?.schema === 2 && Object.keys(value).length === 5 && value.scope === 'all';
      if (bytes !== stat.size || (!single && !all) || !Object.hasOwn(value, 'source') ||
          !Object.hasOwn(value, 'sessionId') || typeof value.revision !== 'string' ||
          !/^[0-9a-f-]{36}$/.test(value.revision) || !validChoice(value)) throw Error('task_source_storage');
      return {source: value.source, sessionId: value.sessionId, scope: all ? 'all' : 'single', revision: value.revision};
    } finally { closeSync(fd); }
  }

  function view() {
    return {instance, ...selection, status, state, available: ['off', ...Object.keys(readers)],
      aggregateSources: Object.keys(aggregateReaders)};
  }

  function switchReader() {
    const round = ++generation;
    const {source, sessionId, scope} = selection;
    const id = scope === 'all' ? aggregateSession : sessionId;
    const previous = motion?.close();
    motion = undefined;
    state = null;
    status = source === 'off' ? 'off' : 'pending';
    ready = Promise.allSettled([ready, previous]).then(() => {
      if (closed || round !== generation || source === 'off') return;
      try {
        const reader = (scope === 'all' ? aggregateReaders : readers)[source]?.(id);
        if (!reader) throw Error('task_source_not_configured');
        motion = start(reader, id, {lan, extended: source === 'dsh', onSample(sample) {
          if (closed || round !== generation) return;
          status = sample ? 'ready' : 'unavailable';
          state = sample?.sessionId === id ? sample.state : null;
        }});
        void motion.done.catch(() => {
          if (!closed && round === generation) { status = 'unavailable'; state = null; }
        });
      } catch { status = 'unavailable'; }
    });
  }

  function select(input) {
    const fields = ['instance', 'revision', 'source', 'sessionId'];
    if (input && Object.hasOwn(input, 'scope')) fields.push('scope');
    if (!input || Object.keys(input).length !== fields.length || !fields.every(key => Object.hasOwn(input, key)) ||
        !validChoice(input) || (input.source !== 'off' &&
          !Object.hasOwn(input.scope === 'all' ? aggregateReaders : readers, input.source)))
      throw errorWith('task_source_invalid');
    if (closed || input.instance !== instance || input.revision !== selection.revision) throw errorWith('task_source_conflict');
    const {source, sessionId, scope = 'single'} = input;
    if (selection.source === source && selection.sessionId === sessionId && selection.scope === scope) return view();

    privatePath(directory, 'directory');
    let lease;
    try { lease = openSync(lock, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw errorWith('task_source_conflict'); throw error; }
    try {
      if (load().revision !== selection.revision) throw errorWith('task_source_conflict');
      const next = {source, sessionId, scope, revision: randomUUID()};
      const temp = file + '.' + next.revision;
      let written = false;
      try {
        const fd = openSync(temp, 'wx', 0o600);
        written = true;
        const saved = {schema: scope === 'all' ? 2 : 1, source, sessionId, revision: next.revision};
        if (scope === 'all') saved.scope = scope;
        try { writeFileSync(fd, JSON.stringify(saved)); }
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
