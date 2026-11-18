import assert from 'node:assert/strict';
import {execFile, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {closeSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync, writeSync} from 'node:fs';
import {promisify} from 'node:util';
import {basename, join, resolve} from 'node:path';
import {cropRgba400, decodeSource} from './prepare-native400-samples.mjs';
import {auditNative400Source} from './audit-native400-edges.mjs';
import {outputPath} from './prepare-native400-review.mjs';

const revision = '4e589f6dacabbd3170e91e7a213b2a7afff1a09b';
const prefix = 'dsh-pet/assets/webm/';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(readFileSync(file));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});

async function review(source, catalog, treePath, destination) {
  const tree = readJson(treePath), baseline = readJson(catalog);
  assert.equal(tree.sha, revision);
  assert.equal(tree.truncated, false);
  const expected = new Map(tree.tree.filter(item => item.type === 'blob' && item.path.startsWith(prefix) &&
    item.path.endsWith('.webm')).map(item => [basename(item.path), item.sha]));
  const names = readdirSync(source).filter(name => name.endsWith('.webm')).sort();
  assert.equal(expected.size, 114);
  assert.equal(names.length, expected.size);
  assert.equal(baseline.actions.length, 78);
  const known = new Map(baseline.actions.map(({name, id}) => [name, id]));
  assert.equal(known.size, 78);
  const output = outputPath(process.cwd(), destination);
  mkdirSync(output, {mode: 0o700});
  const actions = [];
  await Promise.all(Array.from({length: 5}, async (_, worker) => {
    for (const file of names.filter((_, index) => index % 5 === worker)) {
      const path = join(source, file), content = readFileSync(path);
      const gitBlob = createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
      assert.equal(gitBlob, expected.get(file), file);
      const {streams: [video]} = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,codec_name', '-of', 'json', path], {encoding: 'utf8'}));
      assert.deepEqual(video, {codec_name: 'vp9', width: 640, height: 360, r_frame_rate: '24/1'}, file);
      const {per_frame: frames, ...stats} = await auditNative400Source(path);
      const peak = frames.reduce((max, frame, index) => {
        const ratio = frame.foreground ? frame.total / frame.foreground : 0;
        return ratio > max.ratio ? {index, ratio} : max;
      }, {index: 0, ratio: 0});
      const name = basename(file, '.webm');
      actions.push({name, file, id: known.get(name) ?? null, sha256: sha256(content), git_blob_sha1: gitBlob,
        ...stats, peak_loss_frame: peak.index, peak_loss_percent: 100 * peak.ratio});
    }
  }));
  actions.sort((a, b) => names.indexOf(a.file) - names.indexOf(b.file));
  assert.equal(actions.filter(action => action.id !== null).length, known.size);
  writeJson(join(output, 'audit.json'), {revision, baseline_manifest_sha256: sha256(readFileSync(catalog)),
    crop: [124, -6, 400, 400], display: [466, 466], physical_radius_px: 233, alpha_threshold: 8, actions});
  console.log('Scanned', actions.length, 'actions;', actions.filter(a => a.id === null).length, 'outside baseline');
}

const ffmpeg = args => promisify(execFile)('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', ...args],
  {maxBuffer: 1024 * 1024, timeout: 120000});

