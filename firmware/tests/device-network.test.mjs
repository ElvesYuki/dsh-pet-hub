import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createECDH, createHash, createHmac, createPrivateKey, createPublicKey, hkdfSync, sign, verify} from 'node:crypto';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import test from 'node:test';
import {decodeStatusV2 as decodeHubStatus} from '../../packages/runtime/device-status-wire.mjs';

const [binary] = process.argv.slice(2);
const V = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL(
  '../../docs/protocol/vectors/device-status.json', import.meta.url
)))).filter(([key]) => key !== 'format').map(([key, hex]) => [key, Buffer.from(hex, 'hex')]));
const push = JSON.parse(readFileSync(new URL('../../docs/protocol/vectors/device-status-push.json', import.meta.url)));
const sha = (...parts) => createHash('sha256').update(Buffer.concat(parts)).digest();
const mac = (key, domain, ...parts) => createHmac('sha256', key).update(domain).update(Buffer.concat(parts)).digest();
const hk = (key, salt, info) => Buffer.from(hkdfSync('sha256', key, salt, info, 32));
function le(value, width = 4) {
  const b = Buffer.alloc(width);
  b.writeUIntLE(value, 0, width);
  return b;
}
function ec(n) {
  const key = createECDH('prime256v1');
  if (n !== undefined) key.setPrivateKey(Buffer.concat([Buffer.alloc(31), Buffer.of(n)]));
  else key.generateKeys();
  return key;
}
function pub(point) {
  return createPublicKey({format:'jwk', key:{kty:'EC', crv:'P-256',
    x:point.subarray(1, 33).toString('base64url'), y:point.subarray(33, 65).toString('base64url')}});
}
const signing = ec(11), device = pub(ec(7).getPublicKey());
function privateKey(ecKey) {
  const point = ecKey.getPublicKey();
  return createPrivateKey({format:'jwk', key:{kty:'EC', crv:'P-256', d:ecKey.getPrivateKey().toString('base64url'),
    x:point.subarray(1, 33).toString('base64url'), y:point.subarray(33, 65).toString('base64url')}});
}
function header(kind, length) { return Buffer.concat([Buffer.from('VPL1'), Buffer.of(1, kind), le(length, 2)]); }
function packet(kind, data) { return Buffer.concat([header(kind, data.length), data]); }
function seal(kind, data, counter, key) {
  const prefix = Buffer.concat([header(kind, 36 + data.length), le(counter), data]);
  return Buffer.concat([prefix, mac(key, 'VPL1/record', prefix)]);
}
function ping(session, sequence, kind = 2, role = 0, action = 0, value = 0) {
  return Buffer.concat([Buffer.from('VPC1'), Buffer.of(1, kind, 0, 0), le(session), le(sequence),
    le(role, 2), le(action, 2), le(value)]);
}
function decodeStatus(data) {
  assert.equal(data[0], 2);
  const flags = data[2];
  assert.ok((flags & ~7) === 0 && data[1] <= 1);
  const length = data[3];
  assert.equal(data[4] & ~3, 0);
  let at = 5 + length;
  assert.ok(data.subarray(5, at).every(ch => ch <= 127));
  const version = data.toString('ascii', 5, at);
  assert.match(version, /^[0-9A-Za-z][0-9A-Za-z._+-]{0,30}$/);
  const out = {schema:1, version, slot:'ota_' + data[1], busy:!!(data[4] & 1), selected:!!(data[4] & 2),
    battery:null, sensors:null};
  if (flags & 1) {
    const [present, usb, percent, flow, phase, reserved] = data.subarray(at, at + 6);
    const mv = data.readUInt16LE(at + 6);
    assert.ok(present <= 1 && usb <= 1 && reserved === 0);
    if (!present) assert.deepEqual([percent, flow, phase, mv], [255, 255, 255, 0]);
    if (present) assert.ok((percent <= 100 || percent === 255) && flow <= 3 && phase <= 6 && mv <= 8191);
    out.battery = {present:!!present, usbPower:!!usb, percent:percent === 255 ? null : percent, mv:mv || null,
      flow:present ? ['standby','charging','discharging','unknown'][flow] : null,
      phase:present ? ['trickle','precharge','cc','cv','full','idle','unknown'][phase] : null};
    at += 8;
  }
  if (flags & 6) out.sensors = {touch:{state:'unknown', last:null}, motion:null};
  if (flags & 2) {
    const [state, reserved] = data.subarray(at, at + 2);
    const x = data.readUInt16LE(at + 2), y = data.readUInt16LE(at + 4);
    assert.ok(state <= 2 && reserved === 0 && ((x <= 465 && y <= 465) || (x === 65535 && y === 65535)));
    out.sensors.touch = {state:['unknown','up','down'][state], last:x === 65535 ? null : [x, y]};
    at += 6;
  }
  if (flags & 4) {
    out.sensors.motion = {accelerationMg:[0, 2, 4].map(i => data.readInt16LE(at + i)),
      rotationMdps:[6, 10, 14].map(i => data.readInt32LE(at + i))};
    assert.ok(out.sensors.motion.accelerationMg.every(v => Math.abs(v) <= 4000) &&
      out.sensors.motion.rotationMdps.every(v => Math.abs(v) <= 256000));
    at += 18;
  }
  assert.equal(data.length, at);
  return out;
}

