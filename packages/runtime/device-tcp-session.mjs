import {createECDH, randomBytes, timingSafeEqual} from 'node:crypto';
import {addAbortListener} from 'node:events';
import {requireThat} from '../core/protocol.mjs';
import {createVpc1Owner} from '../core/playback-owner.mjs';
import {decodeVpc1, VPC1_KIND} from '../core/playback-wire.mjs';
import {VPL1, createVpl1Framer, decodeVpl1Status, openVpl1, sealVpl1, vpl1Frame, vpl1Keys, vpl1Tag,
  vpl1StatusTicket, vpl1Transcript} from './device-tcp-wire.mjs';

const handshakeMs = 9000, retiredLimit = 32;
const claimed = new WeakSet();
const nonzero = bytes => bytes.some(byte => byte !== 0);
const exact = (a, b) => a.length === b.length && timingSafeEqual(a, b);

/** Manage one pinned device. The caller owns the listener and supplies its
 * accepted sockets. Status attach is the private Desktop provider callback.
 * close() aborts signing and waits for all owned sockets and sign jobs. */
export function createDeviceTcpAdapter({trust, usbIdentity = trust.usbIdentity, attach, signal,
  now = () => performance.now(), statusVersion = 2, pushStatus = false, schedule = setTimeout, unschedule = clearTimeout}) {
  requireThat(trust.usbIdentity === usbIdentity, 'vpl1_usb_target');
  requireThat([0, 1, 2].includes(statusVersion) && (!pushStatus || (statusVersion === 2 && typeof attach === 'function')),
    'vpl1_status_version');
  const owner = createVpc1Owner({now});
  const lifetime = signal ? AbortSignal.any([signal, trust.signal]) : trust.signal;
  const connections = new Set(), retired = new Set();
  let candidate, active, boot, floor = 0, stopped, closing;
  lifetime.throwIfAborted();
  requireThat(!claimed.has(trust), 'vpl1_trust_in_use');
  claimed.add(trust);
  const abortListener = addAbortListener(lifetime, () => void close());

  function close() {
    if (closing) return closing;
    stopped = true;
    abortListener[Symbol.dispose]();
    trust.revoke();
    const drains = [...connections].map(connection => {
      connection.stop('revoked');
      return connection.done;
    });
    return closing = Promise.all(drains).then(() => {});
  }

  function accept(socket) {
    if (stopped || lifetime.aborted || candidate || connections.size >= 2 || socket.destroyed) {
      socket.destroy();
      return false;
    }
    const framer = createVpl1Framer(statusVersion), abort = new AbortController();
    const socketClosed = Promise.withResolvers();
    let phase = VPL1.hello, link, telemetry, legacyTimer, ackTimer, signing, secretKeys;
    let peerBoot, version, transcript, session, rx = 0, tx = 0, probe;
    let statusSequence = 0, lastStatusAt, ackSequence = 0, lastAckAt;
    let ended = false;
    const timer = setTimeout(() => stop('handshake_timeout'), handshakeMs);
    timer.unref();
    const fresh = () => pushStatus && !ended && active === connection &&
      lastStatusAt !== undefined && now() - lastStatusAt < 6000;
    const target = Object.freeze({play(role, action, ttlMs) {
      if (!fresh()) return false;
      try { trust.assertCurrent(); }
      catch { stop('revoked'); return false; }
      return owner.playCurrent(role, action, ttlMs);
    }});
    const connection = {stop, actionTarget: () => fresh() ? target : undefined,
      done: socketClosed.promise.then(() => signing).finally(() => {
      if (candidate === connection) candidate = undefined;
      connections.delete(connection);
    })};
    connections.add(connection);
    candidate = connection;

    function stop(reason) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      clearInterval(legacyTimer);
      if (ackTimer !== undefined) unschedule(ackTimer);
      abort.abort();
      if (active === connection) active = undefined;
      telemetry?.disconnect();
      link?.close(reason);
      secretKeys?.fromDevice.fill(0);
      secretKeys?.toDevice.fill(0);
      socket.destroy();
    }

    function send(frame) {
      requireThat(!ended && socket.writable && socket.write(frame), 'vpl1_backpressure');
    }

    function sendRecord(type, payload) {
      send(sealVpl1(type, ++tx, payload, secretKeys.toDevice));
    }

    function sendStatusAck() {
      ackTimer = undefined;
      if (ended || ackSequence === statusSequence || now() - lastStatusAt >= 6000) return;
      try {
        trust.assertCurrent();
        const data = Buffer.alloc(8);
        data.writeUInt32LE(session);
        data.writeUInt32LE(statusSequence, 4);
        sendRecord(VPL1.statusAck, data);
        ackSequence = statusSequence;
        lastAckAt = now();
      } catch { stop('status_ack_failed'); }
    }

    function queueStatusAck() {
      if (ackTimer !== undefined) return;
      const wait = ackSequence === 0 ? 0 : lastAckAt + 9000 - now();
      if (wait <= 0) sendStatusAck();
      else {
        ackTimer = schedule(sendStatusAck, wait);
        ackTimer?.unref?.();
      }
    }

    async function authenticate(data) {
      trust.assertCurrent();
      const offers = data[193];
      requireThat(trust.matches(data.subarray(0, 88)) && nonzero(data.subarray(96, 128)) &&
        data[128] === 4 && (pushStatus ? offers === 4 : (offers & ~3) === 0), 'vpl1_hello');
      peerBoot = data.readBigUInt64LE(88);
      requireThat(peerBoot !== 0n && !retired.has(peerBoot), 'vpl1_boot');
      const offersVersion = statusVersion !== 0 && (offers & (1 << (statusVersion - 1))) !== 0;
      version = pushStatus ? 3 : offersVersion && attach ? statusVersion : 0;
      const ephemeral = createECDH('prime256v1');
      const publicKey = ephemeral.generateKeys();
      const prefix = Buffer.concat([randomBytes(32), publicKey, Buffer.from([version])]);
      transcript = vpl1Transcript(data, prefix);
      const shared = ephemeral.computeSecret(data.subarray(128, 193));
      try { secretKeys = vpl1Keys(shared, transcript); }
      finally { shared.fill(0); }
      const message = Buffer.concat([Buffer.from('VPL1/hub-auth'), transcript]);
      const signature = await trust.sign(message, abort.signal);
      abort.signal.throwIfAborted();
      phase = VPL1.deviceFinish;
      send(vpl1Frame(VPL1.auth, Buffer.concat([prefix, signature])));
    }

    function finish(data) {
      trust.assertCurrent();
      const serial = data.subarray(0, 4);
      session = serial.readUInt32LE();
      requireThat(session !== 0 && trust.verifyDevice(Buffer.concat([Buffer.from('VPL1/device-auth'), transcript, serial]),
        data.subarray(4, 68)) && exact(vpl1Tag(secretKeys.fromDevice, 'device-finish', transcript, serial),
        data.subarray(68)), 'vpl1_device_auth');
      phase = VPL1.ready;
      send(vpl1Frame(VPL1.hubFinish, vpl1Tag(secretKeys.toDevice, 'hub-finish', transcript, serial)));
    }

    function arm(payload) {
      requireThat(payload.readUInt32LE() === session && candidate === connection && !retired.has(peerBoot) &&
        (boot === peerBoot ? session > floor : retired.size < retiredLimit), 'vpl1_session');
      if (boot !== undefined && boot !== peerBoot) retired.add(boot);
      const newBoot = boot !== peerBoot;
      boot = peerBoot;
      floor = session;
      candidate = undefined;
      clearTimeout(timer);
      phase = VPL1.control;
      active = connection;
      link = owner.attach(session, {newBoot, externalHeartbeat: version !== 0,
        send: payload => sendRecord(VPL1.control, payload), terminate: stop});
      if (ended) return;
      if (pushStatus) {
        telemetry = attach({usbIdentity: trust.usbIdentity, push: true, close: () => stop('status_closed')});
        if (ended) telemetry.disconnect();
      } else if (version) {
        telemetry = attach({
          usbIdentity: trust.usbIdentity, close: () => stop('status_closed'), probe(id) {
            trust.assertCurrent();
            const sequence = link.probe();
            requireThat(sequence, 'vpl1_ping');
            probe = {id, sequence};
          },
        });
        if (ended) telemetry.disconnect();
      } else {
        legacyTimer = setInterval(() => {
          try { trust.assertCurrent(); link.tick(); }
          catch { stop('control_closed'); }
        }, 250);
        legacyTimer.unref();
      }
    }

    function receive(type, frame) {
      if (ended) return false;
      if (phase === VPL1.hello && type === phase) {
        phase = null;
        signing = authenticate(frame.subarray(8)).catch(() => stop('authentication_failed'));
        return true;
      }
      if (phase === VPL1.deviceFinish && type === phase) {
        finish(frame.subarray(8));
        return true;
      }
      trust.assertCurrent();
      if (phase === VPL1.ready && type === phase) {
        arm(openVpl1(frame, ++rx, secretKeys.fromDevice));
        return !ended;
      }
      requireThat(phase === VPL1.control && active === connection &&
        (type === VPL1.control || (type === VPL1.status && version !== 0)), 'vpl1_direction');
      const payload = openVpl1(frame, ++rx, secretKeys.fromDevice);
      if (type === VPL1.control) {
        const control = decodeVpc1(payload);
        requireThat(!pushStatus || control.kind !== VPC1_KIND.pong, 'vpl1_push_pong');
        return link.receive(control);
      }
      if (pushStatus) {
        const ticket = vpl1StatusTicket(payload, 2);
        requireThat(ticket.session === session && ticket.sequence === statusSequence + 1, 'vpl1_status_ticket');
        requireThat(telemetry.receive(ticket.sequence, decodeVpl1Status(payload, 2).value), 'vpl1_status_rejected');
        statusSequence = ticket.sequence;
        lastStatusAt = now();
        queueStatusAck();
        return !ended;
      }
      const ticket = vpl1StatusTicket(payload, version);
      requireThat(probe && ticket.session === session && ticket.sequence <= probe.sequence, 'vpl1_status_ticket');
      if (ticket.sequence === probe.sequence && probe.id !== null) {
        telemetry.receive(probe.id, decodeVpl1Status(payload, version).value);
        probe.id = null;
      }
      return !ended;
    }

    socket.on('data', chunk => {
      try { framer.push(chunk, receive); }
      catch { stop('protocol_error'); }
    });
    socket.once('end', () => {
      try { framer.finish(); }
      catch { stop('truncated_frame'); return; }
      stop('disconnected');
    });
    socket.on('error', () => stop('transport_error'));
    socket.once('close', () => { stop('disconnected'); socketClosed.resolve(); });
    return true;
  }

  return Object.freeze({accept, close, snapshot: owner.snapshot, actionTarget: () => active?.actionTarget(), setAction(...args) {
    requireThat(!stopped, 'vpl1_closed');
    trust.assertCurrent();
    owner.setAction(...args);
  }});
}
