import {execFileSync, spawn} from 'node:child_process';
import {createHash, randomBytes, verify} from 'node:crypto';
import {chmodSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createVp8BootKeychain, vp8BootReviewDirectory} from '../packages/runtime/vp8-boot-keychain.mjs';
import {openVp8BootIndex} from '../packages/runtime/vp8-boot-index.mjs';
import {createPbp1BindingVerifier} from '../packages/runtime/native400-pbp1-binding.mjs';
import {identifyVp8OtaUsb} from '../packages/runtime/vp8-ota-usb.mjs';
import {createVp8BootSerial} from '../packages/runtime/vp8-boot-serial.mjs';
import {createVp8BootReviewOwner} from '../apps/dsh-plugin/host-vp8-boot-rc3.mjs';
import {compileVp8BootPeer} from '../tests/fixtures/vp8-boot-cpp.mjs';
import {backupVp8BootDirectory, confirmVp8IndexedSigner, migrateVp8BootDirectory,
  restoreVp8BootDirectory} from './lib/vp8-boot-migration.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const app = '/Applications/DeepSeek Harness.app/Contents';
const cli = join(app, 'Resources/runtime/cli/bin/dsh');
const desktop = join(app, 'MacOS/DeepSeek Harness');
const [action, directory, peerSource, identity, ...extra] = process.argv.slice(2);

function run(command, args, options = {}) {
  return execFileSync(command, args, {cwd: repo, timeout: 60000, ...options});
}

function compile(root) {
  const tty = join(root, 'tty-helper'), keychain = join(root, 'keychain-helper');
  run('/usr/bin/xcrun', ['clang', '-Wall', '-Wextra', '-Werror', '-o', tty, 'native/native400-pbp1-tty.c']);
  run('/usr/bin/xcrun', ['clang', '-fobjc-arc', '-Wall', '-Wextra', '-Werror', '-Wno-deprecated-declarations',
    '-framework', 'Foundation', '-framework', 'Security', '-o', keychain, 'native/vp8-boot-keychain.m']);
  chmodSync(tty, 0o700);
  chmodSync(keychain, 0o700);
}

