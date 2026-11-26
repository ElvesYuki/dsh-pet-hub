import {cxx, firmwareMain, hasCppPeer} from './fixtures/firmware.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, generateKeyPairSync} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {registerEnrollmentRoutes} from '../apps/dsh-plugin/enrollment-routes.mjs';
import {decodePbp1Frame, encodePbp1Frame} from '../packages/core/native400-pbp1-wire.mjs';
import {createEnrollmentCoordinator} from '../packages/runtime/device-enrollment-owner.mjs';
import {createBootSerial} from '../packages/runtime/device-enrollment-serial.mjs';
import {decodeNetworkBody, decodeNetworkReply, decodeWifiProfilesReply, encodeNetworkLine} from '../packages/runtime/usb-wifi-settings.mjs';
import {desktopUsbOpener} from '../packages/runtime/desktop-usb-ownership.mjs';

const fixtureId = '11111111-1111-1111-1111-111111111111';
const secret = 'Fixture 123';
const config = {ssid: '圆屏', timeHost: 'ntp.example', weatherHost: 'weather.example', utcMinutes: 480,
  latitudeE4: -1234, longitudeE4: 75678};
const settings = {operation: 'set', instanceId: fixtureId, revision: '0', ...config};
const prefix = '/api/pet-hub-enrollment/';
const url = path => 'http://dsh.internal' + prefix + path;
const headers = {'Content-Type': 'application/octet-stream', 'X-Pet-Hub': '1'};
const version = '0.1.24-battery-usb-pair-test';
const info = {status: 'ok', configured: true, link: 'online'};
const wire = {allowBinding: true, allowBootProof: true};

function body(input, password = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(input)), field = Buffer.alloc(2);
  field.writeUInt16BE(json.length);
  return Buffer.concat([field, json, Buffer.from(password)]);
}

test('DESKNET2 validates safe fields and operation-specific correlated receipts', () => {
  const input = decodeNetworkBody(body(settings, secret));
  assert.equal(input.password.toString(), secret);
  for (const value of [{ssid: '界'.repeat(11)}, {ssid: 'A\0B'}, {ssid: ''}, {ssid: '\ud800'},
    {timeHost: 'ntp.example\n'}, {timeHost: '-ntp.example'}, {timeHost: 'a'.repeat(64)}, {weatherHost: 'https://weather.example'},
    {utcMinutes: 841}, {utcMinutes: 2.5}, {latitudeE4: -900001}, {longitudeE4: 1800001}, {weatherHost: ''}, {password: secret}])
    assert.throws(() => decodeNetworkBody(body({...settings, ...value}, secret)));
  for (const value of ['short', 'z'.repeat(64), 'nonascii密码', 'line\n123'])
    assert.throws(() => decodeNetworkBody(body(settings, value)));
  assert.match(encodeNetworkLine('012345ab', 'set', decodeNetworkBody(body(settings))).toString(), /e59c86e5b18f - ntp/);
  const request = {operation: 'info', instanceId: fixtureId, revision: '0'};
  assert.throws(() => decodeNetworkBody(body(request, secret)));
  const line = (id, tail) => `@VP8_DESKNET2 id=${id} status=${tail}\r\n`;
  for (const [id, reply] of [['deadbeef', 'saved configured=1 link=connecting'], ['012345ab', 'ok configured=1 link=online'],
    ['012345ab', 'saved'], ['012345ab', 'saved configured=0 link=off'], ['012345ab', 'busy configured=1 link=connecting'],
    ['012345ab', 'saved configured=1 link=online extra=redacted']])
    assert.equal(decodeNetworkReply(line(id, reply), '012345ab', 'set'), null);
  assert.deepEqual(decodeNetworkReply(line('012345ab', 'ok configured=0 link=unavailable'), '012345ab', 'info'),
    {status: 'ok', configured: false, link: 'unavailable'});
  assert.deepEqual(decodeNetworkReply(line('012345ab', 'storage_failed'), '012345ab', 'clear'), {status: 'storage_failed'});
});

