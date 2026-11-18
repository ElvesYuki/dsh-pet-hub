import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DevicePlayback } from '../packages/core/index.mjs';
import { parsePetState, validatePetUrl, readPetState } from '../packages/source-pet/index.mjs';
import { apply } from '../apps/dsh-plugin/index.mjs';

test('confirmations are device-, boot- and revision-specific', () => {
  const p = new DevicePlayback();
  p.register('a', 'boot1'); p.register('b', 'boot1');
  const a = p.target('a', 51); p.target('b', 11);
  assert.equal(p.confirm({ ...a, deviceId: 'b' }), false);
  assert.equal(p.confirm(a), true);
  assert.equal(p.snapshot('b').playing, false);
  p.target('a', 77); assert.equal(p.confirm(a), false);
  p.register('a', 'boot2'); p.target('a', 51);
  assert.equal(p.confirm(a), false);
  const copy = p.snapshot('a'); copy.playing = true;
  assert.equal(p.snapshot('a').playing, false);
  assert.throws(() => p.target('missing', 0));
  assert.throws(() => p.target('a', -1));
});
test('semantic boundary discards private sections and rejects unknown schema', () => {
  assert.deepEqual(parsePetState({ sections: { workStatus: { counter: 1, data: { state: 'working', task: 'PRIVATE' } }, balance: 'PRIVATE' } }), { state: 'working', counter: 1 });
  assert.deepEqual(parsePetState({ sections: { workStatus: { counter: 0, data: null } } }), { state: null, counter: 0 });
  for (const data of [{}, [], { state: 'new-state' }]) assert.throws(() => parsePetState({ sections: { workStatus: { counter: 0, data } } }));
  assert.throws(() => parsePetState({ sections: { workStatus: { counter: true, data: null } } }));
});
test('source URL cannot reach LAN, credentials or arbitrary pet routes', () => {
  for (const base of ['http://192.0.2.1/dsh-pet-7340', 'http://localhost/dsh-pet-7340', 'http://user@127.0.0.1/dsh-pet-7340', 'http://127.0.0.1/config', 'http://127.0.0.1/dsh-pet-7340?x=1']) assert.throws(() => validatePetUrl(base));
  assert.equal(validatePetUrl('http://127.0.0.1:1234/dsh-pet-7340').pathname, '/dsh-pet-7340/state');
});
test('transport only GETs state, refuses redirect and oversized responses', async t => {
  let mode = 'ok'; const requests = [];
  const server = http.createServer((req, res) => {
    requests.push([req.method, req.url]);
    if (mode === 'redirect') { res.writeHead(302, { Location: 'http://192.0.2.1/' }); res.end(); }
    else if (mode === 'large') res.end('x'.repeat(262145));
    else res.end(JSON.stringify({ sections: { workStatus: { counter: 3, data: { state: 'thinking' } } } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/dsh-pet-7340`;
  assert.deepEqual(await readPetState(base), { state: 'thinking', counter: 3 });
  mode = 'redirect'; await assert.rejects(readPetState(base));
  mode = 'large'; await assert.rejects(readPetState(base));
  assert.deepEqual(requests, Array(3).fill(['GET', '/dsh-pet-7340/state']));
});
test('host lifecycle releases route on unload and can remount', () => {
  let active = 0; const disposers = [];
  const ctx = { effect(fn) { disposers.push(fn()); }, webServer: { register(route) {
    assert.equal(route.path, '/dsh-pet-hub'); active++; return () => active--;
  } } };
  apply(ctx); assert.equal(active, 1); disposers.pop()(); assert.equal(active, 0);
  apply(ctx); disposers.pop()(); assert.equal(active, 0);
});

test('public page service probes capability, distinguishes first poll and isolates snapshot', async () => {
  const { readPetPageState } = await import('../packages/source-pet/index.mjs');
  const context = api => ({ get(name) { assert.equal(name, 'petApi7340'); return api; } });
  assert.deepEqual(readPetPageState(context(undefined)), { status: 'unsupported' });
  assert.deepEqual(readPetPageState(context({ pose() {}, progress() {} })), { status: 'unsupported' });
  assert.deepEqual(readPetPageState(context({ getState: () => null })), { status: 'pending' });
  const snapshot = Object.freeze({ sections: Object.freeze({ workStatus: Object.freeze({ counter: 7, data: Object.freeze({ state: 'working', task: 'PRIVATE' }) }) }) });
  const result = readPetPageState(context({ getState: () => snapshot }));
  assert.deepEqual(result, { status: 'ready', state: 'working', counter: 7 });
  result.state = 'error';
  assert.equal(snapshot.sections.workStatus.data.state, 'working');
  assert.throws(() => readPetPageState(context({ getState() { throw new Error('service stopped'); } })));
});
