import {target,uint64,increment,requireThat,bounded,clone,same} from './protocol.mjs';
import {NATIVE360,native360Capabilities,native360Manifest,verifyNative360} from './native360-profile.mjs';
import {Native360FlashModel} from './native360-flash.mjs';
import {validateLeaseContext} from './lease-wire.mjs';

/** Schema2 resource actor for trusted offline callers, NOT a transport/authentication entry point.
 * One encoded RAM owner; cached touch media may stream from a pinned Flash generation.
 * Work/frame tokens are local opaque capabilities; reboot fences all tokens, retains valid Flash.
 * submitFrame represents an injected refresh-completed event, not actual rendering or hardware proof.
 * The caller owns the medium; close releases its model claim, never erases durable contents. */
export class Native360DeviceModel {
 #caps;#manifest;#flash;#clock;#verify;#closed=false;#generation='0';#revision='0';
 #work=null;#ram=null;#stream=null;#frame=null;#save=null;#phase=null;#actual=null;#started=null;
 #display='unknown';#maintenance='none';#storage=null;#session=null;
 constructor({caps,manifest,medium,clock,verifyAsset=()=>false,namespace=NATIVE360.namespace,create=false}){
  this.#caps=native360Capabilities(caps);this.#manifest=native360Manifest(manifest,this.#caps);requireThat(clock&&typeof clock.now==='function'&&typeof verifyAsset==='function');
  this.#clock=clock;this.#verify=verifyAsset;this.#flash=new Native360FlashModel({medium,caps:this.#caps,verifyAsset,namespace,create});
 }
 #active(){requireThat(!this.#closed,'closed');}
 #healthy(){this.#active();const r=this.#flash.resources();requireThat(!r.busy,'flash_busy');requireThat(!r.uncertain,this.#flash.inventory().reason??'flash_recovery_required');}
 #ticket(ticket){this.#healthy();requireThat(this.#work?.ticket===ticket,'stale_task');return this.#work;}
 #freeze(reason){this.#frame=null;this.#display=this.#actual?'held_last_valid':'unknown';this.#maintenance=reason;}
 #releaseStream(){if(this.#stream)this.#flash.releaseRead(this.#stream.lease);this.#stream=null;}
 #cancelSave(){if(this.#save){this.#flash.cancel(this.#save.ticket);this.#save=null;if(this.#storage?.status==='saving')this.#storage={...this.#storage,status:'cancelled'};this.#maintenance='none';}}
 #loaded(){return !!(this.#stream&&same(this.#stream.asset,this.#work?.asset))||!!(this.#ram?.verified&&same(this.#ram.asset,this.#work?.asset));}
 /** Trusted authenticated-owner boundary, not a hello endpoint. New full context resets only
  * volatile command state; Flash/root/uncertainty and held pixels survive without a reboot/scan. */
 beginSession(context){this.#active();validateLeaseContext(context);requireThat(Object.keys(context).length===7,'invalid_message');if(same(this.#session,context))return false;requireThat(!this.#flash.resources().busy,'flash_busy');requireThat(!this.#save?.gate,'commit_in_progress');
  const generation=increment(this.#generation);this.#cancelSave();this.#releaseStream();this.#generation=generation;this.#frame=this.#work=this.#ram=null;this.#revision='0';this.#phase=null;this.#started=null;this.#storage=null;this.#freeze(this.#flash.resources().uncertain?'blocked':'none');this.#session=clone(context);return true;
 }
 request(command){
  this.#healthy();requireThat(!this.#save?.gate,'commit_in_progress');const asset=target(command,this.#manifest,this.#caps);
  if(this.#work?.command.command_id===command.command_id){requireThat(same(command,this.#work.command),'idempotency_conflict');return this.#work.ticket;}
  requireThat(uint64(command.revision)>uint64(this.#revision),'stale_revision');const generation=increment(this.#generation);
  this.#cancelSave();this.#frame=null;if(this.#ram&&!this.#ram.verified)this.#ram=null;this.#work={ticket:Object.freeze({native360_work:true}),command:clone(command),asset,generation,source:null};this.#generation=generation;this.#revision=command.revision;this.#phase='accepted';this.#started=null;return this.#work.ticket;
 }
 load(ticket){
  const w=this.#ticket(ticket);requireThat(this.#phase==='accepted','invalid_phase');this.#freeze('loading');this.#releaseStream();
  const hit=this.#flash.lookup(w.asset);
  if(hit&&w.asset.id===4){this.#stream={lease:this.#flash.openRead(w.asset),asset:clone(w.asset)};w.source='flash_stream';this.#phase='verified';this.#maintenance='loading';return {source:w.source};}
  this.#ram=null;
  if(!hit){w.source='network';this.#phase='downloading';return {source:w.source};}
  const lease=this.#flash.openRead(w.asset),bytes=new Uint8Array(w.asset.bytes);
  try{for(let at=0;at<bytes.length;at+=4096)bytes.set(this.#flash.read(lease,at,Math.min(4096,bytes.length-at)),at);}
  catch(error){this.#phase='failed';this.#maintenance='blocked';throw error;}finally{this.#flash.releaseRead(lease);}
  this.#ram={asset:clone(w.asset),bytes,verified:false};w.source='flash_ram';this.#phase='preparing';return {source:w.source};
 }
 supply(ticket,bytes){const w=this.#ticket(ticket);requireThat(w.source==='network'&&this.#phase==='downloading'&&!this.#ram,'invalid_phase');requireThat(bytes instanceof Uint8Array&&bytes.length===w.asset.bytes,'asset_integrity_failed');this.#ram={asset:clone(w.asset),bytes:new Uint8Array(bytes),verified:false};}
 verify(ticket){
  const w=this.#ticket(ticket);if(w.source==='flash_stream'){requireThat(this.#phase==='verified','invalid_phase');return;}
  requireThat(['downloading','preparing'].includes(this.#phase)&&this.#ram,'invalid_phase');const ram=this.#ram;
  try{verifyNative360(this.#verify,ram.bytes,w.asset);this.#ticket(ticket);requireThat(this.#ram===ram,'stale_task');ram.verified=true;this.#phase='verified';}
  catch(error){if(this.#work===w){this.#ram=null;this.#phase='failed';this.#freeze('blocked');}throw error;}
 }
 prepareFrame(ticket){this.#ticket(ticket);requireThat(['verified','playing'].includes(this.#phase)&&this.#loaded()&&!this.#save,'invalid_phase');const token=Object.freeze({native360_frame:true});this.#frame={token,ticket};return token;}
 submitFrame(token){
  this.#healthy();requireThat(this.#frame?.token===token,'stale_task');const w=this.#ticket(this.#frame.ticket);requireThat(this.#loaded()&&!this.#save&&['verified','playing'].includes(this.#phase),'invalid_phase');const at=this.#clock.now();bounded(at,0,Number.MAX_SAFE_INTEGER);
  this.#frame=null;if(this.#started===null)this.#started=at;this.#actual=clone(w.command);this.#phase='playing';this.#display='playing';this.#maintenance='none';return this.snapshot();
 }
 beginSave(ticket,options){
  const w=this.#ticket(ticket);requireThat(['verified','playing'].includes(this.#phase)&&this.#loaded()&&!this.#save,'invalid_phase');
  const hit=this.#flash.lookup(w.asset);if(hit){this.#storage={status:'saved',already_saved:true,target:clone(w.command),...hit};return {already_saved:true};}
  requireThat(!this.#stream&&this.#ram?.verified&&same(this.#ram.asset,w.asset),'cache_busy');this.#freeze('saving');
  try{const result=this.#flash.begin(w.asset,options);this.#save={ticket:result.ticket,work:ticket,written:0};this.#storage={status:'saving',target:clone(w.command)};return {already_saved:false};}
  catch(error){this.#storage={status:'failed',target:clone(w.command),error:error.code};this.#maintenance='blocked';throw error;}
 }
 writeSave(ticket,maxBytes=4096){const w=this.#ticket(ticket);bounded(maxBytes,1,4096);requireThat(this.#save?.work===ticket,'stale_task');const s=this.#save;requireThat(s.written<w.asset.bytes,'asset_complete');
  try{s.written=this.#flash.append(s.ticket,this.#ram.bytes.subarray(s.written,Math.min(s.written+maxBytes,w.asset.bytes)));return s.written;}
  catch(error){this.#save=null;this.#maintenance='blocked';this.#storage={status:'failed',target:clone(w.command),error:error.code};throw error;}
 }
 /** Explicit offline gate: old playback can be cancelled afterwards, durable work cannot. */
 gateSave(ticket){this.#ticket(ticket);requireThat(this.#save?.work===ticket,'stale_task');const s=this.#save;s.gate=this.#flash.gateCommit(s.ticket);return s.gate;}
 commitSave(ticket){const w=this.#ticket(ticket);requireThat(this.#save?.work===ticket,'stale_task');const s=this.#save;
  try{const receipt=this.#flash.commit(s.ticket,s.gate?{gate:s.gate}:undefined);this.#save=null;this.#storage={status:'saved',target:clone(w.command),...receipt};return clone(this.#storage);}
  catch(error){if(error.code==='asset_incomplete')throw error;this.#save=null;this.#maintenance='blocked';this.#storage={status:error.code==='storage_commit_unknown'?'outcome_unknown':'failed',target:clone(w.command),error:error.code};throw error;}
 }
 cancel(ticket){this.#ticket(ticket);if(this.#save?.gate){this.#phase='cancelled';this.#freeze('saving');return this.snapshot();}this.#cancelSave();this.#frame=null;this.#releaseStream();this.#ram=null;this.#phase='cancelled';this.#freeze('none');if(this.#storage?.status==='saving')this.#storage={...this.#storage,status:'cancelled'};return this.snapshot();}
 /** Trusted recovery only: invalidates all volatile tickets; inventory does not synthesize saved. */
 recoverStorage(){this.#active();requireThat(!this.#save&&!this.#stream,'cache_busy');this.#generation=increment(this.#generation);this.#frame=this.#work=this.#ram=null;this.#phase=null;this.#started=null;this.#freeze('blocked');const inventory=this.#flash.recover();this.#maintenance='none';return inventory;}
 reboot(){this.#active();this.#session=null;this.#generation=increment(this.#generation);this.#frame=null;this.#work=null;this.#ram=null;this.#stream=null;this.#save=null;this.#revision='0';this.#phase=null;this.#actual=null;this.#started=null;this.#display='unknown';this.#maintenance='none';this.#storage=null;this.#flash.reboot();return this.snapshot();}
 snapshot(){this.#active();return {synthetic:true,model:'native360-resources/1',generation:this.#generation,desired:clone(this.#work?.command??null),actual:clone(this.#actual),phase:this.#phase,started:this.#started,display_state:this.#display,maintenance:this.#maintenance,working:this.#ram?{asset:clone(this.#ram.asset),verified:this.#ram.verified}:null,streaming:this.#stream?clone(this.#stream.asset):null,storage:clone(this.#storage),inventory:this.#flash.inventory(),presentation:{mode:'center',x:53,y:53}};}
 resources(){return {closed:this.#closed,encoded_buffers:this.#ram?1:0,encoded_bytes:this.#ram?.bytes.length??0,stream_leases:this.#stream?1:0,work_tickets:this.#work?1:0,frame_tickets:this.#frame?1:0,save_tasks:this.#save?1:0,flash:this.#flash.resources()};}
 close(){if(this.#closed)return;this.#flash.close();this.#closed=true;this.#frame=this.#work=this.#ram=this.#stream=this.#save=null;}
}
