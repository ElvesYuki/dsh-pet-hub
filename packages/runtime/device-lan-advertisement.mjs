import {spawn} from 'node:child_process';
import {requireThat} from '../core/protocol.mjs';

export const deviceLanServiceType = '_dsh-pet-hub._tcp';

/** Own one interface-scoped macOS Bonjour registration. Await close before replacing it. */
export async function registerDeviceLanService({interfaceName, instance, port, signal}) {
  requireThat(/^(?:en[0-9]{1,3}|lo0)$/.test(interfaceName) && /^DSH Pet Hub [a-f0-9]{16}$/.test(instance) &&
    Number.isInteger(port) && port >= 1 && port <= 65535, 'device_lan_advertisement_input');
  signal.throwIfAborted();
  const child = spawn('/usr/bin/dns-sd', ['-i', interfaceName, '-R', instance, deviceLanServiceType, 'local.',
    String(port), 'version=1'], {env: {LC_ALL: 'C', PATH: '/usr/bin:/bin'}, stdio: ['ignore', 'pipe', 'ignore']});
  const ready = Promise.withResolvers(), done = Promise.withResolvers();
  let output = '', live = false, ended = false, killTimer, closing = false;
  const timer = setTimeout(() => stop(Error('device_lan_advertisement_timeout')), 5000);

  function stop(error) {
    if (closing || ended) return;
    closing = true;
    live = false;
    ready.reject(error);
    clearTimeout(timer);
    child.kill();
    if (!ended) killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
  }

  const abort = () => stop(signal.reason);
  signal.addEventListener('abort', abort, {once: true});
  child.stdout.setEncoding('utf8').on('data', chunk => {
    if (live || closing) return;
    output += chunk;
    if (output.length > 4096) return stop(Error('device_lan_advertisement_output'));
    if (!/now registered and active\r?\n/i.test(output)) return;
    live = true;
    clearTimeout(timer);
    ready.resolve();
  });
  child.once('error', () => stop(Error('device_lan_advertisement_spawn')));
  child.once('close', () => {
    ended = true;
    live = false;
    clearTimeout(timer);
    clearTimeout(killTimer);
    signal.removeEventListener('abort', abort);
    ready.reject(Error('device_lan_advertisement_exit'));
    done.resolve();
  });
  if (signal.aborted) abort();
  try { await ready.promise; }
  catch (error) { await done.promise; throw error; }
  return Object.freeze({live: () => live, close() { stop(Error('device_lan_advertisement_closed')); return done.promise; }});
}
