import {parseArgs} from 'node:util';
import {mkdtempSync,realpathSync,copyFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {sha256,readRegular} from '../packages/runtime/material-import.mjs';
import {requireThat,digest} from '../packages/core/protocol.mjs';
import {startOrAttach} from '../packages/runtime/service.mjs';
import {createSimulation} from '../packages/simulator/session.mjs';
const {values:v}=parseArgs({options:{'source-dir':{type:'string'},'manifest-sha256':{type:'string'},'license-ref':{type:'string'},output:{type:'string'}}});
requireThat(v.output&&v['source-dir']&&v['license-ref']==='dsh-pet-nc-86181ce');digest(v['manifest-sha256']);
const external=realpathSync(v['source-dir']),raw=readRegular(external,'manifest.json',1048576);requireThat(sha256(raw)===v['manifest-sha256'],'source_manifest_changed');
const m=JSON.parse(raw);requireThat(m.protocol===5&&Array.isArray(m.actions)&&m.actions.length===46&&m.width===360,'expected_native360_full_library');
const root=realpathSync(mkdtempSync(join(tmpdir(),'str-real-'))),source=join(root,'source'),runtime=join(root,'runtime');let hub;
try{
 mkdirSync(source,{mode:0o700});const actions=[],files=[],seen=new Set();
 for(const a of m.actions){requireThat(Number.isSafeInteger(a.id)&&a.id>=0&&a.id<=2**32-1&&!seen.has(a.id));seen.add(a.id);digest(a.sha256);requireThat(Number.isSafeInteger(a.bytes)&&a.bytes<=8388608);copyFileSync(join(external,`${a.id}.pet`),join(source,`${a.id}.pet`));actions.push({id:a.id,bytes:a.bytes,sha256:a.sha256});files.push({action_id:a.id,path:`${a.id}.pet`});}
 const index=JSON.stringify({schemaVersion:1,variants:[{manifest:{character_id:'whale_nc',variant_id:'native360',codec:'PET4',license_ref:v['license-ref'],display:{width:360,height:360,shape:'circle',pixel_format:'RGB565'},actions},files}]});writeFileSync(join(source,'index.json'),index);
 const heapBefore=process.memoryUsage().heapUsed,start=performance.now();
 hub=await startOrAttach({directory:runtime,deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{mode:'streaming',directory:source,indexSha256:sha256(index),approvedLicenses:[v['license-ref']]}});
 const state=()=>hub.client.request('GET','/v1/status');let count=0,maxLatency=0,status,nonReadyResponses=0;
 do{const at=performance.now();status=await state();maxLatency=Math.max(maxLatency,performance.now()-at);count++;requireThat(status.catalog.phase!=='failed',status.catalog.error);if(status.catalog.phase!=='ready')nonReadyResponses++;
   if(status.catalog.phase==='ready')break;requireThat(performance.now()-start<120000,'background_timeout');await new Promise(r=>setTimeout(r,10));
 }while(true);
 requireThat(status.catalog.validated_assets===46&&status.catalog.validated_bytes===actions.reduce((s,a)=>s+a.bytes,0)&&status.catalog.validated_bytes>33554432);
 const choice=status.devices[0].material.candidates.find(c=>c.character_id==='whale_nc');requireThat(choice,'catalog_not_installed');
 await hub.client.request('POST','/v1/materials/selection',{service_instance_id:hub.instanceId,device_id:'sim_A',expected_revision:status.devices[0].material.revision,character_id:choice.character_id,variant_id:choice.variant_id,manifest_sha256:choice.manifest_sha256});
 const advance=async(ms,id)=>hub.client.request('POST','/v1/simulation/control',{service_instance_id:hub.instanceId,client_id:'probe',request_id:`advance_${id}`,expected_revision:(await state()).simulation.revision,operation:'advance',ms});
 await advance(400,'first');let playing=(await state()).devices[0].material_playback;requireThat(playing.phase==='playing'&&playing.actual.decoded_frame.width===360,'first_frame_failed');
 const readAt=performance.now();const move=advance(100,'next'),during=await state();const playbackStatusLatency=performance.now()-readAt;await move;playing=(await state()).devices[0].material_playback;requireThat(playing.actual.decoded_frame.frame_index===2,'frame_clock_failed');
 const current=await state();await hub.client.request('POST','/v1/simulation/intent',{device_id:'sim_A',client_id:'probe',intent_id:'work',service_instance_id:hub.instanceId,expected_revision:current.devices[0].intent_revision,kind:'manual',action_id:11});await advance(400,'work');
 const work=(await state()).devices[0].material_playback;requireThat(work.phase==='playing'&&work.actual.action_id===11,'work_failed');
 const repository=(await hub.client.request('GET','/v1/materials/versions')).repository;
 requireThat(repository.valid&&repository.used_bytes>=status.catalog.validated_bytes&&repository.entries.length===1,'warehouse_listing_failed');
 requireThat(repository.entries[0].protected&&repository.entries[0].reasons.includes('selected')&&repository.entries[0].reasons.includes('actual'),'warehouse_reference_failed');
 let refused=false;try{await hub.client.request('POST','/v1/materials/cleanup',{service_instance_id:hub.instanceId,expected_revision:repository.revision,entry_ids:[repository.entries[0].entry_id]});}catch(e){refused=e.status===409;}requireThat(refused,'protected_cleanup_not_refused');
 const report={status:'full_native360_streaming_passed',source_manifest_sha256:v['manifest-sha256'],license_ref:v['license-ref'],actions:46,bytes:status.catalog.validated_bytes,frames:status.catalog.validated_frames,background_elapsed_ms:Math.round(performance.now()-start),status_requests:count,non_ready_status_responses:nonReadyResponses,max_import_status_latency_ms:maxLatency,playback_status_latency_ms:playbackStatusLatency,main_heap_before:heapBefore,main_heap_after:process.memoryUsage().heapUsed,catalog:(await state()).catalog,repository,protected_cleanup_refused:refused,playing,work};
 writeFileSync(v.output,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:report.status,bytes:report.bytes,status_requests:count,max_latency_ms:maxLatency,peak_asset_bytes:report.catalog.peak_asset_bytes}));
}finally{await hub?.close();rmSync(root,{recursive:true,force:true});}
