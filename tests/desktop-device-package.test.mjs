import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {planDesktopPluginMigration} from '../scripts/lib/desktop-plugin-migration.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const readStatus = (update = {}) => ({instanceId: 'query-instance', update: {queryOnly: true, revision: 2, phase: 'ready',
  usbBusy: false, sameUsbTarget: true, device: {version: '0.1.5-usb-pair-test', slot: 'ota_1'}, ...update}});
const bindStatus = (state = {}) => ({instanceId: id, revision: '4', usbEnrollment: true,
  busy: false, deviceChecked: false, phase: 'unregistered', ...state});

function node(root, path, ...args) {
  return execFileSync(process.execPath, [path, ...args], {cwd: root, encoding: 'utf8', timeout: 15000});
}

function packageAt(root, workspace) {
  const archive = JSON.parse(execFileSync('npm', ['pack', workspace, '--ignore-scripts', '--json', '--pack-destination', root],
    {cwd: root, encoding: 'utf8', timeout: 15000, env: {...process.env, npm_config_cache: join(root, 'npm-cache')}}))[0];
  const unpacked = join(root, archive.name + '-' + archive.version);
  mkdirSync(unpacked);
  execFileSync('tar', ['-xzf', join(root, archive.filename), '-C', unpacked], {timeout: 15000});
  return join(unpacked, 'package');
}

