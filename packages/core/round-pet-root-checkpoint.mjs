import {clone,id,uint64,requireThat as need,same} from './protocol.mjs';
import {NATIVE360} from './native360-profile.mjs';
import {observationKeys,observationRecord,observationAsset} from './round-pet-observation-schema.mjs';
export const ROOT_CHECKPOINT='round-pet-root-checkpoint/1';
export const rootBinding=c=>({device_id:c.device_id,binding_id:c.binding_id,binding_epoch:c.binding_epoch});
/** Caller-trusted checkpoint data, NOT a signed approval or live inventory. Strict bounded schema
 * protects representation; an authorized old file cannot be detected without durable authority. */
export function validateRootCheckpoint(value){
 need(value&&JSON.stringify(value).length<=4096,'invalid_root_checkpoint');const c=clone(value);observationKeys(c,['schema_version','profile','binding','namespace','floor_seq','root','floor_commit']);need(c.schema_version===1&&c.profile===ROOT_CHECKPOINT&&c.namespace===NATIVE360.namespace,'invalid_root_checkpoint');
 observationKeys(c.binding,['device_id','binding_id','binding_epoch']);id(c.binding.device_id);id(c.binding.binding_id);uint64(c.binding.binding_epoch);const floor=uint64(c.floor_seq);
 if(c.root!==null){observationKeys(c.root,['namespace','root_seq','root_state','active']);need(c.root.namespace===c.namespace&&uint64(c.root.root_seq)<=floor,'invalid_root_checkpoint');observationRecord({schema_version:1,type:'inventory.snapshot',inventory_seq:'0',query_id:'checkpoint',known:true,...c.root});c.root.active.sort((a,b)=>a.action_id-b.action_id);}
 if(c.floor_commit!==null){const p=c.floor_commit;observationKeys(p,['root_seq','action_id','asset_sha256','bytes','object_generation']);const {root_seq,object_generation,...asset}=p;observationAsset({namespace:c.namespace,...asset});need(root_seq===c.floor_seq&&uint64(object_generation)>0n&&uint64(object_generation)<=floor,'invalid_root_checkpoint');if(c.root?.root_seq===root_seq)need(c.root.active.some(a=>same(a,{...asset,object_generation})),'root_conflict');}
 need((c.root?.root_seq??'0')===c.floor_seq||c.floor_commit!==null,'invalid_root_checkpoint');
 return c;
}
/** Review-only maintenance decision. Never lowers a floor, approves a binding or enables writes. */
export function assessRootRecovery(checkpoint,observed){
 const c=validateRootCheckpoint(checkpoint),o=validateRootCheckpoint(observed);need(same(c.binding,o.binding)&&c.namespace===o.namespace,'root_checkpoint_binding_mismatch');
 const commit=c.floor_commit,{root_seq,...entry}=commit??{},conflict=o.root&&((c.root&&o.root.root_seq===c.root.root_seq&&!same(o.root,c.root))||(commit&&o.root.root_seq===root_seq&&!o.root.active.some(a=>same(a,entry))));
 const reason=!o.root?'inventory_unknown':uint64(o.root.root_seq)<uint64(c.floor_seq)?'root_rollback':conflict?'root_conflict':null;
 return {status:reason?'maintenance_required':'fresh_authenticated_inventory_required',reason,can_write:false,floor_seq:c.floor_seq,observed_seq:o.root?.root_seq??null,next_steps:reason?['preserve_evidence','read_only_identity_and_media_review','restore_approved_root_or_review_new_binding']:['query_current_authenticated_inventory']};
}
/** Monotonic write admission for one binding authority, not a new trust approval. */
export function advanceRootCheckpoint(previous,candidate){
 const c=validateRootCheckpoint(candidate);if(previous===null)return c;const p=validateRootCheckpoint(previous);need(same(p.binding,c.binding)&&p.namespace===c.namespace,'root_checkpoint_binding_mismatch');need(uint64(c.floor_seq)>=uint64(p.floor_seq),'stale_root');
 if(p.root){need(c.root&&uint64(c.root.root_seq)>=uint64(p.root.root_seq),'stale_root');if(p.root.root_seq===c.root.root_seq)need(same(p.root,c.root),'root_conflict');}
 if(p.floor_commit&&p.floor_seq===c.floor_seq){const {root_seq,...entry}=p.floor_commit;if(c.root?.root_seq===root_seq)need(c.root.active.some(a=>same(a,entry)),'root_conflict');else need(same(p.floor_commit,c.floor_commit),'root_conflict');}
 return c;
}
