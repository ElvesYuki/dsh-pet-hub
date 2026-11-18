import { createHash } from 'node:crypto';
import { Registry } from '../../packages/core/registry.mjs';
import { DeviceModel } from '../../packages/core/device.mjs';
import { IntentScheduler } from '../../packages/core/scheduler.mjs';
import { MemoryStore, VirtualClock, FaultQueue, fixtureAuth } from '../../packages/simulator/index.mjs';
const evidence = [];
export function clearEvidence() { evidence.length = 0; }
export function readEvidence() { return evidence.map(fn => fn()); }
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function lab() {
  const clock = new VirtualClock(), queue = new FaultQueue(clock), auth = fixtureAuth(), operations = []; let next = 0;
  const tracked = (component, object) => new Proxy(object, { get(t,k) {
    const value = t[k]; if (typeof value !== 'function') return value;
    return (...args) => {
      const input = args.filter(v => v && typeof v === 'object' && !ArrayBuffer.isView(v)).map(v => Object.fromEntries(['device_id','command_id','action_id','revision','phase','kind','expected_revision'].filter(key => Object.hasOwn(v,key)).map(key=>[key,v[key]])));
      try { const result=value.apply(t,args); operations.push({component,operation:String(k),at_ms:clock.now(),input,result:'ok'}); return result; }
      catch(e) { operations.push({component,operation:String(k),at_ms:clock.now(),input,result:'rejected',code:e.code}); throw e; }
    };
  } });
  const ids = () => `fixture_${++next}`;
  const caps = { schema_version: 1, protocols: ['hub-device/1'], codecs: ['PET4'], firmware_version: 'fixture_v1', board_profile: 'fixture_round',
    display: { width: 240, height: 240, shape: 'circle', pixel_format: 'RGB565' }, cache: { slots: 4, slot_bytes: 3145728, persistent: false }, max_asset_bytes: 3145728, max_downloads: 1, inputs: ['touch'], outputs: ['display'] };
  const assets = new Map();
  // Tiny synthetic format, not PET4: magic, width code, fps, valid-offset flag, action ID.
  const actions = [0,11,58,4,43,7,55,1].map(actionId => {
    const bytes = new Uint8Array([83,73,77,49,240,24,1,actionId]); assets.set(actionId, bytes);
    return { id: actionId, bytes: bytes.length, sha256: hash(bytes) };
  });
  const manifest = { synthetic: true, character_id: 'fixture_character', sha256: hash('fixture_manifest'), variant_id: 'fixture_circle_240', codec: 'PET4', display: caps.display, actions };
  const store = new MemoryStore({ bindings: {} });
  const registry = () => tracked('hub',new Registry({ store, clock, manifest, verifyPeer: (proof,binding) => auth.verify(proof,binding.identity_ref) }));
  let hub = registry(); const devices = {};
  for (const deviceId of ['A','B']) {
    const deviceProof = auth.issue(`identity_${deviceId}`), controllerProof = auth.issue('controller_C');
    hub.bind({ device_id: deviceId, binding_id: `binding_${deviceId}`, binding_epoch: '1', identity_ref: `identity_${deviceId}`, controller_id: 'C' });
    const deviceStore = new MemoryStore({ control_epoch: '0', binding_epoch: '1', revoked: false, revoke_ops: {} });
    const device = tracked(deviceId,new DeviceModel({ deviceId, bindingId: `binding_${deviceId}`, controllerId: 'C', clock, ids, store: deviceStore, caps, manifest,
      verifyPeer: proof => auth.verify(proof,'controller_C'),
      verifyAsset: (bytes, expected) => bytes instanceof Uint8Array && bytes.length === expected.bytes && hash(bytes) === expected.sha256 &&
        bytes[0] === 83 && bytes[1] === 73 && bytes[2] === 77 && bytes[3] === 49 && bytes[4] === 240 && bytes[5] === 24 && bytes[6] === 1,
    }));
    devices[deviceId] = { device, deviceStore, deviceProof, controllerProof };
  }
  function connect(deviceId = 'A', instance = 'H1', customCaps = caps) {
    const item = devices[deviceId];
    const ctx = item.device.connect('C', instance, item.controllerProof);
    const hello = { protocol: 'hub-device/1', device_id: deviceId, binding_id: ctx.binding_id, binding_epoch: ctx.binding_epoch, boot_id: ctx.boot_id, session_id: ctx.session_id, capabilities: customCaps };
    hub.connect(hello, item.deviceProof);
    return { ctx, hello };
  }
  function acquire(deviceId = 'A', connection = connect(deviceId)) {
    const item = devices[deviceId];
    const operationId = ids();
    const grant = item.device.acquire(connection.ctx, operationId, item.deviceStore.read().control_epoch);
    return { ...connection, grant, deviceId, operationId };
  }
  function command(actionId = 11, revision = '1', commandId = ids()) {
    return { command_id: commandId, revision, character_id: manifest.character_id, manifest_sha256: manifest.sha256, variant_id: manifest.variant_id, action_id: actionId, asset_sha256: actions.find(a => a.id === actionId)?.sha256 ?? '0'.repeat(64) };
  }
  function send(session, cmd) {
    devices[session.deviceId].device.set(session.ctx, session.grant, cmd); hub.expect(session.ctx,cmd,session.grant);
  }
  function play(session, cmd) {
    const device = devices[session.deviceId].device;
    send(session,cmd); hub.report(session.ctx,device.report()); device.verify(cmd.command_id,assets.get(cmd.action_id)); hub.report(session.ctx,device.report());
    device.submitFrame(session.ctx,session.grant,cmd.command_id); hub.report(session.ctx,device.report());
  }
  evidence.push(() => ({ synthetic: true, operations: [...operations], timeline: clock.timeline, messages: queue.events, registry: hub.summary(), devices: Object.values(devices).map(v => v.device.snapshot()) }));
  return { clock, queue, auth, ids, caps, assets, actions, manifest, store, devices, connect, acquire, command, send, play,
    get hub() { return hub; }, restartHub() { hub = registry(); },
    scheduler(instance = 'H1') { return new IntentScheduler({ clock, instance, mapping: { idle: 0, working: 11, success: 58, thinking: 1, result: 43, waiting: 7, error: 55, touch: 4 } }); },
  };
}
