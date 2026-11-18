import { createHash } from 'node:crypto';
import { MaterialPlayback } from '../core/material-playback.mjs';
import { Registry } from '../core/registry.mjs';
import { DeviceModel } from '../core/device.mjs';
import { IntentScheduler } from '../core/scheduler.mjs';
import { id, keys, requireThat, increment, same, bounded } from '../core/protocol.mjs';
import { VirtualClock, MemoryStore, fixtureAuth } from './index.mjs';

/** Repository-only simulation adapter. Never copied into the installable candidate. */
export function createSimulation({ instanceId }) {
  const clock = new VirtualClock(), auth = fixtureAuth(); let counter = 0, revision = '0', stopped = false;
  const nextId = () => `sim_${++counter}`, hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const mapping = { idle:0, thinking:1, working:11, result:43, success:58, waiting:7, error:55, touch:4 };
  const caps = { schema_version:1, protocols:['hub-device/1'], codecs:['PET4'], firmware_version:'synthetic_v1', board_profile:'synthetic_circle', display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'}, cache:{slots:4,slot_bytes:3145728,persistent:false}, max_asset_bytes:3145728, inputs:['touch'], outputs:['display'], max_downloads:1 };
  const assets = new Map(Object.values(mapping).map(action => [action,new Uint8Array([83,73,77,49,240,24,1,action])]));
  const actions = [...assets].map(([action,bytes]) => ({id:action,bytes:bytes.length,sha256:hash(bytes)}));
  const manifest = { character_id:'sim_character',sha256:hash('sim_manifest'),variant_id:'sim_circle',codec:'PET4',display:caps.display,actions };
  const store = new MemoryStore({bindings:{}});
  const registry = new Registry({store,clock,manifest,verifyPeer:(proof,binding)=>auth.verify(proof,binding.identity_ref)});
  const devices = new Map(), requests = new Map(); let playback=null; let source = {mode:'simulation',status:'connected',state:null,counter:0};
  function connect(item) {
    item.context = item.actor.connect('sim_controller',instanceId,item.controllerProof);
    registry.connect({protocol:'hub-device/1',device_id:item.deviceId,binding_id:`binding_${item.deviceId}`,binding_epoch:'1',boot_id:item.context.boot_id,session_id:item.context.session_id,capabilities:caps},item.deviceProof);
    item.grant = item.actor.acquire(item.context,nextId(),item.storage.read().control_epoch);
    item.connected = true; item.lastHeartbeat = clock.now(); item.revision = '0'; item.pending = null; item.lastAction = null;
    item.schedule = new IntentScheduler({clock,instance:instanceId,mapping}); item.schedule.source(source.status,source.state);
    dispatch(item);
  }
  function dispatch(item, force = false) {
    if (!item.connected) return;
    const actionId=item.schedule.desired(); if(!force && item.lastAction===actionId) return;
    const command={command_id:nextId(),revision:increment(item.revision),character_id:manifest.character_id,manifest_sha256:manifest.sha256,variant_id:manifest.variant_id,action_id:actionId,asset_sha256:actions.find(a=>a.id===actionId).sha256};
    item.actor.set(item.context,item.grant,command); registry.expect(item.context,command,item.grant); registry.report(item.context,item.actor.report());
    item.lastAction=actionId; item.revision=command.revision; item.pending={command,at:clock.now(),verified:false};
  }
  for (const deviceId of ['sim_A','sim_B']) {
    const deviceProof=auth.issue(`identity_${deviceId}`),controllerProof=auth.issue('sim_controller');
    registry.bind({device_id:deviceId,binding_id:`binding_${deviceId}`,binding_epoch:'1',identity_ref:`identity_${deviceId}`,controller_id:'sim_controller'});
    const storage=new MemoryStore({control_epoch:'0',binding_epoch:'1',revoked:false,revoke_ops:{}});
    const actor=new DeviceModel({deviceId,bindingId:`binding_${deviceId}`,controllerId:'sim_controller',store:storage,clock,ids:nextId,caps,manifest,verifyPeer:proof=>auth.verify(proof,'sim_controller'),verifyAsset:(bytes,expected)=>bytes instanceof Uint8Array && bytes.length===expected.bytes && hash(bytes)===expected.sha256 && bytes[0]===83 && bytes[6]===1});
    const item={deviceId,actor,storage,controllerProof,deviceProof,heartbeat:'0'}; devices.set(deviceId,item); connect(item);
  }
  function snapshot() {
    return {synthetic:true,revision,time_ms:clock.now(),source:{...source},devices:registry.summary().devices.map(row=>{
      const item=devices.get(row.device_id),schedule=item.schedule.summary();
      return { ...row, connection:item.connected?row.connection:'offline', controlled:item.connected && row.controlled, name:row.device_id==='sim_A'?'模拟圆屏 A':'模拟圆屏 B', mode:schedule.mode,intent_revision:schedule.intent_revision,simulation:true,material_playback:playback?.snapshot(item.deviceId) };
    })};
  }
  function refreshMaterials() {
    for(const item of devices.values()) playback?.tick(item.deviceId,{online:item.connected,session:item.context.session_id,actionId:item.schedule.desired(),intentRevision:item.schedule.summary().intent_revision});
  }
  function transaction(input, run) {
    requireThat(!stopped,'simulation_stopped'); requireThat(input && input.service_instance_id===instanceId,'stale_session');
    id(input.client_id); id(input.intent_id ?? input.request_id);
    const requestKey=`${input.client_id}:${input.intent_id ?? input.request_id}`;
    if(requests.has(requestKey)) { const previous=requests.get(requestKey); requireThat(same(previous.input,input),'idempotency_conflict'); return structuredClone(previous.result); }
    const result=run(); revision=increment(revision); const response={...result,simulation:snapshot()};
    requests.set(requestKey,{input:structuredClone(input),result:structuredClone(response)});if(requests.size>128)requests.delete(requests.keys().next().value);return response;
  }
  return {
    snapshot,
    requestResources(){return {entries:requests.size,limit:128};},
    roleContext(){return {now:clock.now(),source:{...source},devices:[...devices.values()].map(d=>({device_id:d.deviceId,online:d.connected,session:d.context.session_id}))};},
    refreshMaterials,
    async settleMaterials(){await playback?.settle();refreshMaterials();await playback?.settle();},
    attachMaterials(manager,bundle,verifyAsset) {
      playback=new MaterialPlayback({clock,resolve:id=>manager.resolve(id),readAsset:hash=>bundle.readAsset(hash),hasAsset:hash=>bundle.hasAsset?.(hash)??true,prepare:bundle.prepare,release:bundle.release,verifyAsset}); refreshMaterials();
    },
    materialProfiles() {
      const variants = [240,360].map(size => ({character_id:'sim_character',variant_id:`sim_${size}`,sha256:hash(`sim_catalog_${size}`),codec:'PET4',license_ref:'synthetic-only',display:{width:size,height:size,shape:'circle',pixel_format:'RGB565'},actions:actions.map(a=>({...a}))}));
      const profile = width => ({...caps,codecs:['PET4','SIM2'],schema_version:2,display:{...caps.display,width,height:width},presentation_modes:['exact','center'],cache:{playback_bytes:5865472,persistent:{active_slots:4,staging_slots:1,slot_bytes:5865472}},max_asset_bytes:5865472});
      return { manifests:variants, devices:[{device_id:'sim_A',caps:profile(466)},{device_id:'sim_B',caps:profile(240)}],characterId:'sim_character',requiredActions:Object.values(mapping) };
    },
    intent(input) {
      keys(input,['device_id','intent_id','client_id','service_instance_id','expected_revision','kind',...(input?.kind==='manual'?['action_id']:[])]);
      return transaction(input,()=>{
        const item=devices.get(input.device_id); requireThat(item,'unknown_device'); requireThat(item.connected,'device_offline');
        requireThat(input.expected_revision===item.schedule.summary().intent_revision,'revision_conflict');
        const {device_id,...intent}=input; const accepted=item.schedule.submit(intent); dispatch(item,input.kind==='manual'); refreshMaterials(); return accepted;
      });
    },
    control(input) {
      const fields={advance:['ms'],offline:['device_id'],reconnect:['device_id'],source:['status','state']};
      requireThat(Object.hasOwn(fields,input?.operation),'invalid_message');
      keys(input,['operation','request_id','client_id','service_instance_id','expected_revision',...fields[input.operation]]);
      return transaction(input,()=>{
        requireThat(input.expected_revision===revision,'revision_conflict');
        if(input.operation==='advance') {
          bounded(input.ms,1,30000);
          const until=clock.now()+input.ms;
          while(clock.now()<until) {
            clock.advance(Math.min(100,until-clock.now()));
            for(const item of devices.values()) {
              playback?.tick(item.deviceId,{online:item.connected,session:item.context.session_id,actionId:item.schedule.desired(),intentRevision:item.schedule.summary().intent_revision});
              if(!item.connected) continue;
              if(clock.now()-item.lastHeartbeat>=5000) {
                item.grant=item.actor.renew(item.context,item.grant); registry.control(item.context,item.grant);
                item.heartbeat=increment(item.heartbeat); registry.heartbeat(item.context,item.heartbeat); item.lastHeartbeat=clock.now();
              }
              dispatch(item);
              const pending=item.pending; if(!pending) continue;
              if(!pending.verified && clock.now()-pending.at>=300) { item.actor.verify(pending.command.command_id,assets.get(pending.command.action_id)); registry.report(item.context,item.actor.report()); pending.verified=true; }
              if(pending.verified && clock.now()-pending.at>=400) { item.actor.submitFrame(item.context,item.grant,pending.command.command_id); registry.report(item.context,item.actor.report()); item.pending=null; }
            }
          }
        } else if(['offline','reconnect'].includes(input.operation)) {
          const item=devices.get(input.device_id); requireThat(item,'unknown_device');
          if(input.operation==='offline') { if(item.connected) item.actor.disconnect(item.context); item.connected=false; item.pending=null; playback?.tick(item.deviceId,{online:false}); }
          else { requireThat(!item.connected,'already_connected'); connect(item); }
        } else if(input.operation==='source') {
          requireThat(['connected','unavailable'].includes(input.status)); requireThat(input.state===null || ['thinking','working','result','success','waiting','error'].includes(input.state));
          source={mode:'simulation',status:input.status,state:input.state,counter:source.counter+1};
          for(const item of devices.values()) { item.schedule.source(source.status,source.state); dispatch(item); }
        } else requireThat(false,'invalid_message');
        refreshMaterials(); return {accepted:true};
      });
    },
    stop() { playback?.stop();stopped=true; devices.clear(); requests.clear(); },
  };
}
