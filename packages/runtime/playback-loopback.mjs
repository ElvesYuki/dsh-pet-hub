import {createVpc1Framer} from '../core/playback-wire.mjs';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Attach an already connected fixture socket. This adapter never starts a listener. */
export function attachVpc1Loopback(socket, owner, session, {automaticHeartbeat = true} = {}) {
  if (socket.destroyed || !loopback.has(socket.localAddress) || !loopback.has(socket.remoteAddress))
    throw new Error('vpc1_loopback_only');
  const framer = createVpc1Framer();
  let timer, link;
  const terminate = () => { clearInterval(timer); socket.destroy(); };
  try {
    link = owner.attach(session, {terminate, send(bytes) {
      if (!socket.writable || !socket.write(bytes)) throw new Error('vpc1_backpressure');
    }});
  } catch (error) { terminate(); throw error; }
  socket.on('data', chunk => {
    try { framer.push(chunk, link.receive); }
    catch { link.close('protocol_error'); }
  });
  socket.once('end', () => {
    try { framer.finish(); }
    catch { link.close('truncated_frame'); return; }
    link.close('disconnected');
  });
  socket.on('error', () => link.close('transport_error'));
  socket.once('close', () => link.close('disconnected'));
  if (automaticHeartbeat && !socket.destroyed) {
    timer = setInterval(() => {
      try { link.tick(); }
      catch { link.close('clock_error'); }
    }, 100);
    timer.unref();
  }
  return link;
}
