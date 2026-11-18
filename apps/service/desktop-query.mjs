import {execFile} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {lstat, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHubClient, startOrAttach} from '../../packages/runtime/index.mjs';
import {privatePath} from '../../packages/runtime/paths.mjs';
import {desktopQueryPort, prepareDesktopQuery, readDesktopQueryConfig} from '../../packages/runtime/vp8-desktop-query.mjs';
import {identifyVp8OtaUsb} from '../../packages/runtime/vp8-ota-usb.mjs';

const [directory, action, device, ...rest] = process.argv.slice(2);
const actions = ['start', 'start-wave', 'stop', 'status', 'copy-code', 'select-device'];

async function present(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function copyCode(code) {
  return new Promise((resolve, reject) => {
    const child = execFile('/usr/bin/pbcopy', {timeout: 3000}, error => error ? reject(error) : resolve());
    child.stdin.on('error', reject);
    child.stdin.end(code);
  });
}

async function main() {
  if (process.platform !== 'darwin' || !directory || !isAbsolute(directory) || !actions.includes(action) ||
      rest.length || (action === 'select-device' ? !desktopQueryPort.test(device) : device !== undefined)) {
    console.error('用法：hub-query start|start-wave|stop|status|copy-code，或 hub-query select-device /dev/cu.usbmodem…');
    process.exitCode = 2;
    return;
  }
  privatePath(directory, 'directory');
  const configPath = join(directory, 'query.json'), runtime = join(directory, 'ipc');
  const socket = join(runtime, 'hub.sock'), descriptor = join(runtime, 'service.json');
  const active = async () => (await present(socket)) || (await present(descriptor));
  if (action === 'select-device') {
    if (await active()) throw new Error('stop_before_selecting');
    const usbIdentity = await identifyVp8OtaUsb(device);
    await writeFile(configPath, JSON.stringify({schema: 1, port: device, usbIdentity, operatorToken: randomBytes(32).toString('hex')}),
      {mode: 0o600, flag: 'wx'});
    console.log('已登记只读查询设备。');
    return;
  }
  if ((action === 'status' || action === 'stop') && !(await active())) {
    console.log('只读 Hub 已停止。');
    return;
  }
  const config = await readDesktopQueryConfig(directory);
  const {operatorToken} = config;
  if (action === 'copy-code') {
    await copyCode(operatorToken);
    console.log('已复制本地授权码。');
    return;
  }
  const auth = {reviewToken: operatorToken};
  if (action === 'status' || action === 'stop') {
    const client = createHubClient(runtime);
    const {instanceId, update} = await client.request('GET', '/v1/vp8-action/status', undefined, auth);
    if (update.queryOnly !== true) throw new Error('wrong_owner');
    if (action === 'status') {
      console.log(update.wave ? '挥手测试 Hub 正在运行。' : '只读 Hub 正在运行。');
      if (update.device) console.log(`固件 ${update.device.version} · 当前槽 ${update.device.slot}`);
      if (update.error) console.log(`查询状态 ${update.error}`);
      if (update.wave) console.log(`挥手状态 ${update.wave.phase}${update.wave.returnedIdle ? '，241 帧，已恢复待机' : ''}`);
      return;
    }
    await client.request('POST', '/v1/desktop-query/stop', undefined, {...auth, expectedInstanceId: instanceId});
    const deadline = performance.now() + 6000;
    while (await active()) {
      if (performance.now() >= deadline) throw new Error('stop_not_confirmed');
      await delay(50);
    }
    console.log('只读 Hub 已停止。');
    return;
  }
  let service;
  const stop = () => {
    void service.close().catch(() => {
      console.error('只读 Hub 清理失败。');
      process.exitCode = 1;
    });
  };
  const waveTest = action === 'start-wave';
  const vp8Update = prepareDesktopQuery(directory, config, {waveTest});
  service = await startOrAttach({directory: runtime, vp8Update, onVp8LocalStop: stop});
  if (service.role === 'attached') {
    console.log('只读 Hub 已在运行。');
    return;
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log((waveTest ? '挥手测试 Hub 正在运行，可手动触发一次。' : '只读 Hub 正在运行。') +
    '按 Ctrl+C 或在另一终端执行 hub-query stop。');
}

try { await main(); }
catch (error) {
  const stable = new Set(['stop_not_confirmed', 'wrong_owner', 'private_config_permissions', 'private_config_invalid',
    'stop_before_selecting', 'vp8_ota_usb_identity', 'ENOENT', 'EEXIST', 'EACCES', 'EPERM']);
  const cause = error.code ?? error.message;
  console.error(`只读 Hub 操作失败 (${stable.has(cause) ? cause : 'operation_failed'})。`);
  process.exitCode = 1;
}