test('Node Wi-Fi requests match both contracts of the firmware C++ command parser', {skip: !hasCppPeer}, t => {
  const root = mkdtempSync(join(tmpdir(), 'vp8-desknet-peer-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const output = join(root, 'peer');
  execFileSync(cxx, ['-std=c++20', '-Wall', '-Wextra', '-Werror', '-I', firmwareMain,
    'tests/fixtures/wifi-settings-peer.cpp', '-o', output], {timeout: 15000});
  const input = decodeNetworkBody(body(settings, secret));
  const operations = ['info', 'set', 'clear'];
  const requests = operations.map(operation => encodeNetworkLine('012345ab', operation, input));
  const replies = execFileSync(output, {input: Buffer.concat(requests), encoding: 'ascii', timeout: 5000}).match(/[^\n]+\n/g);
  assert.deepEqual(replies.map((line, i) => decodeNetworkReply(line, '012345ab', operations[i])),
    [{status: 'ok', configured: false, link: 'off'}, {status: 'saved', configured: true, link: 'connecting'},
      {status: 'cleared', configured: false, link: 'off'}]);
  const profileInput = {...input, version: 3, ssidHex: 'e59c86e5b18f'};
  const listOperations = ['info', 'set', 'remove'];
  const listRequests = listOperations.map(operation => encodeNetworkLine('012345ab', operation, profileInput));
  const listReplies = execFileSync(output, {input: Buffer.concat(listRequests), encoding: 'ascii', timeout: 5000}).match(/[^\n]+\n/g);
  assert.deepEqual(listReplies.map((line, i) => decodeWifiProfilesReply(line, '012345ab', listOperations[i], profileInput)),
    [{version: 3, status: 'ok', configured: false, mode: 'online', link: 'off', active: null, profiles: []},
      {version: 3, status: 'saved', configured: true, mode: 'online', link: 'connecting', active: null,
        profiles: [{id: 'e59c86e5b18f', name: '圆屏'}]},
      {version: 3, status: 'removed', configured: false, mode: 'online', link: 'off', active: null, profiles: []}]);
});

test('Wi-Fi list receipts enforce correlation, raw identities and operation-specific confirmation', () => {
  const sel = {operation: 'remove', instanceId: fixtureId, revision: '1', version: 3, ssidHex: 'ff'};
  assert.equal(decodeNetworkBody(body(sel)).ssidHex, 'ff');
  for (const value of [{version: 4}, {version: undefined}, {ssidHex: '00'}, {ssidHex: 'FF'}, {ssidHex: 'f'}, {operation: 'clear'}])
    assert.throws(() => decodeNetworkBody(body({...sel, ...value})));
  assert.throws(() => decodeNetworkBody(body(sel, secret)));
  const line = value => `@VP8_DESKNET3 id=012345ab status=${value}\r\n`;
  for (const fields of ['ok mode=online link=online active=61 profiles=62', 'ok mode=offline link=online active=61 profiles=61',
    'ok mode=online link=off active=- profiles=61,61', 'ok mode=online link=off active=- profiles=61,62,63,64,65',
    'ok mode=online link=off active=- profiles=00', 'full', 'ok mode=online link=connecting active=- profiles=-'])
    assert.equal(decodeWifiProfilesReply(line(fields), '012345ab', 'info'), null);
  const active = line('ok mode=online link=online active=ff profiles=ff,62');
  assert.equal(decodeWifiProfilesReply(active, 'ffffffff', 'info'), null);
  assert.deepEqual(decodeWifiProfilesReply(active, '012345ab', 'info').profiles,
    [{id: 'ff', name: null}, {id: '62', name: 'b'}]);
  assert.equal(decodeWifiProfilesReply(line('removed mode=offline link=off active=- profiles=ff'), '012345ab', 'remove', sel), null);
  assert.equal(decodeWifiProfilesReply(line('saved mode=online link=off active=- profiles=66'), '012345ab', 'set', settings), null);
});

function fixture(t) {
  const {publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const {x, y} = publicKey.export({format: 'jwk'});
  const key = {ref: 'fixture', publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'),
    Buffer.from(y, 'base64url')]), signTranscript: assert.fail};
  const fingerprint = createHash('sha256').update(key.publicKey).digest('hex');
  const target = {device: '11'.repeat(16), controller: '22'.repeat(16), binding: '33'.repeat(16), epoch: '7', keySha256: fingerprint};
  const f = {allowed: true, key, phase: 'bound', revision: '1', supported: true, silenceWrite: false, calls: [],
    opens: 0, closes: 0, closeGate: undefined, writeObserved: Promise.withResolvers(), abort: undefined,
    geocode: assert.fail, weatherSupported: true, weatherPlace: 'lat_e4=12000 lon_e4=-21000'};
  const state = Buffer.alloc(84);
  state.set([0, 2, 15]);
  state.writeBigUInt64LE(5n, 4);
  state.write(target.device, 12, 'hex');
  state.writeBigUInt64LE(7n, 28);
  state.write(target.controller + target.binding + fingerprint.slice(0, 32), 36, 'hex');
  const reply = (kind, bytes) => '@VP8_PAIR1 ' + Buffer.from(encodePbp1Frame({kind, body: bytes}, wire)).toString('base64') + '\n';
  function respond(line) {
    if (line.startsWith('VP8PAIR1 ')) {
      const frame = decodePbp1Frame(Buffer.from(line.slice(9), 'base64'), wire);
      f.calls.push(frame.kind);
      if (frame.kind === 'binding-info') return reply('binding-status', state);
      assert.equal(frame.kind, 'vp8-binding-proof');
      const proof = Buffer.alloc(136);
      proof.set(state.subarray(0, 68));
      proof[2] = 1;
      proof.write(fingerprint, 68, 'hex');
      proof.set(frame.body.subarray(28, 60), 100);
      return reply('vp8-binding-proof-result', proof);
    }
    if (line === 'STATUS2\n') {
      f.calls.push('STATUS2');
      return `@VP8_OTA STATUS busy=0 selected=0 slot=ota_0 version=${version}\n`;
    }
    if (line.startsWith('DESKWEATHER1 ')) {
      const [, id, op, ...fields] = line.trimEnd().split(' ');
      f.calls.push('weather-' + op);
      const weather = (status, place) => `@VP8_DESKWEATHER1 id=${id} status=${status} configured=${place ? '1 ' + place : '0'}\r\n`;
      if (op === 'INFO') return f.weatherSupported ? weather('ok', f.weatherPlace) : '';
      if (op === 'CLEAR') {
        assert.equal(fields.length, 0);
        f.weatherPlace = null;
        return weather('cleared');
      }
      assert.deepEqual(fields, ['-30001', '40001']);
      f.weatherPlace = 'lat_e4=-30001 lon_e4=40001';
      f.writeObserved.resolve();
      return f.silenceWrite ? weather('saved', 'lat_e4=-30002 lon_e4=40001') : weather('saved', f.weatherPlace);
    }
    if (line.startsWith('DESKNET3 ')) {
      const [, id, op, ...fields] = line.trimEnd().split(' ');
      f.calls.push('profiles-' + op);
      if (!f.profiles) return '';
      const answer = status => `@VP8_DESKNET3 id=${id} status=${status}\r\n`;
      const snapshot = status => answer(`${status} mode=online link=${f.profiles.length ? 'online' : 'off'} active=${f.profiles[0] ?? '-'} profiles=${f.profiles.join(',') || '-'}`);
      if (op === 'LIST') return snapshot('ok');
      if (op === 'REMOVE') {
        const index = f.profiles.indexOf(fields[0]);
        if (index === -1) return answer('missing');
        f.profiles.splice(index, 1);
      } else {
        assert.equal(op, 'SET');
        assert.equal(fields[1], Buffer.from(secret).toString('hex'));
        if (!f.profiles.includes(fields[0])) {
          if (f.profiles.length >= 4) return answer('full');
          f.profiles.push(fields[0]);
        }
      }
      return f.silenceWrite ? '' : snapshot(op === 'SET' ? 'saved' : 'removed');
    }
    const [, id, op, ...fields] = line.trimEnd().split(' ');
    f.calls.push(op);
    const answer = (replyId, payload) => `@VP8_DESKNET2 id=${replyId} status=${payload}\r\n`;
    const wrong = id === '00000000' ? '00000001' : '00000000';
    if (op === 'INFO') return f.supported ? answer(wrong, 'ok configured=0 link=off') +
      answer(id, 'ok configured=1 link=online') : '';
    if (op === 'SET') assert.equal(fields[1], Buffer.from(secret).toString('hex'));
    f.writeObserved.resolve();
    if (f.silenceWrite) return '';
    return answer(wrong, 'saved configured=1 link=online') + (op === 'SET' ?
      answer(id, 'saved configured=1 link=connecting') : answer(id, 'cleared configured=0 link=off'));
  }
  const node = {isCharacterDevice: () => true, ino: 1n, rdev: 2n, dev: 3n};
  const openTty = desktopUsbOpener(() => {
    f.opens++;
    let input = '', queued = Buffer.alloc(0);
    return {
      stat: () => node,
      async close() { f.closes++; await f.closeGate?.promise; },
      read(buffer) {
        if (!queued.length) throw Object.assign(new Error('empty'), {code: 'EAGAIN'});
        const bytesRead = queued.copy(buffer, 0, 0, 7);
        queued = queued.subarray(bytesRead);
        return {bytesRead};
      },
      write(buffer, offset, size) {
        const bytesWritten = Math.min(size, 5);
        input += buffer.toString('ascii', offset, offset + bytesWritten);
        if (input.endsWith('\n')) {
          queued = Buffer.from(respond(input));
          input = '';
        }
        return {bytesWritten};
      },
    };
  }, {});
  const usbIdentity = '42/11:22:33:44';
  const openSession = createBootSerial({port: '/dev/cu.usbmodemFixture', usbIdentity, timeoutMs: 140},
    {openTty, identify: () => usbIdentity, inspect: () => node});
  const owner = createEnrollmentCoordinator({openSession, networkAllowed: () => f.allowed, keys: {lookup: () => f.key, prepare: assert.fail},
    store: {read: () => ({revision: f.revision, record: {phase: f.phase, target, keyRef: key.ref}}), commit: assert.fail}});
  const routes = new Map();
  const close = registerEnrollmentRoutes({connection: {fetch: {register(route) {
    routes.set(route.path, route);
    return () => routes.delete(route.path);
  }}}}, {owner, authorize: () => f.authorized !== false, transport: 'desktop-rc3-connection',
    geocode: (...args) => f.geocode(...args)});
  t.after(async () => { f.closeGate?.resolve(); await close(); });
  const selector = operation => {
    const {instanceId, revision} = owner.status();
    return {operation, instanceId, revision};
  };
  const send = (data, overrides = {}) => routes.get(prefix + 'network').fetch(new Request(url('network'),
    {body: data, method: 'POST', headers, ...overrides}));
  const network = async (operation, overrides) => (await send(body({...selector(operation), ...(operation === 'set' ? config : {})},
    operation === 'set' ? secret : undefined), overrides)).json();
  const sendJson = (route, input, overrides = {}) => routes.get(prefix + route).fetch(new Request(url(route), {method: 'POST',
    headers: {...headers, 'Content-Type': 'application/json'}, body: JSON.stringify(input), ...overrides}));
  return Object.assign(f, {routes, close, openTty, owner, send, network, selector, sendJson});
}

test('Connection authorizes and bounds bytes; fresh proof, queries and mutations use one exclusive USB session', async t => {
  const f = fixture(t);
  assert.equal(f.routes.get(prefix + 'network').requestBody, 'streaming');
  const status = await f.routes.get(prefix + 'status').fetch(new Request(url('status')));
  assert.equal((await status.json()).networkAvailable, true);
  assert.equal(f.opens, 0);
  const valid = () => body(f.selector('info'));
  f.authorized = false;
  assert.equal((await f.send(valid())).status, 401);
  f.authorized = true;
  assert.equal((await f.send(valid(), {headers: {...headers, Origin: 'https://other.example'}})).status, 403);
  assert.equal((await f.send(valid(), {headers: {...headers, 'Content-Length': '2'}})).status, 400);
  assert.equal((await f.send(Buffer.alloc(1025))).status, 400);
  assert.equal((await f.send(body({...f.selector('info'), revision: '8'}))).status, 409);
  const abort = new AbortController(), started = Promise.withResolvers();
  const stalled = new ReadableStream({pull() { started.resolve(); return new Promise(() => {}); }});
  const reading = f.send(stalled, {duplex: 'half', signal: abort.signal});
  await started.promise;
  abort.abort();
  assert.equal((await reading).status, 400);
  f.allowed = false;
  assert.deepEqual(await f.network('set'), {status: 'device_conflict'});
  assert.equal(f.opens, 0);
  f.allowed = true;
  const request = body(f.selector('info'));
  const chunks = [Buffer.from(request.subarray(0, 7)), Buffer.from(request.subarray(7))];
  const stream = new ReadableStream({start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  }});
  const fragmented = await f.send(stream, {duplex: 'half'});
  assert.deepEqual(await fragmented.json(), info);
  assert.ok(chunks.every(chunk => chunk.every(byte => byte === 0)));
  assert.deepEqual(f.calls, ['binding-info', 'vp8-binding-proof', 'INFO']);
  const save = await f.network('set');
  assert.deepEqual(save, {status: 'saved', configured: true, link: 'connecting'});
  assert.doesNotMatch(JSON.stringify({save, status: f.owner.status()}), /Fixture|4678|圆屏/);
  assert.deepEqual(await f.network('clear'), {status: 'cleared', configured: false, link: 'off'});
  assert.deepEqual(f.calls.slice(3), ['binding-info', 'vp8-binding-proof', 'INFO', 'SET',
    'binding-info', 'vp8-binding-proof', 'INFO', 'CLEAR']);
  assert.equal(f.opens, 3);
  assert.equal(f.closes, 3);
});

