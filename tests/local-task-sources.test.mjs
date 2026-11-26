import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync, readFileSync, rmSync, statSync, symlinkSync} from 'node:fs';
import {createServer} from 'node:http';
import {join} from 'node:path';
import test from 'node:test';
import {openCodexTaskSource, openDshTaskAggregate, openDshTaskSource} from '../packages/runtime/local-task-sources.mjs';
import {openTaskSelection} from '../packages/runtime/task-source-selection.mjs';

test('native DSH reads exactly one session and never treats idle or failed reads as completion', async () => {
  let raw = {cursor: -1, active: false, running: false, pendingInput: [], queue: [{content: ['private']} ]};
  const reader = openDshTaskSource('chosen', (input, signal) => {
    assert.deepEqual(input, {sessionId: 'chosen'});
    signal.throwIfAborted();
    return raw;
  });
  const input = {signal: new AbortController().signal};
  assert.deepEqual(await reader.read(input), {sessionId: 'chosen', state: null, counter: 1});
  raw = {...raw, cursor: 5, active: true, running: true};
  assert.deepEqual(await reader.read(input), {sessionId: 'chosen', state: 'working', counter: 2});
  raw.pendingInput = ['approval'];
  assert.deepEqual(await reader.read(input), {sessionId: 'chosen', state: 'waiting', counter: 3});
  raw.cursor = 4;
  await assert.rejects(reader.read(input), /dsh_task_state_reset/);
  raw = {...raw, running: false, pendingInput: []};
  assert.deepEqual(await reader.read(input), {sessionId: 'chosen', state: null, counter: 4});
});

test('DSH exact cursor samples feed six task phases, preserve parallel work and suppress old completion', async () => {
  let time = 0, cut = 0, raw = {cursor: -1, active: true, running: false, pendingInput: []};
  const records = [], signal = new AbortController().signal;
  const reader = openDshTaskSource('chosen', async () => raw, async (input, requestSignal) => {
    requestSignal.throwIfAborted();
    assert.deepEqual(input, {address: {kind: 'session', sessionId: 'chosen'}, throughSeq: raw.cursor,
      maxMessages: 8, turnWindow: {minMessages: 1, minTurns: 1}});
    return {cursor: raw.cursor, records: records.slice(cut)};
  }, {now: () => time});
  const append = (type, data = {}) => records.push({type: 'event', event: {type, seq: ++raw.cursor, data}});
  const phase = async value => assert.equal((await reader.read({signal})).state, value);
  append('turn/start');
  append('turn/end', {reason: {kind: 'completed'}});
  await phase(null);
  raw.running = true;
  append('turn/start');
  await phase('thinking');
  append('tool/call', {callId: 'a'});
  append('tool/call', {callId: 'b'});
  await phase('working');
  append('tool/result', {message: {source: {callId: 'a'}}});
  await phase('working');
  cut = raw.cursor;
  append('tool/result', {callId: 'b'});
  await phase('result');
  raw.pendingInput = ['question'];
  await phase('waiting');
  raw.pendingInput = [];
  raw.running = false;
  append('turn/end', {reason: {kind: 'completed'}});
  await phase('success');
  time += 5000;
  await phase(null);
  raw.running = true;
  append('turn/start');
  await phase('thinking');
  raw.running = false;
  append('turn/end', {reason: {kind: 'timeout'}});
  await phase('error');
  append('turn/start');
  append('turn/end', {reason: {kind: 'aborted'}});
  await phase(null);
  append('turn/start');
  append('user/message', {source: {kind: 'goal'}});
  append('turn/end', {reason: {kind: 'completed'}});
  await phase(null);
});

