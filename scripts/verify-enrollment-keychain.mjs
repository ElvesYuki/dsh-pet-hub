import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash, randomBytes, verify} from 'node:crypto';
import {chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, renameSync, rmSync, rmdirSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPbp1BindingVerifier} from '../packages/runtime/native400-pbp1-binding.mjs';
import {createBootKeychain, enrollmentRoot} from '../packages/runtime/device-keychain.mjs';
import {openDeviceBindingIndex} from '../packages/runtime/device-binding-index.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const cli = join(repo, 'scripts/device-enrollment.mjs');
const run = (...args) => execFileSync(process.execPath, [cli, ...args], {
  cwd: repo, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const tool = (command, ...args) => execFileSync(command, args, {cwd: repo, timeout: 20000});
const verified = 'indexed P-256 signature verified';
const parent = enrollmentRoot();
const parentAlreadyExisted = existsSync(parent);

function build(output, source, objc = []) {
  tool('/usr/bin/xcrun', 'clang', '-Wall', '-Wextra', '-Werror', ...objc, '-o', output, source);
  chmodSync(output, 0o700);
}

function buildKeychain(output, source) {
  build(output, source, ['-fobjc-arc', '-Wno-deprecated-declarations', '-framework', 'Foundation',
    '-framework', 'Security']);
}

function sign(helper, root, key) {
  const input = randomBytes(64), fd = openSync(join(root, 'keychain-unlock'), 'r');
  try {
    const result = spawnSync(helper, ['sign', join(root, 'enrollment.keychain-db'), key.ref],
      {input, stdio: ['pipe', 'pipe', 'pipe', fd], env: {PATH: '/usr/bin:/bin'}, timeout: 5000});
    if (result.error) throw result.error;
    assert.ok(Number.isInteger(result.status));
    const securityStatus = /^security-status:(-?\d+)\s*$/.exec(result.stderr.toString())?.[1];
    if (result.status === 0) {
      assert.equal(verify('sha256', input, createPbp1BindingVerifier(key.publicKey), result.stdout), true);
    } else assert.equal(result.stdout.length, 0);
    return {exit: result.status, osStatus: securityStatus ? Number(securityStatus) : null};
  } finally { closeSync(fd); }
}

const failed = (work, pattern) => assert.throws(work, error =>
  error.status === 1 && pattern.test(error.stderr ?? ''));
function assertDenied({exit, osStatus}) {
  assert.equal(exit, 3);
  assert.ok([-25293, -25308].includes(osStatus), `unexpected Security.framework status ${osStatus}`);
}

async function exercise(work, legacyPathOnly) {
  const scope = randomBytes(16).toString('hex');
  const source = join('/private/tmp', 'device-enrollment-' + scope);
  const destination = join(parent, basename(source)), backup = join(parent, 'device-enrollment-backup-' + scope);
  const parked = join(work, basename(source));
  const original = join(source, 'keychain-helper'), other = join(work, 'replacement-helper');
  assert.equal(existsSync(destination) || existsSync(backup), false);
  mkdirSync(source, {mode: 0o700});
  try {
    const sourceText = readFileSync(join(repo, 'native/device-keychain.m'), 'utf8');
    const legacy = join(work, 'legacy.m'), replacement = join(work, 'replacement.m');
    const oldSource = legacyPathOnly ? sourceText.replace(/static bool allowed_parent\([^]*?\n}/,
      'static bool allowed_parent(NSString *path, bool init) {\n  (void)init;\n  return [path isEqualToString:@"/private/tmp"];\n}') : sourceText;
    if (legacyPathOnly) assert.notEqual(oldSource, sourceText);
    writeFileSync(legacy, oldSource, {mode: 0o600});
    writeFileSync(replacement, sourceText + '\nint device_fixture_replacement_build(void) { return 1; }\n', {mode: 0o600});
    buildKeychain(original, legacy);
    buildKeychain(other, replacement);
    const originalHelper = readFileSync(original);
    assert.notDeepEqual(originalHelper, readFileSync(other));
    build(join(source, 'tty-helper'), 'native/exclusive-tty.c');
    writeFileSync(join(source, 'keychain-unlock'), randomBytes(32).toString('hex'), {mode: 0o600, flag: 'wx'});
    run('init-keychain', source);
    const device = 'f1'.repeat(16), key = await createBootKeychain(source).prepare({device});
    const index = openDeviceBindingIndex({directory: source, create: true});
    try {
      index.commit('0', {phase: 'bound', keyRef: key.ref,
        target: {device, controller: 'f2'.repeat(16), binding: 'f3'.repeat(16), epoch: '1',
          keySha256: createHash('sha256').update(key.publicKey).digest('hex')}});
    } finally { index.close(); }
    const indexedBytes = readFileSync(join(source, 'device-binding.json'));
    const assertContinuity = async directory => {
      assert.equal(run('keychain-verify', directory), verified);
      assert.deepEqual(readFileSync(join(directory, 'device-binding.json')), indexedBytes);
      assert.deepEqual(readFileSync(join(directory, 'keychain-helper')), originalHelper);
      const found = await createBootKeychain(directory).lookup(key.ref);
      assert.equal(found.ref, key.ref);
      assert.deepEqual(found.publicKey, key.publicKey);
    };
    await assertContinuity(source);
    const replacementAtSource = sign(other, source, key);
    assertDenied(replacementAtSource);

    const lock = join(source, 'keychain.write.lock');
    writeFileSync(lock, 'fixture-owner', {mode: 0o600, flag: 'wx'});
    failed(() => run('migrate', source), /device_migration_locked/);
    assert.equal(existsSync(destination), false);
    assert.equal(readFileSync(lock, 'utf8'), 'fixture-owner');
    assert.equal(existsSync(join(source, 'device-binding.write.lock')), false);
    rmSync(lock);

    if (!legacyPathOnly) {
      assert.equal(run('migrate', source), destination);
      await assertContinuity(destination);
      const replacementAtDestination = sign(other, destination, key);
      assertDenied(replacementAtDestination);
      failed(() => run('migrate', source), /device_migration_destination_exists/);
      await assertContinuity(destination);
      await assertContinuity(source);
      return {replacementAtSource, replacementAtDestination, movedOriginalSigner: true};
    }

    assert.equal(run('backup', source), backup);
    assert.deepEqual(readFileSync(join(backup, 'device-binding.json')), indexedBytes);
    assert.deepEqual(readFileSync(join(backup, 'keychain-helper')), originalHelper);
    failed(() => run('backup', source), /device_migration_destination_exists/);
    failed(() => run('restore', backup), /device_migration_destination_exists/);
    failed(() => run('keychain-verify', backup), /device_review_directory/);
    failed(() => run('migrate', source), /device_migration_signer_unavailable/);
    assert.equal(existsSync(destination), false);
    assert.equal(existsSync(join(source, 'device-binding.write.lock')), false);
    assert.equal(existsSync(join(source, 'keychain.write.lock')), false);
    await assertContinuity(source);

    // Verify the legacy helper's own path gate against an intact copied DB.
    mkdirSync(destination, {mode: 0o700});
    for (const name of ['enrollment.keychain-db', 'keychain-unlock'])
      copyFileSync(join(backup, name), join(destination, name));
    const legacyAtDestination = sign(original, destination, key);
    assert.deepEqual(legacyAtDestination, {exit: 4, osStatus: null});
    assertDenied(sign(other, destination, key));
    rmSync(destination, {recursive: true});

    // Simulate the original working path going away, without discarding its fixture.
    renameSync(source, parked);
    copyFileSync(other, join(backup, 'keychain-helper'));
    failed(() => run('restore', backup), /device_migration_signer_unavailable/);
    assert.equal(existsSync(source), false);
    copyFileSync(join(parked, 'keychain-helper'), join(backup, 'keychain-helper'));
    assert.equal(run('restore', backup), source);
    await assertContinuity(source);
    assert.deepEqual(sign(original, source, key), {exit: 0, osStatus: null});
    return {replacementAtSource, legacyAtDestination, failedMoveKeptSource: true,
      existingSourceProtected: true, failedRestoreRemovedCopy: true, originalPathRecovered: true};
  } finally {
    for (const path of [source, destination, backup, parked]) rmSync(path, {recursive: true, force: true});
  }
}

assert.equal(process.platform, 'darwin');
assert.equal(process.argv.length, 2);
const work = mkdtempSync('/private/tmp/enrollment-keychain-');
const searchList = () => tool('/usr/bin/security', 'list-keychains', '-d', 'user');
try {
  const searchBefore = searchList();
  const compatible = await exercise(work, false);
  const legacy = await exercise(work, true);
  assert.ok(searchBefore.equals(searchList()), 'user keychain search list changed');
  console.log(JSON.stringify({compatible, legacy, searchListUnchanged: true}));
} finally {
  rmSync(work, {recursive: true, force: true});
  if (!parentAlreadyExisted && existsSync(parent)) {
    try { rmdirSync(parent); }
    catch (error) { if (error.code !== 'ENOTEMPTY') throw error; }
  }
}
