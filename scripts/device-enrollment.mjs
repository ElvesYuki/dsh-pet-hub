import {execFileSync, spawn} from 'node:child_process';
import {createHash, randomBytes, verify} from 'node:crypto';
import {chmodSync, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createBootKeychain, enrollmentDirectory, enrollmentRoot} from '../packages/runtime/device-keychain.mjs';
import {openDeviceBindingIndex} from '../packages/runtime/device-binding-index.mjs';
import {createPbp1BindingVerifier} from '../packages/runtime/native400-pbp1-binding.mjs';
import {identifyMaintenanceUsb} from '../packages/runtime/device-maintenance-usb.mjs';
import {createBootSerial} from '../packages/runtime/device-enrollment-serial.mjs';
import {createDeviceEnrollmentOwner, openUsbEnrollment} from '../apps/dsh-plugin/enrollment-host.mjs';
import {rotateDeviceBinding} from '../packages/runtime/device-key-rotation.mjs';
import {same} from '../packages/core/protocol.mjs';
import {compileBootPeer} from '../tests/fixtures/device-enrollment-cpp.mjs';
import {backupBootDirectory, confirmIndexedSigner, migrateBootDirectory,
  restoreBootDirectory} from './lib/device-enrollment-migration.mjs';

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
  run('/usr/bin/xcrun', ['clang', '-Wall', '-Wextra', '-Werror', '-o', tty, 'native/exclusive-tty.c']);
  run('/usr/bin/xcrun', ['clang', '-fobjc-arc', '-Wall', '-Wextra', '-Werror', '-Wno-deprecated-declarations',
    '-framework', 'Foundation', '-framework', 'Security', '-o', keychain, 'native/device-keychain.m']);
  chmodSync(tty, 0o700);
  chmodSync(keychain, 0o700);
}