function prepare() {
  const root = '/private/tmp/vp8-boot-review-' + randomBytes(16).toString('hex');
  mkdirSync(root, {mode: 0o700});
  try {
    for (const filename of ['dsh', 'electron', 'pnpm-store']) mkdirSync(join(root, filename), {mode: 0o700});
    writeFileSync(join(root, 'keychain-unlock'), randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'});
    compile(root);
    openVp8BootIndex({directory: root, create: true}).close();
    run(process.execPath, ['scripts/build-vp8-boot-rc3.mjs', root]);
    console.log(root);
  } catch (error) {
    rmSync(root, {recursive: true, force: true});
    throw error;
  }
}

async function fixture(root, firmware, usbEnrollment) {
  const tty = join(root, 'fixture-pty'), config = join(root, 'review-peer.json');
  run('/usr/bin/xcrun', ['clang', '-Wall', '-Wextra', '-Werror', '-o', tty, 'tests/fixtures/native400-pbp1-pty.c']);
  const cpp = compileVp8BootPeer(resolve(firmware), root, join(repo, 'tests/fixtures/vp8-boot-proof-peer.cpp'), 'fixture-peer');
  const pty = spawn(tty, ['--review'], {stdio: ['pipe', 'pipe', 'inherit']});
  const peer = spawn(cpp, ['--p256', ...(usbEnrollment ? ['--usb'] : [])], {stdio: ['pipe', 'pipe', 'inherit']});
  const drained = Promise.allSettled([once(pty, 'close'), once(peer, 'close')]);
  const hostLines = createInterface({input: pty.stdout})[Symbol.asyncIterator]();
  const peerLines = createInterface({input: peer.stdout})[Symbol.asyncIterator]();
  const stop = () => { pty.kill(); peer.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let configured = false;
  try {
    const port = (await hostLines.next()).value;
    if (!/^\/dev\/ttys[0-9]{3,4}$/.test(port ?? '')) throw Error('vp8_fixture_pty');
    writeFileSync(config, JSON.stringify({schema: 1, mode: 'pty', port}), {mode: 0o600, flag: 'wx'});
    configured = true;
    console.log('fixture ready');
    // The fixture keeps the master alive across separate slave connections.
    for await (const line of {[Symbol.asyncIterator]: () => hostLines}) {
      if (!line.startsWith('VP8PAIR1 ')) continue;
      const packet = Buffer.from(line.slice(9), 'base64'), type = packet[5];
      if (![6, 7, 8, 10].includes(type)) throw Error('vp8_fixture_request');
      if (usbEnrollment && ((type === 7 && packet[16] !== 3) || (type === 10 && packet[16] !== 1)))
        throw Error('vp8_fixture_request');
      console.log('fixture request ' + type);
      peer.stdin.write(line + '\n');
      const {done, value} = await peerLines.next();
      if (done) throw Error('vp8_fixture_peer');
      if (value !== '-') pty.stdin.write(value + '\n');
      if (type === 8 && !usbEnrollment)
        peer.stdin.write('#tick 100000 1 0\n#tick 150000 1 0\n#tick 200000 1 1\n#tick 250000 1 1\n#tick 300000 1 0\n#tick 350000 1 0\n');
    }
  } finally {
    stop();
    await drained;
    if (configured) rmSync(config);
  }
}

async function exercise(root, firmware, usbEnrollment) {
  const plugin = join(root, 'package/apps/dsh-plugin');
  const {createVp8BootReviewOwner} = await import(pathToFileURL(join(plugin, 'host-vp8-boot-rc3.mjs')));
  const {mountVp8BootSettings} = await import(pathToFileURL(join(plugin, 'vp8-boot-settings.mjs')));
  const index = openVp8BootIndex({directory: root});
  try { if (index.read().record !== null) throw Error('vp8_review_fixture_index'); }
  finally { index.close(); }
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), usbEnrollment ? 'fixture-usb' : 'fixture', root, firmware],
    {stdio: ['ignore', 'pipe', 'inherit']});
  const exited = once(child, 'close');
  const typeLog = [], ready = Promise.withResolvers();
  const lines = createInterface({input: child.stdout});
  lines.on('line', line => {
    if (line === 'fixture ready') ready.resolve();
    const traffic = /^fixture request (\d+)$/.exec(line);
    if (traffic) typeLog.push(Number(traffic[1]));
  });
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let dispose;
  const expect = (condition, code) => { if (!condition) throw Error(code); };
  try {
    const deadline = new AbortController();
    try {
      await Promise.race([ready.promise, exited.then(() => { throw Error('vp8_review_fixture_exit'); }),
        delay(15000, undefined, {signal: deadline.signal}).then(() => { throw Error('vp8_review_fixture_timeout'); })]);
    } finally { deadline.abort(); }
    const routes = new Map(), prefix = '/api/pet-hub-vp8-boot/';
    let authorized = false;
    function mount() {
      mountVp8BootSettings({effect: setup => { dispose = setup(); }, connection: {fetch: {
        register(route) { routes.set(route.path, route.fetch); return () => routes.delete(route.path); },
      }}}, {owner: createVp8BootReviewOwner(root, {usbEnrollment}), transport: 'desktop-rc3-connection',
        authorize: () => authorized, usbEnrollment});
    }
    async function request(path, body, expected = 200) {
      const url = prefix + path;
      const response = await routes.get(url)(new Request('http://dsh.internal' + url, {
        ...(body ? {method: 'POST', body: JSON.stringify(body),
          headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {}),
      }));
      expect(response.status === expected, 'vp8_review_fixture_route');
      return response.json();
    }
    const command = (operation, {instanceId, revision}) => request('command', {operation, instanceId, revision});
    async function idle() {
      const stopAt = performance.now() + 14000;
      do {
        const status = await request('status');
        if (!status.busy) return status;
        await delay(25);
      } while (performance.now() < stopAt);
      throw Error('vp8_review_fixture_timeout');
    }
    mount();
    await request('status', undefined, 401);
    authorized = true;
    const initial = await request('status');
    expect(initial.phase === 'unregistered' && typeLog.length === 0, 'vp8_review_fixture_initial');
    expect((initial.usbEnrollment === true) === usbEnrollment, 'vp8_review_fixture_initial');
    if (usbEnrollment)
      await request('command', {operation: 'enroll', instanceId: initial.instanceId, revision: initial.revision}, 400);
    await command(usbEnrollment ? 'enroll-usb' : 'enroll', initial);
    expect((await idle()).phase === 'bound', 'vp8_review_fixture_binding');
    expect(typeLog.slice(0, 3).join() === '6,7,8' && typeLog.slice(3).every(type => type === 10) && typeLog.length > 3,
      'vp8_review_fixture_traffic');
    if (usbEnrollment) expect(typeLog.length === 4, 'vp8_review_fixture_traffic');
    const enrollment = typeLog.slice();
    await dispose();
    expect(routes.size === 0, 'vp8_review_fixture_dispose');
    mount();
    const reopened = await request('status');
    expect(reopened.phase === 'bound' && !reopened.deviceChecked && reopened.instanceId !== initial.instanceId,
      'vp8_review_fixture_reopen');
    await command('verify', reopened);
    expect((await idle()).deviceChecked, 'vp8_review_fixture_verification');
    const verification = typeLog.slice(enrollment.length);
    expect(verification.join() === '6,10', 'vp8_review_fixture_traffic');
    await dispose();
    dispose = undefined;
    expect(routes.size === 0, 'vp8_review_fixture_dispose');
    console.log(JSON.stringify({authenticated: true, ...(usbEnrollment ? {challengeOperation: 3, bootTicks: 0} : {}),
      enroll: enrollment, reopenCheckedBeforeVerify: false,
      verify: verification, localIndex: 'bound', routesReleased: true}));
  } finally {
    try { await dispose?.(); }
    finally { stop(); await exited; lines.close(); }
  }
}