test('legacy probe stays read-only; wrong key denies writes; timeout closes USB and never resends SET', async t => {
  const f = fixture(t);
  f.supported = false;
  assert.deepEqual(await f.network('set'), {status: 'unsupported', version});
  assert.deepEqual(f.calls, ['binding-info', 'vp8-binding-proof', 'INFO', 'STATUS2']);
  const key = f.key;
  f.key = {...key, publicKey: Buffer.alloc(65, 4)};
  assert.deepEqual(await f.network('clear'), {status: 'unavailable'});
  assert.deepEqual(f.calls.slice(4), ['binding-info', 'vp8-binding-proof']);
  f.key = key;
  f.supported = true;
  f.silenceWrite = true;
  f.closeGate = Promise.withResolvers();
  const pending = f.network('set');
  await f.writeObserved.promise;
  await assert.rejects(f.openTty(), {code: 'device_desktop_usb_busy'});
  assert.equal((await f.send(body(f.selector('info')))).status, 409);
  const draining = f.close();
  assert.equal(f.routes.size, 0);
  await assert.rejects(f.openTty(), {code: 'device_desktop_usb_busy'});
  f.closeGate.resolve();
  assert.deepEqual(await pending, {status: 'unknown'});
  await draining;
  assert.equal(f.calls.filter(op => op === 'SET').length, 1);
  await (await f.openTty()).close();
});

