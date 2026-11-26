import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createServer, isIPv4} from 'node:net';
import {networkInterfaces} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {requireThat} from '../core/protocol.mjs';
import {isPrivateIPv4} from './private-ipv4.mjs';
import {createDeviceTcpAdapter} from './device-tcp-session.mjs';
import {registerDeviceLanService} from './device-lan-advertisement.mjs';

const ipNumber = address => address.split('.').reduce((ip, byte) => ip * 256 + Number(byte), 0);

/** An explicit interface with more than one eligible address is ambiguous. */
export function selectDeviceLanAddress(entries, {fixture = false} = {}) {
  const candidates = (entries ?? []).filter(entry => entry.family === 'IPv4' &&
    (fixture ? entry.address === '127.0.0.1' : !entry.internal && isPrivateIPv4(entry.address)) &&
    typeof entry.cidr === 'string' && /^([89]|[12]\d|30)$/.test(entry.cidr.split('/')[1]) && isIPv4(entry.netmask));
  if (candidates.length !== 1) return null;
  const {address, netmask} = candidates[0];
  return {address, netmask};
}

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
export function createDesktopDeviceLan({address, port, discoveryInterface = ''}, {interfaces = networkInterfaces, wait = delay,
  report = console.error, fixture = false, publish = registerDeviceLanService} = {}) {
  const stop = new AbortController(), signal = stop.signal;
  const discovery = discoveryInterface !== '';
  const instance = discovery ? 'DSH Pet Hub ' + randomBytes(8).toString('hex') : null;
  let enrollment, telemetry, server, listeningEndpoint, listenerFailed, adapter, advertisement, task, closing, releasing;
  const addressOf = () => server?.address() ?? null;

  async function releaseEndpoint() {
    const previousServer = server, previousAdvertisement = advertisement;
    server = advertisement = listeningEndpoint = undefined;
    await Promise.all([previousAdvertisement?.close(), closeServer(previousServer), adapter?.disconnect()]);
  }

  function release() {
    return releasing ??= Promise.all([adapter?.close(), releaseEndpoint()]).then(() => {});
  }

  const currentEndpoint = () => selectDeviceLanAddress(interfaces()[discoveryInterface], {fixture});
  const sameEndpoint = (a, b) => a?.address === b?.address && a?.netmask === b?.netmask;
  const pause = () => wait(1000, undefined, {signal, ref: false});

  async function readyUsb(owner) {
    for (;;) {
      signal.throwIfAborted();
      const status = owner.status();
      if (status.phase === 'bound' && !status.busy && telemetry.usbReady()) return status;
      await pause();
    }
  }

  async function listen(endpoint) {
    signal.throwIfAborted();
    const allowed = endpointGate({address: endpoint.address, port}, discovery ?
      () => ({[discoveryInterface]: interfaces()[discoveryInterface] ?? []}) : interfaces, fixture);
    const owned = createServer(socket => {
      if (signal.aborted || server !== owned || listenerFailed || !adapter || !allowed(socket) ||
          (discovery && !sameEndpoint(endpoint, currentEndpoint()))) return socket.destroy();
      socket.setNoDelay(true);
      adapter.accept(socket);
    });
    server = owned;
    listeningEndpoint = endpoint;
    listenerFailed = false;
    owned.maxConnections = 2;
    owned.on('error', () => {
      if (server === owned) listenerFailed = true;
      if (adapter && !signal.aborted && !discovery) {
        report('[dsh-pet-hub] Device LAN listener stopped.');
        void close().catch(reportReleaseError);
      }
    });
    const listening = once(owned, 'listening', {signal});
    owned.listen({host: endpoint.address, port, exclusive: true, signal});
    await listening;
  }

  async function arm(owner, endpoint) {
    let result;
    do {
      const {instanceId, revision} = await readyUsb(owner);
      signal.throwIfAborted();
      if (discovery && !sameEndpoint(endpoint, currentEndpoint())) return false;
      result = await owner.lanArm({instanceId, revision, address: endpoint.address, port: addressOf().port}, {signal});
      if (signal.aborted) result?.trust?.revoke();
      signal.throwIfAborted();
      if (result.status === 'busy') await pause();
    } while (result.status === 'busy');
    requireThat(result.status === 'ok' && result.trust, 'device_lan_arm');
    installAdapter(result.trust);
    return true;
  }

  function installAdapter(trust) {
    try {
      adapter = createDeviceTcpAdapter({trust, signal, usbIdentity: telemetry.usbIdentity,
        attach: telemetry.attach, pushStatus: true});
      trust.signal.addEventListener('abort', trustRevoked, {once: true});
    } catch (error) { trust.revoke(); throw error; }
    function trustRevoked() { if (!signal.aborted) void close().catch(reportReleaseError); }
  }

  async function maintainDiscovery(endpoint) {
    let unavailableReported = false;
    while (!signal.aborted) {
      const next = currentEndpoint();
      if (!sameEndpoint(next, endpoint) || listenerFailed || (server && !server.listening)) {
        await releaseEndpoint();
        listenerFailed = false;
        endpoint = next;
      }
      try {
        if (endpoint && !server) await listen(endpoint);
        if (server?.listening && (!advertisement || !advertisement.live())) {
          await advertisement?.close();
          const published = await publish({interfaceName: discoveryInterface, instance, port: addressOf().port, signal});
          if (signal.aborted || !sameEndpoint(endpoint, currentEndpoint())) await published.close();
          else advertisement = published;
        }
        unavailableReported = false;
      } catch (error) {
        signal.throwIfAborted();
        if (server && !server.listening) await releaseEndpoint();
        if (!unavailableReported) report('[dsh-pet-hub] Device LAN discovery unavailable. USB remains usable.');
        unavailableReported = true;
      }
      await pause();
    }
  }

  async function provision() {
    const owner = enrollment.owner;
    requireThat(enrollment.usbIdentity === telemetry.usbIdentity, 'device_lan_target');
    if (!discovery) {
      endpointGate({address, port}, interfaces, fixture);
      await readyUsb(owner);
      const endpoint = {address};
      await listen(endpoint);
      await arm(owner, endpoint);
      return;
    }
    requireThat(/^(?:en[0-9]{1,3}|lo0)$/.test(discoveryInterface) &&
      (fixture || (process.platform === 'darwin' && discoveryInterface !== 'lo0')), 'device_lan_discovery_interface');
    const savedTrust = owner.lanLoad?.();
    if (savedTrust) {
      installAdapter(savedTrust);
      return maintainDiscovery(null);
    }
    for (;;) {
      await readyUsb(owner);
      let endpoint;
      while (!(endpoint = currentEndpoint())) { signal.throwIfAborted(); await pause(); }
      await listen(endpoint);
      if (await arm(owner, endpoint)) return maintainDiscovery(endpoint);
      await releaseEndpoint();
    }
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
    actionTarget: () => !signal.aborted && !listenerFailed && server?.listening &&
      (!discovery || sameEndpoint(listeningEndpoint, currentEndpoint())) ? adapter?.actionTarget() : undefined,
    close,
  });
}
