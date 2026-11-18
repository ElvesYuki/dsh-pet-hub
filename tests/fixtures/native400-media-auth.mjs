// In-memory PMA1 proposal oracle. No socket, key store, or production entry point.
import {createHash, createHmac, hkdfSync, timingSafeEqual} from 'node:crypto';
import {decodeMediaFrame, encodeMediaFrame} from '../../packages/core/native400-tcp-media-wire.mjs';

const MAGIC = Buffer.from('PMA1');
const INIT = 1, CHALLENGE = 2, FINISH = 3, GRANT = 16, PTM = 17;
const HEADER = 16, TAG = 32, MAX_SEQUENCE = 2048, MAX_WORK_MS = 30000;
const frames = {
  repair: {device: ['hello', 'ready', 'ack', 'result'], hub: ['begin', 'data', 'end', 'cancel']},
  query: {device: ['hello', 'result'], hub: ['query']}
};

function requireAuth(condition) {
  if (!condition) throw new Error('pma_auth_rejected');
}

function hex(value, length) {
  requireAuth(typeof value === 'string' && value.length === length * 2 && /^[a-f0-9]+$/.test(value));
  return Buffer.from(value, 'hex');
}

const hash = (...parts) => parts.reduce((digest, part) => digest.update(part), createHash('sha256')).digest();
const mac = (key, ...parts) => parts.reduce((hmac, part) => hmac.update(part), createHmac('sha256', key)).digest();

function identity(pair) {
  requireAuth(typeof pair.epoch === 'string' && /^[1-9][0-9]{0,19}$/.test(pair.epoch));
  const epoch = BigInt(pair.epoch);
  requireAuth(epoch <= 0xffffffffffffffffn);
  const epochBytes = Buffer.alloc(8);
  epochBytes.writeBigUInt64LE(epoch);
  return Buffer.concat([hex(pair.device, 16), hex(pair.hub, 16), hex(pair.binding, 16), epochBytes]);
}

function header(type, seq, length) {
  const bytes = Buffer.alloc(HEADER);
  MAGIC.copy(bytes);
  bytes[4] = 1;
  bytes[5] = type;
  bytes.writeUInt32LE(seq, 8);
  bytes.writeUInt32LE(length, 12);
  return bytes;
}

function inspect(packet) {
  requireAuth(Buffer.isBuffer(packet) && packet.length >= HEADER && packet.subarray(0, 4).equals(MAGIC) &&
    packet[4] === 1 && packet.readUInt16LE(6) === 0);
  return {type: packet[5], seq: packet.readUInt32LE(8), length: packet.readUInt32LE(12)};
}

function handshakeBody(packet, type, length) {
  const fields = inspect(packet);
  requireAuth(fields.type === type && fields.seq === 0 && fields.length === length && packet.length === HEADER + length);
  return packet.subarray(HEADER);
}

function keys(pair, transcript, role) {
  const derive = label => Buffer.from(hkdfSync('sha256', hex(pair.syntheticKey, 32), transcript, `PMA1/1/${label}`, 32));
  return {proof: derive(`${role}/proof`), record: derive(`${role}/record`)};
}

function inner(body, role, mode) {
  const frame = decodeMediaFrame(body.subarray(0, HEADER), body.subarray(HEADER));
  requireAuth(frames[mode][role].includes(frame.kind));
  return frame;
}

function grantFields(body) {
  requireAuth(body.length === 116 && body.subarray(0, 16).some(byte => byte !== 0));
  const workMs = body.readUInt32LE(112);
  requireAuth(workMs > 0 && workMs <= MAX_WORK_MS);
  return {id: body.subarray(0, 16).toString('hex'), beginSha: body.subarray(16, 48),
    manifestSha: body.subarray(48, 80).toString('hex'), indexSha: body.subarray(80, 112).toString('hex'), workMs};
}