function parseStatus(data) {
  return {out:decodeStatus(data.subarray(8)), session:data.readUInt32LE(0), sequence:data.readUInt32LE(4)};
}

test('canonical payloads, legacy VPC1, ECDH and both confirmation vectors', () => {
  const T = sha(V.device_hello_body, V.hub_auth_prefix);
  assert.deepEqual(T, V.transcript_sha256);
  assert.deepEqual(ec(13).computeSecret(ec(17).getPublicKey()), V.ecdh_test_secret);
  assert.deepEqual(hk(V.ecdh_test_secret, T, 'VPL1/device-to-hub'), V.k_device_to_hub);
  assert.deepEqual(hk(V.ecdh_test_secret, T, 'VPL1/hub-to-device'), V.k_hub_to_device);
  assert.deepEqual(mac(V.k_device_to_hub, 'VPL1/device-finish', T, le(1)), V.device_finish_session1);
  assert.deepEqual(mac(V.k_hub_to_device, 'VPL1/hub-finish', T, le(1)), V.hub_finish_session1);
  assert.deepEqual(seal(18, V.status_full_tcp, 3, V.record_test_key), V.record_status_counter3);
  assert.deepEqual(ping(1, 1), V.legacy_ping_session1_seq1);
  assert.deepEqual(ping(1, 1, 133), V.legacy_pong_session1_seq1);
  assert.equal(decodeStatus(V.status_full).battery.percent, 83);
  assert.equal(decodeStatus(V.status_minimal).sensors, null);
  assert.deepEqual(V.status_full_tcp.subarray(8), V.status_full);
  assert.deepEqual(V.status_minimal_tcp.subarray(8), V.status_minimal);
  assert.equal(seal(19, Buffer.from(push.ack_first_payload, 'hex'), 1,
    Buffer.from(push.ack_test_key, 'hex')).toString('hex'), push.ack_first_record);
  const output = spawnSync(binary, ['vectors', V.status_full, V.status_minimal,
    V.record_status_counter3, V.device_hello_body, V.hub_auth_prefix, V.transcript_sha256,
    V.ecdh_test_secret, V.k_device_to_hub, V.k_hub_to_device,
    V.usb_request, V.usb_full_reply, V.usb_minimal_reply, V.status_bad_maintenance,
    push.ack_first_record, Buffer.from(push.usb_first_report)].map(value => Buffer.isBuffer(value) ?
    value.toString('hex') : value), {encoding:'utf8'});
  assert.equal(output.status, 0, output.stderr);
});

