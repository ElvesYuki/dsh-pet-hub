import {performance} from 'node:perf_hooks';import {setTimeout as sleep} from 'node:timers/promises';
import {mkdtempSync,realpathSync,rmSync,existsSync,appendFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {startOrAttach} from '../runtime/service.mjs';import {createSimulation} from './session.mjs';import {roleDirectory} from './role-fixture.mjs';import {sha256} from '../runtime/material-import.mjs';import {requireThat} from '../core/protocol.mjs';
/** Summarize bounded numeric samples; slope is descriptive, never a leak classifier. */
export function summarizeMemory(samples){
 requireThat(samples.length>0);const tail=samples.filter(s=>s.elapsed_ms>=samples.at(-1).elapsed_ms-600000),mean=a=>a.reduce((n,x)=>n+x,0)/a.length,mx=mean(tail.map(s=>s.elapsed_ms)),my=mean(tail.map(s=>s.rss_bytes)),den=tail.reduce((n,s)=>n+(s.elapsed_ms-mx)**2,0);
 return {samples:samples.length,initial_rss_bytes:samples[0].rss_bytes,peak_rss_bytes:Math.max(...samples.map(s=>s.rss_bytes)),final_rss_bytes:samples.at(-1).rss_bytes,max_gap_ms:Math.max(0,...samples.slice(1).map((s,i)=>s.elapsed_ms-samples[i].elapsed_ms)),last_10min:{count:tail.length,mean_bytes:my,min_bytes:Math.min(...tail.map(s=>s.rss_bytes)),max_bytes:Math.max(...tail.map(s=>s.rss_bytes)),slope_bytes_per_minute:den?tail.reduce((n,s)=>n+(s.elapsed_ms-mx)*(s.rss_bytes-my),0)/den*60000:0},five_minute_bins:Array.from({length:Math.floor(samples.at(-1).elapsed_ms/300000)+1},(_,i)=>{const v=samples.filter(s=>Math.floor(s.elapsed_ms/300000)===i).map(s=>s.rss_bytes);return {bin:i,count:v.length,mean_bytes:v.length?mean(v):null};})};
}
/** Owns a private temporary service. signal cancellation and all failures close it and remove temp.
 * seconds<1800 is smoke only. Throws with a sanitized report attached after cleanup. */
export async function measureWallMemory({seconds=1800,samplesPath,signal,onProgress=()=>{}}={}){
 requireThat(Number.isInteger(seconds)&&seconds>=2&&seconds<=1800);const root=realpathSync(mkdtempSync(join(tmpdir(),'hub-wall-'))),ports=()=>process.getActiveResourcesInfo().filter(x=>x==='MessagePort').length,baselinePorts=ports();let hub,report,error;
 const samples=[],counts={controls:0,frames:0,frame_skips:0,activations:0},timings={max_status_ms:0};let pending=null,n=0;
 try{
  const demo=roleDirectory(join(root,'source'),{pet4:true});hub=await startOrAttach({directory:join(root,'runtime'),deviceMode:'simulation',simulationFactory:createSimulation,materialImport:{...demo.options,mode:'streaming'}});requireThat(hub.role==='owner','unexpected_attach');
  const status=async()=>{const t=performance.now(),s=await hub.client.request('GET','/v1/status');timings.max_status_ms=Math.max(timings.max_status_ms,performance.now()-t);return s;};const post=(path,body)=>hub.client.request('POST',path,{service_instance_id:hub.instanceId,...body});
  async function waitReady(predicate){const until=performance.now()+120000;for(;;){signal?.throwIfAborted();const s=await status();requireThat(s.catalog.phase!=='failed','catalog_failed');if(predicate(s))return s;requireThat(performance.now()<until,'setup_timeout');await sleep(25,undefined,{signal});}}
  await waitReady(s=>s.catalog.phase==='ready');const repo=(await hub.client.request('GET','/v1/materials/versions')).repository,version=repo.entries.find(e=>e.entry_id===demo.options.indexSha256);
  const activate=async(id,side)=>{const s=await status(),d=s.roles.devices.find(d=>d.device_id===id),p=version.packages.find(p=>p.display.width===side);await post('/v1/roles/activate',{device_id:id,expected_revision:d.activation.revision,version_id:version.entry_id,character_id:p.character_id,variant_id:p.variant_id,manifest_sha256:p.manifest_sha256});};
  for(const [id,side] of [['sim_A',360],['sim_B',240]]){await activate(id,side);await waitReady(s=>{if(s.roles.job&&!s.roles.job.running){requireThat(s.roles.job.phase==='active','activation_failed');return true;}return false;});}
  const start=performance.now();let nextActivation=30,turn=0;
  for(let tick=0;tick<=seconds;tick++){
   signal?.throwIfAborted();
   // Timers may round fractional delays down; sample only after the monotonic deadline.
   const deadline=start+tick*1000;for(let remaining=deadline-performance.now();remaining>0;remaining=deadline-performance.now())await sleep(remaining,undefined,{signal});
   let s=await status(),elapsed=performance.now()-start;
   requireThat(s.catalog.phase==='ready'&&s.roles.devices.every(d=>!['failed','unavailable'].includes(d.phase)),'runtime_failed');
   if(pending&&!s.roles.job.running){requireThat(s.roles.job.phase==='active','activation_failed');counts.activations++;pending=null;}
   if(pending)requireThat(elapsed-pending.at<120000,'activation_timeout');
   if(tick<seconds){
    if(elapsed>=nextActivation*1000&&!pending){const id=turn++%2?'sim_B':'sim_A';await activate(id,id==='sim_A'?360:240);pending={id,at:elapsed};nextActivation+=30;}
    await post('/v1/simulation/control',{client_id:'wall_probe',request_id:`step_${++n}`,expected_revision:s.simulation.revision,operation:'advance',ms:1000});counts.controls++;s=await status();
    const d=s.roles.devices[tick%2];if(pending?.id===d.device_id)counts.frame_skips++;else{
     const f=d.actual.decoded_frame;try{const r=await post('/v1/roles/frame',{device_id:d.device_id,expected_revision:d.activation.revision,expected_intent_revision:d.intent_revision,action_id:d.actual.action_id,frame_index:f.frame_index,rgb565_sha256:f.rgb565_sha256});requireThat(sha256(Buffer.from(r.frame.pixels_base64,'base64'))===f.rgb565_sha256,'pixel_mismatch');counts.frames++;}
     catch(e){if(e.status===409&&['preview_stale','preview_busy'].includes(e.message))counts.frame_skips++;else throw e;}
    }
   }
   const actors=s.roles.devices.map(d=>d.resources),candidate=s.roles.job?.running&&s.roles.job.phase!=='active'?s.roles.job.resources:null,resources=[s.catalog,...actors,...(candidate?[candidate]:[])],memory=process.memoryUsage();
   const row={elapsed_ms:performance.now()-start,rss_bytes:memory.rss,heap_bytes:memory.heapUsed,main_array_buffer_bytes:memory.arrayBuffers,worker_buffer_latest_sum:resources.reduce((v,r)=>v+(r?.worker_array_buffer_bytes??0),0),worker_heap_latest_sum:resources.reduce((v,r)=>v+(r?.worker_heap_bytes??0),0),workers:resources.filter(r=>r?.worker_alive).length,pending_rpc:resources.reduce((v,r)=>v+(r?.pending_requests??0),0),status_max_ms:timings.max_status_ms};
   requireThat(row.workers<=4&&resources.every(r=>(r?.pending_requests??0)<=8),'resource_budget');requireThat(row.rss_bytes<=768*1048576,'rss_guard');samples.push(row);if(samplesPath)appendFileSync(samplesPath,JSON.stringify(row)+'\n',{mode:0o600});
   if(tick%30===0)onProgress({...row,...counts});
  }
  const summary=summarizeMemory(samples);requireThat(samples.at(-1).elapsed_ms>=seconds*1000&&summary.max_gap_ms<=5000,'incomplete_window');requireThat(!pending,'unfinished_activation');
  report={passed:true,kind:seconds===1800?'30min-wall-clock':'smoke',requested_seconds:seconds,measured_ms:samples.at(-1).elapsed_ms,...summary,counts,timings,peak_workers:Math.max(...samples.map(s=>s.workers)),peak_pending_rpc:Math.max(...samples.map(s=>s.pending_rpc))};
 }catch(e){error=e;report={passed:false,kind:seconds===1800?'30min-wall-clock':'smoke',error_code:e.code??e.name,counts,...(samples.length?summarizeMemory(samples):{})};}
 finally{try{await hub?.close();rmSync(root,{recursive:true,force:true});report.cleanup={temp_removed:!existsSync(root),message_ports_before:baselinePorts,message_ports_after:ports(),rss_after_close_bytes:process.memoryUsage().rss};requireThat(report.cleanup.temp_removed&&ports()<=baselinePorts,'cleanup_failed');}catch(e){error??=e;report={...report,passed:false,cleanup_error:e.code??e.name};}}
 if(error)throw Object.assign(new Error('wall measurement failed',{cause:error}),{report});return report;
}
