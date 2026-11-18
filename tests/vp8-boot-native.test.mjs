import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {encodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {createVp8BootSerial} from '../packages/runtime/vp8-boot-serial.mjs';
import {encodeVp8BootRequest} from '../packages/runtime/vp8-boot-wire.mjs';
import {mountVp8BootSettings} from '../apps/dsh-plugin/vp8-boot-settings.mjs';

const binding = {allowBinding: true};
const read = encodeVp8BootRequest(encodePbp1Frame({kind: 'binding-info', body: Buffer.alloc(0)}, binding));
const body = Buffer.alloc(84);
body[2] = 7;
body.writeBigUInt64LE(9n, 4);
body.fill(0x11, 12, 28);
const reply = '@VP8_PAIR1 ' + Buffer.from(encodePbp1Frame({kind: 'binding-status', body}, binding)).toString('base64');

test('VP8 USB refuses changed identity or node and closes the exact acquired fd', async () => {
  const identity = '42/12:34:56:78', session = {opens: 0, closes: 0, checked: 0};
  const stat = ino => ({dev: 1n, ino, rdev: 9n, isCharacterDevice: () => true});
  let observed = identity, inode = 5n, pinned = 5n, changeOnOpen = false;
  const make = () => createVp8BootSerial({port: '/dev/cu.usbmodemFixture', usbIdentity: identity, helper: '/unused'},
    {inspect: async () => stat(inode), identify: async () => { session.checked++; return observed; },
      async openTty() {
        session.opens++;
        if (changeOnOpen) observed = '42/99:99:99:99';
        return {stat: () => stat(pinned), close: () => { session.closes++; }, write: assert.fail, read: assert.fail};
      }});
  const open = make();
  observed = '42/33:44:55:66';
  await assert.rejects(open(), {code: 'vp8_serial_identity'});
  assert.equal(session.opens, 0);
  observed = identity;
  changeOnOpen = true;
  await assert.rejects(open(), {code: 'vp8_serial_identity'});
  assert.equal(session.closes, 1);
  changeOnOpen = false;
  observed = identity;
  pinned = 6n;
  await assert.rejects(open(), {code: 'vp8_serial_identity'});
  assert.equal(session.closes, 2);
  pinned = 5n;
  const serial = await open();
  assert.equal(session.checked, 6);
  inode = 6n;
  await assert.rejects(serial.exchange(read), {code: 'vp8_serial_identity'});
  await serial.close();
  assert.equal(session.closes, 3);
  assert.throws(() => createVp8BootSerial({port: '/dev/cu.usbmodemFixture', fixture: true, helper: '/unused'}),
    {code: 'vp8_serial_endpoint'});
});

test('VP8 BOOT text uses actual exclusive PTY with fragmentation, cancellation and fresh reopen', {timeout: 15000}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'vp8-pty-'));
  const tty = join(root, 'tty'), pty = join(root, 'pty');
  const cc = ['-std=c11', '-D_DEFAULT_SOURCE', '-Wall', '-Wextra', '-Werror'];
  const options = {timeout: 10000};
  execFileSync('cc', [...cc, 'native/native400-pbp1-tty.c', '-o', tty], options);
  execFileSync('cc', [...cc, 'tests/fixtures/native400-pbp1-pty.c', '-o', pty,
    ...(process.platform === 'linux' ? ['-lutil'] : [])], options);
  const child = spawn(pty, ['--review'], {stdio: ['pipe', 'pipe', 'inherit']});
  const exited = once(child, 'close');
  let serial;
  t.after(async () => {
    try { await serial?.close(); }
    finally { child.kill(); await exited; rmSync(root, {recursive: true, force: true}); }
  });
  const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]();
  const port = (await lines.next()).value;
  const open = createVp8BootSerial({port, helper: tty, fixture: true, timeoutMs: 2000});
  const contend = createVp8BootSerial({port, helper: tty, fixture: true, timeoutMs: 2000});
  serial = await open();
  await assert.rejects(contend());
  const operation = serial.exchange(read);
  assert.equal((await lines.next()).value + '\n', read);
  child.stdin.write('boot noise\n@VP8_PAIR1 !!\n' + 'x'.repeat(400) + '\n' + reply.slice(0, 19));
  child.stdin.write(reply.slice(19) + '\r\n');
  assert.equal(await operation, reply + '\r\n');
  const ctrl = new AbortController();
  const waiting = serial.exchange(read, {signal: ctrl.signal});
  assert.equal((await lines.next()).value + '\n', read);
  ctrl.abort();
  await assert.rejects(waiting, {name: 'AbortError'});
  await serial.close();
  serial = await contend();
  const fresh = serial.exchange(read);
  assert.equal((await lines.next()).value + '\n', read);
  child.stdin.write(reply + '\n');
  assert.equal(await fresh, reply + '\n');
});

test('BOOT rc.3 Connection uses the upstream internal Request URL with independent admission', async () => {
  const routes = new Map();
  let disposer, approved = false, commands = 0;
  const instanceId = '01234567-0123-0123-0123-0123456789ab';
  const status = () => ({instanceId, revision: '0', phase: 'bound', busy: false, issue: null, deviceChecked: false});
  mountVp8BootSettings({effect: setup => { disposer = setup(); }, connection: {fetch: {
    register: route => { routes.set(route.path, route.fetch); return () => routes.delete(route.path); },
  }}}, {owner: {status, command: input => { commands++; assert.equal(input.operation, 'verify'); return status(); }, close() {}},
    authorize: () => approved, transport: 'desktop-rc3-connection'});
  const path = '/api/pet-hub-vp8-boot/command', send = (host, headers) => routes.get(path)(new Request(host + path,
    {method: 'POST', body: JSON.stringify({operation: 'verify', instanceId, revision: '0'}),
      headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1', ...headers}}));
  assert.equal((await send('http://dsh.internal')).status, 401);
  approved = true;
  assert.equal((await send('dsh-app://app')).status, 404);
  assert.equal((await send('http://dsh.internal', {Origin: 'http://127.0.0.1'})).status, 403);
  assert.equal((await send('http://dsh.internal')).status, 200);
  assert.equal(commands, 1);
  await disposer();
  assert.equal(routes.size, 0);
});
