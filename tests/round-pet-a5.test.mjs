import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,rmSync,renameSync,chmodSync,symlinkSync,readdirSync,existsSync} from 'node:fs';import {join} from 'node:path';import {setImmediate as turn} from 'node:timers/promises';
import {offlinePKI} from './fixtures/offline-pki.mjs';import {assemblyFixture,controlledAssemblyPower} from './fixtures/round-pet-assembly-lab.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';import {startOrAttach} from '../packages/runtime/service.mjs';
import {createRoundPetImport} from '../packages/runtime/round-pet-import.mjs';import {createRoundPetReader,inspectRoundPetBlob} from '../packages/runtime/round-pet-reader.mjs';
import {publicAssemblyView} from '../packages/core/assembly-view.mjs';import {hubViewModel,renderHubPanel} from '../packages/ui/index.mjs';import {createHostPlugin} from '../apps/dsh-plugin/index.mjs';import http from 'node:http';import vm from 'node:vm';
const pki=offlinePKI({parent:process.env.HUB_TEST_TMPDIR});test.after(()=>{pki.close();assert.equal(pki.resources().exists,false);});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code),row=a=>a.snapshot().observationReview?.devices[0];
async function connected(t,{inventory={},...opts}={}){const f=assemblyFixture(t,pki,opts),hub=await f.start(),a=hub.roundPetAssembly;await a.ready;await a.enableReview();const endpoint=await f.endpoint(hub),peer=endpoint.client();await peer.hello();a.acquire(f.deadline());await peer.exchange();const query=await peer.exchange();assert.equal(query.control.kind,'query.inventory');await peer.exchange({observation:f.inventory(peer,inventory)});return {f,hub,a,endpoint,peer};}
async function manual(s,id=43){const target=s.a.manual(id,s.f.deadline());assert.equal((await s.peer.exchange()).control.kind,'playback.set');await s.peer.exchange();return target;}
async function verified(s,target){await s.peer.exchange({observation:{kind:'record',dispatch_id:null,record:s.peer.record(target,'verified')}});}
async function readerSetup(t){const f=assemblyFixture(t,pki),importer=createRoundPetImport(f.directory,f.options.material);f.owned.push(importer);const bundle=await importer.ready,reader=createRoundPetReader(f.directory,bundle);f.owned.push(reader);return {f,importer,bundle,reader,path:join(f.directory,'material-store',bundle.identity.index_sha256,'blobs',f.media.F)};}
test('A5-01 explicit assembly validates asynchronously but stays disabled without creating a listener',async t=>{
 const f=assemblyFixture(t,pki),hub=await f.start(),a=hub.roundPetAssembly;assert.equal((await hub.client.request('GET','/v1/status')).phase,'A5-assembly-review');await a.ready;const status=await hub.client.request('GET','/v1/status');assert.equal(status.assemblyReview.phase,'disabled');assert.equal(status.assemblyReview.production_listener,false);assert.equal(status.assemblyReview.review_enabled,false);assert.equal(status.capabilities.deviceTransport,false);assert.equal(f.power.starts,1);assert.deepEqual(status.devices,[]);assert.equal(a.resources().managed.sessions.sessions,0);
});
test('A5-02 a mounted temporary endpoint still rejects hello until explicitly enabled',async t=>{
 const f=assemblyFixture(t,pki),hub=await f.start(),a=hub.roundPetAssembly;await a.ready;const ep=await f.endpoint(hub),peer=ep.client();await assert.rejects(peer.hello());assert.equal(a.resources().managed.sessions.sessions,0);err(()=>a.manual(0,f.deadline()),'review_disabled');
});
test('A5-03 every new hello requests initial inventory and unknown does not permit manual playback',async t=>{
 const f=assemblyFixture(t,pki),hub=await f.start(),a=hub.roundPetAssembly;await a.ready;await a.enableReview();const ep=await f.endpoint(hub),peer=ep.client();await peer.hello();err(()=>a.manual(0,f.deadline()),'inventory_unconfirmed');const first=await peer.exchange();assert.equal(first.control.kind,'query.inventory');await peer.exchange();assert.equal(a.snapshot().assemblyReview.inventory_confirmed,false);err(()=>a.manual(0,f.deadline()),'inventory_unconfirmed');assert.equal(row(a).desired,null);
});
test('A5-04 full A2 disk CAS streams through A4 TLS and A3/status after a fresh root query',async t=>{
 const s=await connected(t),target=await manual(s);const bytes=await s.peer.download();assert.equal(sha256(bytes),s.f.media.F);await verified(s,target);assert.equal(row(s.a).playback.phase,'verified');assert.equal(row(s.a).actual,null);assert.ok(s.a.resources().reader.read_calls>0);assert.equal(s.a.resources().reader.open_files,0);const status=await s.hub.client.request('GET','/v1/status');assert.equal(status.observationReview.devices[0].desired.action_id,43);assert.equal(status.assemblyReview.write_gate,'needs_victim');
});
test('A5-05 accepted or downloaded alone cannot save; full cache needs an explicit nonprotected victim',async t=>{
 const s=await connected(t),target=await manual(s);err(()=>s.a.save(s.f.deadline(),{victim_action_id:1}),'playback_unverified');await s.peer.download();err(()=>s.a.save(s.f.deadline(),{victim_action_id:1}),'playback_unverified');await verified(s,target);for(const victim of [undefined,0,4,43,77])err(()=>s.a.save(s.f.deadline(),victim===undefined?{}:{victim_action_id:victim}),'unsafe_cache_write');const operation=s.a.save(s.f.deadline(),{victim_action_id:1}),r=await s.peer.exchange();assert.equal(r.control.kind,'storage.save');assert.equal(r.control.payload.operation_id,operation);assert.equal(r.control.payload.victim_action_id,1);
});
test('A5-06 saving unknown blocks future saves until a new complete known inventory',async t=>{
 const s=await connected(t),target=await manual(s);await verified(s,target);s.a.save(s.f.deadline(),{victim_action_id:1});await s.peer.exchange();await s.peer.exchange();err(()=>s.a.save(s.f.deadline(),{victim_action_id:1}),'storage_outcome_unknown');assert.equal(row(s.a).inventory.known,false);s.a.query('inventory',s.f.deadline());await s.peer.exchange();await s.peer.exchange({observation:s.f.inventory(s.peer,{root:'5'})});assert.equal(row(s.a).inventory.known,true);assert.ok(s.a.save(s.f.deadline(),{victim_action_id:11}));assert.equal(row(s.a).storage[0].status,'outcome_unknown');
});
test('A5-07 EMPTY bootstrap allows only idle0, not working or touch',async t=>{
 const s=await connected(t,{inventory:{root:'0',ids:[]}});for(const id of [4,11,43])err(()=>s.a.manual(id,s.f.deadline()),'unsafe_cache_write');const target=await manual(s,0);await verified(s,target);assert.ok(s.a.save(s.f.deadline()));
});
test('A5-08 IDLE_READY permits completing touch4 and rejects an unrelated working set',async t=>{
 const s=await connected(t,{inventory:{root:'1',ids:[0]}});err(()=>s.a.manual(11,s.f.deadline()),'unsafe_cache_write');const target=await manual(s,4);await verified(s,target);assert.ok(s.a.save(s.f.deadline()));
});
test('A5-09 already available content is not forced into another save',async t=>{
 const s=await connected(t),target=await manual(s,0);await verified(s,target);err(()=>s.a.save(s.f.deadline()),'already_available');assert.equal(s.a.snapshot().assemblyReview.write_gate,'already_available');
});
test('A5-10 old/unmapped F still occupies a root slot and cannot be mistaken for free capacity',async t=>{
 const s=await connected(t,{inventory:{hashes:{1:'a'.repeat(64),11:'b'.repeat(64)}}}),target=await manual(s);await verified(s,target);assert.equal(row(s.a).inventory.actions.find(a=>a.action_id===1).offline_available,false);err(()=>s.a.save(s.f.deadline()),'unsafe_cache_write');assert.ok(s.a.save(s.f.deadline(),{victim_action_id:1}));
});
test('A5-11 same-ID old F may be replaced atomically without evicting an unrelated slot',async t=>{
 const s=await connected(t,{inventory:{hashes:{0:'a'.repeat(64)}}}),target=await manual(s,0);await verified(s,target);assert.equal(s.a.snapshot().assemblyReview.write_gate,'ready');assert.ok(s.a.save(s.f.deadline()));
});
test('A5-12 queued save is rechecked at dispatch after inventory changed',async t=>{
 const s=await connected(t),target=await manual(s);await verified(s,target);s.a.query('inventory',s.f.deadline());await s.peer.exchange();s.a.save(s.f.deadline(),{victim_action_id:1});await assert.rejects(s.peer.exchange({observation:s.f.inventory(s.peer,{root:'5',ids:[0,4,1,43]})}));assert.equal(row(s.a).storage.length,0);assert.equal(s.a.resources().pull.blocked,true);
});
test('A5-13 queued base cannot cross a new unknown inventory barrier',async t=>{
 const s=await connected(t);s.a.query('inventory',s.f.deadline());await s.peer.exchange();s.a.manual(43,s.f.deadline());await assert.rejects(s.peer.exchange({observation:s.f.inventory(s.peer,{known:false})}));assert.equal(row(s.a).playback,null);assert.equal(row(s.a).inventory.known,false);
});
test('A5-14 reader returns private bounded slices without retaining descriptors or whole library',async t=>{
 const s=await readerSetup(t),first=s.reader.read(s.f.media.F,0,4096);assert.deepEqual(first,s.f.source.bytes.subarray(0,4096));first[0]^=1;assert.notDeepEqual(first,s.reader.read(s.f.media.F,0,4096));err(()=>s.reader.read(s.f.media.F,0,4097),'invalid_message');err(()=>s.reader.read('a'.repeat(64),0,1),'unknown_asset');assert.equal(s.reader.resources().open_files,0);assert.equal(s.reader.resources().retained_library_bytes,0);
});
test('A5-15 a digest declaration without worker fd proof cannot open a trusted reader',async t=>{
 const s=await readerSetup(t);err(()=>createRoundPetReader(s.f.directory,{...s.bundle,blobProofs:undefined}),'asset_proof_required');
});
test('A5-16 equal-length mutation invalidates the proof even after bytes are restored',async t=>{
 const s=await readerSetup(t);writeFileSync(s.path,Buffer.alloc(s.f.source.bytes.length));err(()=>s.reader.read(s.f.media.F,0,10),'asset_changed');writeFileSync(s.path,s.f.source.bytes);err(()=>s.reader.read(s.f.media.F,0,10),'asset_changed');assert.equal(s.reader.resources().open_files,0);
});
test('A5-17 replacement inode is rejected even with exactly the approved original bytes',async t=>{
 const s=await readerSetup(t),replacement=s.path+'.replacement';writeFileSync(replacement,s.f.source.bytes,{mode:0o600});renameSync(replacement,s.path);err(()=>s.reader.read(s.f.media.F,0,10),'asset_changed');
});
test('A5-18 leaf and ancestor symlinks do not redirect a CAS read',async t=>{
 const s=await readerSetup(t),saved=s.path+'.old';renameSync(s.path,saved);symlinkSync(saved,s.path);assert.throws(()=>s.reader.read(s.f.media.F,0,10));rmSync(s.path);renameSync(saved,s.path);const folder=join(s.path,'..'),outside=folder+'.old';renameSync(folder,outside);symlinkSync(outside,folder);assert.throws(()=>s.reader.read(s.f.media.F,0,10));
});
test('A5-19 public file permissions or a closed reader cannot reuse the fd proof',async t=>{
 const s=await readerSetup(t);chmodSync(s.path,0o644);err(()=>s.reader.read(s.f.media.F,0,10),'unsafe_store');s.reader.close();s.reader.close();err(()=>s.reader.read(s.f.media.F,0,10),'reader_closed');
});
test('A5-20 mutation during same-fd inspection cannot publish an integrity proof',async t=>{
 const s=await readerSetup(t);err(()=>inspectRoundPetBlob(s.path,s.f.source.bytes.length,bytes=>{writeFileSync(s.path,bytes);return true;}),'asset_changed');
});
test('A5-21 quota failure stays failed/default-off and starts no session or power observer',async t=>{
 const f=assemblyFixture(t,pki,{quota:128}),hub=await f.start(),a=hub.roundPetAssembly;await assert.rejects(a.ready,e=>e.code==='quota_exceeded');const status=await hub.client.request('GET','/v1/status');assert.equal(status.assemblyReview.phase,'failed');assert.equal(status.assemblyReview.review_enabled,false);assert.equal(f.power.starts,0);assert.equal(a.resources().catalog.worker_alive,false);assert.equal((await a.lifecycle.list()).reserved_bytes,0);
});
test('A5-22 invalid independent source approval rolls back only the new UDS owner',async t=>{
 const f=assemblyFixture(t,pki);writeFileSync(join(f.source.directory,'manifest.json'),'wrong');await assert.rejects(f.start(),e=>e.code==='source_manifest_changed');assert.equal(existsSync(join(f.directory,'service.json')),false);assert.equal(existsSync(join(f.directory,'hub.sock')),false);assert.equal(f.power.starts,0);
});
test('A5-23 cached-only reopen after source removal restores data but stays off and re-queries inventory',async t=>{
 const s=await connected(t),target=await manual(s);await verified(s,target);const I=(await s.a.ready).identity.index_sha256;await s.endpoint.close();await s.hub.close();rmSync(s.f.source.directory,{recursive:true});const next=await s.f.start({material:{cachedOnly:true,indexSha256:I,approval:s.f.options.material.approval}}),a=next.roundPetAssembly;await a.ready;assert.equal(a.snapshot().assemblyReview.phase,'disabled');assert.equal(a.snapshot().observationReview.devices.length,0);await a.enableReview();const ep=await s.f.endpoint(next),c=ep.client();await c.hello();assert.equal((await c.exchange()).control.kind,'query.inventory');assert.equal(row(a).desired,null);err(()=>a.manual(0,s.f.deadline()),'inventory_unconfirmed');
});
test('A5-24 one UDS winner owns one worker/session/power source and attach does not replace it',async t=>{
 const f=assemblyFixture(t,pki),both=await Promise.all([f.start(),f.start()]),owner=both.find(o=>o.role==='owner'),attached=both.find(o=>o.role==='attached');await owner.roundPetAssembly.ready;assert.equal(f.power.starts,1);assert.equal(attached.roundPetAssembly,undefined);await attached.close();assert.equal(owner.roundPetAssembly.resources().catalog.worker_alive,true);const other=controlledAssemblyPower();await assert.rejects(f.start({controller_id:'other',powerSource:other}),/differs/);assert.equal(other.starts,0);
});
test('A5-25 default service cannot silently acquire assembly or start catalog/power',async t=>{
 const f=assemblyFixture(t,pki),owner=await startOrAttach({directory:f.directory});f.owned.push(owner);const status=await owner.client.request('GET','/v1/status');assert.equal(status.assemblyReview,undefined);await assert.rejects(f.start(),/differs/);assert.equal(f.power.starts,0);assert.equal(existsSync(join(f.directory,'material-store')),false);
});
test('A5-26 mixed source/simulation/managed review configuration is rejected before side effects',async t=>{
 const f=assemblyFixture(t,pki);for(const extra of [{source:{mode:'page'}},{deviceMode:'simulation',simulationFactory:()=>{}},{observationReview:{id:'other',create(){throw new Error('must not start');}}}])await assert.rejects(startOrAttach({directory:f.directory,roundPetAssembly:f.options,...extra}),/isolated/);assert.equal(f.power.starts,0);assert.equal(existsSync(join(f.directory,'material-store')),false);
});
test('A5-27 bad durable binding metadata is preserved and material pin/worker are released',async t=>{
 const f=assemblyFixture(t,pki);writeFileSync(join(f.bindingDirectory,'bindings.json'),'bad');const hub=await f.start(),a=hub.roundPetAssembly;await assert.rejects(a.ready,e=>e.code==='binding_store_invalid');assert.equal(readFileSync(join(f.bindingDirectory,'bindings.json'),'utf8'),'bad');assert.equal(a.resources().catalog.worker_alive,false);assert.equal(f.power.starts,0);assert.equal((await a.lifecycle.list()).entries[0].protected,false);
});
test('A5-28 power startup failure closes sessions/reader/worker and preserves approved CAS',async t=>{
 const power={descriptor:{kind:'fixture',identity:'startup-fails'},async start(){throw Object.assign(new Error('injected'),{code:'power_start_failed'});}},f=assemblyFixture(t,pki,{power}),before=readFileSync(join(f.bindingDirectory,'bindings.json')),hub=await f.start(),a=hub.roundPetAssembly;await assert.rejects(a.ready,e=>e.code==='power_start_failed');assert.equal(a.resources().reader.closed,true);assert.equal(a.resources().catalog.worker_alive,false);assert.deepEqual(readFileSync(join(f.bindingDirectory,'bindings.json')),before);assert.equal((await a.lifecycle.list()).entries.length,1);
});
test('A5-29 closing during initialization cancels ready without letting stale completion re-enable it',async t=>{
 const f=assemblyFixture(t,pki),hub=await f.start(),a=hub.roundPetAssembly;await hub.close();await assert.rejects(a.ready);assert.equal(a.resources().phase,'closed');assert.equal(a.resources().catalog.worker_alive,false);assert.equal(existsSync(join(f.directory,'service.json')),false);assert.equal(readdirSync(join(f.directory,'material-store')).some(n=>n.startsWith('.staging-')),false);
});
test('A5-30 closing retains the CAS pin until an ignored-abort HTTP handler actually exits',async t=>{
 let release,entered,first=true;const reached=new Promise(r=>entered=r),f=assemblyFixture(t,pki),hub=await f.start(),a=hub.roundPetAssembly;await a.ready;await a.enableReview();const ep=await f.endpoint(hub,{beforeChunk(){if(first){first=false;entered();return new Promise(r=>release=r);}}}),peer=ep.client();await peer.hello();a.acquire(f.deadline());await peer.exchange();await peer.exchange();await peer.exchange({observation:f.inventory(peer)});const s={f,hub,a,endpoint:ep,peer};await manual(s);const pending=assert.rejects(peer.segment(0,32767));await reached;let done=false;
 try{const closing=hub.close().then(()=>done=true);await pending;await turn();assert.equal(done,false);const held=await a.lifecycle.list();assert.equal(held.entries[0].protected,true);await assert.rejects(a.lifecycle.cleanup({expected_revision:held.revision,entry_ids:[held.entries[0].entry_id]}),e=>e.code==='protected_version');assert.equal(a.resources().catalog.worker_alive,true);release();await closing;const free=await a.lifecycle.list();assert.equal(free.entries[0].protected,false);assert.equal(a.resources().reader.open_files,0);}finally{release?.();}
});
test('A5-31 suspend/resume fences old session and does not automatically re-enable or replay base',async t=>{
 const s=await connected(t);await manual(s);s.f.power.emit('suspend');assert.equal(s.a.snapshot().assemblyReview.phase,'suspended');await assert.rejects(s.a.enableReview(),e=>e.code==='review_unavailable');s.f.power.emit('resume');assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);await s.peer.close();for(let i=0;i<100&&s.endpoint.resources().sockets;i++)await turn();await s.a.enableReview();const c=s.endpoint.client();await c.hello();assert.equal((await c.exchange()).control.kind,'query.inventory');assert.equal(row(s.a).desired,null);assert.equal(row(s.a).controlled,false);
});
test('A5-32 source loss remains blocked and cannot be automatically revived by enable',async t=>{
 const s=await connected(t);s.f.power.fail();assert.equal(s.a.snapshot().assemblyReview.phase,'blocked');assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);await assert.rejects(s.a.enableReview(),e=>e.code==='review_unavailable');assert.equal(row(s.a).inventory.known,false);
});
test('A5-33 untrusted resume time remains blocked and reports the authority error',async t=>{
 const s=await connected(t);s.f.power.emit('suspend');s.f.setWall(NaN);s.f.power.emit('resume');assert.equal(s.a.snapshot().assemblyReview.phase,'blocked');assert.equal(s.a.snapshot().assemblyReview.error,'untrusted_time');await assert.rejects(s.a.enableReview(),e=>e.code==='review_unavailable');
});
test('A5-34 IPC/status contains only public review fields and no inode proofs, paths or credentials',async t=>{
 const s=await connected(t),status=await s.hub.client.request('GET','/v1/status'),text=JSON.stringify(status);for(const value of [s.f.root,'blobProofs','mtimeNs','ctimeNs','identity_ref','certificate_sha256','rootDER'])assert.ok(!text.includes(value));assert.equal(status.assemblyReview.inventory_confirmed,true);assert.equal(status.capabilities.deviceTransport,false);for(const path of ['/v1/assembly/enable','/v1/assembly/manual','/v1/assembly/save'])await assert.rejects(s.hub.client.request('POST',path,{}),e=>e.status===404);
});
test('A5-35 public assembly view drops extra fields and read-only UI renders the gate',async t=>{
 const s=await connected(t),status=await s.hub.client.request('GET','/v1/status');status.assemblyReview.secret='PRIVATE';status.assemblyReview.counts.path='PRIVATE';assert.ok(!JSON.stringify(publicAssemblyView(status.assemblyReview)).includes('PRIVATE'));const model=hubViewModel(status),tree=renderHubPanel((tag,props,...children)=>({tag,props,children}),model),text=JSON.stringify(tree);for(const label of ['默认关闭装配候选','生产 listener：关闭','等待当前素材验证'])assert.ok(text.includes(label));assert.equal(model.devices.length,0);assert.equal(hubViewModel({assemblyReview:{production_listener:true}}).assemblyError,true);
});
test('A5-36 live CAS mutation fails closed and cannot re-enable without full repository revalidation',async t=>{
 const s=await connected(t);await manual(s);const I=(await s.a.ready).identity.index_sha256,path=join(s.f.directory,'material-store',I,'blobs',s.f.media.F);writeFileSync(path,Buffer.alloc(s.f.source.bytes.length));await assert.rejects(s.peer.segment(0,4095));await s.a.waitForIdle();assert.equal(s.a.snapshot().assemblyReview.phase,'blocked');assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);assert.equal(s.a.resources().reader.open_files,0);await assert.rejects(s.a.enableReview(),e=>e.code==='repository_revalidation_required');assert.deepEqual(readFileSync(path),Buffer.alloc(s.f.source.bytes.length));
});
test('A5-37 trusted handler refuses nonloopback sockets before any TLS/session work',async t=>{
 const s=await connected(t),handler=s.a.createHandler();for(const [localAddress,remoteAddress] of [['192.0.2.1','127.0.0.1'],['127.0.0.1','192.0.2.2'],['::1','::1']]){let code,ended=false;await handler({socket:{localAddress,remoteAddress}},{writeHead(c){code=c;},end(){ended=true;}});assert.equal(code,503);assert.equal(ended,true);}assert.equal(s.a.resources().managed.sessions.sessions,1);
});
test('A5-38 repeated disable is harmless and a new review still requires fresh inventory',async t=>{
 const s=await connected(t);await manual(s);await s.a.disableReview();await s.a.disableReview();assert.equal(s.a.snapshot().assemblyReview.phase,'disabled');assert.equal(row(s.a).connection,'offline');await s.peer.close();for(let i=0;i<100&&s.endpoint.resources().sockets;i++)await turn();await s.a.enableReview();const c=s.endpoint.client();await c.hello();err(()=>s.a.manual(0,s.f.deadline()),'inventory_unconfirmed');assert.equal((await c.exchange()).control.kind,'query.inventory');assert.equal(row(s.a).desired,null);await s.a.disableReview();await c.close();for(let i=0;i<100&&s.endpoint.resources().sockets;i++)await turn();await s.a.enableReview();const bad=s.endpoint.client(),rejected=await bad.wire.request({path:'/offline-round-pet/v1/hello',body:Buffer.from('{}'),deadline:s.f.clock.now()+1500});assert.equal(rejected.status,403);await s.a.waitForIdle();assert.equal(s.a.snapshot().assemblyReview.review_enabled,false);assert.equal(s.a.snapshot().assemblyReview.phase,'blocked');
});
test('A5-39 host proxy keeps assembly read-only and does not expose new control routes',async t=>{
 const s=await connected(t);let route,dispose;createHostPlugin(s.hub.client)({effect(fn){dispose=fn();},webServer:{register(v){route=v;return()=>{};}}});const server=http.createServer((req,res)=>route.handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}/dsh-pet-hub`,res=await fetch(base+'/status'),v=await res.json();assert.equal(res.status,200);assert.equal(v.assemblyReview.production_listener,false);assert.equal(v.assemblyReview.inventory_confirmed,true);assert.ok(!JSON.stringify(v).includes(s.f.root));for(const action of ['enable','manual','save'])assert.equal((await fetch(base+'/assembly/'+action,{method:'POST'})).status,404);}finally{dispose();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('A5-40 built client registers the settings slot with the pure assembly validator included',()=>{
 let loaded,Component;const React={};vm.runInNewContext(readFileSync('dist/client.js','utf8'),{window:{__ModuleLoader__:{load(v){loaded=v;}}},AbortController,setTimeout,clearTimeout});const plugin=loaded.factory(name=>{assert.equal(name,'react');return React;});plugin.apply({slots:{inject(name,g){assert.equal(name,'settings.section');[...g()];},register(meta,C){assert.equal(meta.id,'dsh-pet-hub-settings');Component=C;return()=>{};}}});assert.equal(typeof Component,'function');assert.ok(readFileSync('dist/client.js','utf8').includes('function publicAssemblyView'));
});
test('A5-41 cleanup failure still closes reader, worker and pin before removing only owned UDS',async t=>{
 const power={descriptor:{kind:'fixture',identity:'close-fails'},async start(c){c.onEvent('ready');return {resources:()=>({ready:true}),async close(){throw new Error('injected-close');}};}},f=assemblyFixture(t,pki,{power}),hub=await f.start(),a=hub.roundPetAssembly;await a.ready;await assert.rejects(hub.close(),AggregateError);f.owned.splice(f.owned.indexOf(hub),1);assert.equal(a.resources().catalog.worker_alive,false);assert.equal(a.resources().reader.closed,true);assert.equal(a.resources().managed.store.closed,true);assert.equal((await a.lifecycle.list()).entries[0].protected,false);assert.equal(existsSync(join(f.directory,'service.json')),false);assert.equal(a.snapshot().assemblyReview.phase,'closed');
});
