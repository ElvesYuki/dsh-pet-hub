import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,mkdirSync,rmSync,readFileSync,writeFileSync,readdirSync,existsSync,appendFileSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {Worker} from 'node:worker_threads';
import {roundPetCanonical as C,parseRoundPetJson,roundPetMetadata,ROUND_PET_NAMESPACE_TEXT} from '../packages/core/round-pet-identity.mjs';
import {sha256,manifestDigest} from '../packages/runtime/material-import.mjs';
import {createRoundPetImport} from '../packages/runtime/round-pet-import.mjs';
import {readRoundPetSource,roundPetRecord,roundPetFromRecord} from '../packages/runtime/round-pet-material.mjs';
import {createStoreLifecycle} from '../packages/runtime/store-lifecycle.mjs';
import {roundPetImportFixture} from '../packages/simulator/round-pet-import-fixture.mjs';
import {NATIVE360} from '../packages/core/native360-profile.mjs';

const golden=JSON.parse(readFileSync(new URL('../docs/protocol/vectors/round-pet-g0-identity-v1.json',import.meta.url))),clone=structuredClone;
function fixture(t,options){const root=realpathSync(mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'a2-')));t.after(()=>rmSync(root,{recursive:true,force:true}));const runtime=join(root,'runtime');mkdirSync(runtime,{mode:0o700});return Object.assign(roundPetImportFixture(join(root,'source'),options),{root,runtime});}
function metadata(f,changes={}){return roundPetMetadata({package:f.pkg,catalog:f.catalog,approval:f.approval,sourceSha256:f.approval.source_manifest_sha256,hash:sha256,...changes});}
function start(t,f,options={},dependencies={}){const s=createRoundPetImport(f.runtime,{sourceDirectory:f.directory,approval:f.approval,...options},dependencies);t.after(()=>s.close());return s;}
const code=(fn,value)=>assert.throws(fn,e=>e.code===value);
async function rejected(s,value){await assert.rejects(s.ready,e=>!value||e.code===value);await s.close();assert.equal(s.snapshot().worker_alive,false);assert.equal(s.snapshot().pending_requests,0);}
function noPublished(f){const dir=join(f.runtime,'material-store');assert.deepEqual(existsSync(dir)?readdirSync(dir):[],[]);assert.equal(existsSync(join(f.runtime,'round-pet-provenance')),false);}
function cached(f,I){return {cachedOnly:true,indexSha256:I,approval:f.approval};}
function ledger(f,I){return join(f.runtime,'round-pet-provenance',I+'.json');}

