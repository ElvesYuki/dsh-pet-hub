import {cpSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {target: {type: 'string', default: 'desktop'}}});
const targets = {
  connection: {directory: 'dist-connection', version: '0.2.2-rc.1'},
  'legacy-connection': {directory: 'dist-connection-legacy', version: '0.2.2-rc.3'},
  'legacy-desktop': {directory: 'dist-desktop-legacy', version: '0.2.2-rc.3', host: 'legacy-desktop-host.mjs', release: '0.0.7'},
  desktop: {directory: 'dist-desktop', version: '0.2.2-rc.5', host: 'desktop-host.mjs', release: '0.0.10', enrollment: true},
};
if (!Object.hasOwn(targets, values.target)) throw new Error('unsupported desktop build target');
const profile = targets[values.target];
const {directory: target, version, host} = profile;

rmSync(target, {recursive: true, force: true});
cpSync('dist', target, {recursive: true});
cpSync('apps/dsh-plugin/connection-host.mjs', `${target}/apps/dsh-plugin/connection-host.mjs`);
cpSync('apps/dsh-plugin/desktop-query-service.mjs', `${target}/apps/dsh-plugin/desktop-query-service.mjs`);
const manifest = JSON.parse(readFileSync('apps/dsh-plugin/package.template.json', 'utf8'));
manifest.main = 'apps/dsh-plugin/connection-host.mjs';
manifest.exports['.'] = './' + manifest.main;
if (host) {
  cpSync('apps/dsh-plugin/legacy-desktop-host.mjs', `${target}/apps/dsh-plugin/legacy-desktop-host.mjs`);
  if (profile.enrollment) for (const file of ['desktop-host.mjs', 'desktop-enrollment-config.mjs', 'enrollment-host.mjs',
    'enrollment-routes.mjs', 'task-source-routes.mjs']) cpSync(`apps/dsh-plugin/${file}`, `${target}/apps/dsh-plugin/${file}`);
  manifest.main = `./apps/dsh-plugin/${profile.host}`;
  manifest.exports['.'] = manifest.main;
  manifest.version = profile.release;
}
manifest.exports['./client'] = './client.js';
manifest.peerDependencies = {'@deepseek-ai/schemastery': '3.19.0', '@deepseek-ai/cordis': '4.1.0',
  '@deepseek-ai/dsh-host-webserver': version, '@deepseek-ai/dsh-client-connection': version, react: '18.3.1'};
cpSync(`${target}/${host ? 'client.desktop-combined.js' : 'client.connection.js'}`, `${target}/client.js`);
rmSync(`${target}/client.connection.js`);
rmSync(`${target}/client.desktop-combined.js`, {force: true});
delete manifest.exports['./connection-client'];
manifest.files = manifest.files.filter(path => path !== 'client.connection.js');
writeFileSync(`${target}/package.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built isolated DSH ${version} candidate in ${target}/.`);