function reader(socket) {
  const queue = [];
  let data = Buffer.alloc(0), waiting;
  socket.on('data', chunk => {
    data = Buffer.concat([data, chunk]);
    while (data.length >= 8 && data.length >= 8 + data.readUInt16LE(6)) {
      const size = 8 + data.readUInt16LE(6);
      queue.push(data.subarray(0, size));
      data = data.subarray(size);
    }
    waiting?.();
  });
  socket.on('close', () => waiting?.());
  return async function next(kind) {
    while (!socket.destroyed && !queue.length) await new Promise(resolve => { waiting = resolve; });
    waiting = undefined;
    const frame = queue.shift();
    assert.ok(frame, 'expected a VPL1 record before EOF');
    assert.equal(frame.toString('ascii', 0, 4), 'VPL1');
    assert.equal(frame[4], 1);
    assert.equal(frame[5], kind);
    return frame;
  };
}

async function handshake(socket, read, {mode = 3, correct = true, boot = 98765n} = {}) {
  const hello = (await read(1)).subarray(8);
  const key = ec();
  assert.deepEqual(hello.subarray(0, 88), V.device_hello_body.subarray(0, 88));
  assert.equal(hello.readBigUInt64LE(88), boot);
  assert.equal(hello[193], 4);
  assert.equal(hello.length, 194);
  const prefix = Buffer.concat([Buffer.alloc(32, 0xc8), key.getPublicKey(), Buffer.of(mode)]);
  const T = sha(hello, prefix);
  const signature = sign('sha256', Buffer.concat([Buffer.from('VPL1/hub-auth'), T]),
    {key:privateKey(correct ? signing : ec(19)), dsaEncoding:'ieee-p1363'});
  const auth = packet(2, Buffer.concat([prefix, signature]));
  socket.write(auth.subarray(0, 7));
  await new Promise(resolve => setTimeout(resolve, 8));
  socket.write(auth.subarray(7));
  if (!correct || mode !== 3) return;
  const secret = key.computeSecret(hello.subarray(128, 193));
  const xd = hk(secret, T, 'VPL1/device-to-hub'), xh = hk(secret, T, 'VPL1/hub-to-device');
  const finish = (await read(3)).subarray(8), serial = finish.subarray(0, 4);
  assert.ok(verify('sha256', Buffer.concat([Buffer.from('VPL1/device-auth'), T, serial]),
    {key:device, dsaEncoding:'ieee-p1363'}, finish.subarray(4, 68)));
  assert.deepEqual(finish.subarray(68), mac(xd, 'VPL1/device-finish', T, serial));
  socket.write(packet(4, mac(xh, 'VPL1/hub-finish', T, serial)));
  let tx = 0, rx = 0;
  const session = serial.readUInt32LE();
  const receive = async kind => {
    const frame = await read(kind), payload = frame.subarray(12, -32);
    assert.deepEqual(frame, seal(kind, payload, ++rx, xd));
    return payload;
  };
  assert.deepEqual(await receive(16), serial);
  return {session, receive, wire: (kind, data) => seal(kind, data, ++tx, xh)};
}

