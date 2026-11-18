import {performance} from 'node:perf_hooks';
import {mkdtempSync,realpathSync,rmSync,readdirSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {parseArgs} from 'node:util';
import {roleDirectory} from '../packages/simulator/role-fixture.mjs';import {createSimulation} from '../packages/simulator/session.mjs';import {createMaterialStore} from '../packages/runtime/material-store.mjs';import {createStoreLifecycle} from '../packages/runtime/store-lifecycle.mjs';import {createRoleRuntime} from '../packages/runtime/role-runtime.mjs';import {requireThat} from '../packages/core/protocol.mjs';import {sha256} from '../packages/runtime/material-import.mjs';
const {values:v}=parseArgs({options:{output:{type:'string'}}});requireThat(v.output,'explicit_output_required');
const started=performance.now();
const root=realpathSync(mkdtempSync(join(tmpdir(),'role-stress-'))),demo=roleDirectory(join(root,'source'),{pet4:true}),simulation=createSimulation({instanceId:'stress'}),stores=[];let roles,peakWorkers=0,peakRss=0,peakWorkerBuffers=0,frames=0;
const life=createStoreLifecycle(root,{references:()=>({activated:roles?.references()??[]})});
const sample=()=>{peakWorkers=Math.max(peakWorkers,stores.filter(s=>s.snapshot().worker_alive).length);peakRss=Math.max(peakRss,process.memoryUsage().rss);peakWorkerBuffers=Math.max(peakWorkerBuffers,stores.filter(s=>s.snapshot().worker_alive).reduce((n,s)=>n+(s.snapshot().worker_array_buffer_bytes??0),0));};
const factory=(...args)=>{const s=createMaterialStore(...args);stores.push(s);sample();return s;};
try{
 const base=factory(root,demo.options,life),bundle=await base.ready;roles=createRoleRuntime(root,{simulation,lifecycle:life,approvedLicenses:demo.options.approvedLicenses,storeFactory:factory});
 async function activate(deviceId,side){const d=roles.snapshot().devices.find(d=>d.device_id===deviceId),m=bundle.manifests.find(m=>m.display.width===side);roles.start({device_id:deviceId,expected_revision:d.activation.revision,version_id:demo.options.indexSha256,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256});while(roles.snapshot().job.running){sample();await new Promise(r=>setTimeout(r,5));}requireThat(roles.snapshot().job.phase==='active','activation_failed');}
 await activate('sim_A',360);await activate('sim_B',240);let n=0;
 for(let turn=0;turn<50;turn++){
  await activate(turn%2?'sim_B':'sim_A',turn%2?240:360);
  for(let step=0;step<10;step++){
   simulation.control({service_instance_id:'stress',client_id:'stress',request_id:`s${++n}`,expected_revision:simulation.snapshot().revision,operation:'advance',ms:42});await roles.tick();
   const d=roles.snapshot().devices[turn%2?1:0],f=d.actual.decoded_frame,r=await roles.frame({device_id:d.device_id,expected_revision:d.activation.revision,expected_intent_revision:d.intent_revision,action_id:d.actual.action_id,frame_index:f.frame_index,rgb565_sha256:f.rgb565_sha256});requireThat(sha256(Buffer.from(r.frame.pixels_base64,'base64'))===f.rgb565_sha256,'pixel_mismatch');frames++;sample();
  }
  requireThat(stores.filter(s=>s.snapshot().worker_alive).length===3,'worker_leak');requireThat(!readdirSync(join(root,'material-store')).some(n=>n.startsWith('.staging-')),'stage_leak');requireThat(simulation.requestResources().entries<=128,'request_cache_leak');
 }
 await roles.close();await base.close();await life.idle();requireThat(stores.every(s=>!s.snapshot().worker_alive&&s.snapshot().pending_requests===0),'shutdown_leak');requireThat(peakWorkers<=4,'worker_budget');
 const report={status:'finite_role_resource_stress_passed',fixture:'original-MIT-PET4-240-360-13frames',replacements:50,pixel_reads:frames,peak_workers:peakWorkers,workers_after_close:stores.filter(s=>s.snapshot().worker_alive).length,max_pending_requests:Math.max(...stores.map(s=>s.snapshot().max_pending_requests)),request_cache:simulation.requestResources(),peak_process_rss_sample_bytes:peakRss,peak_worker_array_buffer_sample_bytes:peakWorkerBuffers,rss_after_close_bytes:process.memoryUsage().rss,elapsed_ms:performance.now()-started,note:'Finite local probe, RSS sampled and GC dependent; no hard memory limit or multi-day endurance claim.'};writeFileSync(v.output,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
}finally{await roles?.close();await Promise.all(stores.map(s=>s.close()));simulation.stop();rmSync(root,{recursive:true,force:true});}
