import {join} from 'node:path';import {readFileSync,lstatSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {MaterialCatalog} from '../core/materials.mjs';import {validateRolePackage,roleFrame} from '../core/role-package.mjs';
import {keys,requireThat,id,digest,uint64,increment,clone,bounded} from '../core/protocol.mjs';
import {sha256} from './material-import.mjs';
import {privatePath} from './paths.mjs';import {saveMaterials} from './materials.mjs';import {createMaterialStore} from './material-store.mjs';
function validateRecords(records){
 requireThat(Array.isArray(records)&&records.length<=64);const seen=new Set();for(const r of records){keys(r,['device_id','revision','version_id','character_id','variant_id','manifest_sha256']);id(r.device_id);id(r.character_id);id(r.variant_id);digest(r.version_id);digest(r.manifest_sha256);uint64(r.revision);requireThat(r.revision!=='0'&&!seen.has(r.device_id));seen.add(r.device_id);}return clone(records);
}
export function createRoleRuntime(directory,{simulation,lifecycle,approvedLicenses,approvedPet4Profiles=[],persist=saveMaterials,storeFactory=createMaterialStore}){
 const path=join(directory,'role-activations.json'),caps=new Map(simulation.materialProfiles().devices.map(d=>[d.device_id,d.caps]));
 function read(){try{privatePath(path,'file');requireThat(lstatSync(path).size<=131072);const data=JSON.parse(readFileSync(path,'utf8'));keys(data,['schemaVersion','records']);requireThat(data.schemaVersion===1);return validateRecords(data.records);}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 let records=new Map(read().map(r=>[r.device_id,r])),actors=new Map(),job=null,closed=false,restoring=null;const previews=new Set();
 const resources=store=>{const s=store?.snapshot()??{};return Object.fromEntries(['worker_alive','pending_requests','max_pending_requests','timeouts','decoder_count','worker_heap_bytes','worker_array_buffer_bytes','error'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));};
 const startupRecords=[...records.values()].map(clone);
 const context=()=>simulation.roleContext();
 const deviceContext=deviceId=>context().devices.find(d=>d.device_id===deviceId);
 let lastSemantic='idle',unavailableAt=null;
 const semantic=()=>{const c=context();if(c.source.status==='connected'){lastSemantic=c.source.state??'idle';unavailableAt=null;return lastSemantic;}if(unavailableAt===null)unavailableAt=c.now;return c.now-unavailableAt>2000?'idle':lastSemantic;};
 const sourceKey=()=>{const c=context();return `${c.source.status}:${c.source.state}:${c.source.counter}:${semantic()}`;};
 const record=id=>records.get(id)??{device_id:id,revision:'0'};
 const event=a=>a.mode==='manual'?`manual:${a.intentRevision}`:`auto:${a.intentRevision}:${sourceKey()}`;
 function current(a,key,session){const c=deviceContext(a.deviceId);return !closed&&actors.get(a.deviceId)===a&&c?.online&&c.session===session&&event(a)===key;}
 async function tickActor(a){
  const c=deviceContext(a.deviceId);if(!c?.online){if(!a.disconnected){void a.bundle.release(a.deviceId);a.disconnected=true;}a.phase='offline';a.key=null;a.proof=null;return;}
  if(a.disconnected||a.session!==c.session){a.mode='auto';a.manual=null;a.intentRevision=increment(a.intentRevision);a.disconnected=false;a.key=null;a.proof=null;a.session=c.session;}
  if(a.pending)return;
  if(a.store.snapshot().phase==='failed'){a.phase='failed';return;}
  const key=event(a);if(a.key!==key||a.session!==c.session){a.key=key;a.session=c.session;a.started=context().now;a.requested=a.mode==='manual'?a.manual:a.manifest.semantics[semantic()];a.proof=null;}
  const desired=roleFrame(a.manifest,a.requested,Math.max(0,context().now-a.started));
  const session=c.session;a.phase='preparing';
  a.pending=(async()=>{try{
   let proof=a.proof;if(!proof||a.proofAction!==desired.action_id){proof=await a.bundle.prepare(a.deviceId,a.manifest.actions.find(x=>x.id===desired.action_id),a.manifest);}
   const frame=await proof.frame(desired.frame_index);if(!current(a,key,session))return;
   a.proof=proof;a.proofAction=desired.action_id;a.actual={character_id:a.manifest.character_id,variant_id:a.manifest.variant_id,manifest_sha256:a.manifest.sha256,action_id:desired.action_id,decoded_frame:frame,completed:desired.completed};a.phase=desired.completed?'completed':'playing';
  }catch{if(current(a,key,session))a.phase='failed';}finally{a.pending=null;}})();await a.pending;
 }
 async function run(j,restore){let candidate,committed=false;
  try{
   candidate=storeFactory(directory,{mode:'streaming',cachedOnly:true,directory:join(directory,'material-store',j.target.version_id),indexSha256:j.target.version_id,approvedLicenses,approvedPet4Profiles},lifecycle);j.candidate=candidate;
   const bundle=await candidate.ready;requireThat(!closed&&!j.cancelled,'activation_cancelled');
   const catalog=new MaterialCatalog(bundle.manifests),checked=catalog.check(caps.get(j.target.device_id),j.target.character_id,j.target.variant_id);const m=checked.manifest;validateRolePackage(m);requireThat(m.sha256===j.target.manifest_sha256,'catalog_changed');
   const c=deviceContext(j.target.device_id);requireThat(c?.online,'device_offline');const source=sourceKey(),oldActor=actors.get(j.target.device_id),oldIntent=oldActor?.intentRevision;
   const actionId=m.semantics[semantic()],proof=await bundle.prepare(j.target.device_id,m.actions.find(a=>a.id===actionId),m),frame=await proof.frame(0);
   requireThat(!closed&&!j.cancelled,'activation_cancelled');requireThat(!lifecycle.busy,'cleanup_busy');
   const now=deviceContext(j.target.device_id);requireThat(now?.online&&now.session===c.session&&source===sourceKey()&&oldIntent===actors.get(j.target.device_id)?.intentRevision,'activation_conflict');
   requireThat(record(j.target.device_id).revision===j.target.expected_revision,'revision_conflict');
   const nextRecord={device_id:j.target.device_id,revision:restore?j.target.expected_revision:increment(j.target.expected_revision),version_id:j.target.version_id,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256};
   const next=new Map(records);next.set(nextRecord.device_id,nextRecord);validateRecords([...next.values()]);
   const nextIntent=oldActor?increment(oldActor.intentRevision):'0';
   if(!restore){try{persist(path,[...next.values()]);}catch{throw Object.assign(new Error('storage_failed'),{code:'storage_failed'});}}
   const a={deviceId:nextRecord.device_id,store:candidate,bundle,manifest:m,mode:'auto',intentRevision:nextIntent,key:`auto:${nextIntent}:${source}`,session:now.session,started:context().now,requested:actionId,proof,proofAction:actionId,pending:null,phase:'playing',actual:{character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id:actionId,decoded_frame:frame,completed:false}};
   records=next;actors.set(a.deviceId,a);committed=true;j.phase='active';
   if(oldActor)await oldActor.store.close().catch(()=>{});
  }catch(e){j.phase=j.cancelled||closed?'cancelled':'failed';j.error=e.code??candidate?.snapshot().error??'activation_failed';}
  finally{if(candidate&&!committed)await candidate.close();j.release();j.running=false;}
 }
 function start(input,restore=false){
  keys(input,['device_id','expected_revision','version_id','character_id','variant_id','manifest_sha256']);id(input.device_id);id(input.character_id);id(input.variant_id);digest(input.version_id);digest(input.manifest_sha256);uint64(input.expected_revision);
  requireThat(!closed&&!job?.running,'activation_busy');requireThat(caps.has(input.device_id),'unknown_device');requireThat(record(input.device_id).revision===input.expected_revision,'revision_conflict');requireThat(!lifecycle.busy,'cleanup_busy');
  const release=lifecycle.holdVersion(input.version_id);const j={job_id:randomUUID(),target:clone(input),phase:restore?'restoring':'preparing',running:true,cancelled:false,release};job=j;j.promise=run(j,restore);return {job_id:j.job_id,phase:j.phase};
 }
 return {
  start,
  retry(input){keys(input,['device_id','expected_revision']);id(input.device_id);uint64(input.expected_revision);const r=record(input.device_id),a=actors.get(input.device_id);requireThat(r.revision===input.expected_revision,'revision_conflict');requireThat(r.version_id,'role_inactive');requireThat(deviceContext(input.device_id)?.online,'device_offline');requireThat(!a||a.store.snapshot().phase==='failed'||a.phase==='failed','recovery_not_needed');return start({device_id:r.device_id,expected_revision:r.revision,version_id:r.version_id,character_id:r.character_id,variant_id:r.variant_id,manifest_sha256:r.manifest_sha256},true);},
  async frame(input,{signal}={}){
   keys(input,['device_id','expected_revision','expected_intent_revision','action_id','frame_index','rgb565_sha256']);id(input.device_id);uint64(input.expected_revision);uint64(input.expected_intent_revision);bounded(input.action_id,0,2**32-1);bounded(input.frame_index,0,359);digest(input.rgb565_sha256);
   requireThat(!closed,'closed');const a=actors.get(input.device_id);requireThat(a,'role_inactive');requireThat(a.manifest.codec==='PET4','pixels_unavailable');
   requireThat(!previews.has(a.deviceId)&&!a.pending,'preview_busy');
   const actual=a.actual,key=a.key,session=a.session;
   const valid=()=>!signal?.aborted&&current(a,key,session)&&record(a.deviceId).revision===input.expected_revision&&a.intentRevision===input.expected_intent_revision&&a.actual===actual&&actual.action_id===input.action_id&&actual.decoded_frame.frame_index===input.frame_index&&actual.decoded_frame.rgb565_sha256===input.rgb565_sha256;
   requireThat(valid(),'preview_stale');requireThat(a.proof&&a.proofAction===actual.action_id,'preview_busy');previews.add(a.deviceId);
   try{const rgb=await a.proof.pixels(input.frame_index);requireThat(valid(),'preview_stale');const {width,height}=actual.decoded_frame;
    requireThat(rgb instanceof Uint8Array&&[240,360,400].includes(width)&&height===width&&rgb.length===width*height*2&&sha256(rgb)===input.rgb565_sha256,'preview_integrity');
    return {frame:{device_id:a.deviceId,activation_revision:input.expected_revision,intent_revision:a.intentRevision,action_id:actual.action_id,frame_index:input.frame_index,rgb565_sha256:input.rgb565_sha256,width,height,format:'RGB565LE',pixels_base64:Buffer.from(rgb.buffer,rgb.byteOffset,rgb.byteLength).toString('base64')}};
   }finally{previews.delete(a.deviceId);}
  },
  cancel(jobId){requireThat(job?.running&&job.job_id===jobId,'unknown_job');requireThat(job.phase!=='active','activation_committed');job.cancelled=true;job.phase='cancelling';void job.candidate?.close();return {accepted:true};},
  async restore(){if(restoring)return restoring;restoring=(async()=>{for(const r of startupRecords){if(closed)break;if(job?.running)await job.promise;if(actors.has(r.device_id)||record(r.device_id).revision!==r.revision||!caps.has(r.device_id))continue;start({device_id:r.device_id,expected_revision:r.revision,version_id:r.version_id,character_id:r.character_id,variant_id:r.variant_id,manifest_sha256:r.manifest_sha256},true);await job.promise;}})();return restoring;},
  snapshot(){return {devices:[...caps.keys()].map(deviceId=>{const a=actors.get(deviceId);return {device_id:deviceId,online:deviceContext(deviceId)?.online??false,display:clone(caps.get(deviceId).display),activation:clone(record(deviceId)),phase:a?.store.snapshot().phase==='failed'?'failed':a?.phase??(records.has(deviceId)?'unavailable':'inactive'),mode:a?.mode??'auto',requested_action:a?.requested??null,intent_revision:a?.intentRevision??'0',resources:a?resources(a.store):null,actual:clone(a?.actual??null),actions:a?.manifest.actions.map(x=>({id:x.id,loop:x.loop,fps:x.fps,frames:x.frames,semantics:Object.keys(a.manifest.semantics).filter(k=>a.manifest.semantics[k]===x.id)}))??[]};}),job:job?{job_id:job.job_id,device_id:job.target.device_id,phase:job.phase,error:job.error??null,running:job.running,resources:resources(job.candidate)}:null};},
  actualReferences(){return [...new Set([...actors.values()].map(a=>a.actual?.manifest_sha256).filter(Boolean))];},
  pendingReferences(){return [...new Set([...actors.values()].filter(a=>a.pending).map(a=>a.manifest.sha256).concat(job?.running?[job.target.manifest_sha256]:[]))];},
  references(){const disk=read();return [...new Set([...records.values(),...disk].map(r=>r.manifest_sha256).concat(job?.running?[job.target.manifest_sha256]:[]))].sort();},
  intent(input){keys(input,['device_id','expected_revision','kind','action_id']);requireThat(!closed,'closed');const a=actors.get(input.device_id);requireThat(a,'role_inactive');requireThat(!(job?.running&&job.target.device_id===input.device_id),'activation_busy');requireThat(a.intentRevision===input.expected_revision,'revision_conflict');requireThat(deviceContext(a.deviceId)?.online,'device_offline');requireThat(['manual','auto'].includes(input.kind));
   if(input.kind==='manual')requireThat(a.manifest.actions.some(x=>x.id===input.action_id),'unknown_action');else requireThat(input.action_id===undefined);
   a.intentRevision=increment(a.intentRevision);a.mode=input.kind;a.manual=input.action_id??null;return {revision:a.intentRevision};},
  async tick(){semantic();await Promise.all([...actors.values()].map(tickActor));},
  async close(){if(closed)return;closed=true;if(job?.running){job.cancelled=true;await job.candidate?.close();await job.promise;}await restoring;await Promise.all([...actors.values()].map(a=>a.store.close()));}
 };
}
