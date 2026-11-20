import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {cxx, firmwareHostTests, firmwareMain, firmwarePlayback, firmwareProtocol, hasCppPeer} from './firmware.mjs';

export {firmwareHostTests};
const openssl = process.env.OPENSSL_PREFIX ?? (process.platform === 'darwin' ? '/opt/homebrew/opt/openssl' : '/usr');
export const hasCryptoPeer = hasCppPeer && existsSync(join(openssl, 'include/openssl/evp.h'));

export function compileBootPeer(work, source, name) {
  const output = join(work, name);
  execFileSync(cxx, ['-std=c++20', '-Wall', '-Wextra', '-Werror',
    ...[firmwareMain, firmwarePlayback, firmwareProtocol, join(openssl, 'include')].flatMap(path => ['-I', path]),
    source, join(firmwareHostTests, 'media_auth_openssl.cpp'),
    '-L', join(openssl, 'lib'), '-Wl,-rpath,' + join(openssl, 'lib'), '-lcrypto', '-o', output], {timeout: 15000});
  return output;
}
