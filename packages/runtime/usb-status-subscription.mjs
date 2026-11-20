import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {openVerifiedDeviceTty} from './device-maintenance-usb.mjs';
import {serialLines} from './serial-lines.mjs';
import {decodeUsbStatusBody} from './usb-status-wire.mjs';

export function decodeUsbStatusReport(line, id, last) {
  const match = /^id=([0-9a-f]{8}) seq=([1-9][0-9]{0,9}) data=(\S+)$/.exec(line);
  if (!match || match[1] !== id) return;
  const sequence = Number(match[2]);
  if (sequence <= last || sequence > 0xffffffff) return;
  const status = decodeUsbStatusBody(match[3]);
  if (status) return {sequence, status};
}

/** Hold the verified descriptor for one subscription. Returning always drains it. */
export async function subscribeUsbDeviceStatus({options, signal, publish, now = () => performance.now(), pause = delay}) {
  signal.throwIfAborted();
  const io = await openVerifiedDeviceTty({...options, signal});
  const tty = serialLines(io, '@VP8_STATUS3_PUSH ');
  const id = randomBytes(4).toString('hex');
  let tried = false, sequence = 0;
  const send = (operation, abort) => tty.write('STATUS3_' + operation + ' ' + id + '\n', abort);
  try {
    do { signal.throwIfAborted(); } while (await tty.read({discard: true}));
    tried = true;
    await send('SUB', AbortSignal.any([signal, AbortSignal.timeout(900)]));
    let lastContact = now(), renewed = lastContact;
    for (;;) {
      signal.throwIfAborted();
      const time = now();
      if (time - lastContact >= 9000) return;
      if (time - renewed >= 9000) {
        await send('SUB', AbortSignal.any([signal, AbortSignal.timeout(900)]));
        renewed = now();
      }
      for (const line of await tty.read() ?? []) {
        signal.throwIfAborted();
        const next = decodeUsbStatusReport(line, id, sequence);
        if (!next) continue;
        sequence = next.sequence;
        lastContact = now();
        publish(next.status);
      }
      await pause(20, undefined, {signal});
    }
  } finally {
    if (tried) {
      // A lost cable or reply is still bounded by the device subscription lease.
      try { await send('UNSUB', AbortSignal.timeout(300)); }
      catch { /* The exclusive descriptor must still be closed. */ }
    }
    try { await io.close(); }
    catch (cause) { throw Object.assign(Error('device_usb_push_release', {cause}), {usbReleaseUnconfirmed: true}); }
  }
}

/** Own the USB subscription for the plugin lifetime, independently of page visibility. */
export function createUsbStatusSubscription({lifetime, networkFresh, usbAttachment, usbStatus, subscribe,
  clock, now = clock?.now ?? (() => performance.now()), schedule = clock?.schedule ?? setTimeout,
  unschedule = clock?.unschedule ?? clearTimeout, report = console.error}) {
  let attachment, baselined, value, current, timer, closing, retryAt = 0, unsafe = false;
  function refresh() {
    if (lifetime.aborted || closing || unsafe) return;
    const {sameUsbTarget, usbBusy} = usbStatus();
    // Periodic state belongs to the same USB target as the saved registration.
    const next = sameUsbTarget === true ? usbAttachment() : undefined;
    if (next !== attachment) {
      current?.stop.abort();
      attachment = next;
      baselined = false;
      value = undefined;
      retryAt = 0;
    }
    if (!attachment || usbBusy || (baselined && networkFresh())) {
      if (usbBusy) value = undefined;
      current?.stop.abort();
      return;
    }
    if (current || now() < retryAt) return;
    const entry = {stop: new AbortController()};
    current = entry;
    const signal = AbortSignal.any([lifetime, entry.stop.signal]);
    entry.done = Promise.resolve().then(() => subscribe({signal, async yieldToForeground() {
      entry.stop.abort();
      await entry.done;
    }, publish(status) {
      if (signal.aborted || current !== entry) return;
      value = {status, at: now()};
      baselined = true;
      if (networkFresh()) entry.stop.abort();
    }})).catch(error => {
      if (error.usbReleaseUnconfirmed) {
        unsafe = true;
        report('[dsh-pet-hub] USB status subscription release not confirmed.');
        throw error;
      }
      if (!signal.aborted) retryAt = now() + 5000;
    }).finally(() => {
      if (!signal.aborted) retryAt = Math.max(retryAt, now() + 5000);
      if (current === entry) current = undefined;
    });
    void entry.done.catch(() => {});
  }

  function tick() {
    timer = undefined;
    if (lifetime.aborted || closing) return;
    refresh();
    timer = schedule(tick, 250);
    timer?.unref?.();
  }

  function close() {
    if (closing) return closing;
    lifetime.removeEventListener('abort', abort);
    if (timer !== undefined) unschedule(timer);
    current?.stop.abort();
    return closing = Promise.resolve(current?.done);
  }
  function abort() { void close().catch(() => {}); }
  lifetime.addEventListener('abort', abort, {once: true});
  tick();
  return {
    refresh,
    close,
    snapshot() {
      if (usbStatus().sameUsbTarget !== true) return {usbPresent: false, status: null};
      const status = value && now() - value.at < 6000 ? value.status : null;
      return {usbPresent: Boolean(attachment), status};
    },
  };
}