function inspectIvf(bytes, frames) {
  assert.equal(bytes.toString('ascii', 0, 4), 'DKIF');
  assert.equal(bytes.toString('ascii', 8, 12), 'VP80');
  assert.equal(bytes.readUInt32LE(4), 0x00200000);
  assert.equal(bytes.readUInt32LE(12), 0x01900190);
  assert.equal(bytes.readUInt32LE(16), 24);
  assert.equal(bytes.readUInt32LE(20), 1);
  assert.equal(bytes.readUInt32LE(24), frames);
  let offset = 32, latestKey = -12, maxPacket = 0, keyframes = 0;
  for (let frame = 0; frame < frames; frame++) {
    assert.ok(offset + 12 <= bytes.length);
    const size = bytes.readUInt32LE(offset);
    assert.equal(bytes.readBigUInt64LE(offset + 4), BigInt(frame));
    offset += 12;
    assert.ok(size >= 3 && offset + size <= bytes.length);
    assert.equal(bytes[offset] & 0x1e, 0x12);
    if ((bytes[offset] & 1) === 0) {
      assert.ok(size >= 10);
      assert.equal(bytes.toString('hex', offset + 3, offset + 6), '9d012a');
      assert.equal(bytes.readUInt32LE(offset + 6), 0x01900190);
      latestKey = frame;
      keyframes++;
    } else assert.ok(frame - latestKey < 12);
    maxPacket = Math.max(maxPacket, size);
    offset += size;
  }
  assert.equal(offset, bytes.length);
  return {max_packet_bytes: maxPacket, keyframes};
}

async function encodeAction(action, source, output) {
  const input = join(source, action.file), raw = join(output, '.' + action.id + '.rgb');
  assert.equal(sha256(readFileSync(input)), action.sha256, action.name);
  const fd = openSync(raw, 'wx', 0o600);
  try {
    const frames = await decodeSource(input, rgba => {
      const cropped = cropRgba400(rgba);
      for (let offset = 0; offset < cropped.length;) {
        const count = writeSync(fd, cropped, offset, cropped.length - offset);
        assert.ok(count > 0);
        offset += count;
      }
    });
    assert.equal(frames, action.frames, action.name);
  } finally { closeSync(fd); }

  const file = action.id + '-400.ivf', path = join(output, file);
  let bytes, details, bitrate;
  try {
    for (bitrate of [350, 330, 300, 270]) {
      await ffmpeg(['-y', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', '400x400',
        '-framerate', '24', '-i', raw, '-vf', 'scale=400:400:flags=area:out_color_matrix=bt601:out_range=tv,format=yuv420p',
        '-c:v', 'libvpx', '-profile:v', '1', '-b:v', bitrate + 'k', '-threads', '1', '-g', '12',
        '-lag-in-frames', '0', '-auto-alt-ref', '0', '-deadline', 'good', '-cpu-used', '1', '-an', '-f', 'ivf', path]);
      bytes = readFileSync(path);
      details = inspectIvf(bytes, action.frames);
      if (details.max_packet_bytes <= 22000) break;
    }
    assert.ok(details.max_packet_bytes <= 22000, action.name);
    const hashes = async codec => {
      const {stdout} = await ffmpeg(['-threads', '1', '-c:v', codec, '-i', path, '-pix_fmt', 'yuv420p',
        '-f', 'framehash', '-hash', 'sha256', 'pipe:1']);
      return stdout.trim().split('\n').filter(line => !line.startsWith('#')).map(line => line.split(',').at(-1).trim());
    };
    const frames = await Promise.all(['vp8', 'libvpx'].map(hashes));
    assert.equal(frames[0].length, action.frames);
    assert.deepEqual(frames[0], frames[1]);
    assert.ok(frames[0].every(hash => /^[a-f0-9]{64}$/.test(hash)));
    await ffmpeg(['-i', path, '-map', '0:v:0', '-c:v', 'copy', join(output, action.id + '.webm')]);
    return {id: action.id, name: action.name, use: action.use, playback: action.playback,
      file, bytes: bytes.length, frames: action.frames, sha256: sha256(bytes), source_file: action.file,
      source_sha256: action.sha256, git_blob_sha1: action.git_blob_sha1, bitrate_kbps: bitrate,
      affected_frames: action.affected_frames, peak_loss_percent: action.peak_loss_percent, ...details,
      i420_frame_sha256: frames[0]};
  } finally { rmSync(raw, {force: true}); }
}

