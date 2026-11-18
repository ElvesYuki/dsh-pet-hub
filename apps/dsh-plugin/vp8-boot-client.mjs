import {makeClientFactory} from './client.mjs';
import {makeVp8BootSettings} from '../../packages/ui/vp8-boot-settings.mjs';

/** Standalone candidate asset, built alongside the existing Desktop client. */
export function makeVp8BootReviewClientFactory({standalone = false} = {}) {
  const base = makeClientFactory({nodeControlTransport: 'connection'});
  return function factory(require) {
    const plugin = standalone ? {name: 'pet-hub-boot-review-client', inject: ['slots'], apply() {}} : base(require);
    if (globalThis.location?.protocol !== 'dsh-app:' || globalThis.location?.hostname !== 'app') return plugin;
    const React = require('react');
    return {...plugin, apply(ctx) {
      plugin.apply(ctx);
      async function request(path, signal, body) {
        const response = await fetch('/api/pet-hub-vp8-boot/' + path, {signal, credentials: 'same-origin',
          ...(body ? {method: 'POST', body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {})});
        if (!response.ok) throw new Error('vp8_boot_request_rejected');
        return response.json();
      }
      const BootSettings = makeVp8BootSettings(React, {
        vp8BootStatus: signal => request('status', signal),
        vp8BootCommand: (report, signal) => request('command', signal, report),
      });
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({name: 'settings.section', id: 'dsh-pet-hub-vp8-boot-review', order: 41,
          label: () => '设备登记候选', inject: () => ({})}, BootSettings);
      });
    }};
  };
}
