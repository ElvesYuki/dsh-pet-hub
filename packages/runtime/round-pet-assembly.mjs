import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {keys,id,digest,requireThat as need,clone,increment,bounded} from '../core/protocol.mjs';
import {FIRST_WINDOW_PROFILE,authorizeFirstWindow,firstWindowChoices} from '../core/round-pet-first-window.mjs';
import {native360Capabilities} from '../core/native360-profile.mjs';
import {validateRoundPetApproval,roundPetCanonical} from '../core/round-pet-identity.mjs';
import {validateRootCheckpoint} from '../core/round-pet-root-checkpoint.mjs';
import {publicAssemblyView} from '../core/assembly-view.mjs';import {publicObservationView} from '../core/observation-view.mjs';
import {createRoundPetImport} from './round-pet-import.mjs';import {createRoundPetReader} from './round-pet-reader.mjs';
import {createStoreLifecycle} from './store-lifecycle.mjs';import {createManagedSessions,managedSessionDescriptor} from './managed-sessions.mjs';
import {createRoundPetPull,createPullHandler} from './round-pet-pull.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
/** Pure-data identity validation before election; never reads files or starts observers/worker/TCP. */
export function roundPetAssemblyDescriptor(o){
 keys(o,['profile','bindingDirectory','controller_id','rootDER','policy','clock','now','powerSource','material','caps','readBudget','rootCheckpoint','rootPersistence','executionProfile']);need(o.profile==='offline-review','invalid_assembly_profile');
 if(o.executionProfile!==undefined)need(o.executionProfile===FIRST_WINDOW_PROFILE,'unsupported_execution_profile');
 const approval=validateRoundPetApproval(o.material?.approval);keys(o.material,['sourceDirectory','approval','cachedOnly','indexSha256']);const material={approval_sha256:hash(roundPetCanonical(approval))};
 if(o.material.cachedOnly===true){digest(o.material.indexSha256);need(o.material.sourceDirectory===undefined,'invalid_assembly_material');material.index_sha256=o.material.indexSha256;material.cached_only=true;}
 else{need(o.material.cachedOnly===undefined||o.material.cachedOnly===false,'invalid_assembly_material');need(typeof o.material.sourceDirectory==='string'&&o.material.sourceDirectory.length>0&&o.material.indexSha256===undefined,'invalid_assembly_material');material.source_directory=resolve(o.material.sourceDirectory);material.cached_only=false;}
 if(o.rootPersistence){keys(o.rootPersistence,['profile','device_id']);need(o.rootPersistence.profile==='binding-roots-review/1'&&o.rootCheckpoint==null,'invalid_root_persistence');id(o.rootPersistence.device_id);}
 const caps=native360Capabilities(o.caps),base=managedSessionDescriptor({profile:'review',bindingDirectory:o.bindingDirectory,controller_id:o.controller_id,rootDER:o.rootDER,policy:o.policy,clock:o.clock,now:o.now,powerSource:o.powerSource,manifest:{candidate_manifest:approval.hub_manifest_sha256}});
 return JSON.parse(roundPetCanonical({profile:o.profile,managed:base,material,caps,read_budget:o.readBudget??null,enabled:false,...(o.executionProfile?{execution_profile:o.executionProfile}:{}),...(o.rootPersistence?{root_persistence:{profile:o.rootPersistence.profile,device_id:o.rootPersistence.device_id}}:{}),...(o.rootCheckpoint==null?{}:{root_checkpoint:validateRootCheckpoint(o.rootCheckpoint)})}));
}
/** UDS-winner-only A2/A3/A4 owner, default OFF. Never creates a TCP server or persists network config.
 * Caller may explicitly mount createHandler() on a disposable loopback TLS server after enableReview.
 * ready may reject while status remains failed; close cancels and waits initialization and actual I/O. */
