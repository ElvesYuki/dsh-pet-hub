import {createHmac} from 'node:crypto';
import {addAbortListener, once} from 'node:events';
import {createServer} from 'node:net';
import {decodePbp1Frame, encodePbp1Frame} from '../core/native400-pbp1-wire.mjs';
import {native400UsbPairingScope} from './native400-usb-pairing.mjs';
import {isPrivateMediaIPv4} from './native400-tcp-media-socket.mjs';
import {prepareNative400LanMediaTransfer} from './native400-tcp-media.mjs';

const armedPairings = new WeakSet();

function need(ok, code) {
  if (!ok) throw new Error(code);
}

export function encodeNative400LanArm({boot, proposal, address, port, beginSha, ssid, password, key}) {
  need(isPrivateMediaIPv4(address) && Number.isInteger(port) && port >= 1 && port <= 65535, 'media_lan_endpoint');
  need(ssid instanceof Uint8Array && ssid.length >= 1 && ssid.length <= 32 && !ssid.includes(0) &&
    password instanceof Uint8Array && (password.length === 0 || (password.length >= 8 && password.length <= 63 &&
      password.every(byte => byte >= 32 && byte <= 126))), 'media_lan_wifi');
  need(typeof boot === 'string' && /^[1-9][0-9]{0,19}$/.test(boot) && BigInt(boot) <= 0xffffffffffffffffn &&
    Number.isInteger(proposal) && proposal >= 1 && proposal <= 0xffffffff && typeof beginSha === 'string' &&
    /^[0-9a-f]{64}$/.test(beginSha) && /[^0]/.test(beginSha), 'media_lan_scope');
  const body = Buffer.alloc(180);
  let tag;
  try {
    body.writeBigUInt64LE(BigInt(boot), 0);
    body.writeUInt32LE(proposal, 8);
    body.set(address.split('.').map(Number), 12);
    body.writeUInt16LE(port, 16);
    body[18] = ssid.length;
    body[19] = password.length;
    body.set(ssid, 20);
    body.set(password, 52);
    body.set(Buffer.from(beginSha, 'hex'), 116);
    tag = createHmac('sha256', key).update('PMA1/usb-lan-arm/v1', 'ascii').update(body.subarray(0, 148)).digest();
    body.set(tag, 148);
    return encodePbp1Frame({kind: 'lan-arm', body});
  } finally {
    tag?.fill(0);
    body.fill(0);
  }
}

function armAccepted(reply, scope) {
  need(reply, 'media_lan_arm_unconfirmed');
  const state = decodePbp1Frame(reply);
  need(state.kind === 'state' && state.device === scope.device && state.boot === scope.boot &&
    state.proposal === scope.proposal && state.fingerprint === scope.fingerprint && state.phase === 'active' &&
    state.event === 'ok', 'media_lan_arm_rejected');
}

async function waitForPeer(promise, signal) {
  const cancelled = Promise.withResolvers();
  const abort = addAbortListener(signal, () => cancelled.reject(new Error('media_lan_connect_deadline')));
  try {
    signal.throwIfAborted();
    return await Promise.race([promise, cancelled.promise]);
  } finally { abort[Symbol.dispose](); }
}

/** Explicit one-shot caller. run consumes and clears the supplied Wi-Fi buffers.
 * The second argument is a server factory for isolated host tests. Production
 * uses the built-in TCP listener, which receives exactly the pinned endpoint.
 */
export function createNative400LanMaintenance(options, makeServer = createServer) {
  need(options?.enabled === true, 'media_lan_disabled');
  const {address, port, pairing, openArmTransport} = options;
  const endpoint = Object.freeze({address, port});
  need(isPrivateMediaIPv4(address) && Number.isInteger(port) && port >= 1 && port <= 65535, 'media_lan_endpoint');
  const scope = native400UsbPairingScope(pairing);
  need(scope && typeof openArmTransport === 'function', 'media_lan_scope');
  const job = prepareNative400LanMediaTransfer(options, endpoint);
  const controller = new AbortController();
  let running, stopped;

  async function perform({ssid, password}) {
    const startedAt = performance.now();
    const incoming = Promise.withResolvers();
    let transport, packet, socket, server, closingListener, revocation, result;
    const closeListener = () => closingListener ??= new Promise(resolve => server.close(() => resolve()));
    try {
      controller.signal.throwIfAborted();
      const {key, revoked} = pairing.acquire(pairing.identity);
      const signal = AbortSignal.any([controller.signal, revoked]);
      signal.throwIfAborted();
      need(!armedPairings.has(pairing), 'media_lan_used');
      packet = encodeNative400LanArm({...scope, ...endpoint, beginSha: job.plan.beginSha, ssid, password, key});
      ssid.fill(0);
      password.fill(0);
      server = makeServer({pauseOnConnect: true}, candidate => {
        if (socket) { candidate.destroy(); return; }
        socket = candidate;
        // The socket may disconnect while USB acknowledgment is in flight.
        socket.on('error', () => {});
        void closeListener();
        incoming.resolve(socket);
      });
      server.on('error', error => controller.abort(error));
      const ready = once(server, 'listening');
      server.listen({host: address, port, exclusive: true, backlog: 1});
      await ready;
      signal.throwIfAborted();
      transport = await openArmTransport();
      signal.throwIfAborted();
      need(!armedPairings.has(pairing), 'media_lan_used');
      armedPairings.add(pairing);
      try {
        armAccepted(await transport.exchange(packet, {signal: AbortSignal.any([signal, AbortSignal.timeout(2000)])}), scope);
      } finally { packet.fill(0); }
      const peer = await waitForPeer(incoming.promise, AbortSignal.any([signal, AbortSignal.timeout(20000)]));
      signal.throwIfAborted();
      const transfer = job.start(peer);
      revocation = addAbortListener(signal, () => { void job.close().catch(() => {}); });
      result = await transfer;
    } finally {
      if (ssid instanceof Uint8Array) ssid.fill(0);
      if (password instanceof Uint8Array) password.fill(0);
      packet?.fill(0);
      revocation?.[Symbol.dispose]();
      try { await job.close(); } finally {
        socket?.destroy();
        try { if (server) await closeListener(); } finally { await transport?.close(); }
      }
    }
    return {...result, timing: {...result.timing, totalMs: performance.now() - startedAt}};
  }

  return Object.freeze({plan: job.plan,
    run(wifi) {
      need(!running && !stopped, 'media_lan_used');
      return running = Promise.resolve().then(() => perform(wifi));
    },
    close() {
      return stopped ??= Promise.resolve().then(async () => {
        controller.abort(new Error('media_lan_closed'));
        if (running) await Promise.allSettled([running]);
        else await job.close();
      });
    }
  });
}