test('DSH aggregate samples running summaries only and fails closed until bounded discovery can retry', async () => {
  let now = 0, lists = 0, fail = false;
  let items = [{sessionId: 'a', running: true}, {sessionId: 'b', running: true}, {sessionId: 'cold', running: false}];
  const reads = [];
  const reader = openDshTaskAggregate('group', (params, signal) => {
    assert.deepEqual(params, {});
    signal.throwIfAborted();
    lists++;
    return {items};
  }, ({sessionId}, signal) => {
    signal.throwIfAborted();
    reads.push(sessionId);
    if (fail) throw Error('fixture failure');
    return {active: true, running: items.find(item => item.sessionId === sessionId).running,
      cursor: -1, pendingInput: sessionId === 'b' ? ['approval'] : []};
  }, undefined, {now: () => now});
  const read = () => reader.read({signal: AbortSignal.timeout(1000)});
  assert.equal((await read()).state, 'working');
  assert.deepEqual(reads, ['a', 'b']);
  items[0].running = false;
  now = 1000;
  assert.equal((await read()).state, 'waiting');
  assert.equal(lists, 1);
  fail = true;
  await assert.rejects(read(), /fixture failure/);
  fail = false;
  now = 3999;
  await assert.rejects(read(), /dsh_task_list_unavailable/);
  now = 4000;
  assert.equal((await read()).state, 'waiting');
  assert.equal(reads.at(-1), 'b');
  items = Array.from({length: 17}, (_, i) => ({sessionId: `active-${i}`, running: true}));
  now = 7000;
  await assert.rejects(read(), /dsh_task_list/);
  assert.equal(lists, 3);
  assert.equal(await reader.read({signal: AbortSignal.abort()}).then(() => false, e => e.name), 'AbortError');
});

test('Codex reader verifies the six phases over a bounded local WebSocket and closes on cancellation', async t => {
  const dir = mkdtempSync('/tmp/vp8-codex-');
  const server = createServer();
  const socket = join(dir, 'test.sock');
  const calls = [];
  const upgraded = Promise.withResolvers();
  const trials = [
    ['idle', [], null, null],
    ['idle', [], {id: 'historical', status: 'completed'}, null],
    ['active', [], {id: 'live', status: 'inProgress', items: [{type: 'reasoning'}]}, 'thinking'],
    ['active', [], {id: 'live', status: 'inProgress', items: [{type: 'commandExecution', status: 'inProgress'}]}, 'working'],
    ['active', [], {id: 'live', status: 'inProgress', items: [{type: 'commandExecution', status: 'completed'}]}, 'result'],
    ['active', ['waitingOnUserInput'], {id: 'live', status: 'inProgress', items: []}, 'waiting'],
    ['idle', [], {id: 'live', status: 'completed'}, 'success'],
    ['active', [], {id: 'failed', status: 'inProgress', items: []}, 'thinking'],
    ['idle', [], {id: 'failed', status: 'failed'}, 'error'],
    ['idle', [], {id: 'interrupted', status: 'interrupted'}, null],
  ];
  let connections = 0, peer, cursor = 0;
  server.on('upgrade', (request, client) => {
    connections++;
    peer = client;
    const accept = createHash('sha1').update(request.headers['sec-websocket-key'] +
      '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    peer.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    peer.once('end', () => peer.destroy());
    peer.once('close', upgraded.resolve);
    let input = Buffer.alloc(0);
    function send(opcode, data) {
      const head = data.length < 126 ? Buffer.of(opcode, data.length) : Buffer.of(opcode, 126, data.length >> 8, data.length & 255);
      peer.write(Buffer.concat([head, data]));
    }
    peer.on('data', chunk => {
      input = Buffer.concat([input, chunk]);
      while (input.length >= 6) {
        assert.equal(input[1] & 128, 128);
        const bytes = input[1] & 127;
        const offset = bytes === 126 ? 4 : 2;
        if (input.length < offset + 4) break;
        const count = bytes === 126 ? input.readUInt16BE(2) : bytes;
        if (input.length < offset + 4 + count) break;
        const payload = Buffer.from(input.subarray(offset + 4, offset + 4 + count));
        for (let i = 0; i < count; i++) payload[i] ^= input[offset + i % 4];
        const opcode = input[0] & 15;
        input = input.subarray(offset + 4 + count);
        if (opcode === 10) continue;
        assert.equal(opcode, 1);
        const msg = JSON.parse(payload);
        calls.push(msg.method);
        if (msg.method === 'initialize') {
          send(129, Buffer.from(JSON.stringify({id: msg.id, result: {}})));
          continue;
        }
        if (msg.method === 'initialized') continue;
        const trial = trials[cursor];
        if (!trial) continue;
        const [type, activeFlags, turn] = trial;
        let result;
        if (msg.method === 'thread/read') {
          assert.deepEqual(msg.params, {threadId: 'chosen', includeTurns: false});
          result = {thread: {id: 'chosen', status: {type, activeFlags}, preview: 'private'}};
        } else {
          assert.equal(msg.method, 'thread/turns/list');
          assert.deepEqual(msg.params, {threadId: 'chosen', limit: 1, sortDirection: 'desc', itemsView: 'summary'});
          result = turn ? {data: [turn]} : null;
          cursor++;
        }
        const body = Buffer.from(JSON.stringify(result ? {id: msg.id, result} : {id: msg.id, error: {code: -32600}}));
        send(1, body.subarray(0, 20));
        send(137, Buffer.from('ping'));
        send(128, body.subarray(20));
      }
    });
  });
  server.listen(socket);
  await once(server, 'listening');
  const alias = join(dir, 'server.sock');
  symlinkSync(socket, alias);
  const reader = openCodexTaskSource('chosen', {socket: alias}), controller = new AbortController();
  t.after(async () => {
    await reader.close();
    peer?.destroy();
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, {recursive: true, force: true});
  });
  for (const [index, [, , turn, state]] of trials.entries()) {
    assert.deepEqual(await reader.read({signal: AbortSignal.timeout(1500)}),
      {sessionId: 'chosen', ...(turn ? {turnId: turn.id} : {}), state, counter: index + 1});
  }
  const result = reader.read({signal: controller.signal});
  controller.abort();
  await assert.rejects(result, /codex_task_unavailable/);
  await upgraded.promise;
  assert.equal(connections, 1);
  assert.deepEqual(calls.slice(0, 6), ['initialize', 'initialized', 'thread/read', 'thread/turns/list', 'thread/read', 'thread/turns/list']);
});

