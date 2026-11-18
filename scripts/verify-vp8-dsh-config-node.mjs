import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {vp8BootReviewDirectory} from '../packages/runtime/vp8-boot-keychain.mjs';

// Run under ELECTRON_RUN_AS_NODE from the installed rc.3 bundle. This does
// not boot a DSH host, use a profile or open any serial port.
const root = vp8BootReviewDirectory(process.argv[2]);
const bundled = 'file:///Applications/DeepSeek%20Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/';
const schema = bundled + 'schemastery/lib/index.mjs';
registerHooks({resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/schemastery') return {url: schema, format: 'module', shortCircuit: true};
  return next(specifier, context);
}});
const {Context} = await import(bundled + 'cordis/lib/index.js');
const {default: manifest} = await import(pathToFileURL(join(root, 'package/package.json')), {with: {type: 'json'}});
const candidate = await import(pathToFileURL(join(root, 'package', manifest.main)));
assert.deepEqual(candidate.Config({}), {enabled: false, enrollmentDirectory: ''});
const ctx = new Context(), routes = new Map();
ctx.provide('profileContext');
ctx.provide('connection');
ctx.set('profileContext', {name: 'desktop'});
ctx.set('connection', {fetch: {register(route) {
  assert.equal(routes.has(route.path), false);
  routes.set(route.path, route.fetch);
  return () => routes.delete(route.path);
}}});
const handle = ctx.plugin(candidate, {});
await handle;
assert.equal(routes.size, 0);
const active = {enabled: true, enrollmentDirectory: root};
const prefix = '/api/pet-hub-vp8-boot/';
const view = async () => (await routes.get(prefix + 'status')(new Request('http://dsh.internal' + prefix + 'status'))).json();
try {
  await handle.update(active);
  const initial = await view();
  assert.equal(initial.usbEnrollment, true);
  assert.equal(initial.phase, 'unregistered');
  await handle.update({enabled: false, enrollmentDirectory: ''});
  assert.equal(routes.size, 0);
  await handle.update(active);
  const next = await view();
  assert.notEqual(next.instanceId, initial.instanceId);
} finally { await handle.dispose(); }
assert.equal(routes.size, 0);
console.log(JSON.stringify({rc3Cordis: true, sameProcess: true, configDefaultOff: true, reenabled: true, disposed: true}));
