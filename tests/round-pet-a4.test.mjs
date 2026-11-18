import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {setImmediate as turn} from 'node:timers/promises';
import {PullControlQueue,decodePullMessage,encodePullMessage} from '../packages/core/round-pet-pull.mjs';
import {VirtualClock} from '../packages/simulator/index.mjs';import {createPullRequestOwner} from '../packages/runtime/pull-request-owner.mjs';
import {offlinePKI} from './fixtures/offline-pki.mjs';import {createPullLab} from './fixtures/round-pet-pull-lab.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {validateSegmentResponse} from '../packages/runtime/asset-segment.mjs';import {createLoadMetrics} from '../packages/runtime/load-metrics.mjs';
const pki=offlinePKI({parent:process.env.HUB_TEST_TMPDIR});test.after(()=>pki.close());
const golden=JSON.parse(readFileSync(new URL('../docs/protocol/vectors/round-pet-a4-exchange-v1.json',import.meta.url))),err=(fn,code)=>assert.throws(fn,e=>e.code===code);
async function setup(t,opts){const lab=await createPullLab(pki,opts);t.after(async()=>{await lab.close();const r=lab.resources();assert.equal(r.listening,false);assert.equal(r.clients,0);assert.equal(r.sockets,0);assert.equal(r.pull.http,0);assert.equal(r.pull.reads,0);assert.equal(r.session.sessions,0);});return lab;}
function command(lab,action_id=0,revision='1'){const m=lab.media.manifest;return {command_id:`command_${revision}`,revision,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id,asset_sha256:m.actions.find(a=>a.id===action_id).sha256};}
async function ready(t,opts){const lab=await setup(t,opts),client=lab.client();await client.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline());await client.exchange();await client.exchange();await client.exchange();return {lab,client};}
const view=lab=>lab.pull.observations.snapshot().devices[0];
test('A4-01 canonical candidate golden preserves uint64 and refuses aliases/unknown fields',()=>{
 for(const v of [golden.request,golden.response])assert.deepEqual(JSON.parse(JSON.stringify(decodePullMessage(encodePullMessage(v)))),v);
 for(const text of ['{"a":1,"\\u0061":2}',JSON.stringify(golden.request),'{"a":1.0}','\ufeff{}'])assert.throws(()=>decodePullMessage(Buffer.from(text)));
 assert.throws(()=>encodePullMessage({...golden.request,extra:1}));assert.throws(()=>decodePullMessage(Buffer.alloc(4097)));
});
test('A4-02 latest base is bounded and a dispatched control cannot be replaced',()=>{
 const clock=new VirtualClock(),q=new PullControlQueue(clock);for(let i=0;i<100;i++)q.put('playback.set',{target:i},100);assert.equal(q.resources().latest_base,1);const first=q.take(50);assert.equal(first.payload.target,99);q.put('playback.set',{target:100},100);assert.equal(q.take(50),null);q.ack(first.dispatch_id);assert.equal(q.take(50).payload.target,100);q.close();
});
test('A4-03 urgent flags precede base and ordinary work; no deep control FIFO',()=>{
 const q=new PullControlQueue(new VirtualClock());q.put('query.inventory',{},100);q.put('playback.set',{},100);q.put('lease.renew',{},100);q.put('playback.cancel',{},100);q.put('binding.revoke',{},100);for(const kind of ['binding.revoke','playback.cancel','lease.renew','playback.set','query.inventory']){const job=q.take(50);assert.equal(job.kind,kind);q.ack(job.dispatch_id);}assert.equal(q.hasWork(),false);
});
test('A4-04 side effects reject overflow and identical pending flags do not extend deadlines',()=>{
 const q=new PullControlQueue(new VirtualClock());q.put('storage.save',{id:1},100);err(()=>q.put('storage.save',{id:2},100),'queue_full');q.take(50);err(()=>q.put('storage.save',{id:2},100),'queue_full');q.put('lease.renew',{},100);assert.equal(q.put('lease.renew',{},500),false);assert.equal(q.resources().flags,1);
});
test('A4-05 queue absolute deadline includes waiting and freezes without retry',()=>{
 const clock=new VirtualClock(),q=new PullControlQueue(clock);q.put('playback.set',{},10);clock.advance(10);err(()=>q.take(100),'control_deadline');assert.equal(q.resources().blocked,true);err(()=>q.put('playback.set',{},100),'pull_blocked');
});
test('A4-06 timeout retains actual request slot until an abort-ignoring operation exits',async()=>{
 const clock=new VirtualClock(),timers=new Map();let release,started,abortSeen,done=false;const entered=new Promise(r=>started=r),aborted=new Promise(r=>abortSeen=r),owner=createPullRequestOwner({clock,timers:{setTimeout(fn){timers.set(1,fn);return 1;},clearTimeout(id){timers.delete(id);}}});
 const result=owner.run({deadline:10,operation:({signal})=>{signal.addEventListener('abort',abortSeen,{once:true});started();return new Promise(r=>release=r);}}).catch(e=>e);await entered;timers.get(1)();await aborted;assert.equal(owner.resources().inflight,1);await assert.rejects(owner.run({deadline:10,operation:async()=>0}),e=>e.code==='request_blocked');const closing=owner.close().then(()=>done=true);await turn();assert.equal(done,false);release('late');assert.equal((await result).code,'request_deadline');await closing;assert.equal(owner.resources().inflight,0);assert.equal(timers.size,0);
});
test('A4-07 lease dispatch and receipt require two real HTTP cycles before base acceptance',async t=>{
 const lab=await setup(t),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline());assert.equal(view(lab).request_status,'requested');const first=await c.exchange();assert.equal(first.control.kind,'lease.acquire');assert.equal(view(lab).controlled,false);assert.equal(lab.sessions.guard.resources().pending,1);const second=await c.exchange();assert.equal(second.control.kind,'playback.set');assert.equal(view(lab).request_status,'sent');assert.equal(view(lab).playback,null);await c.exchange();assert.equal(view(lab).playback.phase,'accepted');assert.equal(view(lab).actual,null);
});
test('A4-08 real PET4 downloads via exchange between every bounded Range on one TLS socket',async t=>{
 const {lab,client:c}=await ready(t),bytes=await c.download();assert.equal(sha256(bytes),lab.media.F);assert.equal(c.wire.resources().connections,1);assert.equal(lab.resources().max_http,1);assert.equal(view(lab).playback.phase,'accepted');assert.equal(view(lab).actual,null);await c.exchange({observation:{kind:'record',dispatch_id:null,record:c.record(command(lab),'verified')}});await c.exchange({observation:{kind:'record',dispatch_id:null,record:c.record(command(lab),'playing')}});assert.equal(view(lab).playback.phase,'playing');assert.equal(view(lab).actual,null);
});
test('A4-09 manifest uses six <=8-action pages bound to the same P/M/N',async t=>{
 const {lab,client:c}=await ready(t),actions=[];for(let page=0;page<6;page++){await c.exchange();const v=await c.page(page);assert.deepEqual(v.package_ref,lab.media.packageRef);actions.push(...v.actions);}assert.deepEqual(actions,lab.media.manifest.actions);assert.equal(c.wire.resources().connections,1);
});
test('A4-10 a read permit is single-use and cannot bypass the next exchange',async t=>{
 const {lab,client:c}=await ready(t),permit=c.last.read_permit;await c.segment(0,100,permit);await assert.rejects(c.segment(101,200,permit));assert.equal(lab.pull.resources().blocked,true);
});
test('A4-11 unknown resource bounds never authorize a material segment',async t=>{
 const {lab,client:c}=await ready(t,{readBudget:null});const r=await c.exchange();assert.equal(r.read_permit,null);assert.equal(view(lab).controlled,true);assert.equal(lab.pull.resources().permit,0);
});
test('A4-12 next segment waits for renew sent in one exchange and confirmed in the next',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock});clock.advance(11500);assert.equal((await c.exchange()).read_permit,null);lab.pull.lease('renew',lab.deadline());const r=await c.exchange();assert.equal(r.control.kind,'lease.renew');assert.equal(r.read_permit,null);const granted=await c.exchange();assert.ok(granted.read_permit);assert.equal(c.wire.resources().connections,1);
});
test('A4-13 latest queued base converges while old dispatched acceptance is discarded',async t=>{
 const lab=await setup(t),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline());await c.exchange();const old=await c.exchange();assert.equal(old.control.kind,'playback.set');lab.pull.base(command(lab,11,'2'),lab.deadline());lab.pull.base(command(lab,1,'3'),lab.deadline());const next=await c.exchange();assert.equal(next.control.payload.target.action_id,1);await c.exchange();assert.equal(view(lab).desired.revision,'3');assert.equal(view(lab).playback.phase,'accepted');
});
test('A4-14 queued cancel wins over base at the next segment boundary',async t=>{
 const {lab,client:c}=await ready(t);await c.segment(0,100);lab.pull.base(command(lab,11,'2'),lab.deadline());lab.pull.cancel(lab.deadline());const cancelled=await c.exchange();assert.equal(cancelled.control.kind,'playback.cancel');assert.equal(cancelled.read_permit,null);const next=await c.exchange();assert.equal(next.control.kind,'playback.set');assert.equal(next.control.payload.target.action_id,11);
});
test('A4-15 missing control receipt is not retransmitted and times out as outcome unknown',async t=>{
 const clock=new VirtualClock(),lab=await setup(t,{clock,ackMs:50}),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());await c.exchange({apply:false});assert.equal((await c.exchange({observation:null})).control,null);clock.advance(50);await assert.rejects(c.exchange({observation:null}));assert.equal(lab.pull.resources().last_outcome.status,'outcome_unknown');assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-16 save is not blindly retried and unknown storage does not become saved',async t=>{
 const {lab,client:c}=await ready(t);lab.pull.save(lab.deadline());const r=await c.exchange();assert.equal(r.control.kind,'storage.save');err(()=>lab.pull.save(lab.deadline()),'queue_full');assert.equal(lab.pull.resources().blocked,false);await c.exchange();assert.equal(view(lab).storage[0].status,'outcome_unknown');assert.equal(view(lab).inventory.known,false);err(()=>lab.pull.save(lab.deadline()),'storage_outcome_unknown');assert.equal(lab.pull.resources().blocked,false);
});
test('A4-17 replayed request sequence is rejected and cannot deliver another control',async t=>{
 const {lab,client:c}=await ready(t);await assert.rejects(c.exchange({requestSeq:'3'}));assert.equal(lab.pull.resources().blocked,true);assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-18 receipt dispatch identity cannot be swapped to another operation',async t=>{
 const lab=await setup(t),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());await c.exchange();const forged={...c.outgoing,dispatch_id:'wrong_dispatch'};await assert.rejects(c.exchange({observation:forged}));assert.equal(lab.pull.resources().last_outcome.kind,'lease.acquire');
});
test('A4-19 a valid TLS certificate without the approved fingerprint cannot hello',async t=>{
 const lab=await setup(t),c=lab.client('unknown');await assert.rejects(c.hello());assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-20 unknown certificate time blocks the next request instead of trusting cache',async t=>{
 const {lab,client:c}=await ready(t);lab.setWall(NaN);await assert.rejects(c.exchange());assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-21 persistent revocation fences current socket and future asset admission',async t=>{
 const {lab,client:c}=await ready(t);lab.sessions.revoke({device_id:'D',expected_revision:'1',operation_id:'original_revoke'});await assert.rejects(c.exchange());assert.equal(lab.store.record('D').state,'pending_revocation');assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-22 corrupt metadata between blocks fails before publishing a complete segment',async t=>{
 let lab;const s=await ready(t,{beforeChunk:({offset})=>{if(offset===4096)writeFileSync(join(lab.directory,'bindings.json'),'bad',{mode:0o600});}});lab=s.lab;await assert.rejects(s.client.segment(0,32767));assert.equal(lab.pull.resources().blocked,true);assert.equal(readFileSync(join(lab.directory,'bindings.json'),'utf8'),'bad');
});
test('A4-23 each 4KiB block gets a fresh full metadata view without repeated static certificate work',async t=>{
 const metrics=createLoadMetrics(),{lab,client:c}=await ready(t,{metrics});metrics.reset();await c.segment(0,32767);await lab.pull.waitForIdle();const m=metrics.snapshot();assert.equal(m.stats.metadata_load.count,10);assert.equal(m.stats.certificate_static?.count??0,0);assert.equal(lab.pull.resources().reads,0);
});
test('A4-24 server close retains handler ownership until an abort-ignoring hook really exits',async t=>{
 let release,entered;const reached=new Promise(r=>entered=r),s=await ready(t,{beforeChunk:()=>{entered();return new Promise(r=>release=r);}}),{lab,client:c}=s;
 const request=assert.rejects(c.segment(0,32767,c.last.read_permit,{deadline:lab.clock.now()+100}));await reached;
 try{await request;assert.equal(lab.pull.resources().http,1);let done=false;const closing=lab.pull.close().then(()=>done=true);await turn();assert.equal(done,false);release();await closing;assert.equal(lab.pull.resources().http,0);}finally{release?.();}
});
test('A4-25 no implicit Agent queue or second request while a segment is active',async t=>{
 let release,entered,first=true;const reached=new Promise(r=>entered=r),{lab,client:c}=await ready(t,{beforeChunk:()=>{if(first){first=false;entered();return new Promise(r=>release=r);}}});const segment=c.segment(0,100);await reached;
 try{await assert.rejects(c.exchange(),e=>e.code==='request_busy');assert.equal(c.wire.resources().connections,1);assert.equal(c.wire.resources().inflight,1);}finally{release();}await segment;assert.equal(lab.resources().max_http,1);
});
test('A4-26 wrong Range/If-Range and asset identity fail closed',async t=>{
 for(const options of [{headers:{'if-range':'"wrong"'}},{headers:{range:'bytes=0-1,3-4'}},{headers:{range:'bytes=0-32768'}},{pathHash:'b'.repeat(64)}]){const {lab,client:c}=await ready(t);await assert.rejects(c.segment(0,100,c.last.read_permit,options));assert.equal(lab.pull.resources().blocked,true);}
});
test('A4-27 segment response rejects redirect/encoding/chunked/length/ETag mismatches',()=>{
 const sha='a'.repeat(64),range={start:0,end:1,length:2},headers={'content-length':'2','content-range':'bytes 0-1/2',etag:'"'+sha+'"'},good={status:206,headers,body:Buffer.alloc(2),range,total:2,sha};assert.equal(validateSegmentResponse(good).length,2);
 for(const patch of [{location:'https://never.test.invalid'},{'transfer-encoding':'chunked'},{'content-encoding':'gzip'},{'content-length':'3'},{etag:'"wrong"'},{'content-range':'bytes 1-2/3'}])assert.throws(()=>validateSegmentResponse({...good,headers:{...headers,...patch}}));assert.throws(()=>validateSegmentResponse({...good,status:200}));
});
test('A4-28 expired read permit cannot start a new Range',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock}),permit=c.last.read_permit;clock.advance(1001);await assert.rejects(c.segment(0,100));assert.equal(lab.pull.resources().blocked,false);await assert.rejects(c.wire.request({method:'GET',path:'/offline-round-pet/v1/assets/'+lab.media.F,headers:{range:'bytes=0-100','if-range':'"'+lab.media.F+'"','x-round-pet-read':permit.id},deadline:clock.now()+1000}));assert.equal(lab.pull.resources().blocked,true);
});
test('A4-29 exchange with an old context cannot refresh current session state',async t=>{
 const {lab,client:c}=await ready(t),message={...golden.request,context:{...c.context,session_id:'old_session'},request_seq:'99'};await assert.rejects(c.wire.request({path:'/offline-round-pet/v1/exchange',body:Buffer.from(encodePullMessage(message)),deadline:lab.deadline(1000)}));assert.equal(lab.pull.resources().blocked,true);
});
test('A4-30 a new TLS hello does not replay the previous base, lease or pending control',async t=>{
 const {lab,client:c}=await ready(t),old=c.context;await c.close();for(let i=0;i<100&&lab.resources().sockets;i++)await turn();const next=lab.client();await next.hello();assert.notEqual(next.context.session_id,old.session_id);const response=await next.exchange();assert.equal(response.control,null);assert.equal(response.read_permit,null);assert.equal(view(lab).desired,null);assert.equal(view(lab).controlled,false);
});
test('A4-31 suspend between chunks invalidates the candidate without partial publication',async t=>{
 let lab;const s=await ready(t,{beforeChunk:({offset})=>{if(offset===4096)lab.sessions.suspend();}});lab=s.lab;await assert.rejects(s.client.segment(0,32767));assert.equal(lab.sessions.resources().mode,'suspended');assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-32 queued command deadline does not restart at dispatch or extend the lease',async t=>{
 const clock=new VirtualClock(),lab=await setup(t,{clock}),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline(10));await c.exchange();clock.advance(11);await assert.rejects(c.exchange());assert.equal(lab.pull.resources().blocked,true);assert.equal(view(lab).playback,null);
});
test('A4-33 lease send time is actual dispatch rather than host enqueue time',async t=>{
 const clock=new VirtualClock(),lab=await setup(t,{clock}),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline(20000));clock.advance(3000);await c.exchange();await c.exchange();await c.exchange();clock.advance(11500);assert.equal(view(lab).controlled,true);
});
test('A4-34 old completed grant cannot acknowledge a new renew dispatch',async t=>{
 const lab=await setup(t),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());await c.exchange();const old=c.outgoing;await c.exchange();lab.pull.lease('renew',lab.deadline());const renewed=await c.exchange();await assert.rejects(c.exchange({observation:{...old,dispatch_id:renewed.control.dispatch_id}}));assert.equal(lab.pull.resources().blocked,true);
});
test('A4-35 lost save receipt is locally unknown, never fabricated as a device storage report',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock,ackMs:50});lab.pull.save(lab.deadline());await c.exchange({apply:false});clock.advance(51);await assert.rejects(c.exchange({observation:null}));assert.deepEqual(lab.pull.resources().last_outcome,{kind:'storage.save',status:'outcome_unknown'});assert.equal(view(lab).storage.length,0);
});
test('A4-36 a queued urgent renewal invalidates an unused old read opportunity',async t=>{
 const {lab,client:c}=await ready(t);lab.pull.lease('renew',lab.deadline());await assert.rejects(c.segment(0,100));assert.equal(lab.pull.resources().blocked,true);
});
test('A4-37 download completion or wrong phase cannot acknowledge playback acceptance',async t=>{
 const lab=await setup(t),c=lab.client();await c.hello();lab.pull.lease('acquire',lab.deadline());lab.pull.base(command(lab),lab.deadline());await c.exchange();const dispatched=await c.exchange();await assert.rejects(c.exchange({observation:{kind:'record',dispatch_id:dispatched.control.dispatch_id,record:c.record(command(lab),'verified')}}));assert.equal(view(lab).playback,null);
});
test('A4-38 second simultaneous TLS client cannot obtain a parallel device session',async t=>{
 const {lab,client:c}=await ready(t),second=lab.client();await assert.rejects(second.hello());assert.equal(lab.sessions.resources().sessions,1);assert.ok((await c.exchange()).read_permit);await second.close();
});
test('A4-39 readonly query controls map real TLS request proof into A3 without restoring control',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock});clock.advance(14000);lab.pull.query('inventory',lab.deadline());assert.equal((await c.exchange()).control.kind,'query.inventory');await c.exchange();assert.equal(view(lab).inventory.known,false);lab.pull.query('display',lab.deadline());assert.equal((await c.exchange()).control.kind,'query.display');await c.exchange();assert.equal(view(lab).actual,null);assert.equal(view(lab).controlled,false);
});
test('A4-40 explicit close reclaims client/server/session/queue resources idempotently',async t=>{
 const {lab,client:c}=await ready(t);await c.close();await c.close();await lab.close();await lab.close();assert.equal(lab.resources().pull.queue.pending,0);assert.equal(lab.resources().pull.permit,0);assert.equal(lab.resources().session.tasks,0);assert.equal(c.wire.resources().inflight,0);assert.equal(c.wire.resources().requests,0);
});
test('A4-41 authenticated local display and maintenance map to A3 without changing remote base',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock}),a=lab.media.manifest.actions.find(a=>a.id===4),record={schema_version:1,type:'display.report',display_seq:'1',kind:'event',query_id:null,origin:'local',asset_ref:{namespace:lab.media.packageRef.namespace,action_id:4,asset_sha256:a.sha256,bytes:a.bytes},source_command:null,refresh_generation:'1',frame_seq:'1',elapsed_ms:24,maintenance:'none',display_state:'playing'};
 await c.exchange({observation:{kind:'record',dispatch_id:null,record}});assert.equal(view(lab).actual.action_id,4);assert.equal(view(lab).desired.action_id,0);await c.exchange({observation:{kind:'record',dispatch_id:null,record:{...record,display_seq:'2',maintenance:'saving',display_state:'held_last_valid'}}});clock.advance(100);assert.equal(view(lab).actual.elapsed_ms,24);assert.equal(view(lab).display_state,'held_last_valid');
});
test('A4-42 correlated saved commit and complete inventory remain separate authenticated streams',async t=>{
 const {lab,client:c}=await ready(t);lab.pull.save(lab.deadline());const response=await c.exchange(),p=response.control.payload;
 const saved={schema_version:1,type:'storage.report',storage_seq:'1',operation_id:p.operation_id,source_target:p.target,package_ref:p.package_ref,status:'saved',commit:{evidence:'root_commit',root_seq:'5',object_generation:'5'}};
 await c.exchange({observation:{kind:'record',dispatch_id:response.control.dispatch_id,record:saved}});assert.equal(view(lab).storage[0].status,'saved');assert.equal(view(lab).inventory.known,false);assert.equal(view(lab).actual,null);
 lab.pull.query('inventory',lab.deadline());const query=await c.exchange(),record={schema_version:1,type:'inventory.snapshot',inventory_seq:'1',query_id:query.control.payload.query_id,known:true,namespace:p.package_ref.namespace,root_seq:'5',root_state:'OFFLINE_READY',active:[0,4,1,11].map((id,i)=>{const a=lab.media.manifest.actions.find(a=>a.id===id);return {action_id:id,asset_sha256:a.sha256,bytes:a.bytes,object_generation:id===0?'5':String(i+1)};})};await c.exchange({observation:{kind:'record',dispatch_id:query.control.dispatch_id,record}});assert.equal(view(lab).inventory.known,true);assert.equal(view(lab).inventory.actions[0].offline_available,true);
});
test('A4-43 candidate revoke acknowledgement fences session but is not durable binding revocation',async t=>{
 const {lab,client:c}=await ready(t);lab.pull.revoke(lab.deadline());assert.equal((await c.exchange()).control.kind,'binding.revoke');await assert.rejects(c.exchange());assert.equal(lab.sessions.resources().sessions,0);assert.equal(lab.store.record('D').state,'bound');
});
test('A4-44 cancellation during a Range prevents the next chunk and publishes no full segment',async t=>{
 let lab;const s=await ready(t,{beforeChunk:({offset})=>{if(offset===4096)lab.pull.cancel(lab.deadline());}});lab=s.lab;await assert.rejects(s.client.segment(0,32767));assert.equal(lab.pull.resources().blocked,true);assert.equal(lab.sessions.resources().sessions,0);
});
test('A4-45 exact horizon reserve permits a segment; one millisecond less does not extend TTL',async t=>{
 const clock=new VirtualClock(),{lab,client:c}=await ready(t,{clock});clock.advance(11464);assert.ok((await c.exchange()).read_permit);clock.advance(1);assert.equal((await c.exchange()).read_permit,null);assert.equal(view(lab).controlled,true);
});
test('A4-46 storage uncertainty blocks further writes until a fresh known inventory resolves it',async t=>{
 const {lab,client:c}=await ready(t);lab.pull.save(lab.deadline());await c.exchange();await c.exchange();assert.equal(lab.pull.resources().storage_blocked,true);lab.pull.query('inventory',lab.deadline());const response=await c.exchange(),query_id=response.control.payload.query_id,record={schema_version:1,type:'inventory.snapshot',inventory_seq:'1',query_id,known:true,namespace:lab.media.packageRef.namespace,root_seq:'0',root_state:'EMPTY',active:[]};await c.exchange({observation:{kind:'record',dispatch_id:response.control.dispatch_id,record}});assert.equal(lab.pull.resources().storage_blocked,false);assert.equal(view(lab).storage[0].status,'outcome_unknown');assert.ok(lab.pull.save(lab.deadline()));
});
test('A4-47 candidate hello requires explicit profile and stream versions without loosening base hello',async t=>{
 for(const body of [{protocol:'hub-device/1',type:'hello.begin'}, {profile:'round-pet-pull-candidate/1',schema_version:1,versions:{},hello:{protocol:'hub-device/1',type:'hello.begin'}}]){const lab=await setup(t),c=lab.client();let refused=false;try{const r=await c.wire.request({path:'/offline-round-pet/v1/hello',body:Buffer.from(JSON.stringify(body)),deadline:lab.deadline(1000)});refused=r.status===403;}catch{refused=true;}assert.equal(refused,true);assert.equal(lab.sessions.resources().sessions,0);assert.equal(lab.sessions.resources().pending,0);}
});
test('A4-48 independent device clock offset consumes relative permit duration, never host absolute time',async t=>{
 const clock=new VirtualClock(),deviceClock={now:()=>900000000+clock.now()},s=await ready(t,{clock,deviceClock});assert.equal(s.client.last.read_permit.deadline,undefined);assert.ok(s.client.last.read_permit.remaining_ms<=1000);const bytes=await s.client.download();assert.equal(sha256(bytes),s.lab.media.F);assert.equal(s.client.wire.resources().connections,1);
});
