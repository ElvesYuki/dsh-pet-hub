import {native400NodeControlDescriptor,createNative400NodeControlChannel} from './native400-node-control-channel.mjs';
import {createDeviceUpdateOwner, deviceMediaDescriptor} from './device-update.mjs';
import {native400LanHostDescriptor,createNative400LanHostOwner} from './native400-tcp-lan-host.mjs';
import {createNative400ConfigOwner} from './native400-config-owner.mjs';
import {createNative400ReviewedConfigSession} from './native400-private-config-session.mjs';
import {publicNative400LanHostView} from '../core/native400-tcp-lan-host-view.mjs';
import {native400TcpHostDescriptor,createNative400TcpHostOwner} from './native400-tcp-host.mjs';
import {publicNative400TcpHostView} from '../core/native400-tcp-host-view.mjs';
import {readNative400ReviewBody,native400ReviewError} from './native400-review-channel.mjs';
import {native400SourceReviewDescriptor,createNative400SourceReviewOwner} from './native400-source-review-host.mjs';
import {publicNative400SourceReviewView} from '../core/native400-source-review-view.mjs';
import {FRAME_RESPONSE_BYTES,SMALL_RESPONSE_BYTES} from '../core/material-profile.mjs';
import http from 'node:http';
import {keys,requireThat} from '../core/protocol.mjs';
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, unlinkSync, chmodSync } from 'node:fs';
import { runtimePaths, privatePath, descriptorAt } from './paths.mjs';
import { createHubClient } from './client.mjs';
import { importMaterials, verifyMaterial } from './material-import.mjs';
import {createRoleRuntime} from './role-runtime.mjs';
import {createStoreLifecycle} from './store-lifecycle.mjs';
import { createMaterialStore } from './material-store.mjs';
import { createMaterialManager } from './materials.mjs';
import {managedSessionDescriptor,createManagedSessions} from './managed-sessions.mjs';
import { createSource } from '../source-pet/assembly.mjs';
import {observationReviewDescriptor,publicObservationView} from './observation-review.mjs';
import {createRoundPetAssembly,roundPetAssemblyDescriptor} from './round-pet-assembly.mjs';

