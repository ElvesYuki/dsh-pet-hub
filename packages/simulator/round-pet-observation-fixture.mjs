import {RoundPetObservations} from '../core/round-pet-observations.mjs';
import {same,clone} from '../core/protocol.mjs';
import {native360Caps,native360Manifest} from './native360-fixture.mjs';
import {NATIVE360} from '../core/native360-profile.mjs';
import {VirtualClock} from './index.mjs';
export const observationVersions={profile:'round-pet-native360/1',playback_version:1,display_version:1,storage_version:1,inventory_version:1};
/** Original object-semantics fixture, NOT authenticated device wire or a real material approval. */
export function observationFixture({instanceId='fixture_service',...overrides}={}){
 const clock=new VirtualClock(),manifest=native360Manifest(),caps=native360Caps(),proofs=new WeakMap(),queryLabels=new Map();let session=true,control=true;
 let context={device_id:'candidate_175c',binding_id:'fixture_binding',binding_epoch:'1',boot_id:'fixture_boot',session_id:'fixture_session',controller_id:'fixture_controller',service_instance_id:instanceId};
 const grant={controller_id:context.controller_id,service_instance_id:instanceId,control_epoch:'1',lease_id:'fixture_lease'},packageRef={namespace:NATIVE360.namespace,firmware_package_sha256:'a'.repeat(64),hub_manifest_sha256:manifest.sha256};
 const model=new RoundPetObservations({caps,manifest,clock,packageRef,sessionCurrent:c=>session&&same(c,context),controlCurrent:(c,g)=>session&&control&&same(c,context)&&same(g,grant),verifyObservation:(proof,payload)=>proofs.has(proof)&&same(proofs.get(proof),payload),...overrides});
 const attest=(record,c=context)=>{const proof=Object.freeze({synthetic_attestation:true});proofs.set(proof,{context:clone(c),record:clone(record)});return proof;};
 const command=(action_id=0,revision='1',command_id=`command_${revision}`)=>({command_id,revision,character_id:manifest.character_id,variant_id:manifest.variant_id,manifest_sha256:manifest.sha256,action_id,asset_sha256:manifest.actions.find(a=>a.id===action_id).sha256});
 const asset=action_id=>{const a=manifest.actions.find(a=>a.id===action_id);return {namespace:NATIVE360.namespace,action_id,asset_sha256:a.sha256,bytes:a.bytes};};
 const playback=(target,phase,seq='1')=>({schema_version:1,type:'playback.report',report_seq:seq,target,control:clone(grant),package_ref:clone(packageRef),phase,elapsed_ms:0,first_frame:phase==='playing'?{refresh_generation:'1',first_frame_seq:'1'}:null});
 const display=(action_id=0,seq='1',extra={})=>({schema_version:1,type:'display.report',display_seq:seq,kind:'event',query_id:null,origin:'remote',asset_ref:asset(action_id),source_command:command(action_id),refresh_generation:'1',frame_seq:'1',elapsed_ms:0,maintenance:'none',display_state:'playing',...extra,...(extra.query_id?{query_id:queryLabels.get(extra.query_id)??extra.query_id}:{})});
 const inventory=(query_id='inventory_query',seq='1',root_seq='4',ids=[0,4,1,11])=>({schema_version:1,type:'inventory.snapshot',inventory_seq:seq,query_id:queryLabels.get(query_id)??query_id,known:true,namespace:NATIVE360.namespace,root_seq,root_state:ids.length===0?'EMPTY':ids.length===1?'IDLE_READY':'OFFLINE_READY',active:ids.map((action_id,i)=>{const {namespace,...a}=asset(action_id),saved=model.snapshot().devices[0]?.storage.find(s=>s.status==='saved'&&s.root_seq===root_seq&&s.action_id===action_id);return {...a,object_generation:saved?.object_generation??String(i+1)};})});
 const storage=(target,operation_id='save_one',seq='1',status='saved',root_seq='5')=>({schema_version:1,type:'storage.report',storage_seq:seq,operation_id,source_target:target,package_ref:clone(packageRef),status,commit:status==='saved'?{evidence:'root_commit',root_seq,object_generation:root_seq}:null});
 model.open(context,observationVersions);
 return {model,clock,manifest,caps,grant,packageRef,get context(){return context;},attest,command,asset,playback,display,inventory,storage,
  query(kind,label){const queryId=model.query(context,kind);queryLabels.set(label,queryId);return queryId;},
  ingest(r,c=context){return model.ingest(c,r,attest(r,c));},request(t=command()){model.request(context,t);return t;},sent(t=command()){model.request(context,t);model.sent(context,t,grant);return t;},
  reopen(extra={},versions=observationVersions){context={...context,session_id:'fixture_session_next',...extra};session=true;model.open(context,versions);return context;},
  setSession(v){session=v;},setControl(v){control=v;},close(){model.close();}};
}