function session(pair, role, mode, transcript, transmitKey, receiveKey) {
  const peer = role === 'hub' ? 'device' : 'hub';
  let sendSeq = 0, recvSeq = 0, failed = false;
  let sentKind, receivedKind;
  function ordered(sender, last, next) {
    if (mode === 'query') {
      return sender === 'hub' ? !last && next === 'query' :
        (!last && next === 'hello') || (last === 'hello' && next === 'result');
    }
    if (sender === 'device') {
      return !last ? next === 'hello' : last === 'hello' ? ['ready', 'result'].includes(next) :
        ['ready', 'ack'].includes(last) && ['ack', 'result'].includes(next);
    }
    if (!last) return next === 'grant';
    if (last === 'grant') return next === 'begin';
    if (last === 'end') return next === 'cancel';
    return ['begin', 'data'].includes(last) && ['data', 'end', 'cancel'].includes(next);
  }
  return Object.freeze({
    role, mode, binding: identity(pair).toString('hex'), transcript: transcript.toString('hex'),
    seal(kind, value) {
      requireAuth(!failed && sendSeq < MAX_SEQUENCE && (kind === 'grant' || kind === 'ptm'));
      const seq = sendSeq + 1;
      const body = Buffer.from(value);
      const fields = kind === 'grant' ? grantFields(body) : inner(body, role, mode);
      const type = kind === 'grant' ? 'grant' : fields.kind;
      requireAuth(ordered(role, sentKind, type));
      const prefix = header(kind === 'grant' ? GRANT : PTM, seq, body.length);
      const packet = Buffer.concat([prefix, body, mac(transmitKey, transcript, prefix, body)]);
      sendSeq = seq;
      sentKind = type;
      return packet;
    },
    open(packet) {
      requireAuth(!failed);
      try {
        const {type, seq, length} = inspect(packet);
        requireAuth(seq === recvSeq + 1 && seq <= MAX_SEQUENCE && packet.length === HEADER + length + TAG &&
          ((type === GRANT && length === 116) || (type === PTM && length >= 32 && length <= 4112)));
        const body = packet.subarray(HEADER, HEADER + length);
        requireAuth(timingSafeEqual(mac(receiveKey, transcript, packet.subarray(0, HEADER), body), packet.subarray(-TAG)));
        const fields = type === GRANT ? grantFields(body) : inner(body, peer, mode);
        const kind = type === GRANT ? 'grant' : fields.kind;
        requireAuth(ordered(peer, receivedKind, kind));
        recvSeq = seq;
        receivedKind = kind;
        return {kind: type === GRANT ? 'grant' : 'ptm', seq, body: Buffer.from(body), fields};
      } catch {
        failed = true;
        throw new Error('pma_auth_rejected');
      }
    }
  });
}

export function deviceInit(pair, mode, nonce) {
  requireAuth(Object.hasOwn(frames, mode));
  const selection = Buffer.alloc(8);
  selection[0] = mode === 'repair' ? 1 : 2;
  const init = Buffer.concat([header(INIT, 0, 96), identity(pair), selection, hex(nonce, 32)]);
  let used = false;
  return {init: Buffer.from(init), finish(challenge) {
    requireAuth(!used);
    used = true;
    const proof = handshakeBody(challenge, CHALLENGE, 64);
    const transcript = hash(init, challenge.subarray(0, HEADER + 32));
    const hub = keys(pair, transcript, 'hub'), device = keys(pair, transcript, 'device');
    requireAuth(timingSafeEqual(proof.subarray(32), mac(hub.proof, transcript)));
    return {finish: Buffer.concat([header(FINISH, 0, 32), mac(device.proof, transcript)]),
      endpoint: session(pair, 'device', mode, transcript, device.record, hub.record)};
  }};
}

export function hubChallenge(pair, packet, nonce) {
  const init = handshakeBody(packet, INIT, 96);
  requireAuth(init.subarray(0, 56).equals(identity(pair)) && [1, 2].includes(init[56]) &&
    init.subarray(57, 64).every(byte => byte === 0));
  const mode = init[56] === 1 ? 'repair' : 'query';
  const prefix = Buffer.concat([header(CHALLENGE, 0, 64), hex(nonce, 32)]);
  const transcript = hash(packet, prefix);
  const hub = keys(pair, transcript, 'hub'), device = keys(pair, transcript, 'device');
  let used = false;
  return {challenge: Buffer.concat([prefix, mac(hub.proof, transcript)]), finish(finish) {
    requireAuth(!used);
    used = true;
    requireAuth(timingSafeEqual(handshakeBody(finish, FINISH, 32), mac(device.proof, transcript)));
    return session(pair, 'hub', mode, transcript, hub.record, device.record);
  }};
}

function ticks(...times) {
  return times.every(time => Number.isSafeInteger(time) && time >= 0);
}

