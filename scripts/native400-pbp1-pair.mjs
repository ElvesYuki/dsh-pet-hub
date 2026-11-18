import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {parseArgs} from 'node:util';
import {createNative400UsbPairing, openNative400Pbp1Serial} from '../packages/runtime/index.mjs';

const usage = 'node scripts/native400-pbp1-pair.mjs --pair [--button] --helper /absolute/path/pbp1-tty --port /dev/cu.usbmodem… --device <32 hex>';

export function createPbp1ConfirmationPrompt({button, terminal, print = console.log}) {
  return async ({fingerprint}, {signal}) => {
    if (button === true) {
      signal.throwIfAborted();
      // The pairing owner calls this only after verifying the Pending HMAC and scope.
      print('请等设备显示提示，再在 15 秒内短按一次实体 BOOT 键。');
      return fingerprint;
    }
    print(`管理端指纹 ${fingerprint}`);
    const answer = await terminal.question('请输入设备屏幕上的完整指纹，留空取消。\n> ', {signal});
    const normalized = answer.replace(/\s/g, '');
    if (normalized.toLowerCase() === fingerprint) print('设备显示确认提示后，先松开手指，再长按至少 1.2 秒。');
    return normalized;
  };
}

async function main() {
  const {values} = parseArgs({options: {help: {type: 'boolean'}, pair: {type: 'boolean'}, button: {type: 'boolean'},
    helper: {type: 'string'}, port: {type: 'string'}, device: {type: 'string'}}});
  if (values.help) { console.log(usage); return; }
  if (!values.pair || !values.helper || !values.port || !/^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]*$/.test(values.port) ||
      !/^[0-9a-fA-F]{32}$/.test(values.device ?? '') || /^0+$/.test(values.device) ||
      process.platform !== 'darwin' || !process.stdin.isTTY || !process.stdout.isTTY) throw new Error('pbp_cli_arguments');

  const terminal = createInterface({input: process.stdin, output: process.stdout});
  const stop = new AbortController();
  let transport, owner;
  const interrupt = () => {
    stop.abort();
    void owner?.close().catch(() => {});
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  terminal.on('SIGINT', interrupt);
  terminal.once('close', interrupt);
  try {
    transport = await openNative400Pbp1Serial({enabled: true, port: values.port, helper: values.helper});
    stop.signal.throwIfAborted();
    owner = createNative400UsbPairing({enabled: true, transport,
      identity: {device: values.device.toLowerCase(), hub: randomBytes(16).toString('hex'),
        binding: randomBytes(16).toString('hex'), epoch: '1'},
      confirmFingerprint: createPbp1ConfirmationPrompt({button: values.button, terminal})});
    const pairing = await owner.start();
    console.log(`PBP1 Active，设备 boot ${pairing.boot}，USB 已退出。`);
    await terminal.question('这是独立配对验证。按回车撤销本进程的 RAM 租用并退出。\n', {signal: stop.signal});
  } finally {
    try {
      if (owner) await owner.close();
      else await transport?.close();
    } finally {
      terminal.removeListener('close', interrupt);
      terminal.close();
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    }
  }
}

if (import.meta.main) main().catch(error => {
  const reason = /^pbp_[a-z_]+$/.test(error.message) ? error.message : 'pbp_cli_stopped';
  console.error(reason);
  if (reason === 'pbp_cli_arguments') console.error(usage);
  process.exitCode = 1;
});
