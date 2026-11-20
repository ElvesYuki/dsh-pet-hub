import {makeClientFactory} from './client.mjs';
import {makeEnrollmentSettings} from '../../packages/ui/enrollment-settings.mjs';

/** Standalone candidate asset, built alongside the existing Desktop client. */
export function makeEnrollmentClientFactory({standalone = false} = {}) {
  const base = makeClientFactory({nodeControlTransport: 'connection'});
  return function factory(require) {
    const plugin = standalone ? {name: 'pet-hub-boot-review-client', inject: ['slots'], apply() {}} : base(require);
    if (globalThis.location?.protocol !== 'dsh-app:' || globalThis.location?.hostname !== 'app') return plugin;
    const React = require('react');
    return {...plugin, apply(ctx) {
      plugin.apply(ctx);
      async function request(path, signal, body) {
        const response = await fetch('/api/pet-hub-enrollment/' + path, {signal, credentials: 'same-origin',
          ...(body ? {method: 'POST', body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json', 'X-Pet-Hub': '1'}} : {})});
        if (!response.ok) throw new Error('device_boot_request_rejected');
        return response.json();
      }
      const BootSettings = makeEnrollmentSettings(React, {
        enrollmentStatus: signal => request('status', signal),
        enrollmentCommand: (report, signal) => request('command', signal, report),
      });
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({name: 'settings.section', id: 'dsh-pet-hub-enrollment-settings', order: 41,
          label: () => '设备登记候选', inject: () => ({})}, BootSettings);
      });
    }};
  };
}
