import {wireReviewLab} from './round-pet-wire-review-lab.mjs';
import {Native360DeviceModel} from '../../packages/core/native360-device.mjs';
import {MemoryNative360Flash} from '../../packages/simulator/native360-flash.mjs';
import {createRoundPetExecutor} from '../../packages/simulator/round-pet-executor.mjs';
import {native360Caps} from '../../packages/simulator/native360-fixture.mjs';
import {VirtualClock} from '../../packages/simulator/index.mjs';
import {NATIVE360} from '../../packages/core/native360-profile.mjs';
import {DEVICE_WIRE_PROFILE} from '../../packages/core/round-pet-wire.mjs';
import {clone,requireThat as need} from '../../packages/core/protocol.mjs';
import {leaseSendBudget} from '../../packages/core/lease-budget.mjs';
import {verifyRoundPetAsset,readRoundPetSource} from '../../packages/runtime/round-pet-material.mjs';
import {sha256} from '../../packages/runtime/material-import.mjs';
/** Existing A1 actor/executor through real new-wire hello/exchange/GET only. No static state reports. */
export async function wireExecutionLab(t,pki,{seed=[0,4,1,11],fault=()=>{},...options}={}){
 let executor=null;const f=await wireReviewLab(t,pki,{full:true,readBudget:{segment_ms:1000,exchange_ms:500,cleanup_ms:100,margin_ms:10},checkedClient:true,autoApply:false,...options,beforeClose:()=>executor?.close()}),metadata=readRoundPetSource(f.source.directory,f.source.approval),manifest=metadata.manifest,deviceClock=new VirtualClock();deviceClock.advance(700000);
 const medium=new MemoryNative360Flash({fault});let validations=0,closed=false,raw=f.peer,leaseReceipt=null,loadTicket=null,receivedBytes=0,steps=0;
 const verifyAsset=(bytes,asset)=>{validations++;const p=verifyRoundPetAsset(bytes,asset,f.source.content.timing[0]);return {...Object.fromEntries(['width','height','fps','frames','codec_flag','key_interval','tile_rows'].map(k=>[k,NATIVE360[k]])),width:p.width,height:p.height,fps:p.fps,frames:p.frames,bytes:bytes.length,sha256:sha256(bytes)};};
 const makeActor=create=>new Native360DeviceModel({caps:native360Caps(),manifest,medium,clock:deviceClock,verifyAsset,create});
 const initial=makeActor(true);try{let rev=0;for(const id of seed){const command={command_id:`seed_${++rev}`,revision:String(rev),character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id:id,asset_sha256:f.source.F},ticket=initial.request(command);initial.load(ticket);initial.supply(ticket,f.source.bytes);initial.verify(ticket);initial.beginSave(ticket);let n=0;while(n<f.source.bytes.length)n=initial.writeSave(ticket);initial.commitSave(ticket);}}finally{initial.close();}
 executor=createRoundPetExecutor({actor:makeActor(false),manifest,packageRef:f.packageRef,clock:deviceClock,wireProfile:DEVICE_WIRE_PROFILE});
 async function step({observation}={}){need(raw,'stale_session');const peer=raw,context=clone(peer.context),outgoing=observation??leaseReceipt??executor.take();leaseReceipt=null;let reply;try{reply=await peer.exchange(outgoing);need(reply.status===200,'exchange_refused');await f.adapter.waitForIdle();}catch(e){executor.disconnect(context);throw e;}need(raw===peer,'stale_session');steps++;const job=reply.value.payload.control;
  if(job){if(job.kind.startsWith('lease.')){peer.apply(job);leaseReceipt=clone(peer.outgoing);peer.outgoing=null;const duration=leaseSendBudget(job.payload.lease_ms,{host_ppm:500,device_ppm:500,command_delay_ms:1900,margin_ms:10,max_round_trip_ms:4000,max_lease_ms:15000});executor.setControl(peer.grant,deviceClock.now()+duration,context);}else executor.receive(job,context);}
  return reply.value.payload;
 }
 async function flush(){for(let n=0;n<32&&(leaseReceipt||executor.resources().outbox);n++)await step();need(!leaseReceipt&&!executor.resources().outbox,'flush_limit');}
 async function connect(){need(raw,'stale_session');try{const r=await raw.hello();need(r.status===200,'hello_refused');executor.open(raw.context);await step();await flush();}catch(e){executor.disconnect();await raw.close();raw=null;throw e;}}
 async function disconnect(){executor.disconnect();leaseReceipt=null;loadTicket=null;if(raw){await raw.close();raw=null;}await f.adapter.waitForIdle();}
 async function inventory(){f.adapter.query('inventory',f.deadline());await step();await flush();return row().inventory;}
 const row=()=>f.adapter.snapshot().observation.devices[0];
 await connect();f.adapter.lease('acquire',f.deadline());await step();await flush();
 return {f,executor,medium,deviceClock,manifest,get peer(){return raw;},step,flush,inventory,row,
  async acquire(){f.adapter.lease('acquire',f.deadline());await step();await flush();},
  async manual(id=43){const target=f.adapter.manual(id,f.deadline());await step();await flush();return target;},
  async load(){const r=executor.load();loadTicket=r.ticket;await flush();return r;},
  async display(){f.adapter.query('display',f.deadline());await step();await flush();return row().actual;},
  async download({mutate=b=>b,afterSegment=async()=>{}}={}){const context=clone(raw.context),ticket=loadTicket,bytes=new Uint8Array(manifest.actions.find(a=>a.id===executor.snapshot().desired.action_id).bytes);try{for(let offset=0;offset<bytes.length;offset+=32768){const response=await step();need(!response.control&&response.read_permit,'read_not_permitted');const part=await raw.segment(offset,Math.min(offset+32767,bytes.length-1));await f.adapter.waitForIdle();bytes.set(part,offset);receivedBytes+=part.length;await afterSegment(offset);}}catch(e){executor.disconnect(context);throw e;}executor.supply(ticket,mutate(bytes));return bytes;},
  async verify(){const r=executor.verify();await flush();return r;},
  async frame(){const token=executor.prepareFrame();executor.submitFrame(token);await flush();return token;},
  async save(options){const p=f.adapter.save(f.deadline(),options);const r=await step();need(r.control?.kind==='storage.save','save_not_dispatched');await flush();return p;},
  writeAll(){let n=0;while(n<f.source.bytes.length)n=executor.writeSave();return n;},
  async defer(){executor.deferSave();await flush();},
  async commit(){const r=executor.commitSave();await flush();return r;},
  async cancel(){const p=f.adapter.cancel(f.deadline());await step();await flush();return p;},
  async reconnect({reboot=false}={}){await disconnect();if(reboot)executor.reboot();raw=f.client();await connect();},
  async restartOwner(){await disconnect();await f.restartOwner(metadata.indexSha256);raw=f.client();await connect();},
  resources:()=>({received_bytes:receivedBytes,validations,steps,closed}),
  async close(){if(closed)return;closed=true;await disconnect();await executor.close();await f.close();}
 };
}