test('device pushes authenticated state and accepts lease acknowledgments independently of Play', {timeout:28000}, async t => {
  const server = createServer();
  const sockets = [];
  const connections = [];
  let connected;
  server.on('connection', socket => {
    socket.setNoDelay(true);
    sockets.push(socket);
    connections.push(socket);
    connected?.();
  });
  server.listen({host:'127.0.0.1', port:0});
  await once(server, 'listening');
  const child = spawn(binary, ['tcp', String(server.address().port), signing.getPublicKey().toString('hex'), '9']);
  const done = once(child, 'exit');
  let output = '', errors = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { errors += data; });
  t.after(() => {
    sockets.forEach(socket => socket.destroy());
    child.kill();
    server.close();
  });

  const take = async () => {
    while (!connections.length) await new Promise(resolve => { connected = resolve; });
    connected = undefined;
    const socket = connections.shift();
    return [socket, reader(socket)];
  };
  async function establish(boot) {
    const [socket, read] = await take();
    const connection = await handshake(socket, read, {boot});
    const {session, receive, wire} = connection;
    return {socket, session, receive, wire,
      ack: (sequence, id = session) => wire(19, Buffer.concat([le(id), le(sequence)])),
      async status(sequence) {
        const payload = await receive(18);
        assert.deepEqual([payload.readUInt32LE(0), payload.readUInt32LE(4)], [session, sequence]);
        assert.deepEqual({schema:1, ...decodeHubStatus(payload.subarray(8))}, parseStatus(payload).out);
        return parseStatus(payload).out;
      }};
  }
  async function expectClose(socket, send) {
    const closed = once(socket, 'close');
    await send();
    await closed;
  }

  const link = await establish();
  assert.equal(link.session, 1);
  const first = await link.status(1);
  assert.equal(first.battery.mv, 4187);
  assert.deepEqual(first.sensors.touch.last, [0, 465]);
  const firstAt = performance.now();
  const a1 = link.ack(1);
  const play = link.wire(17, ping(link.session, 1, 1, 0, 4, 1000));
  link.socket.write(a1.subarray(0, 5));
  link.socket.write(Buffer.concat([a1.subarray(5), play]));
  assert.deepEqual(await link.receive(17), ping(1, 1, 128, 0, 4));
  assert.deepEqual(await link.receive(17), ping(1, 1, 129, 0, 4, 1));
  const second = await link.status(2);
  assert.ok(performance.now() - firstAt >= 2800, 'status should be paced by device');
  assert.equal(second.selected, true);
  assert.equal(second.battery, null);
  link.socket.write(link.ack(1));
  assert.equal((await link.status(3)).battery.percent, 83);
  link.socket.write(link.ack(3));
  await expectClose(link.socket, () => link.socket.end());

  const invalidSignature = await take();
  await expectClose(invalidSignature[0], () =>
    handshake(...invalidSignature, {correct:false}));

  const oldMode = await take();
  await expectClose(oldMode[0], () => handshake(...oldMode, {mode:2}));

  const future = await establish();
  assert.equal(future.session, 2, 'failed handshakes do not allocate a session');
  await future.status(1);
  await expectClose(future.socket, () => future.socket.write(future.ack(2)));

  const wrongSession = await establish();
  await wrongSession.status(1);
  await expectClose(wrongSession.socket, () => wrongSession.socket.write(wrongSession.ack(1, link.session)));

  const oldPing = await establish();
  await oldPing.status(1);
  await expectClose(oldPing.socket, () => oldPing.socket.write(oldPing.wire(17, ping(oldPing.session, 1))));

  const tampered = await establish();
  await tampered.status(1);
  const altered = tampered.ack(1);
  altered[altered.length - 1] ^= 1;
  await expectClose(tampered.socket, () => tampered.socket.write(altered));

  const malformed = await establish(98766n);
  assert.equal(malformed.session, 1, 'a new boot has an independent sequence scope');
  await malformed.status(1);
  await expectClose(malformed.socket, () => malformed.socket.write(header(19, 43)));

  const lease = await establish(98766n);
  await lease.status(1);
  const leaseStart = performance.now();
  const leaseClosed = once(lease.socket, 'close');
  lease.socket.write(lease.ack(1));
  for (let sequence = 2; sequence <= 5; ++sequence) {
    await lease.status(sequence);
    lease.socket.write(lease.ack(1)); // New record counters, same acknowledged state.
  }
  await leaseClosed;
  assert.ok(performance.now() - leaseStart >= 14500, 'duplicate ACKs do not extend the control lease');
  const [code] = await done;
  assert.equal(code, 0, errors);
  assert.match(output, /open=7 close=7 display=1/);
});