// The model caller represents a trusted, already authorized issuer. An opaque
// grant stays local until the current paired repair connection consumes it.
export function issueDecision({pair, begin, decisionId, manifestSha, indexSha, approvedAt, expiresAt}) {
  const expected = Buffer.from(begin);
  const target = inner(expected, 'hub', 'repair');
  requireAuth(target.kind === 'begin' && [1, 11].includes(target.action) &&
    ticks(approvedAt, expiresAt) && expiresAt > approvedAt);
  const binding = identity(pair).toString('hex');
  const pins = Buffer.concat([hex(decisionId, 16), hash(expected), hex(manifestSha, 32), hex(indexSha, 32)]);
  let spent = false;
  return ({endpoint, begin: actual, startedAt, now}) => {
    requireAuth(!spent && endpoint.role === 'hub' && endpoint.mode === 'repair' && endpoint.binding === binding &&
      expected.equals(actual) && ticks(startedAt, now) && now >= Math.max(startedAt, approvedAt) && now < expiresAt);
    const end = Math.min(expiresAt, startedAt + MAX_WORK_MS);
    requireAuth(now < end);
    const span = Buffer.alloc(4);
    span.writeUInt32LE(end - startedAt);
    spent = true;
    return endpoint.seal('grant', Buffer.concat([pins, span]));
  };
}

export function repairArm({startedAt, armUntil, expectedBegin}) {
  const expected = Buffer.from(expectedBegin);
  let spent = false;
  return (grant, begin, now) => {
    requireAuth(!spent && grant.kind === 'grant' && grant.seq === 1 && begin.kind === 'ptm' && begin.seq === 2 &&
      grant.fields.beginSha.equals(hash(begin.body)) && expected.equals(begin.body) &&
      ticks(startedAt, armUntil, now) && now >= startedAt);
    const deadline = Math.min(armUntil, startedAt + grant.fields.workMs);
    requireAuth(now < deadline);
    spent = true;
    let last = now, invalidated = false;
    return tick => {
      invalidated ||= !ticks(tick) || tick < last || tick >= deadline;
      requireAuth(!invalidated);
      last = tick;
    };
  };
}

export function queryReceipt({endpoint, helloBoot, query, now, receipt}) {
  requireAuth(endpoint.role === 'device' && endpoint.mode === 'query' && query.kind === 'ptm' &&
    query.fields.kind === 'query');
  if (receipt && endpoint.binding === receipt.binding && helloBoot === receipt.boot &&
      query.fields.job === receipt.job && ticks(now, receipt.closedAt) && now >= receipt.closedAt &&
      now - receipt.closedAt < 120000) return receipt.result;
  return {kind: 'result', job: query.fields.job, status: 'unknown'};
}

export function connectExample({pair, nonces}, mode) {
  const device = deviceInit(pair, mode, nonces[mode].device);
  const hub = hubChallenge(pair, device.init, nonces[mode].hub);
  const authenticated = device.finish(hub.challenge);
  return {hub: hub.finish(authenticated.finish), device: authenticated.endpoint,
    handshake: {init: device.init, challenge: hub.challenge, finish: authenticated.finish}};
}

export function exampleVectors(example) {
  const {pair, decision, hello, queryHello, begin, result} = example;
  const beginBytes = encodeMediaFrame(begin);
  const issue = issueDecision({...decision, pair, begin: beginBytes});
  const encode = value => Buffer.from(encodeMediaFrame(value));
  const output = {};
  for (const mode of ['repair', 'query']) {
    const {hub, device, handshake} = connectExample(example, mode);
    const packet = (from, frame) => from.seal('ptm', encode(frame));
    const {job, bytes} = begin;
    const records = {hello: packet(device, mode === 'repair' ? hello : queryHello)};
    if (mode === 'repair') {
      records.grant = issue({endpoint: hub, begin: beginBytes, startedAt: 100, now: 200});
      records.begin = packet(hub, begin);
      records.ready = packet(device, {kind: 'ready', job});
      records.data = packet(hub, {kind: 'data', job, offset: 0, data: Buffer.from('PET4')});
      records.ack = packet(device, {kind: 'ack', job, bytes});
      records.end = packet(hub, {kind: 'end', job, bytes});
      records.cancel = packet(hub, {kind: 'cancel', job});
    } else records.query = packet(hub, {kind: 'query', job});
    records.result = packet(device, result);
    const toHex = packets => Object.fromEntries(Object.entries(packets).map(([name, bytes]) => [name, bytes.toString('hex')]));
    output[mode] = {transcriptSha256: hub.transcript, handshake: toHex(handshake), records: toHex(records)};
  }
  return output;
}
