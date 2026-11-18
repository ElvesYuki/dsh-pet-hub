import {clone,same,uint64,bounded,requireThat as need} from './protocol.mjs';
import {native360Capabilities,native360Manifest,NATIVE360} from './native360-profile.mjs';
import {observationContext,observationControl,observationTarget,observationRecord} from './round-pet-observation-schema.mjs';
import {advanceRootCheckpoint,ROOT_CHECKPOINT,rootBinding} from './round-pet-root-checkpoint.mjs';
export const FIRST_WINDOW_PROFILE='first-window-review/1';
/** Admission for the cached-only review window, reused at enqueue and dispatch. No side effects.
 * inventory is a validated full root snapshot from the current authenticated source. */
export function authorizeFirstWindow(kind,target,inventory,manifest){
 need(kind==='playback.set','first_window_read_only');
 need(target.action_id!==4,'touch_only');need([0,11].includes(target.action_id),'first_window_action');
 need(inventory?.known&&inventory.namespace===NATIVE360.namespace&&inventory.root_state==='OFFLINE_READY','inventory_unconfirmed');
 for(const id of [0,4,target.action_id]){const a=manifest.actions.find(a=>a.id===id);need(a&&inventory.active.some(e=>e.action_id===id&&e.asset_sha256===a.sha256&&e.bytes===a.bytes),'first_window_not_cached');}
 const a=manifest.actions.find(a=>a.id===target.action_id);need(target.asset_sha256===a.sha256,'incompatible_asset');
 return true;
}
/** Projection only; callers still enforce authorizeFirstWindow. Does not implement a UI/IPC route. */
export function firstWindowChoices(inventory,manifest){return manifest.actions.map(a=>{let reason=null;try{authorizeFirstWindow('playback.set',{action_id:a.id,asset_sha256:a.sha256},inventory,manifest);}catch(e){reason=e.code;}return {action_id:a.id,enabled:reason===null,reason};});}

/** Trusted offline execution policy, not authentication, a device driver or a touch listener.
 * One current base/local event/frame; clock is local monotonic ms. submitFrame models a refresh ACK.
 * Same-boot disconnect preserves local lifetime; new context requires new control/inventory/base.
 * close is idempotent; no timers, callbacks, I/O or automatic remote commands. */
export class FirstWindowModel{
 #clock;#manifest;#caps;#boot=null;#context=null;#binding=null;#inventory=null;#checkpoint=null;#inventorySeq=null;
 #control=null;#deadline=0;#base=null;#revision='0';#local=null;#touchSeq=null;#frame=null;#actual=null;#lastTime=0;#closed=false;
 constructor({clock,manifest,caps}){this.#caps=native360Capabilities(caps);this.#manifest=native360Manifest(manifest,this.#caps);need(clock&&typeof clock.now==='function');this.#clock=clock;}
 #active(){need(!this.#closed,'closed');}
 #now(){this.#active();const t=this.#clock.now();try{bounded(t,0,Number.MAX_SAFE_INTEGER);need(t>=this.#lastTime,'clock_regressed');}catch(e){this.#control=this.#base=this.#frame=this.#local=null;throw e;}this.#lastTime=t;if(this.#control&&t>=this.#deadline)this.#control=this.#base=null;if(this.#local&&this.#local.started!==null&&(t-this.#local.started)*24>=241000)this.#local=null;return t;}
 #current(context){need(this.#context&&same(context,this.#context),'stale_session');}
 #choice(){if(this.#local)return {origin:'local',action_id:4,event_seq:this.#local.seq};if(this.#base)return {origin:'remote',action_id:this.#base.action_id,target:clone(this.#base),context:clone(this.#context),control:clone(this.#control)};return {origin:'local',action_id:0,event_seq:null};}
 open(context){this.#now();observationContext(context);if(same(context,this.#context))return false;const binding=rootBinding(context);need(!this.#binding||same(binding,this.#binding),'stale_binding');if(this.#boot!==context.boot_id){this.#local=null;this.#touchSeq=null;this.#actual=null;}this.#boot=context.boot_id;this.#binding=binding;this.#context=clone(context);this.#control=this.#base=this.#frame=this.#inventory=null;this.#inventorySeq=null;this.#revision='0';return true;}
 observeInventory(record,context=this.#context){this.#now();this.#current(context);observationRecord(record,this.#manifest,this.#caps);need(record.type==='inventory.snapshot','invalid_observation');const seq=uint64(record.inventory_seq);need(this.#inventorySeq===null||seq>uint64(this.#inventorySeq),'stale_sequence');if(record.known){const c={schema_version:1,profile:ROOT_CHECKPOINT,binding:this.#binding,namespace:record.namespace,floor_seq:record.root_seq,floor_commit:null,root:{namespace:record.namespace,root_seq:record.root_seq,root_state:record.root_state,active:clone(record.active)}};try{this.#checkpoint=advanceRootCheckpoint(this.#checkpoint,c);}catch(e){this.#inventory=this.#base=null;throw e;}}this.#inventorySeq=record.inventory_seq;this.#inventory=clone(record);if(this.#base)try{authorizeFirstWindow('playback.set',this.#base,this.#inventory,this.#manifest);}catch{this.#base=null;}return true;}
 setControl(control,deadline,context=this.#context){const t=this.#now();this.#current(context);observationControl(control,context);bounded(deadline,t+1,Number.MAX_SAFE_INTEGER);if(!same(control,this.#control))this.#base=null;this.#control=clone(control);this.#deadline=deadline;}
 request(target,context=this.#context){this.#now();this.#current(context);need(this.#control,'lease_expired');observationTarget(target,this.#manifest,this.#caps);authorizeFirstWindow('playback.set',target,this.#inventory,this.#manifest);if(this.#base?.command_id===target.command_id){need(same(this.#base,target),'idempotency_conflict');return false;}need(uint64(target.revision)>uint64(this.#revision),'stale_revision');this.#revision=target.revision;this.#base=clone(target);return true;}
 touch(sequence,bootId=this.#boot){this.#now();need(bootId!==null&&bootId===this.#boot,'stale_boot');const n=uint64(sequence);need(this.#touchSeq===null||n>=uint64(this.#touchSeq),'stale_sequence');if(sequence===this.#touchSeq)return false;this.#touchSeq=sequence;this.#local={seq:sequence,started:null};this.#frame=null;return true;}
 selection(){this.#now();return clone(this.#choice());}
 prepareFrame(){this.#now();const ticket=Object.freeze({first_window_frame:true});this.#frame={ticket,choice:this.#choice()};return ticket;}
 submitFrame(ticket){const t=this.#now();need(this.#frame?.ticket===ticket&&same(this.#frame.choice,this.#choice()),'stale_task');const c=this.#choice();this.#frame=null;if(c.origin==='local'&&c.action_id===4&&this.#local.started===null)this.#local.started=t;this.#actual=clone(c);return clone(c);}
 disconnect(context=this.#context){this.#now();if(!same(context,this.#context))return false;this.#context=this.#control=this.#base=this.#frame=null;return true;}
 snapshot(){this.#now();return {synthetic:true,profile:FIRST_WINDOW_PROFILE,selection:this.#choice(),actual:clone(this.#actual),local:this.#local?{event_seq:this.#local.seq,started:this.#local.started}:null,base:clone(this.#base),counts:{bases:this.#base?1:0,locals:this.#local?1:0,frames:this.#frame?1:0},floor_seq:this.#checkpoint?.floor_seq??null};}
 close(){if(this.#closed)return;this.#closed=true;this.#context=this.#control=this.#base=this.#local=this.#frame=this.#inventory=this.#checkpoint=this.#actual=null;}
}
