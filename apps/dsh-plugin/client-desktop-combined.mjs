import {makeClientFactory} from './client.mjs';
import {makeDesktopDevicePage} from '../../packages/ui/vp8-desktop-device-page.mjs';

export function makeCombinedDesktopClientFactory() {
  const original = makeClientFactory({nodeControlTransport: 'connection'});
  return function factory(require) {
    if (globalThis.location?.protocol !== 'dsh-app:' || globalThis.location?.hostname !== 'app') return original(require);
    const React = require('react');
    return {name: 'pet-hub-client', inject: ['slots'], apply(ctx) {
      async function request(path, signal, body) {
        const response = await fetch('/api/pet-hub-vp8-' + path, {signal, credentials: 'same-origin',
          ...(body ? {method: 'POST', body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {})});
        if (!response.ok) throw Error('vp8_device_request_rejected');
        return response.json();
      }
      const Panel = makeDesktopDevicePage(React, {
        binding: signal => request('boot/status', signal),
        query: signal => request('local/status', signal),
        bindingCommand: (body, signal) => request('boot/command', signal, body),
        readDevice: (body, signal) => request('local/query', signal, body),
        battery: (body, signal) => request('local/battery', signal, body),
      });
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({name: 'settings.section', id: 'dsh-pet-hub-settings', order: 40,
          label: () => '桌面宠物设备', inject: () => ({})}, Panel);
      });
    }};
  };
}
