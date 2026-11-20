import {spawn} from 'node:child_process';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute, normalize} from 'node:path';

function need(condition, code) {
  if (!condition) throw new Error(code);
}

function configure(helper, fd) {
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [], {stdio: ['ignore', 'ignore', 'ignore', fd]});
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    let failed = false;
    child.once('error', () => { failed = true; });
    child.once('close', code => {
      clearTimeout(timer);
      if (!failed && code === 0) resolve();
      else reject(new Error('pbp_serial_exclusive'));
    });
  });
}

/** Shared raw POSIX TTY opener. The caller owns the returned file handle. */
export async function openExclusiveTty({enabled = false, port, helper} = {}) {
  need(enabled === true, 'pbp_serial_disabled');
  need(typeof port === 'string' && /^\/dev\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(port) &&
    normalize(port) === port && typeof helper === 'string' && isAbsolute(helper) && !helper.includes('\0'), 'pbp_serial_path');
  const io = await open(port, constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    need((await io.stat()).isCharacterDevice(), 'pbp_serial_device');
    await configure(helper, io.fd);
    return io;
  } catch (error) {
    try { await io.close(); }
    catch (cause) {
      throw Object.assign(new Error('pbp_serial_release', {cause}), {usbReleaseUnconfirmed: true});
    }
    throw error;
  }
}
