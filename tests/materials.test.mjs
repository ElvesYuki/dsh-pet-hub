import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialCatalog, MaterialAssignments } from '../packages/core/materials.mjs';
import { capabilities, compatible } from '../packages/core/protocol.mjs';
import { DeviceModel } from '../packages/core/device.mjs';
const sha = 'a'.repeat(64);
const variant = (variant_id, width, height = width, shape = 'circle', character_id = 'whale') => ({character_id,variant_id,sha256:sha,codec:'PET4',license_ref:'synthetic-test-only',display:{width,height,shape,pixel_format:'RGB565'},actions:[{id:0,bytes:100,sha256:sha},{id:11,bytes:200,sha256:sha}]});
const device = (width = 466, height = width, shape = 'circle') => ({schema_version:2,protocols:['hub-device/1'],codecs:['PET4'],firmware_version:'synthetic',board_profile:'synthetic',display:{width,height,shape,pixel_format:'RGB565'},presentation_modes:['exact','center'],cache:{playback_bytes:5865472,persistent:{active_slots:4,staging_slots:1,slot_bytes:5865472}},max_asset_bytes:5865472,max_downloads:1,inputs:['touch'],outputs:['display']});
const catalog = () => new MaterialCatalog([variant('circle_240',240),variant('circle_360',360),variant('rect_320_240',320,240,'rectangle')]);
const rejected = (fn,code) => assert.throws(fn,e => e.code === code);
const confirmation = (device_id = 'A',variant_id = 'circle_360',expected_revision = '0') => ({device_id,expected_revision,character_id:'whale',variant_id,manifest_sha256:sha,required_actions:[0,11]});