function buildPackages(t) {
  const root = mkdtempSync(join(tmpdir(), 'vp8-device-package-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const dir of ['dist', 'apps', 'packages']) cpSync(dir, join(root, dir), {recursive: true});
  for (const file of ['LICENSE', 'THIRD_PARTY.md', 'scripts/build-desktop-plugin.mjs', 'scripts/build-enrollment-plugin.mjs']) {
    mkdirSync(join(root, 'scripts'), {recursive: true});
    cpSync(file, join(root, file));
  }
  node(root, 'scripts/build-desktop-plugin.mjs', '--target', 'legacy-desktop');
  node(root, 'scripts/build-desktop-plugin.mjs', '--target', 'legacy-connection');
  node(root, 'scripts/build-desktop-plugin.mjs', '--target', 'desktop');
  const backendPath = node(root, 'scripts/build-enrollment-plugin.mjs', '--backend-only').trim();
  const legacyPath = node(root, 'scripts/build-enrollment-plugin.mjs', '--artifact').trim();
  return [packageAt(root, join(root, 'dist-desktop-legacy')), packageAt(root, backendPath),
    packageAt(root, legacyPath), packageAt(root, join(root, 'dist-connection-legacy')),
    packageAt(root, join(root, 'dist-desktop'))];
}

function readClientRegistration(path, {desktop = true, fetch = assert.fail} = {}) {
  let registration;
  runInNewContext(readFileSync(join(path, 'client.js'), 'utf8'), {
    window: {__ModuleLoader__: {load: value => { registration = value; }}},
    location: desktop ? {protocol: 'dsh-app:', hostname: 'app'} : {protocol: 'http:', hostname: '127.0.0.1'},
    fetch, TextEncoder, AbortController, AbortSignal,
  });
  return registration;
}

function mountClient(path, options) {
  const registration = readClientRegistration(path, options);
  assert.equal(registration.id, 'dsh-pet-hub');
  const session = {controller: new AbortController(), generation: 0, sending: false};
  let current;
  const react = {useState: initial => typeof initial === 'boolean' ? [false, () => {}] :
    [current, update => { current = update(current); }], useEffect() {},
    useRef: () => ({current: session}), createElement: (tag, props, ...children) => ({tag, props, children})};
  const slots = [];
  registration.factory(() => react).apply({slots: {
    inject(name, create) { assert.equal(name, 'settings.section'); [...create()]; },
    register(spec, component) { slots.push({spec, component}); },
  }});
  return {slots, snapshot: () => current, render(view) { current = view; return slots[0].component(); }};
}

const childrenOf = tree => tree?.children ?? [];
function nodes(tree) { return tree ? [tree, ...childrenOf(tree).flatMap(nodes)] : []; }
function button(tree, name) {
  return nodes(tree).find(item => item.tag === 'button' && childrenOf(item).includes(name));
}

test('single-package migration preserves unrelated patches and rejects ambiguous registration settings', () => {
  const main = 'dsh-pet-hub', old = 'dsh-pet-hub-boot-review';
  const config = {runtimeDirectory: '/synthetic/ipc', desktopDeviceQuery: true};
  const enrollmentDirectory = '/synthetic/device-enrollment';
  const other = {id: 'dsh-pet', config: {fixture: true}};
  const registration = {id: old, config: {enabled: true, enrollmentDirectory}};
  const original = {bundles: [main, 'dsh-pet', old], patches: [{id: main, config}, other, registration]};
  const result = planDesktopPluginMigration(original);
  assert.deepEqual(result, {bundles: [main, 'dsh-pet'], patches: [
    {id: main, config: {...config, deviceEnrollment: registration.config}}, other,
  ]});
  assert.equal(Object.hasOwn(config, 'deviceEnrollment'), false);
  assert.equal(original.patches[2], registration);
  for (const patches of [[...original.patches, registration], [other, registration],
    [{id: main, config: {...config, deviceEnrollment: {enabled: false}}}, registration],
    [{id: main, config}, {...registration, config: {enabled: true}}]])
    assert.throws(() => planDesktopPluginMigration({...original, patches}));
  assert.throws(() => planDesktopPluginMigration(result));
});

test('the actual paired rc.3 tarballs register one named slot, preserve identities and drive the daily device flow',
  {skip: process.platform !== 'darwin', timeout: 30000}, async t => {
    const [hub, backend, legacy, ordinary, single] = buildPackages(t);
    const hubManifest = JSON.parse(readFileSync(join(hub, 'package.json'), 'utf8'));
    const bindingManifest = JSON.parse(readFileSync(join(backend, 'package.json'), 'utf8'));
    assert.equal(hubManifest.name, 'dsh-pet-hub');
    assert.equal(bindingManifest.name, 'dsh-pet-hub-boot-review');
    assert.equal(hubManifest.version, '0.0.7');
    assert.equal(bindingManifest.version, '0.0.4');
    assert.match(hubManifest.main, /legacy-desktop-host/);
    assert.equal(hubManifest.exports['.'], hubManifest.main);
    const ordinaryManifest = JSON.parse(readFileSync(join(ordinary, 'package.json'), 'utf8'));
    assert.equal(ordinaryManifest.main, 'apps/dsh-plugin/connection-host.mjs');
    assert.equal(ordinaryManifest.exports['.'], './apps/dsh-plugin/connection-host.mjs');
    assert.match(bindingManifest.main, /enrollment-backend-host/);
    const singleManifest = JSON.parse(readFileSync(join(single, 'package.json'), 'utf8'));
    assert.equal(singleManifest.name, hubManifest.name);
    assert.equal(singleManifest.version, '0.0.8');
    assert.equal(singleManifest.peerDependencies['@deepseek-ai/dsh-host-webserver'], '0.2.2-rc.5');
    assert.equal(singleManifest.peerDependencies['@deepseek-ai/dsh-client-connection'], '0.2.2-rc.5');
    assert.ok(existsSync(join(single, 'apps/dsh-plugin/desktop-enrollment-config.mjs')));
    assert.ok(!existsSync(join(single, 'apps/dsh-plugin/enrollment-backend-host.mjs')));
    assert.deepEqual(mountClient(single).slots.map(({spec}) => [spec.id, spec.label()]),
      [['dsh-pet-hub-settings', '桌面宠物设备']]);
    assert.deepEqual(bindingManifest.dsh.client, {inject: [], external: [], platform: 'web'});
    assert.equal(bindingManifest.exports['./client'], './client.js');
    assert.equal(existsSync(join(backend, 'client.js')), true);
    for (const path of [hub, backend])
      assert.equal(existsSync(join(path, 'device-binding.json')), false);

    const fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), 'hub-entry-')));
    t.after(() => rmSync(fixtureRoot, {recursive: true, force: true}));
    const rc5 = process.env.DSH_DESKTOP_RC5_APP;
    if (rc5) {
      const result = JSON.parse(execFileSync(join(rc5, 'Contents/MacOS/DeepSeek Harness'),
        [realpathSync('tests/fixtures/desktop-plugin-host.mjs'), fixtureRoot, process.cwd(), rc5, single, hub, backend],
        {cwd: fixtureRoot, env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, encoding: 'utf8', timeout: 12000}));
      assert.deepEqual(result, {rc5: true, oldSkipped: true, singleLayer: true, realConnection: true, realForward: true,
        originalIndexPreserved: true, oldOwnerExcluded: true, released: true, rollbackSnapshot: true, codexHooks: true});
    }
    const fixture = 'desktop-plugin-entry.mjs';
    for (const [path, mode] of [[hub, 'combined'], [ordinary, 'ordinary']]) {
      cpSync(join('tests/fixtures', fixture), join(path, fixture));
      const result = JSON.parse(node(path, fixture, join(fixtureRoot, mode), mode));
      assert.deepEqual(result, {mode, packageEntry: true, liveStatus: true, batteryRoute: mode === 'combined',
        socketsReleased: true, rc3Cordis: false});
    }

    const calls = [], requestDone = Promise.withResolvers();
    const app = mountClient(hub, {fetch(url, options) {
      calls.push({url, credentials: options.credentials, headers: options.headers, body: JSON.parse(options.body)});
      return requestDone.promise;
    }});
    assert.equal(app.slots.length, 1);
    assert.equal(app.slots[0].spec.id, 'dsh-pet-hub-settings');
    assert.equal(app.slots[0].spec.label(), '桌面宠物设备');
    assert.equal(mountClient(hub, {desktop: false}).slots[0].spec.label(), '实体宠物设备');

    // Keep the same renderer and exercise both package generations. The
    // fixture disposes registrations scoped to the definition it replaces.
    const renderer = new Map(), loaded = new Map();
    function replace(path, require) {
      const client = readClientRegistration(path);
      const plugin = client.factory(require), previous = loaded.get(client.id);
      if (previous) {
        assert.equal(plugin.name, previous.name);
        for (const slot of previous.slots) renderer.delete(slot);
      }
      const current = {name: plugin.name, slots: []};
      plugin.apply({slots: {
        inject(section, create) { assert.equal(section, 'settings.section'); [...create()]; },
        register(spec) {
          current.slots.push(spec.id);
          renderer.set(spec.id, spec.label());
        },
      }});
      loaded.set(client.id, current);
      return {id: client.id, name: plugin.name};
    }
    replace(hub, () => ({}));
    const before = replace(legacy, () => ({}));
    assert.deepEqual([...renderer.values()], ['桌面宠物设备', '设备登记候选']);
    const after = replace(backend, assert.fail);
    assert.deepEqual(after, before);
    assert.deepEqual(after, {id: 'dsh-pet-hub-boot-review', name: 'pet-hub-boot-review-client'});
    assert.deepEqual([...renderer.entries()], [['dsh-pet-hub-settings', '桌面宠物设备']]);
    const view = (binding, query = readStatus(), state) => app.render({binding, query, ...state});
    function visible(tree) {
      const snapshot = JSON.stringify(tree);
      assert.doesNotMatch(snapshot, /管理骨架|暂无已接入设备|候选|本地授权码/);
      assert.match(snapshot, /1\.75C-EN/);
      assert.equal(nodes(tree).filter(item => item.tag === 'article').length, 1);
      return snapshot;
    }
    const unregistered = view(bindStatus());
    assert.match(visible(unregistered), /尚未绑定.*0\.1\.5-usb-pair-test.*ota_1/);
    assert.equal(button(unregistered, '绑定设备').props.disabled, false);
    const command = button(unregistered, '绑定设备').props.onClick();
    await button(unregistered, '查询设备').props.onClick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/pet-hub-enrollment/command');
    assert.equal(calls[0].credentials, 'same-origin');
    assert.equal(calls[0].headers['X-Pet-Hub-Operator'], undefined);
    assert.deepEqual(calls[0].body, {operation: 'enroll-usb', instanceId: id, revision: '4'});
    requestDone.resolve({ok: true, json: () => bindStatus({phase: 'confirming_usb', busy: true})});
    await command;

    const local = view(bindStatus({phase: 'bound'}));
    assert.match(visible(local), /本地已保存绑定.*本次尚未从设备核对/);
    assert.match(visible(local), /已读取设备信息/);
    assert.equal(button(local, '验证绑定').props.disabled, false);
    const reading = button(local, '查询设备').props.onClick();
    await reading;
    assert.equal(calls[1].url, '/api/pet-hub-device/query');
    assert.deepEqual(calls[1].body, {operation: 'query', instanceId: 'query-instance', revision: 2});
    assert.match(visible(view(bindStatus({phase: 'bound', deviceChecked: true}))), /本次已从设备核对持久绑定/);
    assert.ok(button(view(bindStatus({phase: 'recovery_required'})), '核对绑定'));
    assert.equal(button(view(bindStatus(), readStatus({phase: 'querying', usbBusy: true})), '绑定设备').props.disabled, true);
    assert.equal(button(view(bindStatus({phase: 'confirming_usb', busy: true})), '查询设备').props.disabled, true);
    const unsupported = view(bindStatus({issue: 'usb_unsupported'}));
    assert.match(visible(unsupported), /当前固件不支持一键绑定/);
    assert.equal(button(unsupported, '查询设备').props.disabled, false);
    const missing = view(null, readStatus(), {bindingError: true});
    assert.equal(button(missing, '绑定设备'), undefined);
    assert.equal(button(missing, '查询设备').props.disabled, false);
    const different = visible(view(bindStatus({phase: 'bound'}), readStatus({sameUsbTarget: false})));
    assert.match(different, /USB 设备不同/);
    assert.doesNotMatch(different, /USB 查询结果|0\.1\.5-usb-pair-test|ota_1/);
    const withoutRelation = readStatus();
    delete withoutRelation.update.sameUsbTarget;
    for (const query of [readStatus({sameUsbTarget: null}), withoutRelation]) {
      const unresolved = view(bindStatus({phase: 'bound', deviceChecked: true}), query);
      const rendered = visible(unresolved);
      assert.match(rendered, /本次已从设备核对持久绑定/);
      assert.match(rendered, /已读取设备信息/);
      assert.doesNotMatch(rendered, /USB 设备不同|尚未查询/);
      const overview = nodes(unresolved).find(item => item.tag === 'article');
      const bindingDetails = overview.children.find(item => item?.tag === 'dl');
      if (bindingDetails) assert.doesNotMatch(JSON.stringify(bindingDetails), /0\.1\.5-usb-pair-test|ota_1/);
      const queryResult = nodes(unresolved).find(item => item.props?.['aria-label'] === 'USB 查询结果');
      assert.ok(queryResult);
      assert.match(JSON.stringify(queryResult), /与绑定目标的关系待核对.*0\.1\.5-usb-pair-test.*ota_1/);
      assert.equal(button(unresolved, '查询设备').props.disabled, false);
    }
    for (const update of [{phase: 'failed'}, {device: {version: '0.1.5-usb-pair-test', slot: 'unknown'}}]) {
      const unsuccessful = view(bindStatus(), readStatus({sameUsbTarget: null, ...update}));
      assert.doesNotMatch(visible(unsuccessful), /USB 查询结果|已读取设备信息|0\.1\.5-usb-pair-test/);
    }
    const withBattery = (sameUsbTarget, clock = 500, status = 'ok') => view(bindStatus({phase: 'bound'}),
      readStatus({sameUsbTarget, batteryAvailable: true}), {clock, battery: {status, instanceId: 'query-instance',
        sample: {at: 100, present: true, percent: 0, mv: 4191, flow: 'charging', phase: 'cv', usbPower: true}}});
    for (const relation of [true, null]) {
      const tree = withBattery(relation);
      assert.match(visible(tree), /0%.*4191 mV.*充电中 · 恒压/);
      const independent = nodes(tree).find(node => node.props?.['aria-label'] === 'USB 查询结果');
      assert.equal(Boolean(independent), relation === null);
      if (independent) assert.match(JSON.stringify(independent), /0%.*4191 mV/);
    }
    assert.doesNotMatch(visible(withBattery(false)), /4191 mV/);
    assert.match(visible(withBattery(true, 2000, 'busy')), /上次读取.*等待下次采样/);
    assert.doesNotMatch(visible(withBattery(true, 15200)), /4191 mV/);
    assert.match(visible(view(bindStatus({issue: 'usb_not_ready'}))), /设备尚未响应/);
    assert.match(visible(local), /当前绑定插件版本未提供 USB Wi-Fi 配置/);

    const networkCalls = [], networkReplies = [{status: 'ok', configured: true, link: 'online'}, {status: 'unknown'}];
    const networkClient = mountClient(hub, {fetch(url, options) {
      assert.equal(url, '/api/pet-hub-enrollment/network');
      assert.equal(options.headers['Content-Type'], 'application/octet-stream');
      const data = Buffer.from(options.body), length = data.readUInt16BE();
      networkCalls.push({metadata: JSON.parse(data.subarray(2, 2 + length)), body: options.body,
        password: data.subarray(2 + length).toString()});
      return Promise.resolve({ok: true, json: () => networkReplies.shift()});
    }});
    const netBinding = bindStatus({phase: 'bound', networkAvailable: true});
    const netRender = () => networkClient.render(networkClient.snapshot());
    const openNetwork = networkClient.render({binding: netBinding, query: readStatus()});
    assert.equal(button(openNetwork, '保存 Wi-Fi 配置').props.disabled, true);
    assert.equal(networkCalls.length, 0);
    await button(openNetwork, '读取 Wi-Fi 状态').props.onClick({currentTarget: {form: null}});
    assert.equal(networkCalls[0].metadata.operation, 'info');
    assert.equal(networkCalls[0].password, '');
    const fields = Object.fromEntries(Object.entries({ssid: 'Test-Only', password: 'synthetic pass', timeHost: 'ntp.example',
      weatherHost: '', utcMinutes: '480', latitude: '', longitude: ''}).map(([name, value]) => [name, {value}]));
    const form = {elements: {namedItem: name => fields[name]}, reportValidity: () => true};
    const ready = netRender();
    assert.match(visible(ready), /已配置 · 已联网/);
    const submit = button(ready, '保存 Wi-Fi 配置').props.onClick({currentTarget: {form}});
    assert.equal(fields.password.value, '');
    await submit;
    assert.equal(networkCalls[1].metadata.operation, 'set');
    assert.equal(networkCalls[1].metadata.password, undefined);
    assert.equal(networkCalls[1].password, 'synthetic pass');
    assert.equal(networkCalls[1].body.every(byte => byte === 0), true);
    assert.doesNotMatch(JSON.stringify(networkClient.snapshot()), /synthetic pass|Test-Only/);
    const unknown = netRender();
    assert.match(visible(unknown), /结果未知/);
    assert.equal(button(unknown, '保存 Wi-Fi 配置').props.disabled, true);
    assert.equal(networkCalls.length, 2);

    const cityCalls = [], usbCalls = [], latest = Promise.withResolvers(), earlier = Promise.withResolvers();
    let readUnavailable = true;
    const weatherBinding = bindStatus({phase: 'bound', weatherAvailable: true, revision: '5'});
    const weatherClient = mountClient(hub, {fetch(url, options) {
      if (url === '/api/pet-hub-enrollment/status') return Promise.resolve({ok: true, json: () => weatherBinding});
      const body = JSON.parse(options.body);
      if (url.endsWith('/weather-search')) {
        cityCalls.push({body, signal: options.signal});
        return [earlier.promise, latest.promise, Promise.resolve({ok: true, json: () => ({places: []})}),
          Promise.resolve({ok: false})][cityCalls.length - 1];
      }
      assert.equal(url, '/api/pet-hub-enrollment/weather');
      usbCalls.push(body);
      const result = body.operation === 'set' ? {status: 'unknown'} : readUnavailable ? {status: 'unavailable'} :
        {status: 'ok', configured: true, latitudeE4: 33456, longitudeE4: -44444};
      return Promise.resolve({ok: true, json: () => result});
    }});
    const weatherRender = () => weatherClient.render(weatherClient.snapshot());
    weatherClient.render({binding: bindStatus({weatherAvailable: true}), query: readStatus()});
    assert.equal(button(weatherRender(), '读取设备地点').props.disabled, true);
    const searchCity = value => nodes(weatherRender()).find(item => item.props?.['aria-label'] === '搜索天气城市')
      .props.onSubmit({preventDefault() {}, currentTarget: {elements: {namedItem: () => ({value})}}});
    const oldSearch = searchCity('旧城'), currentSearch = searchCity('合成城');
    assert.match(visible(weatherRender()), /正在查找城市/);
    assert.equal(cityCalls[0].signal.aborted, true);
    const places = [
      {id: 1, name: '合成城', area: ['甲省', '甲国'], latitudeE4: 12345, longitudeE4: -23456},
      {id: 2, name: '合成城', area: ['乙省', '乙国'], latitudeE4: 33456, longitudeE4: -44444},
    ];
    latest.resolve({ok: true, json: () => ({places})});
    await currentSearch;
    earlier.resolve({ok: true, json: () => ({places: []})});
    await oldSearch;
    assert.equal(usbCalls.length, 0);
    assert.deepEqual(cityCalls.map(call => call.body), [{name: '旧城'}, {name: '合成城'}]);
    assert.match(visible(weatherRender()), /甲省 · 甲国.*乙省 · 乙国/);
    nodes(weatherRender()).filter(item => item.props?.name === 'pet-device-weather-place')[1].props.onChange();
    assert.equal(button(weatherRender(), '保存天气地点').props.disabled, true);
    weatherClient.render({...weatherClient.snapshot(), binding: weatherBinding});
    await button(weatherRender(), '保存天气地点').props.onClick();
    assert.deepEqual(usbCalls, [{operation: 'set', instanceId: id, revision: '5', latitudeE4: 33456, longitudeE4: -44444}]);
    assert.match(visible(weatherRender()), /设备未确认写入/);
    assert.equal(button(weatherRender(), '保存天气地点').props.disabled, true);
    await button(weatherRender(), '读取设备地点').props.onClick();
    assert.equal(button(weatherRender(), '保存天气地点').props.disabled, true);
    readUnavailable = false;
    await button(weatherRender(), '读取设备地点').props.onClick();
    assert.match(visible(weatherRender()), /设备地点 · 3\.3456°, -4\.4444°/);
    assert.deepEqual(usbCalls[1], {operation: 'info', instanceId: id, revision: '5'});
    assert.equal(button(weatherRender(), '保存天气地点').props.disabled, false);
    await searchCity('无结果');
    assert.match(visible(weatherRender()), /没有找到匹配城市/);
    await searchCity('服务失败');
    assert.match(visible(weatherRender()), /暂时无法搜索城市/);
    assert.equal(usbCalls.length, 3);
    assert.match(visible(view(bindStatus(), readStatus({phase: 'failed', usbContended: true, device: null}))), /另一项 USB 操作/);

    const getUsb = path => import(pathToFileURL(join(path, 'packages/runtime/desktop-usb-ownership.mjs')));
    const [queryUsb, bindingUsb] = await Promise.all([getUsb(hub), getUsb(backend)]);
    assert.notEqual(queryUsb, bindingUsb);
    const scope = {};
    const queryTarget = queryUsb.trackDesktopUsbTarget('query', 'fixture-usb', scope);
    const bindingTarget = bindingUsb.trackDesktopUsbTarget('binding', 'fixture-usb', scope);
    assert.deepEqual(queryUsb.desktopUsbStatus(scope), {sameUsbTarget: true, usbBusy: false});
    const released = Promise.withResolvers();
    const open = queryUsb.desktopUsbOpener(() => ({close: () => released.promise}), scope);
    const contend = bindingUsb.desktopUsbOpener(assert.fail, scope);
    const first = await open({});
    await assert.rejects(contend({}), {code: 'device_desktop_usb_busy'});
    const firstClosing = first.close();
    assert.equal(bindingUsb.desktopUsbStatus(scope).usbBusy, true);
    await assert.rejects(contend({}), {code: 'device_desktop_usb_busy'});
    released.resolve();
    await firstClosing;
    bindingTarget();
    const wrongTarget = bindingUsb.trackDesktopUsbTarget('binding', 'another-usb', scope);
    assert.deepEqual(queryUsb.desktopUsbStatus(scope), {sameUsbTarget: false, usbBusy: false});
    wrongTarget();
    queryTarget();

    const brokenScope = {};
    const broken = await queryUsb.desktopUsbOpener(() => ({close: () => Promise.reject(new Error('failed close'))}),
      brokenScope)({});
    await assert.rejects(broken.close(), /failed close/);
    await assert.rejects(bindingUsb.desktopUsbOpener(assert.fail, brokenScope)({}), {code: 'device_desktop_usb_busy'});

    const routes = new Map(), cleanup = [];
    const {createHostPlugin} = await import(pathToFileURL(join(hub, 'apps/dsh-plugin/index.mjs')));
    const instanceId = 'query-instance';
    const update = {phase: 'ready', revision: 2, queryOnly: true, device: {version: '0.1.5-usb-pair-test', slot: 'ota_1'}};
    let queries = 0, samples = 0, cancelled;
    const access = {instanceId, status: () => ({instanceId, update}),
      query() { queries++; return {instanceId, update}; },
      battery: {sample(requestId, signal) {
        assert.match(requestId, /^[a-f0-9]{32}$/);
        assert.equal(signal.aborted, false);
        samples++;
        return {status: 'busy'};
      }, cancel(requestId) { cancelled = requestId; }},
      usbStatus: () => ({sameUsbTarget: true, usbBusy: false})};
    createHostPlugin(null, {desktopDeviceQuery: true, managedDeviceUpdate: () => access, desktopBattery: true})({
      effect: setup => cleanup.push(setup()),
      connection: {fetch: {register(route) {
        routes.set(route.path, route.fetch);
        return () => routes.delete(route.path);
      }}},
      webServer: {register: () => () => {}},
    });
    t.after(() => { for (const dispose of cleanup.reverse()) dispose(); });
    function call(route, body, headers = {}) {
      const url = '/api/pet-hub-device/' + route;
      return routes.get(url)(new Request('http://dsh.internal' + url, body ? {method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1', ...headers}, body: JSON.stringify(body)} : {}));
    }
    const status = (await (await call('status')).json()).update;
    assert.equal(status.sameUsbTarget, true);
    assert.equal(status.batteryAvailable, true);
    assert.equal(samples, 0);
    const read = {operation: 'query', instanceId, revision: 2};
    assert.equal((await call('query', {...read, operation: 'install'})).status, 403);
    assert.equal((await call('query', read, {'X-Pet-Hub-Operator': 'fixture-token'})).status, 401);
    assert.equal((await call('query', {...read, instanceId: 'old-owner'})).status, 409);
    assert.equal((await call('query', read)).status, 200);
    assert.equal(queries, 1);
    const sample = {instanceId, operation: 'sample', requestId: 'f'.repeat(32)};
    assert.equal((await call('battery', sample)).status, 200);
    assert.equal((await call('battery', {...sample, instanceId: 'previous'})).status, 409);
    assert.equal((await call('battery', sample, {'X-Pet-Hub': '0'})).status, 403);
    assert.equal((await call('battery', sample, {'X-Pet-Hub-Operator': 'fixture-token'})).status, 401);
    assert.equal((await call('battery', {...sample, operation: 'install'})).status, 403);
    assert.equal((await call('battery', {...sample, operation: 'cancel'})).status, 200);
    assert.equal(cancelled, sample.requestId);
    assert.equal(samples, 1);
  });