function prepare() {
  const root = '/private/tmp/device-enrollment-' + randomBytes(16).toString('hex');
  mkdirSync(root, {mode: 0o700});
  try {
    for (const filename of ['dsh', 'electron', 'pnpm-store']) mkdirSync(join(root, filename), {mode: 0o700});
    writeFileSync(join(root, 'keychain-unlock'), randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'});
    compile(root);
    openDeviceBindingIndex({directory: root, create: true}).close();
    run(process.execPath, ['scripts/build-enrollment-plugin.mjs', root]);
    console.log(root);
  } catch (error) {
    rmSync(root, {recursive: true, force: true});
    throw error;
  }
}

async function prepareSigner() {
  const parent = enrollmentRoot();
  try { mkdirSync(parent, {mode: 0o700}); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = lstatSync(parent);
  if (realpathSync(parent) !== parent || !stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700)
    throw Error('device_review_directory');
  const root = join(parent, 'device-enrollment-' + randomBytes(16).toString('hex'));
  mkdirSync(root, {mode: 0o700});
  try {
    writeFileSync(join(root, 'keychain-unlock'), randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'});
    compile(root);
    openDeviceBindingIndex({directory: root, create: true}).close();
    await createBootKeychain(root).init();
    console.log(root);
  } catch (error) { rmSync(root, {recursive: true, force: true}); throw error; }
}

async function rotateSigner(sourceRoot, destinationDirectory) {
  const root = enrollmentDirectory(destinationDirectory);
  if (root === sourceRoot || dirname(root) !== enrollmentRoot()) throw Error('device_key_rotation_destination');
  const {peer, openSession} = openUsbEnrollment(sourceRoot);
  const source = openDeviceBindingIndex({directory: sourceRoot});
  let destination;
  try {
    destination = openDeviceBindingIndex({directory: root});
    const oldKeys = createBootKeychain(sourceRoot), newKeys = createBootKeychain(root);
    await newKeys.health();
    const path = join(root, 'review-peer.json');
    let fd;
    try { fd = openSync(path, 'wx', 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (fd !== undefined) {
      try { writeFileSync(fd, JSON.stringify(peer)); fsyncSync(fd); }
      finally { closeSync(fd); }
    }
    if (!same(openUsbEnrollment(root).peer, peer)) throw Error('device_key_rotation_usb');
    await rotateDeviceBinding({source, destination, oldKeys, newKeys, openSession});
    console.log('New signer and device binding verified. Existing Hub configuration is unchanged.');
  } finally { destination?.close(); source.close(); }
}

async function fixture(root, firmware, usbEnrollment) {
  const tty = join(root, 'fixture-pty'), config = join(root, 'review-peer.json');
  run('/usr/bin/xcrun', ['clang', '-Wall', '-Wextra', '-Werror', '-o', tty, 'tests/fixtures/native400-pbp1-pty.c']);
  const cpp = compileBootPeer(resolve(firmware), root, join(repo, 'tests/fixtures/device-binding-proof-peer.cpp'), 'fixture-peer');
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
    if (!/^\/dev\/ttys[0-9]{3,4}$/.test(port ?? '')) throw Error('device_fixture_pty');
    writeFileSync(config, JSON.stringify({schema: 1, mode: 'pty', port}), {mode: 0o600, flag: 'wx'});
    configured = true;
    console.log('fixture ready');
    // The fixture keeps the master alive across separate slave connections.
    for await (const line of {[Symbol.asyncIterator]: () => hostLines}) {
      if (!line.startsWith('VP8PAIR1 ')) continue;
      const packet = Buffer.from(line.slice(9), 'base64'), type = packet[5];
      if (![6, 7, 8, 10].includes(type)) throw Error('device_fixture_request');
      if (usbEnrollment && ((type === 7 && packet[16] !== 3) || (type === 10 && packet[16] !== 1)))
        throw Error('device_fixture_request');
      console.log('fixture request ' + type);
      peer.stdin.write(line + '\n');
      const {done, value} = await peerLines.next();
      if (done) throw Error('device_fixture_peer');
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
  const {createDeviceEnrollmentOwner} = await import(pathToFileURL(join(plugin, 'enrollment-host.mjs')));
  const {mountEnrollmentSettings} = await import(pathToFileURL(join(plugin, 'enrollment-routes.mjs')));
  const index = openDeviceBindingIndex({directory: root});
  try { if (index.read().record !== null) throw Error('device_review_fixture_index'); }
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
      await Promise.race([ready.promise, exited.then(() => { throw Error('device_review_fixture_exit'); }),
        delay(15000, undefined, {signal: deadline.signal}).then(() => { throw Error('device_review_fixture_timeout'); })]);
    } finally { deadline.abort(); }
    const routes = new Map(), prefix = '/api/pet-hub-enrollment/';
    let authorized = false;
    function mount() {
      mountEnrollmentSettings({effect: setup => { dispose = setup(); }, connection: {fetch: {
        register(route) { routes.set(route.path, route.fetch); return () => routes.delete(route.path); },
      }}}, {owner: createDeviceEnrollmentOwner(root, {usbEnrollment}), transport: 'desktop-rc3-connection',
        authorize: () => authorized, usbEnrollment});
    }
    async function request(path, body, expected = 200) {
      const url = prefix + path;
      const response = await routes.get(url)(new Request('http://dsh.internal' + url, {
        ...(body ? {method: 'POST', body: JSON.stringify(body),
          headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {}),
      }));
      expect(response.status === expected, 'device_review_fixture_route');
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
      throw Error('device_review_fixture_timeout');
    }
    mount();
    await request('status', undefined, 401);
    authorized = true;
    const initial = await request('status');
    expect(initial.phase === 'unregistered' && typeLog.length === 0, 'device_review_fixture_initial');
    expect((initial.usbEnrollment === true) === usbEnrollment, 'device_review_fixture_initial');
    if (usbEnrollment)
      await request('command', {operation: 'enroll', instanceId: initial.instanceId, revision: initial.revision}, 400);
    await command(usbEnrollment ? 'enroll-usb' : 'enroll', initial);
    expect((await idle()).phase === 'bound', 'device_review_fixture_binding');
    expect(typeLog.slice(0, 3).join() === '6,7,8' && typeLog.slice(3).every(type => type === 10) && typeLog.length > 3,
      'device_review_fixture_traffic');
    if (usbEnrollment) expect(typeLog.length === 4, 'device_review_fixture_traffic');
    const enrollment = typeLog.slice();
    await dispose();
    expect(routes.size === 0, 'device_review_fixture_dispose');
    mount();
    const reopened = await request('status');
    expect(reopened.phase === 'bound' && !reopened.deviceChecked && reopened.instanceId !== initial.instanceId,
      'device_review_fixture_reopen');
    await command('verify', reopened);
    expect((await idle()).deviceChecked, 'device_review_fixture_verification');
    const verification = typeLog.slice(enrollment.length);
    expect(verification.join() === '6,10', 'device_review_fixture_traffic');
    await dispose();
    dispose = undefined;
    expect(routes.size === 0, 'device_review_fixture_dispose');
    console.log(JSON.stringify({authenticated: true, ...(usbEnrollment ? {challengeOperation: 3, bootTicks: 0} : {}),
      enroll: enrollment, reopenCheckedBeforeVerify: false,
      verify: verification, localIndex: 'bound', routesReleased: true}));
  } finally {
    try { await dispose?.(); }
    finally { stop(); await exited; lines.close(); }
  }
}

async function deviceCommand(root, operation) {
  const owner = createDeviceEnrollmentOwner(root, {usbEnrollment: operation === 'enroll-usb'});
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
  if (version !== '0.2.2-rc.3') throw Error('device_review_host_version');
  return {...process.env, DSH_HOME: join(root, 'dsh'), DSH_PET_HUB_BOOT_REVIEW: root,
    DSH_DESKTOP_DIAGNOSTIC_FILE: join(root, 'desktop-error.txt'),
    npm_config_store_dir: join(root, 'pnpm-store'), npm_config_ignore_scripts: 'true'};
}

async function main() {
  if (process.platform !== 'darwin' || extra.length) throw Error('device_review_arguments');
  if (action === 'prepare' && !directory) return prepare();
  if (action === 'prepare-signer' && !directory) return prepareSigner();
  if (action === 'config-disable' && !directory) {
    console.log('- id: dsh-pet-hub-boot-review\n  config:\n    enabled: false\n    enrollmentDirectory: ""');
    return;
  }
  if (action === 'restore' && !peerSource) {
    console.log(await restoreBootDirectory(directory));
    return;
  }
  const root = enrollmentDirectory(directory);
  if (action === 'select-usb') {
    const port = peerSource;
    createBootSerial({port, usbIdentity: identity, helper: join(root, 'tty-helper')});
    if (await identifyMaintenanceUsb(port) !== identity) throw Error('device_serial_identity');
    writeFileSync(join(root, 'review-peer.json'), JSON.stringify({schema: 1, mode: 'usb', port, usbIdentity: identity}),
      {mode: 0o600, flag: 'wx'});
    console.log('explicit USB identity recorded; port unopened');
    return;
  }
  if (identity) throw Error('device_review_arguments');
  if (action === 'rotate-key' && peerSource) return rotateSigner(root, peerSource);
  if (['fixture', 'fixture-usb'].includes(action) && peerSource) return fixture(root, peerSource, action === 'fixture-usb');
  if (['exercise', 'exercise-usb'].includes(action) && peerSource) return exercise(root, peerSource, action === 'exercise-usb');
  if (peerSource) throw Error('device_review_arguments');
  if (action === 'discovery-disable') {
    const owner = createDeviceEnrollmentOwner(root, {usbEnrollment: true, sharedUsb: true, lanCandidate: true, lanDiscovery: true});
    try {
      const {instanceId, revision} = owner.status();
      const result = await owner.lanDisableDiscovery({instanceId, revision});
      if (result.status !== 'ok') throw Error('device_lan_discovery_disable_unconfirmed');
      console.log('Device LAN discovery disabled');
    } finally { await owner.close(); }
    return;
  }
  if (action === 'config-enable') {
    openDeviceBindingIndex({directory: root}).close();
    console.log('- id: dsh-pet-hub-boot-review\n  config:\n    enabled: true\n    enrollmentDirectory: ' + JSON.stringify(root));
    return;
  }
  if (action === 'migrate') {
    console.log(await migrateBootDirectory(root));
    return;
  }
  if (action === 'backup') {
    console.log(await backupBootDirectory(root));
    return;
  }
  if (action === 'keychain-verify') {
    const store = openDeviceBindingIndex({directory: root});
    try {
      const state = store.read();
      if (state.record?.phase !== 'bound') throw Error('device_migration_record');
      await confirmIndexedSigner(root, state.record);
      console.log('indexed P-256 signature verified');
    } finally { store.close(); }
    return;
  }
  if (['enroll', 'enroll-usb', 'verify', 'recover'].includes(action)) return deviceCommand(root, action);
  const keys = createBootKeychain(root);
  if (action === 'init-keychain') { await keys.init(); console.log('keychain initialized'); return; }
  if (action === 'keychain-smoke') {
    const key = await keys.prepare({device: 'ff'.repeat(16)});
    const reopened = await createBootKeychain(root).lookup(key.ref);
    const data = Buffer.from('dsh-pet-hub enrollment key health');
    if (!reopened?.publicKey.equals(key.publicKey) || !verify('sha256', data,
      {key: createPbp1BindingVerifier(key.publicKey), dsaEncoding: 'ieee-p1363'}, await reopened.signTranscript(data)))
      throw Error('device_keychain_smoke');
    console.log('keychain persistent P-256 ok');
    return;
  }
  if (action === 'health') {
    const store = openDeviceBindingIndex({directory: root});
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
    if (process.env.ENROLLMENT_REVIEW_DEVTOOLS === '1') args.push('--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0');
    const child = spawn(desktop, args, {cwd: root, env: desktopEnv(root), stdio: 'inherit'});
    const stop = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const [code] = await once(child, 'exit');
    if (code !== 0 && code !== null) process.exitCode = 1;
    return;
  }
  throw Error('device_review_arguments');
}

try { await main(); }
catch (error) {
  console.error('Device enrollment: ' + (/^device_[a-z_]+$/.test(error.code ?? '') ? error.code :
    /^device_[a-z_]+$/.test(error.message) ? error.message : 'operation_failed'));
  process.exitCode = 1;
}
