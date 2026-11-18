import {writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setImmediate as turn} from 'node:timers/promises';
import {Native360DeviceModel} from '../../packages/core/native360-device.mjs';
import {MemoryNative360Flash} from '../../packages/simulator/native360-flash.mjs';
import {createRoundPetExecutor} from '../../packages/simulator/round-pet-executor.mjs';
import {native360Caps} from '../../packages/simulator/native360-fixture.mjs';
import {VirtualClock} from '../../packages/simulator/index.mjs';
import {NATIVE360} from '../../packages/core/native360-profile.mjs';
import {leaseSendBudget} from '../../packages/core/lease-budget.mjs';
import {clone,requireThat as need} from '../../packages/core/protocol.mjs';
import {verifyRoundPetAsset} from '../../packages/runtime/round-pet-material.mjs';
import {sha256} from '../../packages/runtime/material-import.mjs';
import {assemblyFixture} from './round-pet-assembly-lab.mjs';

/** Model-owned execution only; temporary real TLS is still supplied by the A5 fixture. */
export async function executionLab(t,pki,{seed=[0,4,1,11],fault=()=>{},cachedHitInventoryOnly=false,...options}={}){
 const f=assemblyFixture(t,pki,options),deviceClock=new VirtualClock(),medium=new MemoryNative360Flash({fault});let validations=0,closed=false;deviceClock.advance(700000);
 const verifyAsset=(bytes,asset)=>{validations++;const proof=verifyRoundPetAsset(bytes,asset,f.media.timing);return {...Object.fromEntries(['width','height','fps','frames','codec_flag','key_interval','tile_rows'].map(k=>[k,NATIVE360[k]])),width:proof.width,height:proof.height,fps:proof.fps,frames:proof.frames,bytes:bytes.length,sha256:sha256(bytes)};};
 const makeActor=create=>new Native360DeviceModel({caps:native360Caps(),manifest:f.media.manifest,medium,clock:deviceClock,verifyAsset,create});
 // Build initial cache via actual model transactions, never by constructing inventory records.
 const initial=makeActor(true);try{let revision=0;for(const id of seed){const m=f.media.manifest,command={command_id:`seed_${++revision}`,revision:String(revision),character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id:id,asset_sha256:m.actions.find(a=>a.id===id).sha256},w=initial.request(command);initial.load(w);initial.supply(w,f.media.asset);initial.verify(w);initial.beginSave(w);let written=0;while(written<f.media.asset.length)written=initial.writeSave(w);initial.commitSave(w);}}finally{initial.close();}
 const executor=createRoundPetExecutor({actor:makeActor(false),manifest:f.media.manifest,packageRef:f.media.packageRef,clock:deviceClock,cachedHitInventoryOnly});f.owned.push(executor);
 let hub=await f.start(),assembly=hub.roundPetAssembly;await assembly.ready;await assembly.enableReview();let endpoint=await f.endpoint(hub);let raw=null,leaseReceipt=null,loadTicket=null,steps=0,receivedBytes=0;
 async function connect(){need(!raw,'peer_must_disconnect');raw=endpoint.client({deviceClock});await raw.hello();executor.open(raw.context);}
 async function step({observation}={}){need(raw,'stale_session');const peer=raw,expectedContext=clone(peer.context),outgoing=observation??leaseReceipt??executor.take();leaseReceipt=null;let r;try{r=await peer.exchange({observation:outgoing,apply:false});}catch(e){executor.disconnect(expectedContext);throw e;}need(raw===peer,'stale_session');steps++;if(r.control){if(r.control.kind.startsWith('lease.')){peer.apply(r.control);leaseReceipt=clone(peer.outgoing);const budget=leaseSendBudget(r.control.payload.lease_ms,{host_ppm:500,device_ppm:500,command_delay_ms:1900,margin_ms:10,max_round_trip_ms:4000,max_lease_ms:15000});executor.setControl(peer.grant,deviceClock.now()+budget,expectedContext);}else executor.receive(r.control,expectedContext);}return r;}
 async function flush(){for(let n=0;n<32&&(leaseReceipt||executor.resources().outbox);n++)await step();need(!leaseReceipt&&!executor.resources().outbox,'flush_limit');}
 async function inventory(){assembly.query('inventory',f.deadline());const r=await step();assert.equal(r.control.kind,'query.inventory');await flush();return assembly.snapshot().observationReview.devices[0].inventory;}
 async function disconnect(){executor.disconnect();leaseReceipt=null;if(raw){await raw.close();raw=null;}for(let n=0;n<100&&endpoint.resources().sockets;n++)await turn();}
 await connect();assembly.acquire(f.deadline());await step();await flush();
 return {f,get hub(){return hub;},get a(){return assembly;},executor,medium,deviceClock,get endpoint(){return endpoint;},get peer(){return raw;},connect,disconnect,step,flush,inventory,validations:()=>validations,
  row:()=>assembly.snapshot().observationReview.devices[0],
  async manual(id=43){const target=assembly.manual(id,f.deadline());const r=await step();assert.equal(r.control.kind,'playback.set');await flush();return target;},
  async load(){const source=executor.load();loadTicket=source.ticket;await flush();return source;},
  async download({mutate=b=>b,afterSegment=async()=>{}}={}){const expectedContext=clone(raw.context),ticket=loadTicket,bytes=new Uint8Array(f.media.asset.length);try{for(let offset=0;offset<bytes.length;offset+=32768){const r=await step();need(!r.control&&r.read_permit,'read_not_permitted');const part=await raw.segment(offset,Math.min(offset+32767,bytes.length-1));bytes.set(part,offset);receivedBytes+=part.length;await afterSegment(offset);}}catch(e){executor.disconnect(expectedContext);throw e;}executor.supply(ticket,mutate(bytes));return bytes;},
  async verify(){const r=executor.verify();await flush();return r;},
  async frame(){const token=executor.prepareFrame();executor.submitFrame(token);await flush();return token;},
  async save(options){const operation=assembly.save(f.deadline(),options);const r=await step();assert.equal(r.control.kind,'storage.save');return operation;},
  writeAll(){let n=0;while(n<f.media.asset.length)n=executor.writeSave();return n;},
  async commit(){const result=executor.commitSave();await flush();return result;},
  async restartHub({checkpoint=assembly.rootCheckpoint()}={}){const I=(await assembly.ready).identity.index_sha256;await disconnect();await endpoint.close();await hub.close();const file=join(f.root,'root-checkpoint.json');let recovered=null;if(!f.options.rootPersistence){writeFileSync(file,JSON.stringify(checkpoint)+'\n',{mode:0o600});recovered=JSON.parse(readFileSync(file,'utf8'));}hub=await f.start({...(f.options.rootPersistence?{}:{rootCheckpoint:recovered}),material:{cachedOnly:true,indexSha256:I,approval:f.options.material.approval}});assembly=hub.roundPetAssembly;await assembly.ready;const phase=assembly.snapshot().assemblyReview.phase;await assembly.enableReview();endpoint=await f.endpoint(hub);await connect();return {phase,checkpoint:recovered};},
  resources:()=>({steps,received_bytes:receivedBytes,validations,closed}),
  async close(){if(closed)return;closed=true;await disconnect();await endpoint.close();await hub.close();executor.close();}
 };
}
