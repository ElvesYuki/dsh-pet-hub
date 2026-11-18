import { makeHubPanel } from '../../packages/ui/index.mjs';
import { readPetPageState } from '../../packages/source-pet/page.mjs';
/** Trusted build policy: raw remains default; connection targets the separately
 * admitted exact Fetch routes. Selecting a transport never grants hub control. */
export function makeClientFactory({nodeControlTransport='raw'}={}) {
  if(!['raw','connection'].includes(nodeControlTransport))throw Error('invalid node control transport');
  const nodePrefix=nodeControlTransport==='connection'?'/api/pet-hub-node':'/dsh-pet-hub/node-control';
  const desktop = nodeControlTransport === 'connection' && globalThis.location?.protocol === 'dsh-app:' &&
    globalThis.location?.hostname === 'app';
  return function factory(require) {
    const React = require('react');
    return {
      name: 'pet-hub-client', inject: ['slots'],
      apply(ctx) {
        async function request(path, signal, report, operator) {
          const endpoint = desktop && path.startsWith('vp8-local/') ? '/api/pet-hub-vp8-local/' + path.slice('vp8-local/'.length) :
            desktop && path.startsWith('vp8-action/') ? '/api/pet-hub-vp8/' + path.slice('vp8-action/'.length) :
            path.startsWith('node-control/') ? nodePrefix + path.slice('node-control'.length) : `/dsh-pet-hub/${path}`;
          const res = await fetch(endpoint, {
            signal, credentials: 'same-origin',
            ...(report ? { method: 'POST', body: JSON.stringify(report) } : {}),
            ...(report || operator ? {headers: {...(report ? {'Content-Type': 'application/json', 'X-Pet-Hub': '1'} : {}),
              ...(operator ? {'X-Pet-Hub-Operator': operator} : {})}} : {}),
          });
          if (!res.ok) { const body=await res.json().catch(()=>({})); throw Object.assign(new Error(body.error ?? 'hub unavailable'),{status:res.status}); }
          return res.json();
        }
        const Panel = makeHubPanel(React, {
          vp8Status: (operator, signal) => request('vp8-action/status', signal, undefined, operator),
          vp8Command: (operator, report, signal) => request('vp8-action/command', signal, report, operator),
          ...(desktop ? {vp8LocalStatus: signal => request('vp8-local/status', signal),
            vp8LocalQuery: (report, signal) => request('vp8-local/query', signal, report)} : {}),
          nodeControlStatus: signal => request('node-control/controls',signal),
          nodeControlCommand: (report,signal) => request('node-control/command',signal,report),
          reviewStatus: signal => request('source-review/controls',signal),
          reviewStart: (report,signal) => request('source-review/start',signal,report),
          reviewCancel: (report,signal) => request('source-review/cancel',signal,report),
          frame: (report,signal) => request('roles/frame',signal,report),
          retryRole: (report,signal) => request('roles/retry',signal,report),
          activate: (report,signal) => request('roles/activate',signal,report),
          cancelRole: (report,signal) => request('roles/cancel',signal,report),
          roleIntent: (report,signal) => request('roles/intent',signal,report),
          versions: signal => request('materials/versions',signal),
          cleanup: (report,signal) => request('materials/cleanup',signal,report),
          status: signal => request('status', signal),
          publish: (report, signal) => request('source/page', signal, report),
          material: (report, signal) => request('materials/selection', signal, report),
          intent: (report, signal) => request('simulation/intent', signal, report),
          control: (report, signal) => request('simulation/control', signal, report),
        }, () => readPetPageState(ctx));
        ctx.slots.inject('settings.section', function* () {
          yield ctx.slots.register({ name: 'settings.section', id: 'dsh-pet-hub-settings', order: 40, label: () => '实体宠物设备', inject: () => ({}) }, Panel);
        });
      },
    };
  };
}
