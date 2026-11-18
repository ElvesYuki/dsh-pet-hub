import {clone,same,increment,bounded,requireThat as need} from '../core/protocol.mjs';
import {DEVICE_WIRE_PROFILE,validateDeviceWire} from '../core/round-pet-wire.mjs';
import {observationContext,observationControl,observationPackage} from '../core/round-pet-observation-schema.mjs';

/** Offline A1 executor, NOT TLS/authentication or a firmware driver. Caller supplies an owned actor.
 * Records are derived from actor transitions; take() only hands them to a separately owned transport.
 * Clock/control horizon are trusted local inputs. No automatic execution, retry, timers or listeners.
 * wireProfile explicitly selects R3 schema2/cancel/cache-hit records; default remains old A6.
 * cachedHitInventoryOnly is an explicit offline result, not a new wire acknowledgement.
 * recoverStorage fences volatile work/control and returns inventory without fabricating saved.
 * New-wire loss retains one gated local continuation; finish never grants playback/network authority.
 * New-wire close may wait for an actual synchronous commit exit before releasing the actor.
 * Its caller-owned logical medium remains available for a new owner. */
export function createRoundPetExecutor({actor,manifest,packageRef,clock,cachedHitInventoryOnly=false,wireProfile=null,commitWaitMs=4000}){
 need(wireProfile===null||wireProfile===DEVICE_WIRE_PROFILE,'unsupported_executor_profile');const wire=wireProfile!==null;need(!wire||!cachedHitInventoryOnly,'unsupported_executor_profile');
 bounded(commitWaitMs,1,30000);
 observationPackage(packageRef);manifest=clone(manifest);packageRef=clone(packageRef);
 let context=null,control=null,horizon=0,closed=false,work=null,loadToken=null,target=null,operation=null,firstFrame=null,lastDisplay=null,frame=null,lastTime=0;
 let commitTask=null,paused=false,closing=false,closePromise=null,closeResolve=null;
 let refresh='0',frameSeq='0',maintenanceGeneration='0',maintenancePhase=null;const seq={playback:'0',display:'0',storage:'0',inventory:'0',cancel:'0'},outbox=[];
 function active(){need(!closed&&!closing,'executor_closed');need(!paused,'executor_suspended');need(context,'stale_session');}
 function time(){const t=clock.now();bounded(t,0,Number.MAX_SAFE_INTEGER);need(t>=lastTime,'clock_regressed');lastTime=t;return t;}
 function guarded(){active();let t;try{t=time();}catch(e){clear('clock_invalid');if(wire)context=null;throw e;}if(!control||t>=horizon){clear('lease_expired');if(wire)context=null;need(false,'lease_expired');}}
 function room(n=1){need(outbox.length+n<=16,'queue_full');}
 function record(type,fields,dispatch_id=null){room();const stream=type.split('.')[0];seq[stream]=increment(seq[stream]);const key={playback:'report_seq',display:'display_seq',storage:'storage_seq',inventory:'inventory_seq',cancel:'cancel_seq'}[stream];const result={...(wire?{}:{kind:'record'}),dispatch_id,record:{schema_version:wire&&['playback','display','storage'].includes(stream)?2:1,type,[key]:seq[stream],...clone(fields)}};if(wire)validateDeviceWire({protocol:'hub-device/1',profile:DEVICE_WIRE_PROFILE,schema_version:1,type:'exchange.request',request_id:'model',request_seq:'1',context,payload:{observation:result}});outbox.push(result);return clone(result);}
 function playback(phase,dispatch=null){return record('playback.report',{target,control,package_ref:packageRef,phase,elapsed_ms:phase==='playing'?Math.max(0,time()-actor.snapshot().started):0,first_frame:phase==='playing'?firstFrame:null,...(wire?{admission:phase==='accepted'?'ready':null}:{})},dispatch);}
 function storage(status,commit=null){return record('storage.report',{operation_id:operation.operation_id,source_target:target,package_ref:packageRef,status,commit,...(wire?{commit_stage:status==='saved'?'confirmed':status==='already_available'?'not_started':status==='outcome_unknown'?'marker_attempted':status==='failed'&&operation.gated?'post_gate':'pre_gate'}:{})},operation.dispatch_id);}
 function display(query_id=null,dispatch=null){const s=actor.snapshot(),last=lastDisplay;if(wire&&maintenancePhase!==s.maintenance){maintenanceGeneration=increment(maintenanceGeneration);maintenancePhase=s.maintenance;}return record('display.report',{kind:query_id===null?'event':'snapshot',query_id,origin:'remote',asset_ref:last?{namespace:packageRef.namespace,action_id:last.target.action_id,asset_sha256:last.target.asset_sha256,bytes:manifest.actions.find(a=>a.id===last.target.action_id).bytes}:null,source_command:last?(wire?{context:last.context,target:last.target}:last.target):null,refresh_generation:last?.refresh??'0',frame_seq:last?.frame_seq??'0',elapsed_ms:last?.elapsed??0,maintenance:wire?{phase:s.maintenance,generation:maintenanceGeneration,reason:s.maintenance}:s.maintenance,display_state:s.display_state},dispatch);}
 const pendingCommit=()=>wire&&commitTask&&!commitTask.completed;
 function cancelWork(ticket){if(ticket)try{actor.cancel(ticket);}catch(e){if(!['storage_commit_unknown','flash_recovery_required'].includes(e.code))throw e;}}
 function clear(reason='authority_lost'){
  const pending=pendingCommit();if(pending){commitTask.detached=true;commitTask.reason??=reason;}
  outbox.length=0;frame=null;loadToken=null;operation=null;firstFrame=null;control=null;horizon=0;target=null;const old=work;work=null;
  // Reentrant loss during synchronous commit must not call a busy actor.
  if(!pending||!commitTask.running)cancelWork(old??(pending?commitTask.work:null));
 }
 function enterGate(){need(wire&&operation&&work&&!operation.gated&&!pendingCommit(),'invalid_phase');const at=time(),deadline=at+commitWaitMs;bounded(deadline,at+1,Number.MAX_SAFE_INTEGER);actor.gateSave(work);operation.gated=true;const token=Object.freeze({commit_completion:true});commitTask={token,work,operation:clone(operation),target:clone(target),context:clone(context),control:clone(control),deadline,detached:false,reason:null,running:false,completed:false,status:'pending',result:null};return token;}
 function taskFor(token){need(wire&&commitTask&&commitTask.token===token,'stale_commit_task');return commitTask;}
 function publishable(t){if(t.detached||closing||paused||!context)return false;let reason=null;try{const at=time();if(at>=t.deadline)reason='commit_wait_elapsed';else if(at>=horizon||!same(t.context,context)||!same(t.control,control))reason='authority_lost';}catch{reason='clock_invalid';}if(reason){t.detached=true;t.reason??=reason;clear(reason);context=null;return false;}return true;}
 function finalizeClose(){if(closed||pendingCommit())return;actor.close();closed=true;outbox.length=0;context=control=work=loadToken=target=operation=frame=lastDisplay=null;closeResolve?.();}
 function runCommit(t,wantReport){
  need(!t.running&&!t.completed,'commit_in_progress');const mayReport=wantReport&&publishable(t);t.running=true;t.status='running';let receipt=null,error=null,status,wireRecord=null;
  try{receipt=actor.commitSave(t.work);status='saved';}catch(e){error=e;status=e.code==='storage_commit_unknown'?'outcome_unknown':'failed';}
  t.running=false;t.completed=true;t.status=status;
  if(mayReport&&publishable(t))wireRecord=record('storage.report',{operation_id:t.operation.operation_id,source_target:t.target,package_ref:packageRef,status,commit_stage:status==='saved'?'confirmed':status==='outcome_unknown'?'marker_attempted':'post_gate',commit:receipt?{evidence:'root_commit',root_seq:receipt.root_seq,object_generation:receipt.object_generation}:null},t.operation.dispatch_id);
  if(t.detached)cancelWork(t.work);
  t.result={status,detached:t.detached,source_context:clone(t.context),source_target:clone(t.target),operation_id:t.operation.operation_id,root_seq:receipt?.root_seq??null,object_generation:receipt?.object_generation??null,reason:t.reason};operation=null;
  if(closing)finalizeClose();return {wireRecord,result:clone(t.result),error};
 }
 const api={
  open(c){need(!closed&&!closing,'executor_closed');need(!paused,'executor_suspended');need(!pendingCommit(),'commit_in_progress');observationContext(c);if(context&&same(c,context))return;need(!context,'session_must_disconnect');actor.beginSession(c);context=clone(c);for(const k of Object.keys(seq))seq[k]='0';},
  setControl(c,deadline,expectedContext=context){active();need(!pendingCommit(),'commit_in_progress');need(same(expectedContext,context),'stale_session');observationControl(c,context);const at=time();bounded(deadline,at+1,Number.MAX_SAFE_INTEGER);if(control&&(!same(control,c)||at>=horizon))clear();control=clone(c);horizon=deadline;},
  receive(job,expectedContext=context){active();need(same(expectedContext,context),'stale_session');need(!wire||!commitTask?.running,'commit_in_progress');room(wire&&job.kind==='playback.cancel'&&operation?2:1);if(wire)validateDeviceWire({protocol:'hub-device/1',profile:DEVICE_WIRE_PROFILE,schema_version:1,type:'exchange.response',request_id:'model',request_seq:'1',context,payload:{control:job,read_permit:null,poll_after_ms:0}});const p=clone(job.payload);
   if(job.kind==='query.inventory'){const i=actor.snapshot().inventory;return record('inventory.snapshot',{query_id:p.query_id,known:i.known,namespace:packageRef.namespace,root_seq:i.known?i.root_seq:null,root_state:i.known?i.state:null,active:i.known?i.entries.map(e=>({action_id:e.asset.id,asset_sha256:e.asset.sha256,bytes:e.asset.bytes,object_generation:e.object_generation})).sort((a,b)=>wire?a.action_id-b.action_id:0):[]},job.dispatch_id);}
   if(job.kind==='query.display')return display(p.query_id,job.dispatch_id);
   guarded();if(wire&&['playback.set','storage.save'].includes(job.kind))need(!pendingCommit(),'commit_in_progress');
   if(job.kind==='playback.set'){need(same(p.package_ref,packageRef)&&same(p.control,control),'stale_control');if(wire)need(p.mode==='base_loop'&&p.asset_descriptor.bytes===manifest.actions.find(a=>a.id===p.target.action_id)?.bytes,'incompatible_asset');const next=actor.request(p.target);work=next;loadToken=null;target=clone(p.target);frame=null;operation=null;firstFrame=null;return playback('accepted',job.dispatch_id);}
   if(job.kind==='storage.save'){need(work&&same(p.target,target)&&same(p.package_ref,packageRef),'stale_task');need(!operation,'cache_busy');operation={operation_id:p.operation_id,dispatch_id:job.dispatch_id};frame=null;
    try{const r=actor.beginSave(work,p.victim_action_id===undefined||(wire&&p.victim_action_id===null)?{}:{victim_action_id:p.victim_action_id});if(r.already_saved){const s=actor.snapshot().storage;if(wire){const result=storage('already_available',{evidence:'inventory_reference',root_seq:s.root_seq,object_generation:s.object_generation});operation=null;return result;}if(cachedHitInventoryOnly){operation=null;return {already_available:true,root_seq:s.root_seq};}const result=storage('saved',{evidence:'root_commit',root_seq:s.root_seq,object_generation:s.object_generation});operation=null;return result;}return null;}
    catch(e){const result=storage(e.code==='storage_commit_unknown'?'outcome_unknown':'failed');operation=null;return result;}
   }
   if(wire&&job.kind==='playback.cancel'){need(work&&same(p.target,target)&&same(p.control,control),'stale_task');let effect=operation?(operation.gated?'playback_only':'cancelled_pre_gate'):'playback_only';try{actor.cancel(work);}catch(e){if(!['storage_commit_unknown','flash_recovery_required'].includes(e.code))throw e;effect='outcome_unknown';}if(operation&&!operation.gated){storage('cancelled_pre_gate');operation=null;}if(!operation?.gated)work=null;loadToken=null;frame=null;return record('cancel.report',{operation_id:p.operation_id,target:p.target,control:p.control,effect},job.dispatch_id);}
   if(job.kind==='playback.cancel'){need(work&&p.command_id===target.command_id,'stale_task');actor.cancel(work);work=null;loadToken=null;frame=null;operation=null;outbox.push({kind:'ack',dispatch_id:job.dispatch_id,status:'cancelled'});return null;}
   need(false,'unsupported_executor_control');
  },
  load(){guarded();room();need(work,'stale_task');const result=actor.load(work);loadToken=Object.freeze({execution_load:true});frame=null;if(result.source==='network')playback('downloading');return {...result,ticket:loadToken};},
  supply(ticket,bytes){guarded();need(work&&ticket===loadToken,'stale_task');actor.supply(work,bytes);},
  verify(){guarded();room();need(work,'stale_task');try{actor.verify(work);}catch(e){playback('failed');throw e;}return playback('verified');},
  prepareFrame(){guarded();need(work,'stale_task');const token=Object.freeze({execution_frame:true});frame={token,actor:actor.prepareFrame(work)};return token;},
  submitFrame(token){guarded();room(2);need(frame?.token===token,'stale_task');const before=actor.snapshot(),s=actor.submitFrame(frame.actor);frame=null;if(before.display_state!=='playing'||lastDisplay?.target.command_id!==target.command_id)refresh=increment(refresh);frameSeq=increment(frameSeq);firstFrame??={refresh_generation:refresh,first_frame_seq:frameSeq};lastDisplay={target:clone(target),context:clone(context),refresh,frame_seq:frameSeq,elapsed:Math.max(0,time()-s.started)};playback('playing');return display();},
  writeSave(maxBytes=4096){guarded();need(!pendingCommit(),'commit_in_progress');room();bounded(maxBytes,1,4096);need(operation&&work,'stale_task');try{return actor.writeSave(work,maxBytes);}catch(e){storage('failed');operation=null;throw e;}},
  deferSave(){guarded();need(!pendingCommit(),'commit_in_progress');room();need(operation&&work&&operation.dispatch_id!==null&&actor.snapshot().storage?.status==='saving','invalid_phase');const result=storage('deferred');operation.dispatch_id=null;return result;},
  recoverStorage(){active();need(!pendingCommit(),'commit_in_progress');clear();const result=actor.recoverStorage();if(wire&&commitTask?.status==='outcome_unknown')commitTask.status='reconciled';return result;},
  gateSave(){guarded();return enterGate();},
  commitSave(){guarded();room();need(operation&&work,'stale_task');if(wire){if(!operation.gated)enterGate();const r=runCommit(commitTask,true);if(r.error)throw r.error;return r.wireRecord??r.result;}try{const s=actor.commitSave(work),result=storage('saved',{evidence:'root_commit',root_seq:s.root_seq,object_generation:s.object_generation});operation=null;return result;}catch(e){if(e.code==='asset_incomplete')throw e;storage(e.code==='storage_commit_unknown'?'outcome_unknown':'failed');operation=null;throw e;}},
  /** Local gate capability only. No lease renewal, payload append, wire receipt or activation. */
  finishCommit(token){need(!closed,'executor_closed');const t=taskFor(token);need(!t.running,'commit_in_progress');if(t.completed){need(!['outcome_unknown','reconciled'].includes(t.status),'commit_result_unknown');return clone(t.result);}need(t.detached,'commit_not_detached');return runCommit(t,false).result;},
  recoverCommit(token){need(!closed&&!closing,'executor_closed');const t=taskFor(token);need(t.completed&&t.status==='outcome_unknown'&&!context,'recovery_not_allowed');const result=actor.recoverStorage();t.status='reconciled';return result;},
  suspend(){need(wire&&!closed&&!closing,'executor_closed');paused=true;clear('suspended');context=null;},
  resume(){need(wire&&!closed&&!closing&&paused,'invalid_resume');time();paused=false;},
  expire(){need(wire&&!closed&&!closing,'executor_closed');let at;try{at=time();}catch(e){clear('clock_invalid');context=null;throw e;}if((control&&at>=horizon)||(pendingCommit()&&at>=commitTask.deadline)){clear(at>=horizon&&control?'lease_expired':'commit_wait_elapsed');context=null;return true;}return false;},
  commitState(){const t=commitTask;if(!t)return null;const at=clock.now();return clone({pending:!t.completed,running:t.running,status:t.status,detached:t.detached,reason:t.reason,overdue:!t.completed&&(!Number.isSafeInteger(at)||at<lastTime||at>=t.deadline),result:t.result});},
  take(){active();return clone(outbox.shift()??null);},
  disconnect(expectedContext=context){if(closed)return;if(!same(expectedContext,context))return false;try{clear('disconnected');}finally{context=null;}},
  reboot(){need(!closed&&!closing,'executor_closed');need(!pendingCommit(),'commit_in_progress');commitTask=null;paused=false;outbox.length=0;frame=null;loadToken=null;operation=null;work=null;target=null;firstFrame=null;lastDisplay=null;context=null;control=null;horizon=0;return actor.reboot();},
  snapshot:()=>actor.snapshot(),resources:()=>({closed,closing,paused,commit_pending:pendingCommit()?1:0,commit_running:commitTask?.running?1:0,outbox:outbox.length,context:context!==null,operation:operation?1:0,frame:frame?1:0,actor:actor.resources()}),
  close(){if(closed)return wire?closePromise:undefined;if(!wire){outbox.length=0;actor.close();closed=true;context=control=work=loadToken=target=operation=frame=lastDisplay=null;return;}if(closePromise)return closePromise;closePromise=new Promise(resolve=>closeResolve=resolve);closing=true;clear('closed');context=null;if(pendingCommit()&&!commitTask.running)runCommit(commitTask,false);finalizeClose();return closePromise;}
 };return api;
}
