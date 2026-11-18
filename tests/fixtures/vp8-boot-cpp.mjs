import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

export function compileVp8BootPeer(root, work, source, name) {
  const output = join(work, name);
  const device = join(root, 'apps/round-pet/devices/esp32s3-touch-amoled-175c');
  const common = join(root, 'apps/round-pet/common');
  const openssl = process.env.OPENSSL_PREFIX ?? '/opt/homebrew/opt/openssl';
  execFileSync('c++', ['-std=c++20', '-Wall', '-Wextra', '-Werror',
    ...[join(root, 'tools/round-pet/vp8-probe/main'), join(device, 'main'), common, join(common, 'playback_logic'),
      join(common, 'protocol_types'), join(openssl, 'include')].flatMap(path => ['-I', path]),
    source, join(device, 'tests/native400/media_auth_openssl.cpp'),
    '-L', join(openssl, 'lib'), '-Wl,-rpath,' + join(openssl, 'lib'), '-lcrypto', '-o', output], {timeout: 15000});
  return output;
}
