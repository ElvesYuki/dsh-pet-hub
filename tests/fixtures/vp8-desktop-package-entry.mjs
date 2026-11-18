import assert from 'node:assert/strict';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const [root, mode, rc3Bundle] = process.argv.slice(2);
assert.ok(['combined', 'ordinary'].includes(mode));
const stubSchema = 'data:text/javascript,' + encodeURIComponent(
  'const field = () => ({default: field, description: field}); export default {object: value => value, string: field, boolean: field};');
const schema = rc3Bundle ? new URL('schemastery/lib/index.mjs', rc3Bundle).href : stubSchema;
registerHooks({resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/schemastery') return {url: schema, format: 'module', shortCircuit: true};
  return next(specifier, context);
}});

// Resolve the exact package entry the host uses, without naming an implementation file.
const candidate = await import('dsh-pet-hub');
const {default: manifest} = await import('dsh-pet-hub/package.json', {with: {type: 'json'}});
assert.equal(import.meta.resolve('dsh-pet-hub'), new URL(manifest.main, import.meta.url).href);
if (!rc3Bundle) Object.defineProperty(process.versions, 'electron', {value: 'fixture', configurable: true});

const runtimeDirectory = join(root, 'ipc'), routes = new Map(), cleanup = [];
mkdirSync(root, {mode: 0o700});
writeFileSync(join(root, 'query.json'), JSON.stringify({schema: 1, port: '/dev/cu.usbmodemPACKAGEFIXTURE',
  usbIdentity: '1/f0f1f2f3', operatorToken: 'a'.repeat(64)}), {mode: 0o600});
const profileContext = {name: 'desktop'};
const connection = {fetch: {register(route) {
  assert.equal(routes.has(route.path), false);
  routes.set(route.path, route.fetch);
  return () => routes.delete(route.path);
}}};
const webServer = {register: () => () => {}};
const config = {runtimeDirectory, vp8DesktopQuery: true, vp8DesktopManaged: true, vp8DesktopNoCode: true, vp8UpdateOrigin: ''};

let dispose;
if (rc3Bundle) {
  assert.ok(process.versions.electron);
  const {Context} = await import(new URL('cordis/lib/index.js', rc3Bundle).href);
  const ctx = new Context();
  for (const [key, value] of Object.entries({profileContext, connection, webServer})) {
    ctx.provide(key);
    ctx.set(key, value);
  }
  const handle = ctx.plugin(candidate, config);
  dispose = () => handle.dispose();
  await handle;
} else {
  candidate.apply({get: key => key === 'profileContext' ? profileContext : undefined,
    effect: setup => cleanup.push(setup()), connection, webServer}, config);
  dispose = async () => { for (const release of cleanup.reverse()) await release(); };
}

const path = suffix => '/api/pet-hub-vp8-local/' + suffix;
function request(suffix, body) {
  const route = routes.get(path(suffix));
  assert.ok(route);
  return route(new Request('http://dsh.internal' + path(suffix), body ? {method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}, body: JSON.stringify(body)} : {}));
}
try {
  let response = await request('status');
  for (let waits = 0; response.status === 409 && waits < 100; waits++) {
    await response.body.cancel();
    await delay(15);
    response = await request('status');
  }
  assert.equal(response.status, 200);
  assert.equal(existsSync(join(runtimeDirectory, 'hub.sock')), true);
  const {instanceId, update} = await response.json();
  assert.equal(update.queryOnly, true);
  assert.equal(update.phase, 'idle');
  assert.equal(update.device, null);
  assert.equal(update.batteryAvailable, mode === 'combined' ? true : undefined);
  assert.equal(routes.has(path('battery')), mode === 'combined');
  if (mode === 'combined') {
    const input = {instanceId, requestId: 'f'.repeat(32)};
    // Cancel before submitting the matching sample. This exercises dispatch and ownership without USB.
    for (const operation of ['cancel', 'sample']) {
      const result = await request('battery', {...input, operation});
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), {status: 'cancelled'});
    }
  }
} finally { await dispose(); }
assert.equal(routes.size, 0);
assert.equal(existsSync(join(runtimeDirectory, 'hub.sock')), false);
console.log(JSON.stringify({mode, packageEntry: true, liveStatus: true, batteryRoute: mode === 'combined',
  socketsReleased: true, rc3Cordis: Boolean(rc3Bundle)}));