test('materials: physical 466 display accepts native 360 centered, never rescales',()=>{
  const caps = capabilities(device()), result = catalog().recommend(caps,'whale',[0,11]);
  assert.equal(result.recommended.manifest.variant_id,'circle_360');
  assert.deepEqual(result.recommended.presentation,{mode:'center',x:53,y:53});
  assert.equal(result.status,'confirmation_required');
});
test('materials: round 240 and rectangular devices select their own variants',()=>{
  assert.equal(catalog().recommend(device(240),'whale').recommended.manifest.variant_id,'circle_240');
  assert.equal(catalog().recommend(device(320,240,'rectangle'),'whale').recommended.manifest.variant_id,'rect_320_240');
  assert.equal(catalog().recommend(device(100),'whale').status,'unsupported');
});
test('materials: exact outranks centered and ties use stable IDs independent of input order',()=>{
  const a=variant('z',360),b=variant('a',360), exact=variant('exact',466);
  assert.equal(new MaterialCatalog([a,b]).recommend(device(),'whale').recommended.manifest.variant_id,'a');
  assert.equal(new MaterialCatalog([b,a,exact]).recommend(device(),'whale').recommended.manifest.variant_id,'exact');
});
test('materials: incompatible mode, geometry, codec, RAM, Flash and missing actions reject',()=>{
  const m=variant('native',360);
  const cases=[c=>{c.presentation_modes=['exact'];},c=>{c.display.shape='rectangle';},c=>{c.display.pixel_format='RGB888';},c=>{c.codecs=['OTHER'];},c=>{c.cache.playback_bytes=199;c.max_asset_bytes=199;},c=>{c.cache.persistent.slot_bytes=199;}];
  for(const change of cases){const c=device();change(c);rejected(()=>catalog().check(c,'whale','circle_360'),'incompatible_asset');}
  rejected(()=>compatible(device(240),m,0),'incompatible_asset');
  rejected(()=>catalog().check(device(),'whale','circle_360',[77]),'unknown_action');
  assert.equal(catalog().recommend(device(),'whale',[77]).status,'unsupported');
});
test('materials: two devices confirm independently; recommendation alone never assigns',()=>{
  const c=catalog(), assignments=new MaterialAssignments(c);
  c.recommend(device(),'whale');assert.equal(assignments.resolve('A',device()).status,'unassigned');
  assignments.confirm(confirmation(),device());
  assignments.confirm(confirmation('B','circle_240'),device(240));
  assert.equal(assignments.resolve('A',device()).manifest.variant_id,'circle_360');
  assert.equal(assignments.resolve('B',device(240)).manifest.variant_id,'circle_240');
  rejected(()=>assignments.confirm(confirmation(),device()),'revision_conflict');
  assignments.confirm(confirmation('A','circle_240','1'),device());
  assert.equal(assignments.resolve('A',device()).manifest.variant_id,'circle_240');
  assert.equal(assignments.snapshot('B').revision,'1');
});
test('materials: capability change preserves selection and marks unsupported, never auto-falls back',()=>{
  const a=new MaterialAssignments(catalog());a.confirm(confirmation(),device());
  const result=a.resolve('A',device(240));assert.equal(result.status,'unsupported');
  assert.equal(result.selection.variant_id,'circle_360');assert.equal(result.revision,'1');
  assert.equal(a.resolve('A',device()).status,'compatible');
});
test('materials: stale catalog hash and failed confirmation leave assignment untouched',()=>{
  const a=new MaterialAssignments(catalog());
  rejected(()=>a.confirm({...confirmation(),manifest_sha256:'b'.repeat(64)},device()),'catalog_changed');
  rejected(()=>a.confirm(confirmation('A','circle_360'),device(240)),'incompatible_asset');
  assert.equal(a.snapshot('A').revision,'0');
});
test('materials: metadata validation and defensive copies prevent ambiguous or mutated catalogs',()=>{
  const m=variant('v',360);
  rejected(()=>new MaterialCatalog([m,m]),'duplicate_variant');
  rejected(()=>new MaterialCatalog([{...m,actions:[m.actions[0],m.actions[0]]}]),'duplicate_action');
  for(const bad of [{...m,license_ref:''},{...m,actions:[]},{...m,display:{...m.display,width:0}},{...m,sha256:'bad'}])rejected(()=>new MaterialCatalog([bad]),'invalid_message');
  const c=new MaterialCatalog([m]);m.actions[0].bytes=99999999;
  const copy=c.get('whale','v');copy.display.width=999;
  assert.equal(c.check(device(),'whale','v').manifest.display.width,360);
  const a=new MaterialAssignments(c);const request={...confirmation('A','v'),required_actions:[0]};a.confirm(request,device());request.required_actions.push(77);
  assert.equal(a.resolve('A',device()).status,'compatible');
});
test('materials: schema2 validates tiers and rejects unknown modes; schema1 keeps exact-only semantics',()=>{
  for(const mutate of [c=>{c.presentation_modes=['scale'];},c=>{c.cache.persistent.staging_slots=0;},c=>{c.max_asset_bytes=c.cache.playback_bytes+1;}]){const c=device();mutate(c);rejected(()=>capabilities(c),'invalid_message');}
  const legacy={...device(240),schema_version:1,cache:{slots:4,slot_bytes:3145728,persistent:false},max_asset_bytes:3145728};delete legacy.presentation_modes;
  assert.equal(compatible(capabilities(legacy),variant('v',240),0).id,0);
  rejected(()=>compatible(legacy,variant('smaller',200),0),'incompatible_asset');
  rejected(()=>new DeviceModel({caps:device()}),'unsupported_cache_model');
});
test('materials: volatile-only device and separate character remain isolated',()=>{
  const caps=device();caps.cache.persistent=null;
  const c=new MaterialCatalog([variant('v',360),variant('v',240,240,'circle','other')]);
  assert.equal(c.recommend(caps,'whale').recommended.manifest.display.width,360);
  assert.equal(c.recommend(device(240),'other').recommended.manifest.character_id,'other');
  assert.equal(c.recommend(caps,'unknown').status,'unsupported');
});
