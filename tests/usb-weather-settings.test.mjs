import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {decodeWeatherReply, encodeWeatherLine, validateWeatherRequest} from '../packages/runtime/usb-weather-settings.mjs';
import {parseWeatherSearch, searchWeatherPlaces} from '../packages/runtime/weather-geocoding.mjs';

const selection = {instanceId: '11111111-1111-1111-1111-111111111111', revision: '3'};
const coords = {latitudeE4: -900000, longitudeE4: 1800000};
const requestId = '012345ab';
const reply = tail => `@VP8_DESKWEATHER1 id=${requestId} status=${tail}\r\n`;

test('weather requests accept only WGS84 integer coordinates and correlate persistence receipts', () => {
  const input = {...selection, operation: 'set', ...coords};
  assert.doesNotThrow(() => validateWeatherRequest(input));
  for (const fields of [{latitudeE4: -900001}, {longitudeE4: 1800001}, {longitudeE4: '0'}, {latitudeE4: 0.5},
    {ssid: 'fixture'}, {password: 'fixture'}, {timeHost: 'fixture'}, {utcMinutes: 0}, {name: 'fixture'}])
    assert.throws(() => validateWeatherRequest({...input, ...fields}));
  assert.throws(() => validateWeatherRequest({...input, operation: 'info'}));
  assert.equal(encodeWeatherLine(requestId, 'set', input).toString(), 'DESKWEATHER1 012345ab SET -900000 1800000\n');
  assert.deepEqual(decodeWeatherReply(reply('saved configured=1 lat_e4=-900000 lon_e4=1800000'), requestId, 'set', input),
    {status: 'saved', configured: true, ...coords});
  assert.deepEqual(decodeWeatherReply(reply('storage_failed'), requestId, 'set', input), {status: 'storage_failed'});
  for (const payload of ['saved configured=1 lat_e4=0 lon_e4=1800000', 'saved configured=1 lat_e4=-0900000 lon_e4=1800000',
    'saved configured=1 lat_e4=-900001 lon_e4=1800000', 'saved configured=0', 'saved configured=1', 'saved',
    'ok configured=1 lat_e4=-900000 lon_e4=1800000', 'invalid configured=0'])
    assert.equal(decodeWeatherReply(reply(payload), requestId, 'set', input), null);
  assert.equal(decodeWeatherReply(reply('ok configured=0'), '11111111', 'info'), null);
  assert.equal(decodeWeatherReply(reply('cleared configured=0 lat_e4=0 lon_e4=0'), requestId, 'clear'), null);
});

const firmware = process.env.ROUND_PET_BOOT_PEER_ROOT;
test('Node weather bytes match the upstream C++ envelope and coordinate parsers', {skip: !firmware}, t => {
  const root = mkdtempSync(join(tmpdir(), 'vp8-deskweather-peer-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const output = join(root, 'peer');
  execFileSync('c++', ['-std=c++20', '-Wall', '-Wextra', '-Werror', '-I', join(firmware, 'tools/round-pet/vp8-probe/main'),
    'tests/fixtures/weather-settings-peer.cpp', '-o', output], {timeout: 15000});
  const operations = ['info', 'set', 'info', 'clear', 'info'];
  const lines = operations.map(operation => encodeWeatherLine(requestId, operation, coords));
  const actual = execFileSync(output, {input: Buffer.concat(lines), encoding: 'ascii', timeout: 5000}).match(/[^\n]+\n/g);
  assert.deepEqual(actual.map((line, i) => decodeWeatherReply(line, requestId, operations[i], coords)),
    [{status: 'ok', configured: false}, {status: 'saved', configured: true, ...coords},
      {status: 'ok', configured: true, ...coords}, {status: 'cleared', configured: false}, {status: 'ok', configured: false}]);
});

test('geocoding sends a fixed HTTPS query and projects same-name places without account or timezone data', async () => {
  const name = parseWeatherSearch({name: ' 合成城&=/# '});
  const places = await searchWeatherPlaces(name, {fetcher: async (url, options) => {
    assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
    assert.equal(url.pathname, '/v1/search');
    assert.deepEqual(Object.fromEntries(url.searchParams), {name, count: '12', language: 'zh', format: 'json'});
    assert.equal(options.redirect, 'error');
    assert.equal(options.signal.aborted, false);
    assert.deepEqual(options.headers, {Accept: 'application/json'});
    return Response.json({results: [
      {id: 1, name: '合成城', admin1: '甲省', admin2: '东区', country: '甲国', latitude: 1.23456, longitude: -0.00001,
        timezone: 'Private/Fixture', ssid: 'not projected'},
      {id: 2, name: '合成城', admin1: '乙省', admin2: '乙省', country_code: 'ZZ', latitude: -1.23456, longitude: 2},
      {id: 3, name: '不可用坐标', latitude: '4.5', longitude: 0},
    ]});
  }});
  assert.deepEqual(places, [
    {id: 1, name: '合成城', area: ['东区', '甲省', '甲国'], latitudeE4: 12346, longitudeE4: 0},
    {id: 2, name: '合成城', area: ['乙省', 'ZZ'], latitudeE4: -12346, longitudeE4: 20000},
  ]);
  for (const input of [{name: '短'}, {name: '长'.repeat(81)}, {name: '两\n行'}, {name: '坏\ud800值'}, {name: '合成城', host: 'fixture'}])
    assert.throws(() => parseWeatherSearch(input));
});

test('geocoding distinguishes empty, invalid, oversized and cancelled responses', async () => {
  assert.deepEqual(await searchWeatherPlaces('虚构地', {fetcher: async () => Response.json({generationtime_ms: 1})}), []);
  for (const response of [Response.json({error: true}), Response.json({results: [{id: 2, name: '合成城', latitude: 100, longitude: 2}]}),
    Response.json({results: 'invalid'}), new Response('', {status: 502}), new Response(new Uint8Array(128 * 1024 + 1))])
    await assert.rejects(searchWeatherPlaces('虚构地', {fetcher: async () => response}));
  const controller = new AbortController(), pulled = Promise.withResolvers();
  let cancelled = false;
  const stream = new ReadableStream({pull() { pulled.resolve(); return new Promise(() => {}); }, cancel() { cancelled = true; }});
  const pending = searchWeatherPlaces('虚构地', {signal: controller.signal, fetcher: async () => new Response(stream)});
  await pulled.promise;
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(cancelled, true);
});