test('A2-01 G0 golden P/M/N/F/I and negative recipe hashes remain exact',()=>{
 assert.equal(sha256(C(golden.source_package.content)),golden.expected.firmware_package_sha256);
 assert.equal(manifestDigest(golden.hub_manifest_input),golden.expected.hub_manifest_sha256);
 assert.equal(sha256(ROUND_PET_NAMESPACE_TEXT),golden.expected.namespace_sha256);
 for(const a of golden.asset_generators)assert.equal(sha256(Buffer.alloc(a.bytes,a.repeated_byte)),a.expected_file_sha256);
 assert.equal(sha256(JSON.stringify(golden.index_object,null,2)+'\n'),golden.expected.index_file_sha256);
 const reversed=clone(golden.source_package.content);reversed.catalog.actions.reverse();assert.equal(sha256(C(reversed)),golden.negative_vectors.reversed_catalog_actions.canonical_package_sha256);
 const timing=clone(golden.source_package.content);timing.timing[0].frames=240;assert.equal(sha256(C(timing)),golden.negative_vectors.timing_241_to_240.canonical_package_sha256);
});
test('A2-02 canonical object order is irrelevant while array order and timing change identity',()=>{
 assert.equal(C({z:[1,2],a:'中文'}),C({a:'中文',z:[1,2]}));assert.notEqual(C({z:[1,2]}),C({z:[2,1]}));
 const c=clone(golden.source_package.content),M=sha256(C(c.catalog));c.timing[0].frames=240;assert.equal(sha256(C(c.catalog)),M);assert.notEqual(sha256(C(c)),golden.expected.firmware_package_sha256);
});
test('A2-03 Unicode is scalar UTF8 without NFC or trimming',()=>{
 assert.equal(C({license:'鲸鱼🐳'}),'{"license":"鲸鱼🐳"}');assert.notEqual(C({x:'é'}),C({x:'e\u0301'}));assert.notEqual(C({x:' a '}),C({x:'a'}));
 for(const value of ['\ud800','\udc00','x\ud800y'])code(()=>C({x:value}),'invalid_round_pet_json');
});
test('A2-04 strict parser refuses duplicates, numeric aliases, invalid UTF8/BOM and resource excess',()=>{
 for(const raw of ['{"a":1,"\\u0061":2}','{"a":1.0}','{"a":1e0}','{"a":-0}','{"a":9007199254740992}','{"a":"\\ud800"}','{"a":1,"unknown":NaN}','\ufeff{}','['.repeat(18)+'0'+']'.repeat(18)])code(()=>parseRoundPetJson(Buffer.from(raw)),'invalid_round_pet_json');
 code(()=>parseRoundPetJson(Buffer.from([0xff])),'invalid_round_pet_json');code(()=>parseRoundPetJson(Buffer.alloc(262145)),'invalid_round_pet_json');
 assert.equal(parseRoundPetJson(Buffer.from('{"x":241}')).x,241);
});
test('A2-05 dedicated metadata maps P to M without changing F or adding PC package fields',t=>{
 const f=fixture(t),m=metadata(f);assert.notEqual(m.identity.firmware_package_sha256,m.manifest.sha256);assert.equal(m.manifest.sha256,manifestDigest(f.content.catalog));assert.equal(m.manifest.actions.length,46);assert.equal(m.manifest.package_schema,undefined);assert.equal(m.index.variants[0].manifest.sha256,undefined);assert.equal(m.indexSha256,sha256(m.indexText));assert.equal(m.index.variants[0].files[1].path,'1.pet');assert.equal(m.identity.namespace,NATIVE360.namespace);
});
test('A2-06 F/M/P/N swaps and wrong pinned digests cannot authorize an import',t=>{
 const f=fixture(t);for(const [key,value] of [['firmware_package_sha256',f.F],['hub_manifest_sha256',f.pkg.sha256],['namespace',f.pkg.sha256]]){const a={...f.approval,[key]:value};assert.throws(()=>metadata(f,{approval:a}));}
 code(()=>metadata(f,{package:{...f.pkg,sha256:metadata(f).manifest.sha256}}),'package_integrity_failed');
});
test('A2-07 absent approval, missing credits and mismatched license are refused before storage',t=>{
 const f=fixture(t);assert.throws(()=>createRoundPetImport(f.runtime,{sourceDirectory:f.directory}));for(const a of [{...f.approval,credits:[]},{...f.approval,license_ref:'invented'},{...f.approval,usage:'commercial'}])assert.throws(()=>start(t,f,{approval:a}));noPublished(f);
});
test('A2-08 selected source manifest raw bytes must match independently approved SHA',t=>{
 const f=fixture(t);appendFileSync(join(f.directory,'manifest.json'),' ');code(()=>start(t,f),'source_manifest_changed');noPublished(f);
});
test('A2-09 exported catalog must be exactly package catalog plus P, never M',t=>{
 const f=fixture(t);code(()=>metadata(f,{catalog:{...f.catalog,sha256:metadata(f).manifest.sha256}}),'export_catalog_mismatch');code(()=>metadata(f,{catalog:{...f.catalog,license_ref:'different'}}),'export_catalog_mismatch');
});
test('A2-10 closed package/profile schema and recipe reject unknown or missing fields',t=>{
 const f=fixture(t);for(const pkg of [{...f.pkg,extra:1},{...f.pkg,hash_recipe:'other'},{...f.pkg,content:{...f.content,extra:1}}])assert.throws(()=>metadata(f,{package:pkg}));
 delete f.content.media_profile.tile_rows;f.commit();assert.throws(()=>metadata(f));
});
test('A2-11 real ID set is independently pinned, ascending and complete, not auto-sorted',t=>{
 const f=fixture(t);f.content.catalog.actions.reverse();f.commit();code(()=>metadata(f),'round_pet_action_set');f.content.catalog.actions.reverse();f.content.catalog.actions[1].id=0;f.commit();assert.throws(()=>metadata(f));
 const a={...f.approval,action_ids:f.approval.action_ids.slice(1)};code(()=>metadata(f,{approval:a}),'round_pet_action_set');
});
test('A2-12 fixed semantics and minimal catalog cannot accept PC once policies',t=>{
 const f=fixture(t);f.content.semantics.working=0;f.commit();code(()=>metadata(f),'round_pet_semantics');f.content.semantics.working=11;f.content.catalog.package_schema=2;f.commit();assert.throws(()=>metadata(f));
});
test('A2-13 metadata cannot widen F241, fixed media profile or 360 geometry',t=>{
 const f=fixture(t);f.content.timing[0].frames=240;f.commit();code(()=>metadata(f),'timing_mismatch');f.content.timing[0].frames=241;f.content.media_profile.key_interval=1;f.commit();code(()=>metadata(f),'incompatible_asset');f.content.media_profile.key_interval=12;f.content.catalog.display.width=240;f.commit();code(()=>metadata(f),'incompatible_asset');
});
test('A2-14 original real 46-description PET4 import publishes old-schema CAS plus provenance',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,state=s.snapshot(),I=b.identity.index_sha256;assert.equal(state.phase,'ready');assert.equal(state.validated_assets,46);assert.equal(state.validated_frames,46*241);assert.equal(state.retained_library_bytes,0);assert.equal(state.peak_asset_bytes,f.bytes.length);
 const record=JSON.parse(readFileSync(ledger(f,I)));assert.deepEqual(record.identity,b.identity);assert.equal(record.package.sha256,f.pkg.sha256);assert.equal(record.approval.source_kind,'original-test');
 const index=readFileSync(join(f.runtime,'material-store',I,'index.json'));assert.equal(sha256(index),I);assert.deepEqual(Object.keys(JSON.parse(index)),['schemaVersion','variants']);assert.ok(!JSON.stringify(record).includes(f.root));assert.ok(!JSON.stringify(state).includes(f.root));
 b.provenance.identity.namespace='changed';b.identity.namespace='changed';assert.equal(s.snapshot().identity.namespace,NATIVE360.namespace);assert.equal(JSON.parse(readFileSync(ledger(f,I))).identity.namespace,NATIVE360.namespace);
 await s.close();assert.equal(s.snapshot().worker_alive,false);assert.equal(existsSync(ledger(f,I)),true);
});
test('A2-15 cachedOnly reopens without source and revalidates bytes before on-demand playback',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,I=b.identity.index_sha256;await s.close();rmSync(f.directory,{recursive:true});const again=start(t,f,cached(f,I)),bundle=await again.ready,m=bundle.manifests[0];assert.deepEqual(bundle.identity,b.identity);const p=await bundle.prepare('a2_preview',m.actions[0],m);assert.equal(p.frames,241);assert.equal((await p.frame(0)).width,360);await bundle.release('a2_preview');assert.equal(again.snapshot().decoder_count,0);
});
test('A2-16 ledger cannot supply its own approval on reopen',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready;await s.close();const a={...f.approval,approval_id:'different-review'};code(()=>start(t,f,{...cached(f,b.identity.index_sha256),approval:a}),'round_pet_approval_required');
});
test('A2-17 altered package with old P is rejected without creating CAS or a stage',t=>{
 const f=fixture(t);f.pkg.content.timing[0].index_sha256='a'.repeat(64);writeFileSync(join(f.directory,'package.json'),JSON.stringify(f.pkg));code(()=>start(t,f),'package_integrity_failed');noPublished(f);
});
test('A2-18 fake bytes with matching F and valid metadata still fail real PET4 admission',async t=>{
 const f=fixture(t),bad=Buffer.alloc(544);for(const a of f.content.catalog.actions){a.bytes=bad.length;a.sha256=sha256(bad);writeFileSync(join(f.directory,`${a.id}.pet`),bad);}f.commit();const s=start(t,f);await rejected(s,'incompatible_asset');noPublished(f);
});
test('A2-19 actual 240 frames cannot masquerade as approved 241 timing',async t=>{
 const f=fixture(t,{frames:240}),s=start(t,f);await rejected(s,'incompatible_asset');noPublished(f);
});
test('A2-20 full CRC success is insufficient when concatenated index SHA mismatches P',async t=>{
 const f=fixture(t);f.content.timing.at(-1).index_sha256='a'.repeat(64);f.commit();const s=start(t,f);await rejected(s,'timing_mismatch');noPublished(f);
});
test('A2-21 final-frame CRC is checked even when file F and P are recomputed',async t=>{
 const f=fixture(t),bad=Buffer.from(f.bytes);bad.writeUInt32LE(0,532+4*(241+1+240));for(const a of f.content.catalog.actions){a.sha256=sha256(bad);writeFileSync(join(f.directory,`${a.id}.pet`),bad);}f.commit();const s=start(t,f);await rejected(s,'pet4_frame_crc');noPublished(f);
});
test('A2-22 deduplicated F does not skip verification of later source file bytes',async t=>{
 const f=fixture(t);writeFileSync(join(f.directory,'77.pet'),Buffer.alloc(f.bytes.length));const s=start(t,f);await rejected(s,'asset_integrity_failed');noPublished(f);
});
test('A2-23 cached reimport still checks each selected source file, preserving valid CAS',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready;await s.close();writeFileSync(join(f.directory,'77.pet'),Buffer.alloc(f.bytes.length));const again=start(t,f);await rejected(again,'asset_integrity_failed');assert.equal(existsSync(ledger(f,b.identity.index_sha256)),true);assert.equal(existsSync(join(f.runtime,'material-store',b.identity.index_sha256)),true);
});
test('A2-24 worker rechecks source metadata after main-thread preflight',async t=>{
 const f=fixture(t),s=start(t,f,{}, {storeOptions:{workerFactory(url,args){appendFileSync(join(f.directory,'manifest.json'),' ');return new Worker(url,args);}}});await rejected(s,'source_manifest_changed');noPublished(f);
});
test('A2-25 existing lifecycle quota rejects before asset copy and releases reservations',async t=>{
 const f=fixture(t),lifecycle=createStoreLifecycle(f.runtime,{quotaBytes:128}),s=start(t,f,{}, {lifecycle});await rejected(s,'quota_exceeded');assert.equal((await lifecycle.list()).reserved_bytes,0);noPublished(f);
});
test('A2-26 closing a pending import rejects ready and cleans owned stages/worker',async t=>{
 const f=fixture(t),s=start(t,f);await s.close();await assert.rejects(s.ready);assert.equal(s.snapshot().worker_alive,false);assert.equal(s.snapshot().provenance_published,false);await s.close();noPublished(f);
});
test('A2-27 corrupted cached blob fails closed without repair or overwriting bytes',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,I=b.identity.index_sha256;await s.close();const path=join(f.runtime,'material-store',I,'blobs',f.F);writeFileSync(path,'bad');const again=start(t,f,cached(f,I));await rejected(again);assert.equal(readFileSync(path,'utf8'),'bad');assert.equal(existsSync(ledger(f,I)),true);
});
test('A2-28 corrupt ledger is preserved and cannot be silently regenerated on reopen',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,I=b.identity.index_sha256;await s.close();writeFileSync(ledger(f,I),'bad');assert.throws(()=>start(t,f,cached(f,I)));assert.equal(readFileSync(ledger(f,I),'utf8'),'bad');
});
test('A2-29 provenance publication failure does not report ready or remove valid CAS',async t=>{
 const f=fixture(t),s=start(t,f,{}, {publish(){throw Object.assign(new Error('disk'),{code:'disk_full'});}});await rejected(s,'disk_full');assert.equal(s.snapshot().phase,'failed');assert.equal(s.snapshot().provenance_published,false);const I=metadata(f).indexSha256;assert.deepEqual(readdirSync(join(f.runtime,'material-store')),[I]);assert.equal(existsSync(ledger(f,I)),false);assert.throws(()=>start(t,f,cached(f,I)));
});
test('A2-30 reimport is idempotent but cannot overwrite conflicting provenance',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,I=b.identity.index_sha256;await s.close();const raw=readFileSync(ledger(f,I)),again=start(t,f);await again.ready;await again.close();assert.deepEqual(readFileSync(ledger(f,I)),raw);writeFileSync(ledger(f,I),'conflict');const conflict=start(t,f);await rejected(conflict,'round_pet_provenance_conflict');assert.equal(readFileSync(ledger(f,I),'utf8'),'conflict');assert.deepEqual(readdirSync(join(f.runtime,'round-pet-provenance')),[I+'.json']);
});
test('A2-31 bounded provenance refuses unknown entries without deleting them',async t=>{
 const f=fixture(t),dir=join(f.runtime,'round-pet-provenance');mkdirSync(dir,{mode:0o700});writeFileSync(join(dir,'unknown'),'keep',{mode:0o600});const s=start(t,f);await rejected(s,'round_pet_provenance_limit');assert.equal(readFileSync(join(dir,'unknown'),'utf8'),'keep');
 rmSync(join(dir,'unknown'));for(let i=0;i<32;i++)writeFileSync(join(dir,i.toString(16).padStart(64,'0')+'.json'),'{}',{mode:0o600});const full=start(t,f);await rejected(full,'round_pet_provenance_limit');assert.equal(readdirSync(dir).length,32);
 for(const file of readdirSync(dir))rmSync(join(dir,file));writeFileSync(join(dir,'0'.repeat(64)+'.json'),Buffer.alloc(262145),{mode:0o600});const large=start(t,f);await rejected(large,'round_pet_provenance_limit');assert.equal(readFileSync(join(dir,'0'.repeat(64)+'.json')).length,262145);
});
test('A2-32 catalog pin protects CAS while active and is released after close',async t=>{
 const f=fixture(t),lifecycle=createStoreLifecycle(f.runtime),s=start(t,f,{}, {lifecycle});await s.ready;const held=await lifecycle.list();assert.ok(held.entries[0].reasons.includes('active_catalog'));await assert.rejects(lifecycle.cleanup({expected_revision:held.revision,entry_ids:[held.entries[0].entry_id]}),e=>e.code==='protected_version');await s.close();const free=await lifecycle.list();assert.equal(free.entries[0].protected,false);
});
test('A2-33 player preparation revalidates CAS after import; no preview success on corruption',async t=>{
 const f=fixture(t),s=start(t,f),b=await s.ready,m=b.manifests[0];writeFileSync(join(f.runtime,'material-store',b.identity.index_sha256,'blobs',f.F),'bad');await assert.rejects(b.prepare('a2_preview',m.actions[0],m));assert.equal(s.snapshot().decoder_count,0);
});
test('A2-34 provenance identity and pinned I cannot be changed independently of its package',t=>{
 const f=fixture(t),m=metadata(f),r=roundPetRecord(m);r.identity.namespace='a'.repeat(64);code(()=>roundPetFromRecord(r,f.approval),'invalid_round_pet_provenance');r.identity.namespace=NATIVE360.namespace;r.identity.index_sha256='b'.repeat(64);code(()=>roundPetFromRecord(r,f.approval),'invalid_round_pet_provenance');
});
test('A2-35 source root, metadata and later asset symlinks cannot redirect reads',async t=>{
 const f=fixture(t),alias=join(f.root,'alias');symlinkSync(f.directory,alias);assert.throws(()=>start(t,f,{sourceDirectory:alias}));const pkg=readFileSync(join(f.directory,'package.json'));rmSync(join(f.directory,'package.json'));writeFileSync(join(f.root,'outside.json'),pkg);symlinkSync(join(f.root,'outside.json'),join(f.directory,'package.json'));assert.throws(()=>start(t,f));rmSync(join(f.directory,'package.json'));writeFileSync(join(f.directory,'package.json'),pkg);rmSync(join(f.directory,'77.pet'));symlinkSync(join(f.directory,'0.pet'),join(f.directory,'77.pet'));const s=start(t,f);await rejected(s,'unsafe_asset_path');noPublished(f);
});
