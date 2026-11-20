import {createHash, randomBytes} from 'node:crypto';
import {lstatSync, realpathSync} from 'node:fs';
import {request} from 'node:http';
import {isAbsolute} from 'node:path';

const limit = 262144;
const decode = new TextDecoder('utf-8', {fatal: true});

function frame(opcode, payload) {
  const short = payload.length < 126;
  const offset = short ? 2 : 4;
  const buffer = Buffer.alloc(offset + 4 + payload.length);
  buffer[0] = 0x80 | opcode;
  buffer[1] = 0x80 | (short ? payload.length : 126);
  if (!short) buffer.writeUInt16BE(payload.length, 2);
  randomBytes(4).copy(buffer, offset);
  for (let i = 0; i < payload.length; i++) buffer[offset + 4 + i] = payload[i] ^ buffer[offset + i % 4];
  return buffer;
}

/** A bounded text-only WebSocket client for Codex's local Unix App Server. */
export function connectCodexUnix(socketPath, signal) {
  if (!isAbsolute(socketPath)) throw Error('codex_task_endpoint');
  const entry = lstatSync(socketPath);
  if (entry.uid !== process.getuid()) throw Error('codex_task_endpoint');
  if (entry.isSymbolicLink()) socketPath = realpathSync(socketPath);
  const target = lstatSync(socketPath);
  if (!target.isSocket() || target.uid !== process.getuid()) throw Error('codex_task_endpoint');
  signal.throwIfAborted();
  const key = randomBytes(16).toString('base64');
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const ready = Promise.withResolvers(), done = Promise.withResolvers();
  let socket, pending, id = 0, closed = false;
  let buffer = Buffer.alloc(0), fragments = [], messageBytes = 0;
  const req = request({socketPath, path: '/', method: 'GET', agent: false,
    headers: {Host: 'localhost', Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key,
      'Sec-WebSocket-Version': '13'}});

  function close() {
    if (!closed) {
      closed = true;
      ready.reject(Error('codex_task_unavailable'));
      pending?.reject(Error('codex_task_unavailable'));
      if (socket) socket.destroy();
      else req.destroy();
    }
    return done.promise;
  }
  const abort = () => { void close(); };
  signal.addEventListener('abort', abort, {once: true});
  req.on('error', abort);
  req.once('close', () => { if (!socket) { abort(); done.resolve(); } });
  req.once('response', response => { response.destroy(); abort(); });

  function sendFrame(opcode, payload) {
    if (closed || !socket?.writable || payload.length > 65535 || !socket.write(frame(opcode, payload)))
      throw Error('codex_task_unavailable');
  }
  function receive(data) {
    if (closed) return;
    try {
      buffer = Buffer.concat([buffer, data]);
      if (buffer.length > limit + 65536) throw Error('codex_ws_limit');
      while (buffer.length >= 2) {
        const first = buffer[0], opcode = first & 15, fin = Boolean(first & 128);
        if ((first & 112) || (buffer[1] & 128)) throw Error('codex_ws_frame');
        let bytes = buffer[1] & 127, offset = 2;
        if (bytes === 126) {
          if (buffer.length < 4) break;
          bytes = buffer.readUInt16BE(2); offset = 4;
          if (bytes < 126) throw Error('codex_ws_length');
        } else if (bytes === 127) {
          if (buffer.length < 10) break;
          if (buffer.readUInt32BE(2) !== 0) throw Error('codex_ws_length');
          bytes = buffer.readUInt32BE(6); offset = 10;
          if (bytes < 65536) throw Error('codex_ws_length');
        }
        if (bytes > limit || (opcode >= 8 && (!fin || bytes > 125))) throw Error('codex_ws_length');
        if (buffer.length < offset + bytes) break;
        const payload = buffer.subarray(offset, offset + bytes);
        buffer = buffer.subarray(offset + bytes);
        if (opcode === 8) { abort(); return; }
        if (opcode === 9) { sendFrame(10, payload); continue; }
        if (opcode === 10) continue;
        if (opcode !== (fragments.length ? 0 : 1)) throw Error('codex_ws_opcode');
        messageBytes += bytes;
        if (messageBytes > limit || fragments.length >= 256) throw Error('codex_ws_limit');
        fragments.push(!fin ? Buffer.from(payload) : payload);
        if (!fin) continue;
        const value = JSON.parse(decode.decode(Buffer.concat(fragments, messageBytes)));
        fragments = [];
        messageBytes = 0;
        if (pending && value?.id === pending.id && !value.method) {
          if (value.error || !Object.hasOwn(value, 'result')) pending.reject(Object.assign(Error('codex_task_request'),
            {rpcCode: Number.isInteger(value.error?.code) ? value.error.code : undefined}));
          else pending.resolve(value.result);
        }
      }
    } catch { abort(); }
  }
  req.once('upgrade', (response, peer, head) => {
    socket = peer;
    socket.on('error', abort);
    socket.once('close', () => { abort(); done.resolve(); });
    if (closed) { socket.destroy(); return; }
    if (response.statusCode !== 101 || response.headers.upgrade?.toLowerCase() !== 'websocket' ||
        response.headers['sec-websocket-accept'] !== accept || response.headers['sec-websocket-extensions']) {
      abort(); return;
    }
    socket.on('data', receive);
    receive(head);
    if (!closed) ready.resolve();
  });
  req.end();

  const send = value => sendFrame(1, Buffer.from(JSON.stringify(value)));
  return {async ready() {
    try { await ready.promise; }
    finally { signal.removeEventListener('abort', abort); }
  }, send, async request(method, params, deadline) {
    deadline.throwIfAborted();
    if (pending) throw Error('codex_task_busy');
    const response = Promise.withResolvers();
    pending = {id: ++id, ...response};
    deadline.addEventListener('abort', abort, {once: true});
    try { send({id, method, params}); return await response.promise; }
    finally { pending = undefined; deadline.removeEventListener('abort', abort); }
  }, close, get closed() { return closed; }};
}
