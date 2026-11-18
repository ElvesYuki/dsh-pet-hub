import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,unlinkSync,existsSync,chmodSync,renameSync,symlinkSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {openBindingStore} from '../packages/runtime/binding-store.mjs';import {canonicalLeaseJSON} from '../packages/core/lease-wire.mjs';
import {VirtualClock} from '../packages/simulator/index.mjs';
import {observationFixture} from '../packages/simulator/round-pet-observation-fixture.mjs';import {advanceRootCheckpoint} from '../packages/core/round-pet-root-checkpoint.mjs';
import {offlinePKI} from './fixtures/offline-pki.mjs';import {createPullLab} from './fixtures/round-pet-pull-lab.mjs';import {assemblyFixture} from './fixtures/round-pet-assembly-lab.mjs';import {executionLab} from './fixtures/round-pet-execution-lab.mjs';
const pki=offlinePKI({parent:process.env.HUB_TEST_TMPDIR});test.after(()=>pki.close());const err=(fn,code)=>assert.throws(fn,e=>e.code===code),clone=structuredClone;
const binding={device_id:'D',binding_id:'B',binding_epoch:'1',controller_id:'C',identity_ref:'original_test',credential_epoch:'1',certificate_sha256:'a'.repeat(64),state:'bound',mapping:{},root_checkpoint:null};
function root(t){const f=observationFixture();t.after(()=>f.close());f.query('inventory','q');f.ingest(f.inventory('q'));const c=f.model.rootCheckpoint();c.binding={device_id:'D',binding_id:'B',binding_epoch:'1'};return c;}
function directory(t){const d=mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'a8-store-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}
function store(t,{fault,...options}={}){const d=directory(t),s=openBindingStore({directory:d,rootState:true,create:true,...(fault?{fault}:{}),...options});t.after(()=>s.close());s.register('0',clone(binding));return {s,d,file:join(d,'bindings.json')};}
function rewrite(file,change){const e=JSON.parse(readFileSync(file,'utf8'));change(e.content);e.sha256=createHash('sha256').update(canonicalLeaseJSON(e.content)).digest('hex');writeFileSync(file,JSON.stringify(e),{mode:0o600});}
test('A8-01 root authority is an explicit new format and missing files do not initialize themselves',t=>{
 const d=directory(t);err(()=>openBindingStore({directory:d,rootState:true}),'binding_store_missing');assert.equal(existsSync(join(d,'bindings.json')),false);const {s,file}=store(t);assert.equal(s.read().schemaVersion,2);assert.equal(JSON.parse(readFileSync(file)).protocol,'hub-binding-roots/1');assert.equal(s.rootCheckpoint('D'),null);
});
test('A8-02 v1 and v2 cannot silently open or migrate one another',t=>{
 const d=directory(t),old=openBindingStore({directory:d,create:true});old.close();const before=readFileSync(join(d,'bindings.json'));err(()=>openBindingStore({directory:d,rootState:true}),'binding_store_invalid');assert.deepEqual(readFileSync(join(d,'bindings.json')),before);const {file}=store(t);err(()=>openBindingStore({directory:join(file,'..')}),'binding_store_invalid');
});
test('A8-03 new binding cannot import an arbitrary root and mapping commit cannot alter root',t=>{
 const {s}=store(t),cp=root(t);const r={...binding,device_id:'E',certificate_sha256:'b'.repeat(64),root_checkpoint:cp};assert.throws(()=>s.register('1',r));const data=s.read();data.bindings.D.root_checkpoint=cp;err(()=>s.commit('1',data),'managed_binding');assert.equal(s.rootCheckpoint('D'),null);
});
test('A8-04 one CAS commits identity and root without changing credential metadata',t=>{
 const {s,file}=store(t),cp=root(t),before=s.record('D');assert.equal(s.commitRoot('1',cp).revision,'2');assert.deepEqual(s.rootCheckpoint('D'),cp);const after=s.record('D');delete before.root_checkpoint;delete after.root_checkpoint;assert.deepEqual(after,before);assert.equal(JSON.parse(readFileSync(file)).content.bindings.D.root_checkpoint.floor_seq,'4');
});
test('A8-05 unchanged root validates under lock but neither rewrites nor increments revision',t=>{
 let writes=0;const {s,file}=store(t,{fault:at=>{if(at==='before_write')writes++;}}),cp=root(t);s.commitRoot('1',cp);const before=readFileSync(file),n=writes;assert.equal(s.commitRoot('2',cp).revision,'2');assert.equal(writes,n);assert.deepEqual(readFileSync(file),before);assert.equal(existsSync(join(file,'..','bindings.write.lock')),false);
});
test('A8-06 durable writes cannot run within a readonly revision scope',t=>{
 const {s}=store(t),cp=root(t);err(()=>s.withReadView(()=>s.commitRoot('1',cp)),'read_view_mutation');assert.equal(s.read().revision,'1');
});
test('A8-07 competing writers keep a single revision and stale CAS cannot replace the root',t=>{
 const {s,d}=store(t),other=openBindingStore({directory:d,rootState:true}),cp=root(t);t.after(()=>other.close());s.commitRoot('1',cp);err(()=>other.commitRoot('1',cp),'revision_conflict');assert.deepEqual(other.rootCheckpoint('D'),cp);
});
test('A8-08 lower floor, conflicting root and wrong binding preserve the original authority',t=>{
 const {s}=store(t),cp=root(t);s.commitRoot('1',cp);for(const change of [c=>{c.floor_seq=c.root.root_seq='3';c.root.active.pop();},c=>c.root.active[0].asset_sha256='b'.repeat(64),c=>c.binding.binding_epoch='2']){const c=clone(cp);change(c);assert.throws(()=>s.commitRoot('2',c));assert.deepEqual(s.rootCheckpoint('D'),cp);}
});
test('A8-09 credential rotate and revoke retain root and revoke blocks new root writes',t=>{
 const {s}=store(t),cp=root(t);s.commitRoot('1',cp);s.rotate('2','D','b'.repeat(64));assert.deepEqual(s.rootCheckpoint('D'),cp);s.revoke('3','D','revoke');assert.deepEqual(s.read().bindings.D.root_checkpoint,cp);err(()=>s.commitRoot('4',cp),'stale_binding');
});
test('A8-10 corrupt, unsafe or redirected authority fails without repairing the file',t=>{
 const {s,d,file}=store(t);s.close();const good=readFileSync(file);writeFileSync(file,'bad');err(()=>openBindingStore({directory:d,rootState:true}),'binding_store_invalid');assert.equal(readFileSync(file,'utf8'),'bad');writeFileSync(file,good);chmodSync(file,0o644);assert.throws(()=>openBindingStore({directory:d,rootState:true}));chmodSync(file,0o600);renameSync(file,file+'.saved');symlinkSync(file+'.saved',file);assert.throws(()=>openBindingStore({directory:d,rootState:true}));
});
test('A8-11 an active root authority detects replay of a previously valid older file',t=>{
 const {s,file}=store(t),old=readFileSync(file),cp=root(t);s.commitRoot('1',cp);writeFileSync(file,old);err(()=>s.read(),'binding_store_rollback');
});
test('A8-12 documented limit: a fresh opener cannot identify a whole-disk valid old-file replay',t=>{
 const {s,d,file}=store(t),old=readFileSync(file);s.commitRoot('1',root(t));s.close();writeFileSync(file,old);const fresh=openBindingStore({directory:d,rootState:true});t.after(()=>fresh.close());assert.equal(fresh.read().revision,'1');assert.equal(fresh.rootCheckpoint('D'),null); // No external durable anchor: not production anti-rollback.
});
test('A8-13 same-revision rehashed content changes are rejected by the live authority',t=>{
 const {s,file}=store(t);rewrite(file,c=>c.bindings.D.mapping.character_id='changed');err(()=>s.read(),'binding_store_rollback');
});
for(const [n,stage,unknown] of [[14,'before_write',false],[15,'before_rename',false],[16,'after_rename',true],[17,'after_sync',true]])test(`A8-${n} ${stage} failure distinguishes old authority from commit_unknown`,t=>{
 let armed=false;const {s,d,file}=store(t,{fault:at=>{if(armed&&at===stage)throw new Error('injected');}}),cp=root(t);armed=true;err(()=>s.commitRoot('1',cp),unknown?'storage_commit_unknown':'storage_failed');assert.equal(s.resources().uncertain,unknown);assert.equal(JSON.parse(readFileSync(file)).content.revision,unknown?'2':'1');s.close();const next=openBindingStore({directory:d,rootState:true});t.after(()=>next.close());assert.equal(next.rootCheckpoint('D')?.floor_seq??null,unknown?'4':null);
});
for(const [n,stage,persisted] of [[18,'before_write',false],[19,'before_rename',false],[20,'after_rename',true],[21,'after_sync',true]])test(`A8-${n} SIGKILL ${stage} leaves a lock and recovers only after proved child exit`,async t=>{
 const {s,d}=store(t),cp=root(t),file=join(d,'checkpoint.json');s.close();writeFileSync(file,JSON.stringify(cp),{mode:0o600});const child=spawn(process.execPath,['tests/fixtures/root-store-crash.mjs',d,stage,file],{stdio:'ignore'});const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});assert.equal(result.signal,'SIGKILL');err(()=>openBindingStore({directory:d,rootState:true}),'binding_store_locked');unlinkSync(join(d,'bindings.write.lock'));const next=openBindingStore({directory:d,rootState:true});t.after(()=>next.close());assert.equal(next.read().revision,persisted?'2':'1');assert.equal(next.rootCheckpoint('D')?.floor_seq??null,persisted?'4':null);
});
test('A8-22 prepared projection is invisible until committed and discard retains the old view',t=>{
 const f=observationFixture();t.after(()=>f.close());f.query('inventory','q');const record=f.inventory('q'),proof=f.attest(record),prepared=f.model.prepareIngest(f.context,record,proof);err(()=>f.model.snapshot(),'root_commit_pending');f.model.discardPrepared(prepared.ticket);assert.equal(f.model.snapshot().devices[0].inventory.known,false);const next=f.model.prepareIngest(f.context,record,proof);f.model.commitPrepared(next.ticket);assert.equal(f.model.snapshot().devices[0].inventory.known,true);f.query('inventory','later');const later=f.inventory('later','2');f.model.prepareIngest(f.context,later,f.attest(later));f.close();assert.equal(f.model.resources().closed,true);
});
test('A8-23 staged projection cannot be committed after its session authority expires',t=>{
 const f=observationFixture();t.after(()=>f.close());f.query('inventory','q');const r=f.inventory('q'),p=f.model.prepareIngest(f.context,r,f.attest(r));f.setSession(false);err(()=>f.model.commitPrepared(p.ticket),'stale_session');assert.equal(f.model.snapshot().devices[0].inventory.known,false);
});
test('A8-24 monotonic admission keeps unqueried commit-object evidence',t=>{
 const f=observationFixture();t.after(()=>f.close());f.query('inventory','q');f.ingest(f.inventory('q'));const target=f.sent(f.command(43));f.model.expectSave(f.context,'op',target);f.ingest(f.storage(target,'op','1','saved','5'));const cp=f.model.rootCheckpoint(),wrong=clone(cp);wrong.floor_commit=null;assert.throws(()=>advanceRootCheckpoint(cp,wrong));assert.deepEqual(advanceRootCheckpoint(cp,cp),cp);
});
async function tls(t,{fault}={}){const lab=await createPullLab(pki,{rootState:true,fault,clock:new VirtualClock()});t.after(()=>lab.close());const c=lab.client();await c.hello();lab.pull.query('inventory',lab.deadline());await c.exchange();const out=clone(c.outgoing);Object.assign(out.record,{known:true,root_seq:'4',root_state:'OFFLINE_READY',active:[0,4,1,11].map((id,i)=>{const a=lab.media.manifest.actions.find(a=>a.id===id);return {action_id:id,asset_sha256:a.sha256,bytes:a.bytes,object_generation:String(i+1)};})});return {lab,c,out};}
test('A8-25 real TLS inventory becomes public only after same-authority durable commit',async t=>{
 const {lab,c,out}=await tls(t);await c.exchange({observation:out});assert.equal(lab.store.rootCheckpoint('D').floor_seq,'4');assert.equal(lab.pull.observations.snapshot().devices[0].inventory.known,true);assert.equal(lab.store.read().revision,'2');
});
for(const [n,stage] of [[26,'before_rename'],[27,'after_rename']])test(`A8-${n} real TLS ${stage} failure never publishes known inventory or next control`,async t=>{
 let armed=false;const {lab,c,out}=await tls(t,{fault:at=>{if(armed&&at===stage)throw new Error('injected');}});armed=true;await assert.rejects(c.exchange({observation:out}));const r=lab.pull.observations.snapshot().devices[0];assert.equal(r.inventory.known,false);assert.equal(r.inventory.root_seq,null);assert.equal(lab.pull.resources().blocked,true);assert.equal(lab.store.resources().uncertain,stage==='after_rename');
});
test('A8-28 a concurrent metadata revision between readonly validation and commit fails closed',async t=>{
 const {lab,c,out}=await tls(t),commit=lab.rootAuthority.commit;lab.rootAuthority.commit=(revision,cp)=>{const data=lab.store.read();data.bindings.D.mapping.character_id='concurrent';lab.store.commit(data.revision,data);return commit(revision,cp);};await assert.rejects(c.exchange({observation:out}));assert.equal(lab.store.rootCheckpoint('D'),null);assert.equal(lab.pull.observations.snapshot().devices[0].inventory.known,false);assert.equal(lab.pull.resources().error,'revision_conflict');const asyncLab=await tls(t);asyncLab.lab.rootAuthority.commit=()=>Promise.reject(new Error('injected async'));await assert.rejects(asyncLab.c.exchange({observation:asyncLab.out}));assert.equal(asyncLab.lab.pull.resources().error,'async_root_authority');assert.equal(asyncLab.lab.store.rootCheckpoint('D'),null);assert.equal(asyncLab.lab.pull.observations.snapshot().devices[0].inventory.known,false);const slow=await tls(t),durable=slow.lab.rootAuthority.commit;slow.lab.rootAuthority.commit=(...args)=>{const result=durable(...args);slow.lab.clock.advance(5000);return result;};await assert.rejects(slow.c.exchange({observation:slow.out}));assert.equal(slow.lab.pull.resources().error,'control_deadline');assert.equal(slow.lab.store.rootCheckpoint('D').floor_seq,'4');assert.equal(slow.lab.pull.observations.snapshot().devices[0].inventory.known,false);
});
test('A8-29 A5 automatically restores persisted model saved evidence without a caller checkpoint file',async t=>{
 const s=await executionLab(t,pki,{rootState:true});await s.manual(43);await s.load();await s.download();await s.verify();await s.frame();await s.save({victim_action_id:1});s.writeAll();await s.commit();assert.equal(s.a.rootCheckpoint().floor_seq,'5');await s.restartHub({checkpoint:null});assert.equal(existsSync(join(s.f.root,'root-checkpoint.json')),false);assert.equal(s.row().inventory.known,false);await s.step();await s.flush();assert.equal(s.row().inventory.root_seq,'5');assert.equal(s.row().storage.length,0);assert.equal(s.row().desired,null);
});
test('A8-30 authority loss is not silently recreated by a new assembly owner',async t=>{
 const f=assemblyFixture(t,pki,{rootState:true}),owner=await f.start();await owner.roundPetAssembly.ready;await owner.close();unlinkSync(join(f.bindingDirectory,'bindings.json'));const next=await f.start();await assert.rejects(next.roundPetAssembly.ready,e=>e.code==='binding_store_missing');assert.equal(existsSync(join(f.bindingDirectory,'bindings.json')),false);
});
test('A8-31 A8 assembly cannot migrate an existing v1 binding file',async t=>{
 const f=assemblyFixture(t,pki),before=readFileSync(join(f.bindingDirectory,'bindings.json')),owner=await f.start({rootPersistence:{profile:'binding-roots-review/1',device_id:'D'}});await assert.rejects(owner.roundPetAssembly.ready,e=>e.code==='binding_store_invalid');assert.deepEqual(readFileSync(join(f.bindingDirectory,'bindings.json')),before);assert.equal(f.power.starts,0);
});
test('A8-32 authority profile is selected once and attach does not create another worker or source',async t=>{
 const f=assemblyFixture(t,pki,{rootState:true}),owner=await f.start();await owner.roundPetAssembly.ready;const attached=await f.start();assert.equal(attached.role,'attached');assert.equal(f.power.starts,1);await assert.rejects(f.start({rootPersistence:null}),/differs/);assert.equal(owner.roundPetAssembly.snapshot().assemblyReview.phase,'disabled');
});
test('A8-33 authority persistence is mutually exclusive with manual checkpoint injection',async t=>{
 const f=assemblyFixture(t,pki,{rootState:true});await assert.rejects(f.start({rootCheckpoint:root(t)}),e=>e.code==='invalid_root_persistence');assert.equal(f.power.starts,0);
});
test('A8-34 readonly service status exposes no authority contents or administrative reset route',async t=>{
 const f=assemblyFixture(t,pki,{rootState:true}),owner=await f.start();await owner.roundPetAssembly.ready;const status=await owner.client.request('GET','/v1/status');assert.equal(status.capabilities.deviceTransport,false);assert.equal(status.assemblyReview.production_listener,false);for(const token of ['root_checkpoint','credential_epoch','floor_seq',f.bindingDirectory])assert.ok(!JSON.stringify(status).includes(token));await assert.rejects(owner.client.request('POST','/v1/recovery/reset',{}),e=>e.status===404);
});
