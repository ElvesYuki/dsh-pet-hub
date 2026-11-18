import {requireThat as need,keys,id,uint64,bounded,digest,target} from './protocol.mjs';
import {validateLeaseContext} from './lease-wire.mjs';
import {NATIVE360,native360Asset} from './native360-profile.mjs';
export const OBSERVATION_MODEL='round-pet-observation-candidate/1';
export const observationPhases=['accepted','downloading','verified','playing','failed','cancelled','ended'];
export const observationMaintenance=['none','loading','verifying','saving','recovering','blocked'];
export function observationKeys(v,fields){keys(v,fields);need(Object.keys(v).length===fields.length,'invalid_observation');}
export function observationContext(c){observationKeys(c,['device_id','binding_id','binding_epoch','boot_id','session_id','controller_id','service_instance_id']);validateLeaseContext(c);}
export function observationControl(c,context){observationKeys(c,['controller_id','service_instance_id','control_epoch','lease_id']);id(c.controller_id);id(c.service_instance_id);id(c.lease_id);uint64(c.control_epoch);need(c.controller_id===context.controller_id&&c.service_instance_id===context.service_instance_id,'stale_control');}
export function observationPackage(p){observationKeys(p,['namespace','firmware_package_sha256','hub_manifest_sha256']);need(p.namespace===NATIVE360.namespace,'incompatible_asset');digest(p.firmware_package_sha256);digest(p.hub_manifest_sha256);}
export function observationTarget(t,m,c){observationKeys(t,['command_id','revision','character_id','manifest_sha256','variant_id','action_id','asset_sha256']);return target(t,m,c);}
export function observationAsset(a){observationKeys(a,['namespace','action_id','asset_sha256','bytes']);need(a.namespace===NATIVE360.namespace,'incompatible_asset');native360Asset({id:a.action_id,bytes:a.bytes,sha256:a.asset_sha256});}
export function observationRecord(r,manifest,caps){
 need(r&&typeof r==='object'&&new TextEncoder().encode(JSON.stringify(r)).length<=4096,'observation_size');need(r.schema_version===1,'unsupported_observation_version');
 const common=['schema_version','type'];
 if(r.type==='playback.report'){
  observationKeys(r,[...common,'report_seq','target','control','package_ref','phase','elapsed_ms','first_frame']);uint64(r.report_seq);observationTarget(r.target,manifest,caps);observationPackage(r.package_ref);need(observationPhases.includes(r.phase),'invalid_observation');bounded(r.elapsed_ms,0,Number.MAX_SAFE_INTEGER);
  if(r.phase==='playing'){observationKeys(r.first_frame,['refresh_generation','first_frame_seq']);need(uint64(r.first_frame.refresh_generation)>0n&&uint64(r.first_frame.first_frame_seq)>0n,'invalid_observation');}else need(r.first_frame===null,'invalid_observation');
 }else if(r.type==='display.report'){
  observationKeys(r,[...common,'display_seq','kind','query_id','origin','asset_ref','source_command','refresh_generation','frame_seq','elapsed_ms','maintenance','display_state']);uint64(r.display_seq);uint64(r.refresh_generation);uint64(r.frame_seq);bounded(r.elapsed_ms,0,Number.MAX_SAFE_INTEGER);need(observationMaintenance.includes(r.maintenance)&&['playing','held_last_valid','unknown'].includes(r.display_state)&&['remote','local'].includes(r.origin)&&['event','snapshot'].includes(r.kind),'invalid_observation');
  if(r.kind==='event')need(r.query_id===null,'invalid_observation');else id(r.query_id);
  if(r.display_state==='unknown')need(r.asset_ref===null&&r.source_command===null,'invalid_observation');
  else{observationAsset(r.asset_ref);need(uint64(r.refresh_generation)>0n&&uint64(r.frame_seq)>0n,'invalid_observation');if(r.origin==='remote')observationTarget(r.source_command,manifest,caps);else need(r.source_command===null&&[0,4].includes(r.asset_ref.action_id),'invalid_observation');}
  need(r.display_state!=='playing'||r.maintenance==='none','invalid_observation');
 }else if(r.type==='storage.report'){
  observationKeys(r,[...common,'storage_seq','operation_id','source_target','package_ref','status','commit']);uint64(r.storage_seq);id(r.operation_id);observationTarget(r.source_target,manifest,caps);observationPackage(r.package_ref);need(['saved','deferred','failed','outcome_unknown'].includes(r.status),'invalid_observation');
  if(r.status==='saved'){observationKeys(r.commit,['evidence','root_seq','object_generation']);need(r.commit.evidence==='root_commit'&&uint64(r.commit.object_generation)>0n&&uint64(r.commit.root_seq)>=uint64(r.commit.object_generation),'invalid_observation');}else need(r.commit===null,'invalid_observation');
 }else if(r.type==='inventory.snapshot'){
  observationKeys(r,[...common,'inventory_seq','query_id','known','namespace','root_seq','root_state','active']);uint64(r.inventory_seq);id(r.query_id);need(typeof r.known==='boolean'&&r.namespace===NATIVE360.namespace&&Array.isArray(r.active)&&r.active.length<=4,'invalid_observation');
  if(!r.known)need(r.root_seq===null&&r.root_state===null&&r.active.length===0,'invalid_observation');
  else{
   const seq=uint64(r.root_seq),seen=new Set();need(['EMPTY','IDLE_READY','OFFLINE_READY'].includes(r.root_state),'invalid_observation');
   for(const a of r.active){observationKeys(a,['action_id','asset_sha256','bytes','object_generation']);observationAsset({namespace:r.namespace,action_id:a.action_id,asset_sha256:a.asset_sha256,bytes:a.bytes});need(!seen.has(a.action_id)&&uint64(a.object_generation)>0n&&uint64(a.object_generation)<=seq,'invalid_observation');seen.add(a.action_id);}
   need(r.root_state==='EMPTY'?r.active.length===0:r.root_state==='IDLE_READY'?r.active.length===1&&seen.has(0):seen.has(0)&&seen.has(4),'invalid_observation');
  }
 }else need(false,'unsupported_observation');return r;
}