async function deviceCommand(root, operation) {
  const owner = createVp8BootReviewOwner(root, {usbEnrollment: operation === 'enroll-usb'});
  let stopped = false, previous;
  const stop = () => { stopped = true; void owner.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const {instanceId, revision} = owner.status();
    owner.command({operation, instanceId, revision});
    for (;;) {
      const {phase, busy, issue, deviceChecked} = owner.status();
      const message = JSON.stringify({phase, busy, issue, deviceChecked});
      if (message !== previous) console.log(message);
      previous = message;
      if (!busy) {
        const completed = operation === 'verify' ? deviceChecked :
          operation === 'recover' ? ['unregistered', 'bound'].includes(phase) : phase === 'bound';
        if (stopped || issue !== null || !completed) process.exitCode = 1;
        return;
      }
      await delay(100);
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await owner.close();
  }
}

function desktopEnv(root) {
  const version = run('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleShortVersionString', join(app, 'Info.plist')],
    {encoding: 'utf8'}).trim();
  if (version !== '0.2.2-rc.3') throw Error('vp8_review_host_version');
  return {...process.env, DSH_HOME: join(root, 'dsh'), DSH_PET_HUB_BOOT_REVIEW: root,
    DSH_DESKTOP_DIAGNOSTIC_FILE: join(root, 'desktop-error.txt'),
    npm_config_store_dir: join(root, 'pnpm-store'), npm_config_ignore_scripts: 'true'};
}

