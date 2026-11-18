import {Registry} from '../core/registry.mjs';import {DeviceModel} from '../core/device.mjs';
import {VirtualClock,MemoryStore,FaultQueue,fixtureAuth} from './index.mjs';import {sha256} from '../runtime/material-import.mjs';
/** Independent host/device clocks and a transport timeline. No I/O; explicit caller delivery.
 * send() snapshots payloads, flush() returns rejection codes, close() fences future lab actions. */
export function createDualClockLab({hostStart=0,deviceStart=800000}={}){
 const host=new VirtualClock(),device=new VirtualClock(),link=new VirtualClock();host.advance(hostStart);device.advance(deviceStart);const queue=new FaultQueue(link),auth=fixtureAuth();let n=0,closed=false;
 const ids=()=>`dual_${++n}`,caps={schema_version:1,protocols:['hub-device/1'],codecs:['PET4'],firmware_version:'synthetic',board_profile:'synthetic',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},cache:{slots:4,slot_bytes:3145728,persistent:false},max_asset_bytes:3145728,max_downloads:1,inputs:['touch'],outputs:['display']};
 const assets=new Map([0,11,58].map(id=>[id,new Uint8Array([83,73,77,49,240,24,1,id])])),manifest={character_id:'dual',variant_id:'synthetic',codec:'PET4',sha256:sha256('dual'),display:caps.display,actions:[...assets].map(([id,b])=>({id,bytes:b.length,sha256:sha256(b)}))};
 const storage=new MemoryStore({control_epoch:'0',binding_epoch:'1',revoked:false,revoke_ops:{}}),bindings=new MemoryStore({bindings:{}}),cp=auth.issue('controller'),dp=auth.issue('device');
 const actor=new DeviceModel({deviceId:'D',bindingId:'B',controllerId:'C',store:storage,clock:device,ids,caps,manifest,verifyPeer:p=>auth.verify(p,'controller'),verifyAsset:(b,a)=>sha256(b)===a.sha256&&b.length===a.bytes});
 let registry;function newRegistry(){registry=new Registry({store:bindings,clock:host,manifest,verifyPeer:p=>auth.verify(p,'device')});}newRegistry();registry.bind({device_id:'D',binding_id:'B',binding_epoch:'1',controller_id:'C',identity_ref:'device'});
 const active=()=>{if(closed)throw Object.assign(new Error('closed'),{code:'closed'});};
 function connect(instance='H'){active();const ctx=actor.connect('C',instance,cp);registry.connect({protocol:'hub-device/1',device_id:'D',binding_id:'B',binding_epoch:'1',boot_id:ctx.boot_id,session_id:ctx.session_id,capabilities:caps},dp);return ctx;}
 function acquire(ctx,op=ids()){active();const sent_at=host.now(),grant=actor.acquire(ctx,op,storage.read().control_epoch);return {grant,observation:{sent_at,lease_ms:grant.expires_at-device.now()}};}
 function command(action,revision){return {command_id:ids(),revision,character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id:action,asset_sha256:manifest.actions.find(a=>a.id===action).sha256};}
 function send(kind,ctx,payload,options){active();const copy=structuredClone({ctx,payload});queue.send(()=>{active();if(kind==='set')return actor.set(copy.ctx,copy.payload.grant,copy.payload.command);if(kind==='report')return registry.report(copy.ctx,copy.payload);if(kind==='control')return registry.control(copy.ctx,copy.payload.grant,copy.payload.observation);if(kind==='heartbeat')return registry.heartbeat(copy.ctx,copy.payload);throw new Error('unknown lab message');},options);}
 return {host,device,link,queue,actor,storage,get registry(){return registry;},connect,acquire,command,send,
  observe(ctx,p){active();registry.control(ctx,p.grant,p.observation);},
  play(ctx,p,cmd){active();registry.expect(ctx,cmd,p.grant,p.observation);actor.set(ctx,p.grant,cmd);registry.report(ctx,actor.report());actor.verify(cmd.command_id,assets.get(cmd.action_id));registry.report(ctx,actor.report());actor.submitFrame(ctx,p.grant,cmd.command_id);registry.report(ctx,actor.report());},
  renew(ctx,p){active();const sent_at=host.now(),grant=actor.renew(ctx,p.grant);return {grant,observation:{sent_at,lease_ms:grant.expires_at-device.now()}};},
  restartHost(){active();newRegistry();},close(){closed=true;},summary(){return {host_ms:host.now(),device_ms:device.now(),link_ms:link.now(),registry:registry.summary(),queue:queue.historyStats()};}
 };
}