function atomicWrite(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); renameSync(temp, path); }
  finally { try { unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
function configValid(value) {
  return value?.schemaVersion === 1 && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
    typeof value.displayName === 'string' && value.displayName.trim().length > 0 && value.displayName.length <= 80 &&
    Object.keys(value).every(k => ['schemaVersion', 'revision', 'displayName'].includes(k));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = ''; let bytes = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 4096) { reject(new Error('body too large')); req.destroy(); } else text += chunk;
    });
    req.on('error', reject);
    req.on('end', () => { try { resolve(JSON.parse(text)); } catch { reject(new Error('invalid JSON')); } });
  });
}
/** bind() is the ownership lock. Never unlink an existing socket to win startup. */
export async function startOrAttach({ directory, source: sourceOptions = {}, deviceMode = 'disabled', simulationFactory, materialImport, materialQuotaBytes=1073741824, managedSessions, observationReview, roundPetAssembly, sourceReview, tcpReview, lanReview, nodeControl, deviceUpdate, onDeviceLocalStop } = {}) {
  requireThat(Number.isSafeInteger(materialQuotaBytes)&&materialQuotaBytes>=1&&materialQuotaBytes<=8589934592,'invalid_quota');
  if (!['disabled','simulation'].includes(deviceMode) || (deviceMode === 'simulation' && (typeof simulationFactory !== 'function' || (sourceOptions.mode ?? 'disabled') !== 'disabled'))) throw new Error('invalid simulation configuration');
  if(materialImport && deviceMode!=='simulation') throw new Error('material import requires simulation');
  if(materialImport?.mode && !['snapshot','streaming'].includes(materialImport.mode)) throw new Error('invalid material mode');
  if(managedSessions&&(deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'))throw new Error('managed review requires disabled device and source modes');
  const managedDescriptor=managedSessions?managedSessionDescriptor(managedSessions):null;
  if(observationReview&&(deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'||managedSessions||materialImport))throw new Error('observation review requires isolated disabled modes');
  const observationDescriptor=observationReview?observationReviewDescriptor(observationReview):null;
  if(roundPetAssembly&&(deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'||managedSessions||observationReview||materialImport))throw new Error('assembly review requires isolated disabled modes');
  const assemblyDescriptor=roundPetAssembly?roundPetAssemblyDescriptor(roundPetAssembly):null;
  if(sourceReview&&(typeof directory!=='string'||!directory.length||deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'||managedSessions||observationReview||roundPetAssembly||materialImport))throw new Error('source review requires explicit directory and isolated disabled modes');
  const sourceReviewDescriptor=sourceReview?native400SourceReviewDescriptor(sourceReview):null;
  if(tcpReview&&(typeof directory!=='string'||!directory.length||deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'||managedSessions||observationReview||roundPetAssembly||sourceReview||materialImport||lanReview))throw new Error('tcp review requires explicit directory and isolated disabled modes');
  const tcpDescriptor=tcpReview?native400TcpHostDescriptor(tcpReview):null;
  if(lanReview&&(typeof directory!=='string'||!directory.length||deviceMode!=='disabled'||(sourceOptions.mode??'disabled')!=='disabled'||managedSessions||observationReview||roundPetAssembly||sourceReview||materialImport||tcpReview))throw new Error('lan review requires explicit directory and isolated disabled modes');
  const lanDescriptor=lanReview?native400LanHostDescriptor(lanReview):null;
  const nodeDescriptor=nodeControl?native400NodeControlDescriptor(nodeControl,lanReview):null;
  if (deviceUpdate && (deviceMode !== 'disabled' || managedSessions || observationReview || roundPetAssembly ||
      sourceReview || tcpReview || lanReview || nodeControl)) throw new Error('device_update_owner_conflict');
  if (onDeviceLocalStop !== undefined && (!deviceUpdate || typeof onDeviceLocalStop !== 'function'))
    throw new Error('device_local_stop_requires_owner');
  const deviceUpdateDescriptor = deviceUpdate ? deviceMediaDescriptor(deviceUpdate) : null;
  const paths = runtimePaths(directory, true);
  const source = createSource(sourceOptions);
  const sourceKey = createHash('sha256').update(JSON.stringify({...(deviceUpdateDescriptor?{deviceUpdate:deviceUpdateDescriptor}:{}),...(onDeviceLocalStop?{localDeviceStop:true}:{}),...(lanDescriptor?{lanReview:lanDescriptor}:{}),...(nodeDescriptor?{nodeControl:nodeDescriptor}:{}),...(tcpDescriptor?{tcpReview:tcpDescriptor}:{}),...(sourceReviewDescriptor?{sourceReview:sourceReviewDescriptor}:{}),...(assemblyDescriptor?{roundPetAssembly:assemblyDescriptor}:{}),...(observationDescriptor?{observationReview:observationDescriptor}:{}),...(managedDescriptor?{managedSessions:managedDescriptor}:{}), materialQuotaBytes,materialImport:materialImport??null, deviceMode, mode: sourceOptions.mode ?? 'disabled', base: sourceOptions.mode === 'http' ? sourceOptions.base : null })).digest('hex');
  const instanceId = randomUUID(), token = randomBytes(32).toString('hex');
  let config = { schemaVersion: 1, revision: 0, displayName: '实体宠物设备' };
  let closed = false, ready=false, closing, sessions=null, simulation = null, materials = null, materialStore = null, catalogFailure=null, lifecycle=null, roles=null;
  let observationOwner=null,assembly=null,sourceReviewOwner=null,tcpOwner=null,lanOwner=null,configOwner=null,lanConfig=null,nodeChannel=null,deviceUpdateOwner=null;
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => { if(res.destroyed||res.writableEnded)return;
      let text=JSON.stringify({instanceId,...body});const limit=req.method==='POST'&&req.url==='/v1/roles/frame'?FRAME_RESPONSE_BYTES:SMALL_RESPONSE_BYTES;
      if(Buffer.byteLength(text)>limit){status=500;text=JSON.stringify({instanceId,error:'response_too_large'});}
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(text);
    };
    const auth = Buffer.from(req.headers.authorization ?? ''); const expected = Buffer.from(`Bearer ${token}`);
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected) || req.headers['x-hub-instance'] !== instanceId) return reply(401, { error: 'unauthorized' });
    try {
      if(closed||!ready)return reply(503,{error:'service_starting_or_stopping'});
      if (req.method === 'POST' && req.url === '/v1/desktop-query/stop') {
        if (!onDeviceLocalStop || !deviceUpdateOwner?.snapshot().queryOnly) return reply(404, {error: 'device_local_stop_disabled'});
        if (!deviceUpdateOwner.authorize(req.headers['x-hub-review'])) return reply(401, {error: 'device_unauthorized'});
        res.once('finish', onDeviceLocalStop);
        return reply(200, {stopping: true});
      }
      if (req.url === '/v1/device-update/status' || req.url === '/v1/device-update/command') {
        if (!deviceUpdateOwner) return reply(404, {error: 'device_disabled'});
        if (!deviceUpdateOwner.authorize(req.headers['x-hub-review'])) return reply(401, {error: 'device_unauthorized'});
        if (req.method === 'GET' && req.url.endsWith('/status')) return reply(200, {update: deviceUpdateOwner.snapshot()});
        if (req.method !== 'POST' || !req.url.endsWith('/command')) return reply(404, {error: 'device_route'});
        try { return reply(200, {update: deviceUpdateOwner.command(await readNative400ReviewBody(req))}); }
        catch (error) { return reply(error.status === 409 ? 409 : 400, {error: 'device_command_rejected'}); }
      }
      if (req.method === 'GET' && req.url === '/v1/status') {
        let lanView=null;if(lanReview){try{lanView=publicNative400LanHostView(lanOwner.snapshot(),lanOwner.resources());}catch{return reply(503,{error:'lan_review_unavailable'});}}
        let tcpView=null;if(tcpReview){try{tcpView=publicNative400TcpHostView(tcpOwner.snapshot(),tcpOwner.resources());}catch{return reply(503,{error:'tcp_review_unavailable'});}}
        let sourceView=null;
        if(sourceReview){try{sourceView=publicNative400SourceReviewView(sourceReviewOwner.snapshot());requireThat(sourceView,'invalid_source_review');}catch{return reply(503,{error:'source_review_unavailable'});}}
        const state = simulation?.snapshot(),review=assembly?.snapshot();
        return reply(200, { protocol:'hub-ipc/1',phase:lanOwner?'LAN-host-review':tcpOwner?'TCP-host-review':sourceReviewOwner?'400-source-review':state?'S2-simulation':assembly?'A5-assembly-review':observationOwner?'A3-observation-review':'P1-scaffold',displayName:config.displayName,
          ...(lanView?{lanReview:lanView}:{}), ...(deviceUpdateOwner ? {deviceUpdateAvailable:true,
            ...(deviceUpdateOwner.snapshot().queryOnly ? {deviceQueryOnly:true} : {})} : {}),
          ...(tcpView?{tcpReview:tcpView}:{}),
          ...(sourceView?{sourceReview:sourceView}:{}),
          ...(review?{assemblyReview:review.assemblyReview,observationReview:review.observationReview}:observationOwner?{observationReview:publicObservationView(observationOwner.snapshot())}:{}),
          sessions:sessions?.snapshot()??null,roles:roles?.snapshot()??null,catalog:review?.catalog??catalogFailure??materialStore?.snapshot()??null,deviceMode,synthetic:!!state,simulation:state?{revision:state.revision,time_ms:state.time_ms}:null,
          source:state?.source ?? source.snapshot(),devices:state?.devices.map(d=>({...d,...(materials?{material:materials.view(d.device_id)}:{})})) ?? [],capabilities:{bleProvisioning:false,deviceTransport:false,simulation:!!state} });
      }
      if(sourceReviewOwner?.reviewChannel&&((req.method==='GET'&&req.url==='/v1/source-review/controls')||(req.method==='POST'&&['/v1/source-review/start','/v1/source-review/cancel'].includes(req.url)))){
        try{const body=req.method==='POST'?await readNative400ReviewBody(req):undefined;return reply(200,sourceReviewOwner.reviewChannel.request(req.headers['x-hub-review'],req.method,req.url,body));}
        catch(e){const failure=native400ReviewError(e);return reply(failure.status,{error:failure.error});}
      }
      if(nodeChannel&&((req.method==='GET'&&req.url==='/v1/node-control/controls')||(req.method==='POST'&&req.url==='/v1/node-control/command'))){
        try{const body=req.method==='POST'?await readNative400ReviewBody(req):undefined;return reply(200,nodeChannel.request(req.headers['x-hub-review'],req.method,req.url,body));}
        catch(e){const failure=native400ReviewError(e);return reply(failure.status,{error:failure.error});}
      }
      if(lanReview)return reply(404,{error:'lan_review_read_only'});
      if(tcpReview)return reply(404,{error:'tcp_review_read_only'});
      if(sourceReview)return reply(404,{error:'source_review_read_only'});
      if(req.method==='POST'&&['/v1/roles/activate','/v1/roles/cancel','/v1/roles/intent','/v1/roles/frame','/v1/roles/retry'].includes(req.url)){
        if(!roles)return reply(404,{error:'roles_disabled'});const input=await readBody(req);
        try{requireThat(input?.service_instance_id===instanceId,'stale_session');requireThat(!lifecycle.busy,'cleanup_busy');
          if(req.url.endsWith('/frame')){keys(input,['service_instance_id','device_id','expected_revision','expected_intent_revision','action_id','frame_index','rgb565_sha256']);const {service_instance_id,...target}=input,controller=new AbortController(),abort=()=>controller.abort();res.on('close',abort);try{return reply(200,await roles.frame(target,{signal:controller.signal}));}finally{res.off('close',abort);}}
          if(req.url.endsWith('/retry')){keys(input,['service_instance_id','device_id','expected_revision']);const {service_instance_id,...target}=input;return reply(200,roles.retry(target));}
          if(req.url.endsWith('/activate')){keys(input,['service_instance_id','device_id','expected_revision','version_id','character_id','variant_id','manifest_sha256']);const {service_instance_id,...target}=input;return reply(200,roles.start(target));}
          if(req.url.endsWith('/cancel')){keys(input,['service_instance_id','job_id']);return reply(200,roles.cancel(input.job_id));}
          keys(input,['service_instance_id','device_id','expected_revision','kind','action_id']);const {service_instance_id,...target}=input;const result=roles.intent(target);await roles.tick();return reply(200,result);
        }catch(e){return reply(['revision_conflict','stale_session','cleanup_busy','activation_busy','activation_conflict','activation_committed','preview_busy','preview_stale','recovery_not_needed','device_offline'].includes(e.code)?409:400,{error:e.code??'role_request_failed'});}
      }
      if(req.method==='GET'&&req.url==='/v1/materials/versions'){
        if(!lifecycle)return reply(404,{error:'repository_disabled'});
        try{return reply(200,{repository:await lifecycle.list()});}catch(e){return reply(409,{error:e.code??'store_changed'});}
      }
      if(req.method==='POST'&&req.url==='/v1/materials/cleanup'){
        if(!lifecycle)return reply(404,{error:'repository_disabled'});
        const input=await readBody(req);
        try{
          keys(input,['service_instance_id','expected_revision','entry_ids']);requireThat(input.service_instance_id===instanceId,'stale_session');
          const result=await lifecycle.cleanup({expected_revision:input.expected_revision,entry_ids:input.entry_ids});return reply(200,{accepted:true,...result});
        }catch(e){return reply(['revision_conflict','protected_version','stale_session','unsafe_store'].includes(e.code)?409:400,{error:e.code??'cleanup_failed'});}
      }
      if (req.method === 'POST' && ['/v1/simulation/intent','/v1/simulation/control'].includes(req.url)) {
        if (!simulation) return reply(404,{error:'simulation_disabled'});
        const input=await readBody(req);
        if(lifecycle?.busy)return reply(409,{error:'cleanup_busy'});
        try { const result=req.url.endsWith('/intent')?simulation.intent(input):simulation.control(input); await simulation.settleMaterials?.(); await roles?.tick(); return reply(200,{accepted:true,simulation:result.simulation}); }
        catch(e) { const code=['revision_conflict','idempotency_conflict','stale_session'].includes(e.code)?409:400; return reply(code,{error:e.code ?? 'invalid_message'}); }
      }
      if (req.method === 'POST' && req.url === '/v1/materials/selection') {
        if (!materials) return reply(404,{error:'materials_disabled'});
        const input=await readBody(req);
        if(lifecycle?.busy)return reply(409,{error:'cleanup_busy'});
        try { const material=materials.confirm(input,instanceId); simulation.refreshMaterials?.(); return reply(200,{material}); }
        catch(e) { return reply(e.code==='storage_failed'?503:['revision_conflict','stale_session','catalog_changed'].includes(e.code)?409:400,{error:e.code ?? 'invalid_message'}); }
      }
      if (req.method === 'GET' && req.url === '/v1/config') return reply(200, { config });
      if (req.method === 'PUT' && req.url === '/v1/config') {
        const input = await readBody(req);
        if (!configValid(input)) return reply(400, { error: 'invalid config' });
        if (input.revision !== config.revision) return reply(409, { error: 'revision conflict' });
        const next = { ...input, revision: config.revision + 1 };
        atomicWrite(paths.config, next); config = next;
        return reply(200, { config });
      }
      if (req.method === 'POST' && req.url === '/v1/source/page') {
        const accepted = source.publish(await readBody(req));
        return reply(accepted ? 200 : 409, accepted ? { accepted } : { error: 'source lease held' });
      }
      reply(404, { error: 'unknown method or route' });
    } catch { if (!res.destroyed) reply(400, { error: 'request rejected' }); }
  });
  server.requestTimeout = 3000; server.headersTimeout = 3000; server.timeout = 3000;
  server.maxConnections = 32;
  async function cleanupOwned(){
    nodeChannel?.fence();
    if(lanOwner){lanOwner.fence();configOwner?.fence();const results=await Promise.allSettled([lanOwner.close(),configOwner?.close()]);requireThat(results.every(r=>r.status==='fulfilled'),'lan_cleanup_incomplete');const r=lanOwner.resources();requireThat(!r.listening&&['sockets','sessions','timers','active'].every(k=>r[k]===0)&&(!configOwner||configOwner.resources().sessions===0),'lan_cleanup_incomplete');}
    if(nodeChannel)await nodeChannel.close();
    const failures=[];
    for(const release of [...(deviceUpdateOwner?[()=>deviceUpdateOwner.close()]:[]),...(tcpOwner?[()=>tcpOwner.close()]:[]),...(sourceReviewOwner?[()=>sourceReviewOwner.close()]:[]),()=>source.stop(),()=>assembly?.close(),()=>observationOwner?.close(),()=>sessions?.close(),()=>roles?.close(),()=>simulation?.stop(),()=>materialStore?.close(),()=>lifecycle?.idle()]){try{await release();}catch(error){failures.push(error);}}
    try{if(descriptorAt(paths).instanceId===instanceId)unlinkSync(paths.descriptor);}catch(error){if(error.code!=='ENOENT')failures.push(error);}
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(failures.length)throw new AggregateError(failures,'owned service cleanup failed');
  }
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(paths.socket, resolve); });
  } catch (error) {
    source.stop();
    if (!['EADDRINUSE', 'EEXIST'].includes(error.code)) throw error;
    // Another owner may still be writing its descriptor. Never reclaim on timeout.
    let status;const startup=managedSessions||roundPetAssembly||sourceReview||tcpReview||lanReview?new AbortController():null,startupTimer=startup?setTimeout(()=>startup.abort(),5000):null;
    try{for (let attempt = 0; attempt < (managedSessions||roundPetAssembly||sourceReview||tcpReview||lanReview?200:20); attempt++) {
      if(startup?.signal.aborted)break;
      try { status = await createHubClient(directory).request('GET', '/v1/status',undefined,{signal:startup?.signal}); break; }
      catch { if(startup?.signal.aborted)break;await new Promise(resolve => setTimeout(resolve, 25)); }
    }}finally{if(startupTimer)clearTimeout(startupTimer);}
    if (!status) throw new Error('existing IPC unavailable; inspect stale socket offline');
    if (descriptorAt(paths).sourceKey !== sourceKey) throw new Error('existing service source mode or endpoint differs');
    return { role: 'attached', instanceId: status.instanceId, client: createHubClient(directory), close: async () => {} };
  }
  try {
    chmodSync(paths.socket, 0o600);
    try { privatePath(paths.config, 'file'); config = JSON.parse(readFileSync(paths.config, 'utf8')); if (!configValid(config)) throw new Error('invalid saved config'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    atomicWrite(paths.descriptor, { protocol: 'hub-ipc/1', instanceId, token, sourceKey });
    if(deviceMode==='simulation'){
      simulation=simulationFactory({instanceId});
      if(simulation.materialProfiles){
        const install=bundle=>{
          const profile=simulation.materialProfiles();
          if(bundle){profile.manifests.push(...bundle.manifests);profile.hasAsset=hash=>bundle.hasAsset(hash);}
          // Construct completely before replacing the current registry/preferences view.
          const next=createMaterialManager(paths.dir,profile);materials=next;
          if(bundle)simulation.attachMaterials(next,bundle,(bytes,a,m,options)=>verifyMaterial(bytes,a,m,{...options,approvedPet4Profiles:materialImport?.approvedPet4Profiles}));
        };
        if(materialImport?.mode==='streaming'){
          install(null);
          lifecycle=createStoreLifecycle(paths.dir,{quotaBytes:materialQuotaBytes,nonStoredManifests:simulation.materialProfiles().manifests.map(m=>m.sha256),references:()=>{
            const rows=simulation.snapshot().devices;
            return {activated:roles?.references()??[],selected:materials.references(),actual:[...new Set(rows.map(d=>d.material_playback?.actual?.manifest_sha256).filter(Boolean).concat(roles?.actualReferences()??[]))].sort(),pending:[...new Set(rows.map(d=>d.material_playback?.desired?.manifest_sha256).filter(Boolean).concat(roles?.pendingReferences()??[]))].sort()};
          }});
          roles=createRoleRuntime(paths.dir,{simulation,lifecycle,approvedLicenses:materialImport.approvedLicenses,approvedPet4Profiles:materialImport.approvedPet4Profiles});
          materialStore=createMaterialStore(paths.dir,materialImport,lifecycle);
          materialStore.ready.then(bundle=>{if(!closed)install(bundle);}).catch(async()=>{if(!closed){const snapshot=materialStore.snapshot();catalogFailure={...snapshot,phase:'failed',error:snapshot.phase==='ready'?'activation_failed':snapshot.error??'import_failed'};await materialStore.close();}}).finally(()=>{if(!closed)void roles.restore().catch(()=>{});}).catch(()=>{});
        }else install(materialImport?importMaterials(materialImport):null);
      }
    }
    if(managedSessions)sessions=await createManagedSessions(managedSessions,{instanceId});
    if(observationReview){observationOwner=await observationReview.create({instanceId});requireThat(observationOwner&&typeof observationOwner.snapshot==='function'&&typeof observationOwner.close==='function','invalid_observation_review');publicObservationView(observationOwner.snapshot());}
    if(roundPetAssembly){assembly=createRoundPetAssembly(paths.dir,{...roundPetAssembly,rootCheckpoint:assemblyDescriptor.root_checkpoint??null,rootPersistence:assemblyDescriptor.root_persistence??null},{instanceId,quotaBytes:materialQuotaBytes});lifecycle=assembly.lifecycle;}
    if(sourceReview){sourceReviewOwner=await createNative400SourceReviewOwner(sourceReview,{directory:paths.dir,instanceId});requireThat(publicNative400SourceReviewView(sourceReviewOwner.snapshot()),'invalid_source_review');}
    if(tcpReview)tcpOwner=createNative400TcpHostOwner(tcpReview);
    if(lanReview){lanOwner=createNative400LanHostOwner(lanReview);configOwner=createNative400ConfigOwner();if(nodeControl)nodeChannel=createNative400NodeControlChannel(nodeControl,lanReview,lanOwner,instanceId);
      const live=()=>requireThat(!closed&&ready,'config_owner_closed');
      lanConfig={adopt(task){live();return configOwner.adopt(task);},startReviewed(options){live();keys(options,['request','wifi','directory','consumer','signal','timeoutMs','beforeConsume','fault']);return configOwner.start(()=>createNative400ReviewedConfigSession({...options,owner:lanOwner}));},resources:()=>configOwner.resources()};
      publicNative400LanHostView(lanOwner.snapshot(),lanOwner.resources());}
    if (deviceUpdate) deviceUpdateOwner = createDeviceUpdateOwner(deviceUpdate, instanceId);
    source.start();ready=true;
  } catch (e) {try{await cleanupOwned();}catch(cleanupError){throw new AggregateError([e,cleanupError],'service initialization and cleanup failed');}throw e;}
  return {
    role: 'owner', instanceId, client: createHubClient(directory), managedSessions:sessions,roundPetAssembly:assembly,sourceReview:sourceReviewOwner,tcpReview:tcpOwner,lanReview:lanOwner,lanConfig,nodeControl:nodeChannel,
    close() {
      if(closing)return closing;closed=true;ready=false;
      closing=cleanupOwned();if(lanReview)closing=closing.catch(error=>{closing=null;throw error;});return closing;
    },
  };
}
