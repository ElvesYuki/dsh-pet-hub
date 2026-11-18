import {Registry} from '../core/registry.mjs';import {DeviceModel} from '../core/device.mjs';import {IntentScheduler} from '../core/scheduler.mjs';import {requireThat} from '../core/protocol.mjs';
import {VirtualClock,MemoryStore,fixtureAuth} from './index.mjs';import {sha256} from '../runtime/material-import.mjs';
/** Finite core-only probe. No worker, device socket, credential or per-step event dump. */
export function runReplayEndurance({steps=8640,acquisitions=600}={}){
 requireThat(Number.isSafeInteger(steps)&&steps>256&&steps<=20000);requireThat(Number.isSafeInteger(acquisitions)&&acquisitions>256&&acquisitions<=2000);
 const clock=new VirtualClock(),auth=fixtureAuth(),mapping={idle:0,working:11,success:58,thinking:1,result:43,waiting:7,error:55,touch:4};let next=0;
 const ids=()=>`endurance_${++next}`,caps={schema_version:1,protocols:['hub-device/1'],codecs:['PET4'],firmware_version:'synthetic_v1',board_profile:'synthetic_circle',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},cache:{slots:4,slot_bytes:3145728,persistent:false},max_asset_bytes:3145728,max_downloads:1,inputs:['touch'],outputs:['display']};
 const assets=new Map(Object.values(mapping).map(n=>[n,new Uint8Array([83,73,77,49,240,24,1,n])])),manifest={character_id:'synthetic',variant_id:'synthetic_240',sha256:sha256('endurance'),codec:'PET4',display:caps.display,actions:[...assets].map(([id,b])=>({id,bytes:b.length,sha256:sha256(b)}))};
 const store=new MemoryStore({bindings:{}}),registry=new Registry({store,clock,manifest,verifyPeer:(proof,b)=>auth.verify(proof,b.identity_ref)}),devices=[];
 for(const deviceId of ['A','B']){
  const proof=auth.issue(deviceId),controller=auth.issue('controller'),storage=new MemoryStore({control_epoch:'0',binding_epoch:'1',revoked:false,revoke_ops:{}});registry.bind({device_id:deviceId,binding_id:`binding_${deviceId}`,binding_epoch:'1',identity_ref:deviceId,controller_id:'C'});
  const actor=new DeviceModel({deviceId,bindingId:`binding_${deviceId}`,controllerId:'C',store:storage,clock,ids,caps,manifest,verifyPeer:p=>auth.verify(p,'controller'),verifyAsset:(b,a)=>b.length===a.bytes&&sha256(b)===a.sha256});
  const ctx=actor.connect('C','endurance',controller);registry.connect({protocol:'hub-device/1',device_id:deviceId,binding_id:ctx.binding_id,binding_epoch:ctx.binding_epoch,boot_id:ctx.boot_id,session_id:ctx.session_id,capabilities:caps},proof);
  devices.push({actor,storage,ctx,grant:actor.acquire(ctx,ids(),'0'),scheduler:new IntentScheduler({clock,instance:'endurance',mapping}),first:null});
 }
 const rejects=(fn,code)=>{let caught=false;try{fn();}catch(e){requireThat(e.code===code,'unexpected_rejection');caught=true;}requireThat(caught,'replay_accepted');};let heartbeat=0;
 for(let n=0;n<steps;n++){
  for(let tick=0;tick<6;tick++){clock.advance(5000);for(const d of devices){d.grant=d.actor.renew(d.ctx,d.grant);registry.control(d.ctx,d.grant);registry.heartbeat(d.ctx,String(++heartbeat));}}
  for(const d of devices){
   d.scheduler.submit({intent_id:`intent_${n}`,client_id:'simulated_ui',service_instance_id:'endurance',expected_revision:String(n),kind:'manual',action_id:n%2?11:58});
   const action=d.scheduler.desired(),command={command_id:ids(),revision:String(n+1),character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id:action,asset_sha256:manifest.actions.find(a=>a.id===action).sha256};d.first??=command;
   const old=d.actor.snapshot().actual;d.actor.set(d.ctx,d.grant,command);registry.expect(d.ctx,command,d.grant);requireThat(JSON.stringify(old)===JSON.stringify(d.actor.snapshot().actual),'premature_actual');registry.report(d.ctx,d.actor.report());d.actor.verify(command.command_id,assets.get(action));registry.report(d.ctx,d.actor.report());d.actor.submitFrame(d.ctx,d.grant,command.command_id);registry.report(d.ctx,d.actor.report());
   requireThat(d.scheduler.touch(`event_${n}`,100,String(n+1)),'touch_failed');requireThat(!d.scheduler.touch(`event_${n}`,100,String(n+1)),'touch_replay');
  }
 }
 for(const d of devices){
  rejects(()=>d.actor.set(d.ctx,d.grant,d.first),'stale_revision');const r=d.actor.resources();d.commandPhase=r;requireThat(r.command_receipts===256&&d.scheduler.resources().intent_receipts===256&&d.scheduler.resources().touch_receipts===256,'unbounded_receipts');
  const savedActual=d.actor.snapshot().actual;
  for(let n=0;n<acquisitions;n++){d.actor.release(d.ctx,d.grant);const epoch=d.storage.read().control_epoch,op=ids();d.grant=d.actor.acquire(d.ctx,op,epoch);requireThat(d.actor.acquire(d.ctx,op,epoch).control_epoch===d.grant.control_epoch,'acquire_replayed');requireThat(d.actor.resources().acquire_receipts===1,'unbounded_acquire');}
  requireThat(JSON.stringify(savedActual)===JSON.stringify(d.actor.snapshot().actual),'acquire_erased_actual');
  d.actor.release(d.ctx,d.grant);
 }
 return {status:'virtual_core_endurance_passed',virtual_ms:clock.now(),virtual_days:clock.now()/86400000,devices:2,commands:steps*2,intents:steps*2,sequenced_touches:steps*2,acquisitions:acquisitions*2,clock_history:clock.historyStats(),resources:devices.map(d=>({device_id:d.actor.deviceId,command_phase:d.commandPhase,device:d.actor.resources(),scheduler:d.scheduler.resources(),persistent_writes:d.storage.writes})),note:'Synthetic SIM1 and same virtual clock; no real transport, media, hardware, independent clocks or wall-clock endurance.'};
}
