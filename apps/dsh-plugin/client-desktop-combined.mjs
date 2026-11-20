import {makeClientFactory} from './client.mjs';
import {makeDesktopDevicePage} from '../../packages/ui/device-settings-page.mjs';
import {makeTaskSourceSettings} from '../../packages/ui/task-source-settings.mjs';

async function desktopSettingsReply(response) {
  if (response.status === 401 || response.status === 403) return {status: 'unauthorized'};
  if (response.status === 404) return {status: 'backend_missing'};
  if (response.status === 409) return {status: 'state_changed'};
  if (response.status === 400) return {status: 'invalid'};
  if (!response.ok) throw Error('device_settings_request_rejected');
  const result = await response.json();
  if (typeof result?.status !== 'string') throw Error('device_settings_response_rejected');
  return result;
}

async function requestDesktopNetwork(input, password, signal) {
  const header = new TextEncoder().encode(JSON.stringify(input));
  const bytes = new Uint8Array(2 + header.length + password.length);
  try {
    bytes[0] = header.length >> 8;
    bytes[1] = header.length & 255;
    bytes.set(header, 2);
    bytes.set(password, 2 + header.length);
    const pending = fetch('/api/pet-hub-enrollment/network', {method: 'POST', signal, credentials: 'same-origin',
      cache: 'no-store', headers: {'Content-Type': 'application/octet-stream', 'X-Pet-Hub': '1'}, body: bytes});
    // Fetch consumes a copy of a BufferSource when it constructs its Request body.
    bytes.fill(0);
    password.fill(0);
    return await desktopSettingsReply(await pending);
  } finally { bytes.fill(0); password.fill(0); }
}

export function makeCombinedDesktopClientFactory() {
  const original = makeClientFactory({nodeControlTransport: 'connection'});
  return function factory(require) {
    if (globalThis.location?.protocol !== 'dsh-app:' || globalThis.location?.hostname !== 'app') return original(require);
    const React = require('react');
    return {name: 'pet-hub-client', inject: ['slots'], apply(ctx) {
      const fetchDesktop = (path, signal, body) => fetch('/api/pet-hub-' + path, {signal,
        credentials: 'same-origin', cache: 'no-store',
          ...(body ? {method: 'POST', body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {})});
      async function request(path, signal, body) {
        const response = await fetchDesktop(path, signal, body);
        if (!response.ok) throw Object.assign(Error('device_device_request_rejected'), {status: response.status});
        return response.json();
      }
      const Panel = makeDesktopDevicePage(React, {
        binding: signal => request('enrollment/status', signal),
        query: signal => request('device/status', signal),
        bindingCommand: (body, signal) => request('enrollment/command', signal, body),
        readDevice: (body, signal) => request('device/query', signal, body),
        battery: (body, signal) => request('device/battery', signal, body),
        network: requestDesktopNetwork,
        searchWeather: (name, signal) => request('enrollment/weather-search', signal, {name}),
        weather: async (body, signal) => desktopSettingsReply(await fetchDesktop('enrollment/weather', signal, body)),
        TaskSources: makeTaskSourceSettings(React, {
          async status(signal) {
            const response = await fetchDesktop('task-source/status', signal);
            if (response.status === 404) return null;
            if (!response.ok) throw Error('task_source_unavailable');
            return response.json();
          },
          select: (body, signal) => request('task-source/select', signal, body),
        }),
      });
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({name: 'settings.section', id: 'dsh-pet-hub-settings', order: 40,
          label: () => '桌面宠物设备', inject: () => ({})}, Panel);
      });
    }};
  };
}