test('persisted source choice survives reopen and switches only after old reader drain', async t => {
  const directory = mkdtempSync('/tmp/vp8-motion-');
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const history = [], jobs = [];
  const defaults = {source: 'off', sessionId: ''};
  const readers = {dsh: () => 'dsh', codex: () => 'codex'};
  const config = {directory, defaults, readers, aggregateReaders: {codex: () => 'codex-all'}, start(source, id, {extended, onSample}) {
    history.push(source);
    const drain = Promise.withResolvers();
    jobs.push({drain, onSample, extended, id});
    return {done: drain.promise, close() { return drain.promise; }};
  }};
  const owner = openTaskSelection(config);
  const choose = (instance, source, sessionId) => {
    const {instance: token, revision} = instance.view();
    return {instance: token, revision, source, sessionId};
  };
  const dsh = choose(owner, 'dsh', 'one');
  owner.select(dsh);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(history, ['dsh']);
  assert.equal(jobs[0].extended, true);
  assert.throws(() => owner.select(dsh), /task_source_conflict/);
  owner.select(choose(owner, 'codex', 'two'));
  jobs[0].onSample({sessionId: 'one', state: 'success'});
  assert.equal(owner.view().state, null);
  assert.deepEqual(history, ['dsh']);
  jobs[0].drain.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(history, ['dsh', 'codex']);
  assert.equal(jobs[1].extended, false);
  const configPath = join(directory, 'task-source.json');
  assert.equal(statSync(configPath).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(configPath)).sessionId, 'two');
  jobs[1].drain.resolve();
  await owner.close();
  const again = openTaskSelection(config);
  assert.equal(again.view().source, 'codex');
  assert.equal(again.view().scope, 'single');
  assert.deepEqual(again.view().aggregateSources, ['codex']);
  assert.throws(() => again.select({...choose(again, 'dsh', ''), scope: 'all'}), /task_source_invalid/);
  assert.throws(() => again.select({...choose(again, 'codex', 'chosen'), scope: 'all'}), /task_source_invalid/);
  again.select({...choose(again, 'codex', ''), scope: 'all'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(history.at(-1), 'codex-all');
  assert.equal(again.view().sessionId, '');
  const group = jobs.at(-1);
  group.onSample({sessionId: group.id, state: 'working'});
  assert.equal(again.view().state, 'working');
  assert.equal(JSON.parse(readFileSync(configPath)).schema, 2);
  group.drain.resolve();
  await again.close();
  const restored = openTaskSelection(config);
  assert.equal(restored.view().scope, 'all');
  restored.select(choose(restored, 'off', ''));
  assert.equal(JSON.parse(readFileSync(configPath)).schema, 1);
  await restored.close();
});
