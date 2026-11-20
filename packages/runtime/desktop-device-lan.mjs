import {once} from 'node:events';
import {createServer} from 'node:net';
import {networkInterfaces} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {requireThat} from '../core/protocol.mjs';
import {isPrivateIPv4} from './private-ipv4.mjs';
import {createDeviceTcpAdapter} from './device-tcp-session.mjs';

const ipNumber = address => address.split('.').reduce((ip, byte) => ip * 256 + Number(byte), 0);

function endpointGate({address, port}, interfaces, fixture) {
  requireThat(Number.isInteger(port) && port >= (fixture ? 0 : 1) && port <= 65535, 'device_lan_port');
  if (fixture) {
    requireThat(address === '127.0.0.1', 'device_lan_fixture');
    return socket => socket.localAddress === address && socket.remoteAddress === address;
  }
  requireThat(isPrivateIPv4(address), 'device_lan_address');
  const local = Object.values(interfaces()).flat().filter(entry => entry?.address === address &&
    entry.family === 'IPv4' && entry.internal === false);
  requireThat(local.length === 1 && local[0].cidr && local[0].netmask, 'device_lan_interface');
  const bits = Number(local[0].cidr.split('/').at(-1));
  requireThat(Number.isInteger(bits) && bits >= 8 && bits <= 30, 'device_lan_subnet');
  const mask = ipNumber(local[0].netmask);
  const subnet = ipNumber(address) & mask;
  return socket => socket.localAddress === address && socket.localPort === port &&
    isPrivateIPv4(socket.remoteAddress) && (ipNumber(socket.remoteAddress) & mask) === subnet;
}

function closeServer(server) {
  return server && new Promise((resolve, reject) => server.close(error => {
    if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
    else resolve();
  }));
}

/** Pair the managed Desktop query service and existing enrollment owner.
 * This process owns the transient pin. Either owner's exit drains the
 * listener and every attached adapter. Only trusted host code calls this API. */
export function createDesktopDeviceLan({address, port}, {interfaces = networkInterfaces, wait = delay,
  report = console.error, fixture = false} = {}) {
  const stop = new AbortController(), signal = stop.signal;
  let enrollment, telemetry, server, adapter, task, closing, releasing;
  const addressOf = () => server?.address() ?? null;

  function release() {
    return releasing ??= Promise.all([adapter?.close(), closeServer(server)]).then(() => {});
  }

  async function provision() {
    const owner = enrollment.owner;
    requireThat(enrollment.usbIdentity === telemetry.usbIdentity, 'device_lan_target');
    const allowed = endpointGate({address, port}, interfaces, fixture);
    async function readyUsb() {
      for (;;) {
        signal.throwIfAborted();
        const status = owner.status();
        if (status.phase === 'bound' && !status.busy && telemetry.usbReady()) return status;
        await wait(1000, undefined, {signal, ref: false});
      }
    }
    await readyUsb();
    signal.throwIfAborted();
    server = createServer(socket => {
      if (signal.aborted || !adapter || !allowed(socket)) return socket.destroy();
      socket.setNoDelay(true);
      adapter.accept(socket);
    });
    server.maxConnections = 2;
    server.on('error', () => {
      if (adapter && !signal.aborted) {
        report('[dsh-pet-hub] Device LAN listener stopped.');
        void close().catch(reportReleaseError);
      }
    });
    const listening = once(server, 'listening', {signal});
    server.listen({host: address, port, exclusive: true, signal});
    await listening;
    let result;
    do {
      const {instanceId, revision} = await readyUsb();
      signal.throwIfAborted();
      result = await owner.lanArm({instanceId, revision, address, port: addressOf().port}, {signal});
      if (signal.aborted) result?.trust?.revoke();
      signal.throwIfAborted();
      if (result.status === 'busy') await wait(1000, undefined, {signal, ref: false});
    } while (result.status === 'busy');
    requireThat(result.status === 'ok' && result.trust, 'device_lan_arm');
    try {
      adapter = createDeviceTcpAdapter({trust: result.trust, signal, usbIdentity: telemetry.usbIdentity,
        attach: telemetry.attach, pushStatus: true});
      result.trust.signal.addEventListener('abort', trustRevoked, {once: true});
    } catch (error) { result.trust.revoke(); throw error; }
    function trustRevoked() { if (!signal.aborted) void close().catch(reportReleaseError); }
  }

  function reportReleaseError() { report('[dsh-pet-hub] Device LAN listener release not confirmed.'); }

  function close() {
    if (closing) return closing;
    stop.abort();
    return closing = Promise.all([task, release()]).then(() => {});
  }

  function start() {
    if (!enrollment || !telemetry || task) return;
    task = provision().catch(async () => {
      if (!signal.aborted) report('[dsh-pet-hub] Device LAN listener unavailable. USB remains usable.');
      await release();
    });
    void task.catch(reportReleaseError);
  }

  function watch(lifetime) {
    requireThat(!signal.aborted && !lifetime.aborted, 'device_lan_closed');
    const abort = () => void close().catch(reportReleaseError);
    lifetime.addEventListener('abort', abort, {once: true});
    signal.addEventListener('abort', () => lifetime.removeEventListener('abort', abort), {once: true});
  }

  return Object.freeze({
    connectEnrollment({owner, signal: lifetime}) {
      requireThat(!enrollment && typeof owner.lanArm === 'function' && typeof owner.lanUsbIdentity === 'string', 'device_lan_enrollment');
      watch(lifetime);
      enrollment = {owner, usbIdentity: owner.lanUsbIdentity};
      start();
      return close;
    },
    connectTelemetry({usbIdentity, attach, usbReady, signal: lifetime}) {
      requireThat(!telemetry && typeof usbReady === 'function', 'device_lan_telemetry');
      watch(lifetime);
      telemetry = {usbIdentity, attach, usbReady};
      start();
      return close;
    },
    address: addressOf,
    signal,
    actionTarget: () => signal.aborted ? undefined : adapter?.actionTarget(),
    close,
  });
}
