import {cpSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {'host-version': {type: 'string', default: '0.2.2-rc.1'}, combined: {type: 'boolean'}}});
const version = values['host-version'];
const targets = {'0.2.2-rc.1': 'dist-dsh022', '0.2.2-rc.3': 'dist-dsh022-rc3'};
if (!Object.hasOwn(targets, version)) throw new Error('unsupported DSH host version');
if (values.combined && version !== '0.2.2-rc.3') throw new Error('combined Desktop requires DSH rc.3');
const target = values.combined ? 'dist-dsh022-rc3-combined' : targets[version];

rmSync(target, {recursive: true, force: true});
cpSync('dist', target, {recursive: true});
cpSync('apps/dsh-plugin/host-022.mjs', `${target}/apps/dsh-plugin/host-022.mjs`);
cpSync('apps/dsh-plugin/desktop-query-service.mjs', `${target}/apps/dsh-plugin/desktop-query-service.mjs`);
const manifest = JSON.parse(readFileSync('apps/dsh-plugin/package.template.json', 'utf8'));
manifest.main = 'apps/dsh-plugin/host-022.mjs';
manifest.exports['.'] = './' + manifest.main;
if (values.combined) {
  cpSync('apps/dsh-plugin/host-desktop-combined-rc3.mjs', `${target}/apps/dsh-plugin/host-desktop-combined-rc3.mjs`);
  manifest.main = './apps/dsh-plugin/host-desktop-combined-rc3.mjs';
  manifest.exports['.'] = manifest.main;
  manifest.version = '0.0.4';
}
manifest.exports['./client'] = './client.js';
manifest.peerDependencies = {'@deepseek-ai/schemastery': '3.19.0', '@deepseek-ai/cordis': '4.1.0',
  '@deepseek-ai/dsh-host-webserver': version, '@deepseek-ai/dsh-client-connection': version, react: '18.3.1'};
cpSync(`${target}/${values.combined ? 'client.desktop-combined.js' : 'client.connection.js'}`, `${target}/client.js`);
rmSync(`${target}/client.connection.js`);
rmSync(`${target}/client.desktop-combined.js`, {force: true});
delete manifest.exports['./connection-client'];
manifest.files = manifest.files.filter(path => path !== 'client.connection.js');
writeFileSync(`${target}/package.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built isolated DSH ${version} candidate in ${target}/.`);
