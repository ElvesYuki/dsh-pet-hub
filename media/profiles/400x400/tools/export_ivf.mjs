import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [cropModule, reviewDir, output, ...args] = process.argv.slice(2);
const bitrate = args[0] === '--bitrate' ? args.splice(0, 2)[1] : '350k';
const actions = args;
if (!output || !actions.length || actions.some(id => !/^(0|[1-9]\d*)$/.test(id)) ||
    new Set(actions).size !== actions.length || !/^[1-9]\d{1,2}k$/.test(bitrate)) {
  throw Error('Usage: export_ivf.mjs CROP_MODULE REVIEW_DIR NEW_OUTPUT_DIR [--bitrate 350k] ACTION_ID [...]');
}
const { decodeSource, cropRgba400 } = await import(pathToFileURL(resolve(cropModule)));
const sourceDir = resolve(reviewDir);
const review = JSON.parse(readFileSync(join(sourceDir, 'review-data.json')));
const hashes = data => createHash('sha256').update(data).digest('hex');
const run = args => {
  const result = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`ffmpeg failed (${result.status ?? result.signal})`);
};
const geometry = ['-video_size', '400x400', '-framerate', '24'];
const temp = mkdtempSync(join(tmpdir(), 'round-pet-vp8-'));
const out = resolve(output);
try {
  if (out === sourceDir || out.startsWith(sourceDir + '/')) throw Error('Choose a separate output directory');
  const samples = [];
  const files = new Map();
  for (const id of actions.map(Number)) {
    const row = review.actions.find(action => action.id === id);
    const source = join(sourceDir, 'media', `${id}.webm`);
    if (!row || hashes(readFileSync(source)) !== row.source_sha256) throw Error(`Source SHA mismatch for ${id}`);
    const rgb = join(temp, `${id}.rgb`), yuv = join(temp, `${id}.yuv`), ivf = join(temp, `${id}.ivf`);
    // The crop module owns alpha compositing and all offsets. Store just one decoded clip at a time.
    const fd = openSync(rgb, 'wx');
    let frames;
    try {
      frames = await decodeSource(source, frame => {
        const cropped = cropRgba400(frame);
        for (let at = 0; at < cropped.length;) {
          const written = writeSync(fd, cropped, at, cropped.length - at);
          if (!written) throw Error(`Empty RGB write for ${id}`);
          at += written;
        }
      });
    } finally { closeSync(fd); }
    if (!frames || frames !== row.frame_count) throw Error(`Unexpected frame count for ${id}`);
    run(['-f', 'rawvideo', '-pixel_format', 'rgb24', ...geometry, '-i', rgb, '-vf',
      'scale=400:400:flags=area:out_color_matrix=bt601:out_range=tv,format=yuv420p', '-f', 'rawvideo', yuv]);
    run(['-f', 'rawvideo', '-pixel_format', 'yuv420p', ...geometry, '-i', yuv, '-c:v', 'libvpx', '-profile:v', '1',
      '-b:v', bitrate, '-g', '12', '-threads', '1', '-lag-in-frames', '0', '-auto-alt-ref', '0', '-deadline', 'good',
      '-cpu-used', '1', '-an', '-f', 'ivf', ivf]);
    const data = readFileSync(ivf);
    const filename = `${id}-400.ivf`;
    if (data.toString('ascii', 0, 4) !== 'DKIF' || data.toString('ascii', 8, 12) !== 'VP80' ||
        data.readUInt32LE(24) !== frames) throw Error(`Unexpected IVF output for ${id}`);
    samples.push({ id, file: filename, bytes: data.length, sha256: hashes(data), frames, source_sha256: row.source_sha256 });
    files.set(filename, data);
    rmSync(rgb);
    rmSync(yuv);
    rmSync(ivf);
  }
  mkdirSync(out);
  for (const [name, data] of files) writeFileSync(join(out, name), data, { flag: 'wx' });
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({
    codec: 'VP8', container: 'IVF', profile: 1, width: 400, height: 400, fps: 24, offset: [33, 33],
    license_ref: review.license_ref, samples,
  }, null, 2) + '\n', { flag: 'wx' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