async function prepare(source, auditFile, catalog, destination) {
  const audit = readJson(auditFile), baseline = readJson(catalog);
  const parentSha = sha256(readFileSync(catalog));
  assert.equal(audit.revision, revision);
  assert.equal(parentSha, audit.baseline_manifest_sha256);
  const extras = new Map(audit.actions.filter(action => action.id === null).map(action => [action.name, action]));
  const selection = readJson(new URL('./native400-upstream-selection.json', import.meta.url));
  const actions = [];
  for (const [use, names] of Object.entries(selection)) {
    for (const name of names) {
      const source = extras.get(name);
      assert.ok(source, name);
      extras.delete(name);
      actions.push({...source, id: 78 + actions.length, use, playback: name === '睡觉-循环' ? 'loop' : 'once'});
    }
  }
  const output = outputPath(process.cwd(), destination);
  mkdirSync(output, {mode: 0o700});
  const samples = [];
  const encodes = await Promise.allSettled(Array.from({length: 4}, async (_, worker) => {
    for (const action of actions.filter((_, index) => index % 4 === worker)) {
      const sample = await encodeAction(action, source, output);
      samples.push(sample);
      console.log(sample.id, sample.name, sample.frames, sample.bytes, sample.max_packet_bytes);
    }
  }));
  const failure = encodes.find(result => result.status === 'rejected');
  if (failure) {
    rmSync(output, {recursive: true, force: true});
    throw failure.reason;
  }
  samples.sort((a, b) => a.id - b.id);
  writeJson(join(output, 'manifest.json'), {status: 'offline_review', revision, parent_manifest_sha256: parentSha,
    codec: 'VP8', container: 'IVF', profile: 1, width: 400, height: 400, fps: 24, offset: [33, 33],
    color: 'BT.601 limited range', license: 'CC BY-NC-SA 4.0', authors: ['上善无形', 'ZipZipPipe', 'PC2005-cloud/dsh-pet'], samples});
  writeJson(join(output, 'catalog.json'), {parent_manifest_sha256: parentSha, offline: true,
    actions: [...baseline.actions.map(({id, name}) => ({id, name, library: 'compact78'})),
      ...samples.map(({id, name, file, use, playback}) => ({id, name, file, use, playback}))],
    deferred: [...extras.values()].map(({name, peak_loss_percent}) => ({name, peak_loss_percent,
      reason: name.startsWith('余额-') ? '需余额语义映射' : '固定裁切损失或桌面专用表现'}))});
  const html = '<!doctype html><html lang="zh"><meta charset="utf-8"><title>400 圆屏补录预览</title>' +
    '<style>body{background:#141922;color:#edf0f5;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:24px}h2{font-size:17px}.screen{background:black;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;overflow:hidden}.screen video{width:85.84%;height:85.84%;object-fit:contain}button{font:inherit;margin-top:8px}a{color:#a8cdff}</style>' +
    '<h1>400 圆屏补录预览</h1><p>18 段 VP8 离线素材。400 画面以 1:1 比例居中于 466 圆屏。</p><main>' +
    samples.map(a => '<article><h2>' + a.id + ' · ' + a.name + '</h2><div class="screen"><video preload="metadata" playsinline ' +
      (a.playback === 'loop' ? 'loop ' : '') + 'src="' + a.id + '.webm"></video></div><button type="button" onclick="const v=this.previousElementSibling.firstElementChild;v.paused?v.play():v.pause()">播放／暂停</button></article>').join('') +
    '</main><p>上善无形／ZipZipPipe／<a href="https://github.com/PC2005-cloud/dsh-pet">PC2005-cloud/dsh-pet</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a></p></html>';
  writeFileSync(join(output, 'index.html'), html, {flag: 'wx'});
}

const [mode, ...args] = process.argv.slice(2);
if (!['audit', 'prepare'].includes(mode) || args.length !== 4)
  throw new Error('Usage: audit SOURCE BASELINE_MANIFEST UPSTREAM_TREE NEW_OUTPUT or prepare SOURCE AUDIT BASELINE_MANIFEST NEW_OUTPUT');
await (mode === 'audit' ? review : prepare)(...args.map(value => resolve(value)));