test('a missing write receipt without cancellation returns unknown; a later explicit INFO only reads', async t => {
  const f = fixture(t);
  f.silenceWrite = true;
  assert.deepEqual(await f.network('set'), {status: 'unknown'});
  assert.equal(f.opens, f.closes);
  assert.deepEqual(await f.network('info'), info);
  assert.equal(f.calls.filter(op => op === 'SET').length, 1);
});

test('verified USB can list four full-length networks, remove one, add another and recover without replay', async t => {
  const f = fixture(t);
  const network = async (operation, fields = {}) => (await f.send(body(
    {...f.selector(operation), version: 3, ...fields}, operation === 'set' ? secret : undefined))).json();
  assert.deepEqual(await network('info'), {...info, readOnly: true});
  assert.deepEqual(await network('set', config), {status: 'unsupported', version});
  assert.equal(f.calls.includes('SET'), false);
  const ids = ['61', '62', '63', '64'].map(value => value.repeat(32));
  f.profiles = [...ids];
  const listed = await network('info');
  assert.deepEqual(listed.profiles.map(profile => profile.id), ids);
  assert.equal(listed.active, ids[0]);
  assert.deepEqual(await network('set', config), {status: 'full'});
  assert.deepEqual((await network('remove', {ssidHex: ids[1]})).profiles.map(profile => profile.id), [ids[0], ids[2], ids[3]]);
  f.silenceWrite = true;
  assert.deepEqual(await network('set', config), {status: 'unknown'});
  const recovered = await network('info');
  assert.deepEqual(recovered.profiles.map(profile => profile.name), ['a'.repeat(32), 'c'.repeat(32), 'd'.repeat(32), '圆屏']);
  assert.doesNotMatch(JSON.stringify(recovered), /Fixture|466978/);
  assert.equal(f.calls.filter(op => op === 'profiles-SET').length, 2);
  assert.equal(f.opens, f.closes);
});