async function main() {
  if (process.platform !== 'darwin' || extra.length) throw Error('vp8_review_arguments');
  if (action === 'prepare' && !directory) return prepare();
  if (action === 'config-disable' && !directory) {
    console.log('- id: dsh-pet-hub-boot-review\n  config:\n    enabled: false\n    enrollmentDirectory: ""');
    return;
  }
  if (action === 'restore' && !peerSource) {
    console.log(await restoreVp8BootDirectory(directory));
    return;
  }
  const root = vp8BootReviewDirectory(directory);
  if (action === 'select-usb') {
    const port = peerSource;
    createVp8BootSerial({port, usbIdentity: identity, helper: join(root, 'tty-helper')});
    if (await identifyVp8OtaUsb(port) !== identity) throw Error('vp8_serial_identity');
    writeFileSync(join(root, 'review-peer.json'), JSON.stringify({schema: 1, mode: 'usb', port, usbIdentity: identity}),
      {mode: 0o600, flag: 'wx'});
    console.log('explicit USB identity recorded; port unopened');
    return;
  }
  if (identity) throw Error('vp8_review_arguments');
  if (['fixture', 'fixture-usb'].includes(action) && peerSource) return fixture(root, peerSource, action === 'fixture-usb');
  if (['exercise', 'exercise-usb'].includes(action) && peerSource) return exercise(root, peerSource, action === 'exercise-usb');
  if (peerSource) throw Error('vp8_review_arguments');
  if (action === 'config-enable') {
    openVp8BootIndex({directory: root}).close();
    console.log('- id: dsh-pet-hub-boot-review\n  config:\n    enabled: true\n    enrollmentDirectory: ' + JSON.stringify(root));
    return;
  }
  if (action === 'migrate') {
    console.log(await migrateVp8BootDirectory(root));
    return;
  }
  if (action === 'backup') {
    console.log(await backupVp8BootDirectory(root));
    return;
  }
  if (action === 'keychain-verify') {
    const store = openVp8BootIndex({directory: root});
    try {
      const state = store.read();
      if (state.record?.phase !== 'bound') throw Error('vp8_migration_record');
      await confirmVp8IndexedSigner(root, state.record);
      console.log('indexed P-256 signature verified');
    } finally { store.close(); }
    return;
  }
  if (['enroll', 'enroll-usb', 'verify', 'recover'].includes(action)) return deviceCommand(root, action);
  const keys = createVp8BootKeychain(root);
  if (action === 'init-keychain') { await keys.init(); console.log('keychain initialized'); return; }
  if (action === 'keychain-smoke') {
    const key = await keys.prepare({device: 'ff'.repeat(16)});
    const reopened = await createVp8BootKeychain(root).lookup(key.ref);
    const data = Buffer.from('dsh-pet-hub VP8 review key health');
    if (!reopened?.publicKey.equals(key.publicKey) || !verify('sha256', data,
      {key: createPbp1BindingVerifier(key.publicKey), dsaEncoding: 'ieee-p1363'}, await reopened.signTranscript(data)))
      throw Error('vp8_keychain_smoke');
    console.log('keychain persistent P-256 ok');
    return;
  }
  if (action === 'health') {
    const store = openVp8BootIndex({directory: root});
    try {
      const state = store.read();
      await keys.health();
      const key = state.record ? await keys.lookup(state.record.keyRef) : null;
      const indexedKeyMatches = state.record ? Boolean(key && createHash('sha256').update(key.publicKey).digest('hex') ===
        state.record.target.keySha256) : null;
      console.log(JSON.stringify({healthy: indexedKeyMatches !== false, phase: state.record?.phase ?? 'unregistered',
        keychain: 'ready', indexedKeyMatches, deviceChecked: false}));
      if (indexedKeyMatches === false) process.exitCode = 1;
    } finally { store.close(); }
    return;
  }
  if (action === 'install') {
    run(cli, ['plugin', '--profile', 'desktop', 'add', 'file:' + join(root, 'package'), '--ignore-scripts',
      '--store-dir', join(root, 'pnpm-store')],
      {env: desktopEnv(root), stdio: 'inherit'});
    return;
  }
  if (action === 'launch') {
    await keys.health();
    const args = ['--user-data-dir=' + join(root, 'electron')];
    if (process.env.VP8_REVIEW_DEVTOOLS === '1') args.push('--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0');
    const child = spawn(desktop, args, {cwd: root, env: desktopEnv(root), stdio: 'inherit'});
    const stop = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const [code] = await once(child, 'exit');
    if (code !== 0 && code !== null) process.exitCode = 1;
    return;
  }
  throw Error('vp8_review_arguments');
}

try { await main(); }
catch (error) {
  console.error('VP8 BOOT review: ' + (/^vp8_[a-z_]+$/.test(error.code ?? '') ? error.code :
    /^vp8_[a-z_]+$/.test(error.message) ? error.message : 'operation_failed'));
  process.exitCode = 1;
}