export function createRoundPetAssembly(directory,options,{instanceId,quotaBytes=1073741824}={}){
 roundPetAssemblyDescriptor(options);id(instanceId);const executionProfile=options.executionProfile;let rootCheckpoint=options.rootCheckpoint==null?null:validateRootCheckpoint(options.rootCheckpoint);const clock=options.clock??{now:()=>Math.floor(performance.now())},now=options.now??Date.now;
 const lifecycle=createStoreLifecycle(directory,{quotaBytes}),catalog=createRoundPetImport(directory,options.material,{lifecycle});
 let bundle=null,reader=null,managed=null,pull=null,enabled=false,closed=false,closing=null,disposing=null,generation='0',revision='0',phase='validating',error=null,lastObservation=null,lastInventory=null;
 function historical(v){if(!v)return null;v=clone(v);for(const r of v.devices){r.connection='offline';r.controlled=false;if(r.desired)r.desired.is_current=false;if(r.playback)r.playback.is_current=false;if(r.actual)r.actual.is_current=false;r.display_state='unknown';r.maintenance='unknown';for(const s of r.storage)s.is_current=false;r.inventory.known=false;for(const a of r.inventory.actions)a.offline_available=null;}return publicObservationView(v);}
 function fence(code){enabled=false;generation=increment(generation);lastInventory=null;pull?.fail(code);if(pull&&!closed)lastObservation=publicObservationView(pull.observations.snapshot());}
 function currentView(){if(pull&&!closed)try{managed.withReadView(()=>{lastObservation=publicObservationView(pull.observations.snapshot());lastInventory=pull.observations.inventoryState();});}catch(cause){error=cause.code??'authority_unavailable';phase='blocked';fence(error);}return closed?historical(lastObservation):lastObservation;}
 function requireReview(){need(!closed&&enabled&&phase==='review'&&managed?.snapshot().phase==='ready','review_disabled');need(!lifecycle.busy,'cleanup_busy');}
 function admission(kind,payload){
  requireReview();const r=pull.observations.snapshot().devices[0],inventory=pull.observations.inventoryState();need(r?.connection==='online'&&inventory.known,'inventory_unconfirmed');const target=payload.target;
  if(executionProfile===FIRST_WINDOW_PROFILE)authorizeFirstWindow(kind,target,inventory,bundle.manifests[0]);
  const state=inventory.root_state;need(state==='OFFLINE_READY'||target.action_id===0||(state==='IDLE_READY'&&target.action_id===4),'unsafe_cache_write');
  if(kind==='storage.save'){
   need(r.desired?.revision===target.revision&&['verified','playing'].includes(r.playback?.phase)&&r.playback.is_current,'playback_unverified');
   const chosen=r.inventory.actions.find(a=>a.action_id===target.action_id);need(chosen?.offline_available===false,'already_available');
   const entries=inventory.active,victim=payload.victim_action_id,updating=entries.some(a=>a.action_id===target.action_id);
   if(victim!==undefined)need(!updating&&![0,4,target.action_id].includes(victim)&&entries.some(a=>a.action_id===victim),'unsafe_cache_write');
   need(entries.length<4||updating||victim!==undefined,'unsafe_cache_write');
  }
 }
 async function dispose(){if(disposing)return disposing;disposing=(async()=>{const failures=[];for(const f of [()=>pull?.close(),()=>managed?.close(),()=>reader?.close(),()=>catalog.close(),()=>lifecycle.idle()])try{await f();}catch(e){failures.push(e);}if(failures.length)throw new AggregateError(failures,'assembly cleanup failed');})();return disposing;}
 const ready=(async()=>{try{
  bundle=await catalog.ready;need(!closed,'assembly_closed');reader=createRoundPetReader(directory,bundle);
  const powerSource={descriptor:options.powerSource.descriptor,start(callbacks){return options.powerSource.start({onEvent(type){if(closed)return;fence('power_transition');if(type==='suspend')phase='suspended';else phase='disabled';callbacks.onEvent(type);const state=managed?.snapshot();if(state?.phase==='blocked'){phase='blocked';error=state.error;}},onFailure(code){if(closed)return;error=code;phase='blocked';fence(code);callbacks.onFailure(code);}});}};
  managed=await createManagedSessions({rootState:!!options.rootPersistence,profile:'review',bindingDirectory:options.bindingDirectory,controller_id:options.controller_id,rootDER:options.rootDER,manifest:bundle.manifests[0],policy:options.policy,clock,now,powerSource},{instanceId});need(!closed,'assembly_closed');
  if(options.rootPersistence)rootCheckpoint=managed.withReadView(()=>managed.rootAuthority.checkpoint(options.rootPersistence.device_id));
  pull=createRoundPetPull({rootAuthority:managed.rootAuthority,rootCheckpoint,sessions:managed.runtime,readView:fn=>managed.withReadView(fn),clock,caps:options.caps,manifest:bundle.manifests[0],packageRef:{namespace:bundle.identity.namespace,firmware_package_sha256:bundle.identity.firmware_package_sha256,hub_manifest_sha256:bundle.identity.hub_manifest_sha256},readAsset:(...args)=>reader.read(...args),readBudget:options.readBudget??null,onOpen(context){if(options.rootPersistence)need(context.device_id===options.rootPersistence.device_id,'identity_conflict');pull.query('inventory',clock.now()+4000);},authorizeOperation:admission});
  const state=managed.snapshot();phase=state.phase==='ready'?'disabled':state.phase==='blocked'?'blocked':'suspended';error=state.error;return {identity:clone(bundle.identity)};
 }catch(cause){error=cause.code??'assembly_failed';enabled=false;if(!closed)phase='failed';await dispose();throw cause;}})();ready.catch(()=>{});
 const api={ready,lifecycle,
  async enableReview(){await ready;need(!closed,'assembly_closed');const g=generation;await pull.waitForIdle();need(!closed&&g===generation&&managed.snapshot().phase==='ready','review_unavailable');need(!reader.resources().invalidated,'repository_revalidation_required');if(managed.runtime.resources().mode==='suspended')managed.runtime.resume();phase='review';enabled=true;error=null;},
  async disableReview(){if(closed)return;phase='disabled';fence('review_disabled');managed?.runtime.suspend();await pull?.waitForIdle();},
  createHandler(hooks={}){keys(hooks,['beforeChunk','requestMs']);let handler;return async(req,res)=>{if(closed||!enabled||phase!=='review'||req.socket.localAddress!=='127.0.0.1'||req.socket.remoteAddress!=='127.0.0.1'){res.writeHead(503,{'content-length':0,'connection':'close'});res.end();return;}handler??=createPullHandler({pull,sessions:managed.runtime,...hooks});const initiallyBlocked=pull.resources().blocked;try{return await handler(req,res);}finally{if(enabled&&pull.resources().blocked&&(!initiallyBlocked||req.method!=='POST'||req.url!=='/offline-round-pet/v1/hello'||res.statusCode!==200)){phase='blocked';error=pull.resources().error??'pull_failed';fence(error);}}};},
  acquire(deadline,expectedEpoch='0'){requireReview();return pull.lease('acquire',deadline,expectedEpoch);},renew(deadline){requireReview();return pull.lease('renew',deadline);},
  manual(actionId,deadline){requireReview();bounded(actionId,0,77);const a=bundle.manifests[0].actions.find(a=>a.id===actionId);need(a,'unknown_action');const m=bundle.manifests[0],next=increment(revision),target={command_id:`manual_${next}`,revision:next,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id:actionId,asset_sha256:a.sha256};if(executionProfile===FIRST_WINDOW_PROFILE)managed.withReadView(()=>admission('playback.set',{target}));pull.base(target,deadline);revision=next;return target;},
  manualChoices(){requireReview();currentView();return executionProfile===FIRST_WINDOW_PROFILE?firstWindowChoices(lastInventory,bundle.manifests[0]):bundle.manifests[0].actions.map(a=>({action_id:a.id,enabled:true,reason:null}));},
  save(deadline,opts){requireReview();if(executionProfile===FIRST_WINDOW_PROFILE)need(false,'first_window_read_only');return pull.save(deadline,opts);},query(kind,deadline){requireReview();return pull.query(kind,deadline);},cancel(deadline){requireReview();return pull.cancel(deadline);},
  rootCheckpoint(){need(pull&&!closed,'review_unavailable');return managed.withReadView(()=>pull.observations.rootCheckpoint());},
  waitForIdle:()=>pull?.waitForIdle()??Promise.resolve(),
  snapshot(){const observationReview=currentView(),r=observationReview?.devices[0],cs=catalog.snapshot(),pr=pull?.resources(),mr=managed?.resources();let write_gate='blocked';if(enabled&&r?.connection==='online'){if(!r.inventory.known)write_gate='inventory_unknown';else if(pr.storage_blocked)write_gate='blocked';else if(!['verified','playing'].includes(r.playback?.phase))write_gate='playback_unverified';else if(r.inventory.actions.find(a=>a.action_id===r.desired?.action_id)?.offline_available)write_gate='already_available';else if(lastInventory?.active.length===4&&!lastInventory.active.some(a=>a.action_id===r.desired?.action_id))write_gate='needs_victim';else write_gate='ready';}
   return {assemblyReview:publicAssemblyView({schema_version:1,profile:'round-pet-assembly-review/1',production_listener:false,review_enabled:enabled,phase,error,inventory_confirmed:r?.inventory.known===true,write_gate,counts:{worker_alive:cs.worker_alive??false,open_files:reader?.resources().open_files??0,active_http:pr?.http??0,managed_sessions:mr?.sessions.sessions??0}}),observationReview,catalog:Object.fromEntries(['phase','validated_assets','validated_bytes','validated_frames','worker_alive'].filter(k=>cs[k]!==undefined).map(k=>[k,cs[k]]))};
  },resources:()=>({closed,phase,generation,reader:reader?.resources()??null,catalog:catalog.snapshot(),managed:managed?.resources()??null,pull:pull?.resources()??null}),
  close(){if(closing)return closing;phase='closing';fence('assembly_closed');lastObservation=historical(lastObservation);closed=true;closing=(async()=>{if(!pull)await catalog.close();try{await ready;}catch{}try{await dispose();}finally{phase='closed';}})();return closing;}
 };
 return api;
}
