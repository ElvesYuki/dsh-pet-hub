import {requireThat as need,clone,same,uint64,bounded,id,keys,increment} from './protocol.mjs';
import {native360Capabilities,native360Manifest} from './native360-profile.mjs';
import {OBSERVATION_MODEL,observationKeys,observationContext,observationControl,observationPackage,observationTarget,observationRecord} from './round-pet-observation-schema.mjs';
import {validateDeviceWire,deviceWireContract,DEVICE_WIRE_PROFILE} from './round-pet-wire.mjs';
import {ROOT_CHECKPOINT,rootBinding,validateRootCheckpoint} from './round-pet-root-checkpoint.mjs';
const terminal=phase=>['failed','cancelled','ended'].includes(phase);
/** Single-device OFFLINE candidate projection, not a network/auth/lease implementation.
 * open/request/sent/query/expectSave are trusted owner calls. Every ingest needs external attestation;
 * defaults deny. Callbacks are synchronous and must reflect current managed session/control authority.
 * No device writes, timers, persistence or inferred first-frame/commit confirmations. */
export class RoundPetObservations{
 #caps;#manifest;#package;#clock;#verify;#sessionCurrent;#controlCurrent;#closed=false;#callbackBusy=false;#context=null;#online=false;#supported=false;#device=null;#queryTtl;
 #desired=null;#control=null;#request=null;#playback=null;#commands=new Map();#ops=new Map();#history=[];#queries=new Map();#seq={};#revision='0';#queryGeneration='0';
 #wire=null;#actual=null;#displayState='unknown';#maintenance='unknown';#refresh=null;#inventory=null;#inventoryCurrent=false;#rootFloor='0';#rootSeen=null;#checkpoint=null;#floorCommit=null;#prepared=null;
 constructor({caps,manifest,packageRef,clock,verifyObservation=()=>false,sessionCurrent=()=>false,controlCurrent=()=>false,queryTtlMs=2000,rootCheckpoint=null}){
  this.#caps=native360Capabilities(caps);this.#manifest=native360Manifest(manifest,this.#caps);observationPackage(packageRef);need(packageRef.hub_manifest_sha256===manifest.sha256,'incompatible_asset');this.#package=clone(packageRef);
  need(clock&&typeof clock.now==='function'&&[verifyObservation,sessionCurrent,controlCurrent].every(f=>typeof f==='function'));bounded(queryTtlMs,1,30000);this.#clock=clock;this.#verify=verifyObservation;this.#sessionCurrent=sessionCurrent;this.#controlCurrent=controlCurrent;this.#queryTtl=queryTtlMs;
  this.#checkpoint=rootCheckpoint===null?null:validateRootCheckpoint(rootCheckpoint);
 }
 #active(){need(!this.#closed,'closed');need(!this.#callbackBusy,'observation_busy');need(!this.#prepared,'root_commit_pending');}
 #capture(){return clone({wire:this.#wire,playback:this.#playback,actual:this.#actual,display:this.#displayState,maintenance:this.#maintenance,refresh:this.#refresh,inventory:this.#inventory,known:this.#inventoryCurrent,floor:this.#rootFloor,root:this.#rootSeen,commit:this.#floorCommit,history:this.#history,ops:this.#ops,queries:this.#queries,seq:this.#seq});}
 #restore(s){this.#wire=s.wire;this.#playback=s.playback;this.#actual=s.actual;this.#displayState=s.display;this.#maintenance=s.maintenance;this.#refresh=s.refresh;this.#inventory=s.inventory;this.#inventoryCurrent=s.known;this.#rootFloor=s.floor;this.#rootSeen=s.root;this.#floorCommit=s.commit;this.#history=s.history;this.#ops=s.ops;this.#queries=s.queries;this.#seq=s.seq;}
 /** Internal synchronous transaction: validates on a private candidate, restores the old projection,
  * then waits for its authority's durable CAS. No candidate can be observed before commitPrepared. */
 prepareIngest(context,record,proof){return this.#prepare(context,record,proof,false);}
 prepareIngestWire(context,record,proof){return this.#prepare(context,record,proof,true);}
 #prepare(context,record,proof,wire){this.#active();const before=this.#capture();let state,result,checkpoint;try{result=wire?this.ingestWire(context,record,proof):this.ingest(context,record,proof);state=this.#capture();checkpoint=this.rootCheckpoint();}finally{this.#restore(before);}const ticket=Object.freeze({prepared_root:true});this.#prepared={ticket,state,result,context:clone(context)};return {ticket,checkpoint:clone(checkpoint),accepted:result};}
 commitPrepared(ticket){need(this.#prepared?.ticket===ticket,'stale_task');const p=this.#prepared;this.#prepared=null;this.#match(p.context);this.#restore(p.state);return p.result;}
 discardPrepared(ticket){if(this.#prepared?.ticket!==ticket)return false;this.#prepared=null;return true;}
 #callback(fn,...args){this.#callbackBusy=true;try{const value=fn(...args);if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});need(false,'invalid_observation_callback');}return value;}finally{this.#callbackBusy=false;}}
 #now(){const t=this.#clock.now();bounded(t,0,Number.MAX_SAFE_INTEGER);return t;}
 #lose(){this.#online=false;this.#queries.clear();this.#inventoryCurrent=false;this.#displayState='unknown';this.#maintenance='unknown';}
 #live(){this.#active();if(this.#online)try{if(this.#callback(this.#sessionCurrent,clone(this.#context))!==true)this.#lose();}catch(error){this.#lose();throw error;}return this.#online&&this.#supported;}
 #match(context){need(this.#live(),'stale_session');observationContext(context);need(same(context,this.#context),'stale_session');}
 #controls(control){return this.#callback(this.#controlCurrent,clone(this.#context),clone(control))===true;}
 open(context,versions){
  this.#active();observationContext(context);need(!this.#device||this.#device===context.device_id,'identity_conflict');keys(versions,['profile','playback_version','display_version','storage_version','inventory_version']);
  if(this.#checkpoint)need(same(rootBinding(context),this.#checkpoint.binding),'root_checkpoint_binding_mismatch');
  const supported=versions.profile==='round-pet-native360/1'&&['playback_version','display_version','storage_version','inventory_version'].every(k=>versions[k]===1);
  if(this.#online&&same(context,this.#context)){need(supported===this.#supported,'idempotency_conflict');return this.snapshot();}
  const sameBinding=this.#context&&['device_id','binding_id','binding_epoch'].every(k=>this.#context[k]===context[k]);
  if(!sameBinding){this.#actual=null;this.#history=[];this.#inventory=clone(this.#checkpoint?.root??null);this.#rootFloor=this.#checkpoint?.floor_seq??'0';this.#rootSeen=clone(this.#checkpoint?.root??null);this.#floorCommit=clone(this.#checkpoint?.floor_commit??null);this.#refresh=null;}
  this.#wire=null;this.#context=clone(context);this.#device=context.device_id;this.#online=true;this.#supported=supported;this.#desired=null;this.#control=null;this.#request=null;this.#playback=null;this.#revision='0';this.#commands.clear();this.#ops.clear();this.#queries.clear();this.#seq={};this.#inventoryCurrent=false;this.#displayState='unknown';this.#maintenance='unknown';this.#refresh=null;return this.snapshot();
 }
 /** Explicit R3 entry; old open/ingest remain closed to schema2. No wire authentication is inferred. */
 openWire(context,versions){need(same(versions,Object.fromEntries(Object.entries(deviceWireContract().defs.versions.fields).map(([k,v])=>[k,v.const]))),'unsupported_observation_version');const out=this.open(context,{profile:'round-pet-native360/1',playback_version:1,display_version:1,storage_version:1,inventory_version:1});this.#wire={admission:null,maintenance:null,touch:null,cancel:null,source_context:null};return out;}
 /** Local intent fence, not a fabricated device cancelled report. */
 fenceTarget(context,target){this.#match(context);const c=this.#commands.get(target.command_id);need(c&&same(c.target,target),'stale_revision');c.cancelled=true;}
 wireSnapshot(){this.#active();return clone(this.#wire);}
 ingestWire(context,record,proof){
  this.#match(context);need(this.#wire,'unsupported_observation_version');validateDeviceWire({protocol:'hub-device/1',profile:DEVICE_WIRE_PROFILE,schema_version:1,type:'exchange.request',request_id:'projection',request_seq:'1',context,payload:{observation:{dispatch_id:null,record}}});
  need(this.#callback(this.#verify,proof,{context:clone(context),record:clone(record)})===true,'unverified_observation');this.#match(context);
  const r=clone(record),kind=r.type.split('.')[0];
  if(['touch','cancel'].includes(kind)){
   const key=kind==='touch'?'event_seq':'cancel_seq';if(this.#seq[kind]!==undefined&&uint64(r[key])<=uint64(this.#seq[kind]))return false;
   if(kind==='touch'){if(r.base_target)observationTarget(r.base_target,this.#manifest,this.#caps);const old=this.#wire.touch;if(old){need(uint64(r.local_token)>=uint64(old.local_token),'stale_sequence');if(r.local_token===old.local_token)need(['requested','playing','ended'].indexOf(r.phase)>=['requested','playing','ended'].indexOf(old.phase),'stale_phase');}}
   if(kind==='cancel'){observationTarget(r.target,this.#manifest,this.#caps);observationControl(r.control,context);need(this.#controls(r.control),'stale_control');const c=this.#commands.get(r.target.command_id);need(c&&same(c.target,r.target)&&same(c.control,r.control)&&c.cancelled,'stale_revision');}
   if(kind==='cancel'&&r.effect==='outcome_unknown'){this.#inventoryCurrent=false;this.#queries.delete('inventory');}this.#wire[kind]=r;this.#seq[kind]=r[key];return true;
  }
  need(['playback','display','storage','inventory'].includes(kind),'unsupported_observation');
  r.schema_version=1;
  if(kind==='playback')delete r.admission;
  if(kind==='display'){if(this.#wire.maintenance)need(uint64(record.maintenance.generation)>=uint64(this.#wire.maintenance.generation),'stale_refresh');r.maintenance=record.maintenance.phase;r.source_command=record.source_command?.target??null;}
  if(kind==='storage')delete r.commit_stage;
  // Extended storage statuses cannot be encoded as schema1 and are validated above, never re-labelled saved.
  const extended=kind==='storage'&&['already_available','cancelled_pre_gate'].includes(r.status);
  const result=this.#ingest(context,r,proof,record,extended,true);
  if(result){if(kind==='playback')this.#wire.admission=record.admission;if(kind==='display'){this.#wire.maintenance=clone(record.maintenance);this.#wire.source_context=clone(record.source_command?.context??null);}}
  return result;
 }
 request(context,command){
  this.#match(context);observationTarget(command,this.#manifest,this.#caps);const old=this.#commands.get(command.command_id);
  if(old){need(same(old.target,command),'idempotency_conflict');need(this.#desired?.command_id===command.command_id,'stale_revision');return false;}
  need(uint64(command.revision)>uint64(this.#revision),'stale_revision');this.#revision=command.revision;this.#desired=clone(command);this.#request='requested';this.#playback=null;this.#control=null;
  this.#commands.set(command.command_id,{target:clone(command),control:null});if(this.#commands.size>256)this.#commands.delete(this.#commands.keys().next().value);return true;
 }
 sent(context,command,control){this.#match(context);observationControl(control,context);need(same(this.#desired,command)&&this.#controls(control),'stale_control');if(this.#request==='sent'){need(same(control,this.#control),'idempotency_conflict');return false;}this.#request='sent';this.#control=clone(control);this.#commands.get(command.command_id).control=clone(control);return true;}
 query(context,kind){this.#match(context);need(['display','inventory'].includes(kind),'invalid_observation');const generation=increment(this.#queryGeneration),queryId=`${kind}_${generation}`,deadline=this.#now()+this.#queryTtl;bounded(deadline,0,Number.MAX_SAFE_INTEGER);this.#queryGeneration=generation;this.#queries.set(kind,{id:queryId,deadline});return queryId;}
 #query(kind,queryId){const q=this.#queries.get(kind);need(q&&q.id===queryId,'stale_query');need(this.#now()<q.deadline,'query_expired');}
 expectSave(context,operationId,command){
  this.#match(context);id(operationId);const known=this.#commands.get(command.command_id);need(known?.control&&same(known.target,command),'stale_revision');const old=this.#ops.get(operationId);
  if(old){need(same(old.target,command),'idempotency_conflict');return false;}
  if(this.#ops.size>=64){const retired=[...this.#ops].find(([,o])=>o.terminal);need(retired,'capacity_exceeded');this.#ops.delete(retired[0]);}
  this.#ops.set(operationId,{target:clone(command),terminal:false,last:null});return true;
 }
 #currentTarget(t){need(this.#request==='sent'&&same(t,this.#desired),'stale_revision');need(!terminal(this.#playback?.phase)&&!this.#commands.get(t.command_id)?.cancelled,'terminal_observation');}
 ingest(context,record,proof){return this.#ingest(context,record,proof);}
 #ingest(context,record,proof,original=record,extended=false,verified=false){
  context=clone(context);record=clone(record);this.#match(context);if(!extended)observationRecord(record,this.#manifest,this.#caps);if(!verified)need(this.#callback(this.#verify,proof,{context:clone(context),record:clone(original)})===true,'unverified_observation');this.#match(context);
  const stream=record.type.split('.')[0],seqKey={playback:'report_seq',display:'display_seq',storage:'storage_seq',inventory:'inventory_seq'}[stream],seq=record[seqKey];
  if(this.#seq[stream]!==undefined&&uint64(seq)<=uint64(this.#seq[stream]))return false;
  if(stream==='playback')this.#playbackRecord(record);
  else if(stream==='display')this.#displayRecord(record);
  else if(stream==='storage')this.#storageRecord(record);
  else this.#inventoryRecord(record);
  this.#seq[stream]=seq;return true;
 }
 #playbackRecord(r){
  observationControl(r.control,this.#context);need(same(r.package_ref,this.#package),'incompatible_asset');this.#currentTarget(r.target);need(same(r.control,this.#control)&&this.#controls(r.control),'stale_control');
  const order=['accepted','downloading','verified','playing'];const prev=this.#playback;
  if(prev&&order.includes(r.phase))need(order.indexOf(r.phase)>=order.indexOf(prev.phase),'stale_phase');
  need(r.phase!=='playing'||['verified','playing'].includes(prev?.phase),'first_frame_unverified');
  if(prev?.phase==='playing'&&r.phase==='playing')need(same(prev.first_frame,r.first_frame)&&r.elapsed_ms>=prev.elapsed_ms,'stale_refresh');
  this.#playback=clone(r);
 }
 #displayRecord(r){
  if(r.kind==='snapshot')this.#query('display',r.query_id);
  else if(r.origin==='remote'&&r.source_command){this.#currentTarget(r.source_command);need(this.#controls(this.#control),'stale_control');}
  if(r.asset_ref&&r.origin==='remote')need(r.asset_ref.action_id===r.source_command.action_id&&r.asset_ref.asset_sha256===r.source_command.asset_sha256&&r.asset_ref.bytes===this.#manifest.actions.find(a=>a.id===r.source_command.action_id).bytes,'incompatible_asset');
  if(this.#refresh){const old=this.#refresh,g=uint64(r.refresh_generation),og=uint64(old.refresh_generation);need(g>og||(g===og&&uint64(r.frame_seq)>=uint64(old.frame_seq)),'stale_refresh');
   if(this.#displayState==='held_last_valid'&&r.display_state==='playing')need(g>og,'stale_refresh');
   if(g===og&&r.frame_seq===old.frame_seq){need(same(r.asset_ref,old.asset_ref)&&same(r.source_command,old.source_command)&&r.origin===old.origin,'stale_refresh');if(this.#displayState==='held_last_valid'&&r.display_state==='held_last_valid')need(r.elapsed_ms===old.elapsed_ms,'maintenance_elapsed');}
  }
  if(r.kind==='snapshot')this.#queries.delete('display');this.#refresh=clone(r);this.#displayState=r.display_state;this.#maintenance=r.maintenance;
  if(r.asset_ref)this.#actual={...clone(r),context:clone(this.#context)};
 }
 #storageRecord(r){
  need(same(r.package_ref,this.#package),'incompatible_asset');const op=this.#ops.get(r.operation_id);need(op&&same(op.target,r.source_target),'stale_operation');
  if(op.terminal){need(same(op.last,{status:r.status,commit:r.commit}),'idempotency_conflict');return;}
  if(r.status==='already_available'){need(this.#inventoryCurrent&&this.#inventory?.root_seq===r.commit.root_seq,'inventory_unconfirmed');this.#commitMatches(this.#inventory,op.target,r.commit);}
  if(r.status==='saved'&&this.#inventory?.root_seq===r.commit.root_seq)this.#commitMatches(this.#inventory,op.target,r.commit);
  if(r.status==='saved'&&uint64(r.commit.root_seq)>=uint64(this.#rootFloor)){const a=this.#manifest.actions.find(a=>a.id===op.target.action_id);this.#floorCommit={root_seq:r.commit.root_seq,action_id:a.id,asset_sha256:a.sha256,bytes:a.bytes,object_generation:r.commit.object_generation};}
  if(r.status==='saved'&&uint64(r.commit.root_seq)>uint64(this.#rootFloor)){this.#rootFloor=r.commit.root_seq;if(!this.#inventory||uint64(this.#inventory.root_seq)<uint64(r.commit.root_seq)){this.#inventoryCurrent=false;this.#queries.delete('inventory');}}
  if(r.status==='outcome_unknown'){this.#inventoryCurrent=false;this.#queries.delete('inventory');}
  op.last={status:r.status,commit:clone(r.commit)};op.terminal=r.status!=='deferred';this.#history.push({...clone(r),context:clone(this.#context)});if(this.#history.length>16)this.#history.shift();
 }
 #inventoryRecord(r){
  this.#query('inventory',r.query_id);
  if(r.known){need(uint64(r.root_seq)>=uint64(this.#rootFloor),'stale_root');const root={root_seq:r.root_seq,root_state:r.root_state,namespace:r.namespace,active:clone(r.active).sort((a,b)=>a.action_id-b.action_id)};
   if(this.#rootSeen?.root_seq===r.root_seq)need(same(this.#rootSeen,root),'root_conflict');
   if(this.#floorCommit?.root_seq===r.root_seq){const {root_seq,...entry}=this.#floorCommit;need(root.active.some(a=>same(a,entry)),'root_conflict');}
   for(const saved of this.#history)if(saved.status==='saved'&&saved.commit.root_seq===r.root_seq)this.#commitMatches(root,saved.source_target,saved.commit);
   if(this.#floorCommit&&uint64(r.root_seq)>uint64(this.#floorCommit.root_seq))this.#floorCommit=null;this.#rootFloor=r.root_seq;this.#rootSeen=clone(root);this.#inventory=clone(root);this.#inventoryCurrent=true;
  }else this.#inventoryCurrent=false;
  this.#queries.delete('inventory');
 }
 #commitMatches(root,target,commit){const a=this.#manifest.actions.find(a=>a.id===target.action_id);need(root.active.some(e=>e.action_id===a.id&&e.asset_sha256===a.sha256&&e.bytes===a.bytes&&e.object_generation===commit.object_generation),'root_conflict');}
 disconnect(context){this.#active();need(same(context,this.#context),'stale_session');this.#lose();}
 /** Trusted policy snapshot of the complete authenticated root, including old/unmapped file identities.
  * Not part of the IPC/UI view; unknown roots expose no usable references. */
 inventoryState(){const known=this.#live()&&this.#inventoryCurrent;return known?{known:true,...clone(this.#inventory)}:{known:false,root_seq:null,root_state:null,active:[]};}
 /** Private handoff only: confirmed floor may exceed the last complete queried root after saved.
  * Export never promotes cached inventory to live and contains no control/command authority. */
 rootCheckpoint(){this.#active();if(!this.#context)return clone(this.#checkpoint);return validateRootCheckpoint({schema_version:1,profile:ROOT_CHECKPOINT,binding:rootBinding(this.#context),namespace:this.#package.namespace,floor_seq:this.#rootFloor,root:clone(this.#rootSeen),floor_commit:clone(this.#floorCommit)});}
 snapshot(){
  const live=this.#live(),controlled=live&&!!this.#control&&this.#controls(this.#control),current=live&&this.#displayState!=='unknown',known=live&&this.#inventoryCurrent;
  const available=a=>this.#inventory?this.#inventory.active.some(e=>e.action_id===a.id&&e.asset_sha256===a.sha256&&e.bytes===a.bytes):null;
  return {schema_version:1,profile:OBSERVATION_MODEL,synthetic:true,devices:this.#device?[{device_id:this.#device,connection:!this.#online?'offline':!this.#supported?'diagnostic':'online',controlled,
   desired:this.#desired?{action_id:this.#desired.action_id,revision:this.#desired.revision,is_current:live}:null,request_status:this.#request,
   playback:this.#playback?{phase:this.#playback.phase,elapsed_ms:this.#playback.elapsed_ms,first_frame_seq:this.#playback.first_frame?.first_frame_seq??null,is_current:controlled&&!this.#commands.get(this.#desired?.command_id)?.cancelled}:null,
   actual:this.#actual?{action_id:this.#actual.asset_ref.action_id,origin:this.#actual.origin,elapsed_ms:this.#actual.elapsed_ms,refresh_generation:this.#actual.refresh_generation,frame_seq:this.#actual.frame_seq,is_current:current,approved_asset:this.#manifest.actions.some(a=>a.id===this.#actual.asset_ref.action_id&&a.sha256===this.#actual.asset_ref.asset_sha256&&a.bytes===this.#actual.asset_ref.bytes)}:null,
   display_state:current?this.#displayState:'unknown',maintenance:live?this.#maintenance:'unknown',
   storage:this.#history.map(r=>({operation_id:r.operation_id,action_id:r.source_target.action_id,revision:r.source_target.revision,status:r.status,root_seq:r.commit?.root_seq??null,object_generation:r.commit?.object_generation??null,is_current:live&&same(r.context,this.#context)})),
   inventory:{known,root_seq:this.#inventory?.root_seq??null,root_state:this.#inventory?.root_state??null,actions:this.#manifest.actions.map(a=>({action_id:a.id,offline_available:known?available(a):null,last_confirmed_available:available(a)}))}}]:[]};
 }
 resources(){return {closed:this.#closed,commands:this.#commands.size,operations:this.#ops.size,history:this.#history.length,queries:this.#queries.size};}
 close(){if(this.#closed)return;need(!this.#callbackBusy,'observation_busy');this.#prepared=null;this.#active();this.#lose();this.#commands.clear();this.#ops.clear();this.#history=[];this.#actual=this.#inventory=this.#rootSeen=this.#refresh=this.#context=this.#desired=this.#control=this.#playback=null;this.#closed=true;}
}
