import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {parseArgs} from 'node:util';
import {NATIVE400_BOOT_NAMESPACE} from '../packages/core/native400-bootstrap.mjs';
import {createNative400LanMaintenance, createNative400UsbPairing, openNative400Pbp1Serial} from '../packages/runtime/index.mjs';
import {isPrivateIPv4} from '../packages/runtime/private-ipv4.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {createPbp1ConfirmationPrompt} from './native400-pbp1-pair.mjs';

const usage = 'node scripts/native400-pma1-lan.mjs --run [--tail-timing] --port <usb> --helper <absolute> --device <32hex> --address <RFC1918> --tcp-port <port> --directory <absolute> --manifest <file> --index <file> --root <u64> --generation <u64> --approval-id <id> --license-ref <ref>';
const fields = ['port', 'helper', 'device', 'address', 'tcp-port', 'directory', 'manifest', 'index', 'root', 'generation', 'approval-id', 'license-ref'];

async function main() {
  const {values: args} = parseArgs({options: {run: {type: 'boolean'}, help: {type: 'boolean'}, 'tail-timing': {type: 'boolean'},
    ...Object.fromEntries(fields.map(field => [field, {type: 'string'}]))}});
  if (args.help) { console.log(usage); return; }
  const port = Number(args['tcp-port']);
  const u64 = value => /^[1-9][0-9]{0,19}$/.test(value ?? '') && BigInt(value) < 0xffffffffffffffffn;
  if (!args.run || !fields.every(field => args[field]) || process.platform !== 'darwin' || !process.stdin.isTTY ||
      !process.stdout.isTTY || !/^\/dev\/cu\.usbmodem[A-Za-z0-9_.-]*$/.test(args.port) ||
      !/^[0-9a-fA-F]{32}$/.test(args.device) || /^0+$/.test(args.device) || !isPrivateIPv4(args.address) ||
      !/^[1-9][0-9]{0,4}$/.test(args['tcp-port']) || port > 65535 || !u64(args.root) || !u64(args.generation)) {
    throw new Error('media_lan_arguments');
  }
  const [sourceBytes, indexBytes] = await Promise.all([readFile(args.manifest), readFile(args.index)]);
  let muted = false;
  const output = new Writable({write: (chunk, encoding, done) => process.stdout.write(chunk, encoding, done)});
  const visibleWrite = output.write.bind(output);
  // Suppress readline echo before it can queue behind a slower stdout write.
  output.write = (...args) => muted ? true : visibleWrite(...args);
  const terminal = createInterface({input: process.stdin, output, terminal: true, historySize: 0});
  const stop = new AbortController();
  let usb, pairingOwner, caller, ssid, password;
  const interrupt = () => {
    stop.abort();
    void (caller ? caller.close() : pairingOwner?.close())?.catch(() => {});
  };
  const openUsb = allowLanArm => openNative400Pbp1Serial({enabled: true, port: args.port, helper: args.helper, allowLanArm});
  async function hidden(prompt) {
    console.log(prompt);
    muted = true;
    try { return Buffer.from(await terminal.question('', {signal: stop.signal}), 'utf8'); }
    finally { muted = false; }
  }
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  terminal.on('SIGINT', interrupt);
  terminal.once('close', interrupt);
  try {
    usb = await openUsb(false);
    stop.signal.throwIfAborted();
    pairingOwner = createNative400UsbPairing({enabled: true, transport: usb,
      identity: {device: args.device.toLowerCase(), hub: randomBytes(16).toString('hex'), binding: randomBytes(16).toString('hex'), epoch: '1'},
      confirmFingerprint: createPbp1ConfirmationPrompt({button: true, terminal})});
    const pairing = await pairingOwner.start();
    caller = createNative400LanMaintenance({enabled: true, address: args.address, port, pairing,
      directory: args.directory, sourceBytes, indexBytes, openArmTransport: () => openUsb(true), tailTiming: args['tail-timing'],
      decision: {profile: 'native400-media-maintenance/1', purpose: 'lan-action1-repair', approval_id: args['approval-id'],
        license_ref: args['license-ref'], source_manifest_sha256: sha256(sourceBytes), source_index_sha256: sha256(indexBytes),
        namespace: NATIVE400_BOOT_NAMESPACE, action: 1, boot: pairing.boot, root: args.root, generation: args.generation},
      authorize(request) {
        if (request.beginSha !== caller.plan.beginSha) return null;
        return {request, id: randomBytes(16).toString('hex'), expiresAt: request.deadline};
      }});
    console.log(`动作 1，BEGIN SHA-256 ${caller.plan.beginSha}`);
    const approval = await terminal.question('核对库存和素材后，键入 ARM 启动一次联调。\n> ', {signal: stop.signal});
    if (approval !== 'ARM') throw new Error('media_lan_declined');
    ssid = await hidden('输入 Wi-Fi SSID，回车提交（隐藏输入）。');
    password = await hidden('输入 Wi-Fi 口令，回车提交（隐藏输入）。');
    const result = await caller.run({ssid, password});
    console.log(JSON.stringify(result));
    if (result.status !== 'saved') process.exitCode = 1;
  } finally {
    ssid?.fill(0);
    password?.fill(0);
    try { await caller?.close(); } finally {
      try {
        if (pairingOwner) await pairingOwner.close();
        else await usb?.close();
      } finally {
        terminal.removeListener('close', interrupt);
        terminal.close();
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
      }
    }
  }
}

if (import.meta.main) main().catch(error => {
  const reason = /^(media|pbp)_[a-z_]+$/.test(error.message) ? error.message : 'media_lan_stopped';
  console.error(reason);
  if (reason === 'media_lan_arguments') console.error(usage);
  process.exitCode = 1;
});
