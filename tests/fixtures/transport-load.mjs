import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createMTLSLab} from './mtls-lab.mjs';import {openBindingStore} from '../../packages/runtime/binding-store.mjs';import {createLoadMetrics,validateTransportObservations} from '../../packages/runtime/load-metrics.mjs';import {createTransportLane} from '../../packages/simulator/transport-lane.mjs';import {transportBudgetExamples} from '../../packages/simulator/transport-budget.mjs';import {encodeLeaseV5} from '../../packages/core/lease-wire.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
/** Fixed synthetic transport study. No production service, OS event source, real assets or device. */
export async function measureTransportLoad(pki,{verification='full',persist=true}={}){const profiles=[];
 for(const [bindings,write_bytes,range_bytes] of [[1,4096,32768],[64,4096,32768],[64,16384,32768],[64,4096,8192]]){
  const directory=mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'hub-load-')),metrics=createLoadMetrics(),store=openBindingStore({directory,create:true,metrics});let lab,lane;
  try{
   for(let i=0;i<bindings;i++){const revision=store.read().revision;store.register(revision,{device_id:i?'synthetic_'+i:'D',binding_id:i?'synthetic_binding_'+i:'B',binding_epoch:'1',controller_id:'C',identity_ref:'synthetic_key',credential_epoch:'1',certificate_sha256:i?hash('synthetic_'+i):hash(pki.certs.client.der),state:'bound',mapping:{}});}
   const epoch=performance.now(),clock={now:()=>Math.floor(performance.now()-epoch)};lab=await createMTLSLab(pki,{sessionStore:store,metrics,clock,verification,writeBytes:write_bytes,rangeBytes:range_bytes});const c=lab.client(),context=await c.hello();
   async function receipt(kind,id){const request=lab.coordinator.beginLease(lab.serverSocket(),{request_id:id,kind,expected_epoch:kind==='acquire'?'0':'1',...(kind==='renew'?{lease_id:'load_lease'}:{})}),device_now=800000+clock.now(),bytes=encodeLeaseV5({context,request,grant:{controller_id:context.controller_id,service_instance_id:context.service_instance_id,control_epoch:'1',lease_id:'load_lease',expires_at:device_now+15000},device_now});const r=await c.request({path:'/hub-device/v1/exchange',bytes});assert.equal(r.status,200,lab.lastError());}
   await receipt('acquire','initial');const initial=metrics.snapshot(),handshake=initial.stats.tls_handshake,initial_static_checks=initial.stats.certificate_static?.count??0;metrics.reset();lane=createTransportLane({clock,control_ms:1000,segment_ms:1000,wait_ms:1100,metrics,onFault:()=>lab.coordinator.invalidate(context)});
   const at=performance.now(),rounds=4;
   for(let round=0;round<rounds;round++){
    const parts=[],order=[];
    const segment=start=>lane.enqueue({kind:'segment',bytes:Math.min(range_bytes,lab.assetLength-start),run:async()=>{const b=await c.segment(start,Math.min(start+range_bytes-1,lab.assetLength-1));order.push('segment');return b;}});
    const first=segment(0);for(let i=0;i<10&&!lane.resources().inflight;i++)await Promise.resolve();assert.equal(lane.resources().inflight,1);const second=segment(range_bytes),control=lane.enqueue({kind:'control',bytes:4096,run:()=>metrics.measureAsync('control_round_trip',async()=>{await receipt('renew','renew_'+round);order.push('control');})});
    const [a,b]=await Promise.all([first,second,control]);parts.push(a,b);assert.deepEqual(order.slice(0,3),['segment','control','segment']);
    for(let start=range_bytes*2;start<lab.assetLength;start+=range_bytes)parts.push(await segment(start));assert.equal(hash(Buffer.concat(parts)),lab.assetSHA);
   }
   const elapsed_ms=performance.now()-at;metrics.measure('instrumentation_batch',()=>{for(let i=0;i<1000;i++)metrics.measure('instrumentation',()=>{});});const snapshot=metrics.snapshot();if(handshake)snapshot.stats.tls_handshake=handshake;assert.equal(snapshot.counters.asset_write_bytes,lab.assetLength*rounds);profiles.push({bindings,write_bytes,range_bytes,rounds,asset_bytes:lab.assetLength,initial_static_checks,elapsed_ms,metrics:snapshot});
  }finally{await lane?.close();await lab?.close();if(lab){const r=lab.resources();for(const name of ['sockets','agents','requests','timers','activeRequests'])assert.equal(r[name],0);assert.equal(r.listening,false);}store.close();rmSync(directory,{recursive:true,force:true});}
 }
 const evidence=validateTransportObservations({profiles,budget:transportBudgetExamples(),scope:'host-samples-not-physical-bounds'});if(persist&&process.env.HUB_TEST_TMPDIR)writeFileSync(join(process.env.HUB_TEST_TMPDIR,'transport-observations.json'),JSON.stringify(evidence),{mode:0o600});return evidence;
}
