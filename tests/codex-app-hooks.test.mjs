import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {createConnection, createServer} from 'node:net';
import {join} from 'node:path';
import {test} from 'node:test';
import {openCodexHookTaskSource} from '../packages/runtime/codex-hook-source.mjs';

const setupScript = realpathSync('scripts/prepare-codex-hooks.mjs');
const lifetime = () => AbortSignal.timeout(2000);

function setup(t) {
  const root = realpathSync(mkdtempSync('/tmp/vp8-hook-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  return {root, path: join(root, 'h.sock')};
}

async function send(path, frame) {
  const peer = createConnection(path);
  peer.on('error', error => assert.fail(error));
  peer.on('connect', () => peer.end(typeof frame === 'string' ? frame : JSON.stringify(frame)));
  await once(peer, 'close');
}

test('Codex App hook projects one fresh turn, preserves parallel tools and expires without a terminal receipt', async t => {
  const {path} = setup(t);
  let wall = 100, clock = 0;
  const reader = openCodexHookTaskSource('selected', path, {wall: () => wall, now: () => clock});
  t.after(() => reader.close());
  const read = () => reader.read({signal: lifetime()});
  const event = (event, extra = {}) => send(path, {v: 1, sessionId: 'selected', turnId: 'turn-a', event, sentAt: ++wall, ...extra});
  await assert.rejects(read(), /codex_hook_unavailable/);
  await event('start', {sessionId: 'wrong-session'});
  await event('start', {sentAt: 99});
  await event('start', {prompt: 'private'});
  await send(path, 'x'.repeat(1025));
  await assert.rejects(read(), /codex_hook_unavailable/);
  await event('start');
  assert.equal((await read()).state, 'thinking');
  await event('tool-start', {callId: 'a'});
  await event('tool-start', {callId: 'b'});
  assert.equal((await read()).state, 'working');
  await event('permission');
  assert.equal((await read()).state, 'waiting');
  await event('tool-end', {callId: 'foreign'});
  assert.equal((await read()).state, 'waiting');
  await event('tool-end', {callId: 'b'});
  assert.equal((await read()).state, 'working');
  await event('tool-end', {callId: 'a'});
  const result = await read();
  assert.equal(result.state, 'result');
  clock += 119999;
  await event('tool-end', {callId: 'a'});
  assert.deepEqual(await read(), result);
  clock++;
  assert.equal((await read()).state, null);
  await event('tool-start', {callId: 'late'});
  assert.equal((await read()).state, null);
  const previousStart = wall;
  await event('start', {turnId: 'turn-b'});
  await event('start', {turnId: 'turn-a', sentAt: previousStart});
  await event('stop');
  assert.equal((await read()).state, 'thinking');
  await event('stop', {turnId: 'turn-b'});
  assert.equal((await read()).state, null);
  await event('start', {turnId: 'turn-c'});
  await event('model-start', {turnId: 'turn-c'});
  await event('model-stopped', {turnId: 'turn-c'});
  const quiet = await read();
  assert.equal(quiet.state, null);
  await event('model-start', {turnId: 'turn-c', sentAt: wall - 2});
  assert.deepEqual(await read(), quiet);
  await event('model-start', {turnId: 'turn-c'});
  assert.equal((await read()).state, 'thinking');
  await event('model-stopped', {turnId: 'turn-c'});
  await event('interrupt', {turnId: 'turn-c'});
  await event('model-start', {turnId: 'turn-c'});
  assert.equal((await read()).state, null);
  await reader.close();
  assert.equal(existsSync(path), false);
  await assert.rejects(read(), /codex_hook_unavailable/);
  const reopened = openCodexHookTaskSource('selected', path, {wall: () => wall, now: () => clock});
  t.after(() => reopened.close());
  await assert.rejects(reopened.read({signal: lifetime()}), /codex_hook_unavailable/);
  await event('start', {sentAt: previousStart, turnId: 'turn-a'});
  await assert.rejects(reopened.read({signal: lifetime()}), /codex_hook_unavailable/);
});

test('a generated Codex project hook sends only bounded metadata and declines decisions when Hub is unavailable', async t => {
  const {root, path} = setup(t);
  const project = join(root, "local project's folder");
  mkdirSync(project, {mode: 0o700});
  execFileSync(process.execPath, [setupScript, 'prepare', project, path]);
  const config = join(project, '.codex/hooks.json');
  assert.throws(() => execFileSync(process.execPath, [setupScript, 'prepare', project, path], {stdio: 'pipe'}));
  const hooks = JSON.parse(readFileSync(config, 'utf8')).hooks;
  const {command} = hooks.PostToolUse[0].hooks[0];
  const run = async input => {
    const proc = spawn('/bin/sh', ['-c', command], {cwd: project});
    proc.stdin.end(JSON.stringify(input));
    let output = '', errors = '';
    proc.stdout.on('data', data => { output += data; });
    proc.stderr.on('data', data => { errors += data; });
    assert.deepEqual(await once(proc, 'close'), [0, null]);
    assert.equal(output, '{}\n');
    assert.equal(errors, '');
  };
  const input = {cwd: project, session_id: 'session-1', turn_id: 'T-1', tool_use_id: 'call-1',
    hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {command: 'private'}, tool_response: 'private',
    transcript_path: 'private', model: 'private'};
  await run(input);
  const frames = [];
  const listener = createServer(peer => {
    let data = '';
    peer.on('data', chunk => { data += chunk; });
    peer.on('end', () => { frames.push(JSON.parse(data)); });
  });
  listener.listen(path);
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  await run({...input, cwd: root});
  await run({...input, tool_use_id: 'bad ID'});
  await run({...input, tool_response: 'x'.repeat(1024 * 1024)});
  await run(input);
  const postModel = {cwd: project, session_id: 'session-1', turn_id: 'T-1', hook_event_name: 'PostModelRequest',
    status: 'failed', error: 'private'};
  await run({...postModel, status: 'completed'});
  await run({...postModel, agent_id: 'subagent'});
  await run(postModel);
  assert.equal(frames.length, 2);
  const {sentAt, ...metadata} = frames[0];
  assert.ok(Math.abs(Date.now() - sentAt) < 2000);
  assert.deepEqual(metadata, {v: 1, sessionId: 'session-1', turnId: 'T-1', event: 'tool-end', callId: 'call-1'});
  assert.deepEqual(Object.keys(frames[1]).sort(), ['event', 'sentAt', 'sessionId', 'turnId', 'v']);
  assert.equal(frames[1].event, 'model-stopped');
});

test('Codex hook refuses shared directories and preserves an occupied endpoint', t => {
  const {root, path} = setup(t);
  mkdirSync(join(root, 'shared'), {mode: 0o755});
  assert.throws(() => openCodexHookTaskSource('selected', join(root, 'shared/h.sock')), /unsafe runtime permissions/);
  writeFileSync(path, 'keep');
  assert.throws(() => openCodexHookTaskSource('selected', path), /codex_hook_endpoint_busy/);
  assert.equal(readFileSync(path, 'utf8'), 'keep');
});
