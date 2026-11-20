import {cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {enrollmentDirectory} from '../packages/runtime/device-keychain.mjs';

if (process.argv.length !== 3 || process.platform !== 'darwin') throw Error('device_review_build');
const backendOnly = process.argv[2] === '--backend-only';
const artifact = process.argv[2] === '--artifact' || backendOnly;
if (artifact) mkdirSync('.cache', {recursive: true, mode: 0o700});
const root = artifact ? mkdtempSync(join(process.cwd(), '.cache/enrollment-plugin-')) :
  enrollmentDirectory(process.argv[2]);
const target = join(root, 'package');
mkdirSync(target, {mode: 0o700});
cpSync('dist/packages', join(target, 'packages'), {recursive: true});
const plugin = join(target, 'apps/dsh-plugin');
mkdirSync(plugin, {recursive: true});
for (const source of ['standalone-enrollment-host.mjs', 'enrollment-host.mjs', 'desktop-enrollment-config.mjs',
  'enrollment-routes.mjs', ...(backendOnly ? ['enrollment-backend-host.mjs'] : [])])
  cpSync('apps/dsh-plugin/' + source, join(plugin, source));
cpSync('LICENSE', join(target, 'LICENSE'));
cpSync('THIRD_PARTY.md', join(target, 'THIRD_PARTY.md'));
const data = 'dsh-pet-hub-boot-review';
const main = './apps/dsh-plugin/' + (backendOnly ? 'enrollment-backend-host.mjs' : 'standalone-enrollment-host.mjs');
if (backendOnly) {
  // Explicitly replace the legacy client in an already-open rc.3 renderer.
  // Omitting the client declaration leaves its existing settings slot mounted.
  writeFileSync(join(target, 'client.js'), `window.__ModuleLoader__.load({
  id: '${data}',
  factory: () => ({name: 'pet-hub-boot-review-client', apply() {}}),
});
`);
} else {
  const client = readFileSync('dist/client.boot-review.js', 'utf8');
  const entry = "id:'dsh-pet-hub',factory:makeEnrollmentClientFactory()";
  if (client.split(entry).length !== 2) throw Error('device_review_build_client');
  writeFileSync(join(target, 'client.js'), client.replace(entry,
    "id:'dsh-pet-hub-boot-review',factory:makeEnrollmentClientFactory({standalone:true})"));
}
writeFileSync(join(target, 'cordis.patch.yml'), '- insert:\n    - id: ' + data + '\n      name: ' + data + '\n');
writeFileSync(join(target, 'package.json'), JSON.stringify({name: data, version: backendOnly ? '0.0.4' : '0.0.0', private: true, type: 'module',
  main, exports: {'.': main, './client': './client.js', './package.json': './package.json',
    './cordis.patch.yml': './cordis.patch.yml'},
  files: ['apps/', 'packages/', 'client.js', 'cordis.patch.yml', 'LICENSE', 'THIRD_PARTY.md'],
  peerDependencies: {'@deepseek-ai/dsh-client-connection': '0.2.2-rc.3', '@deepseek-ai/schemastery': '3.19.0',
    ...(!backendOnly ? {react: '18.3.1'} : {})},
  dsh: {bundle: {patch: './cordis.patch.yml'},
    client: {inject: [], external: backendOnly ? [] : ['react'], platform: 'web'}},
}, null, 2) + '\n');
if (artifact) console.log(target);