test('weather settings share the verified USB owner and search is independent of binding and USB', async t => {
  const f = fixture(t);
  const coords = {latitudeE4: -30001, longitudeE4: 40001};
  const weather = (operation, extra) => f.sendJson('weather', {...f.selector(operation), ...extra});
  const search = name => f.sendJson('weather-search', {name});
  f.geocode = (name, {signal}) => {
    assert.equal(name, '合成城');
    assert.equal(signal.aborted, false);
    return [{id: 11, name, area: ['甲省', '甲国'], ...coords}];
  };
  f.phase = 'pending';
  f.authorized = false;
  assert.equal((await search('合成城')).status, 401);
  f.authorized = true;
  assert.equal((await search('短')).status, 400);
  assert.equal((await search(' 合成城 ')).status, 200);
  assert.equal((await weather('set', coords)).status, 409);
  assert.equal(f.opens, 0);
  f.phase = 'bound';
  for (const field of [{timeHost: 'forbidden'}, {ssid: 'forbidden'}, {password: 'forbidden'}, {utcMinutes: 0}])
    assert.equal((await weather('set', {...coords, ...field})).status, 400);
  const check = await f.routes.get(prefix + 'status').fetch(new Request(url('status')));
  assert.equal((await check.json()).weatherAvailable, true);
  assert.deepEqual(await (await weather('info')).json(), {status: 'ok', configured: true, latitudeE4: 12000, longitudeE4: -21000});
  f.silenceWrite = true;
  const pending = weather('set', coords);
  await f.writeObserved.promise;
  assert.equal((await f.send(body(f.selector('info')))).status, 409);
  assert.equal((await search('合成城')).status, 200);
  assert.deepEqual(await (await pending).json(), {status: 'unknown'});
  assert.deepEqual(await (await weather('info')).json(), {status: 'ok', configured: true, ...coords});
  assert.equal(f.calls.filter(call => call === 'weather-SET').length, 1);
  assert.deepEqual(await (await weather('clear')).json(), {status: 'cleared', configured: false});
  f.weatherSupported = false;
  assert.deepEqual(await (await weather('set', coords)).json(), {status: 'unsupported', version});
  assert.deepEqual(f.calls.slice(-4), ['binding-info', 'vp8-binding-proof', 'weather-INFO', 'STATUS2']);
  assert.equal(f.opens, f.closes);
});

test('weather search capacity is bounded and teardown waits for the cancelled lookup to exit', async t => {
  const f = fixture(t), ready = Promise.withResolvers(), release = Promise.withResolvers(), signals = [];
  f.geocode = async (_name, {signal}) => {
    signals.push(signal);
    if (signals.length === 4) ready.resolve();
    await release.promise;
    return [];
  };
  const search = () => f.sendJson('weather-search', {name: '合成城'});
  const pending = Array.from({length: 4}, search);
  try {
    await ready.promise;
    assert.equal((await search()).status, 429);
    let stopped = false;
    const closing = f.close().then(() => { stopped = true; });
    await Promise.resolve();
    assert.equal(stopped, false);
    assert.ok(signals.every(signal => signal.aborted));
    release.resolve();
    for (const response of await Promise.all(pending)) assert.equal(response.status, 502);
    await closing;
    assert.equal(f.opens, 0);
  } finally { release.resolve(); }
});
