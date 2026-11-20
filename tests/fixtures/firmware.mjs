import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const firmware = new URL('../../firmware/', import.meta.url);
export const firmwareMain = fileURLToPath(new URL('devices/esp32s3-touch-amoled-175c/main/', firmware));
export const firmwareHostTests = fileURLToPath(new URL('tests/', firmware));
export const firmwareProtocol = fileURLToPath(new URL('components/protocol/include/', firmware));
export const firmwarePlayback = fileURLToPath(new URL('components/playback/include/', firmware));
export const cxx = process.env.CXX ?? 'clang++';
export const hasCppPeer = spawnSync(cxx, ['--version'], {stdio: 'ignore'}).status === 0;
