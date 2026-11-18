import test from 'node:test';
import assert from 'node:assert/strict';
import {Pet4Decoder,decodeLz4,crc32} from '../packages/core/pet4.mjs';
import {inspectPet4,verifyMaterial,importMaterials,sha256} from '../packages/runtime/material-import.mjs';
import {pet4Fixture} from './fixtures/pet4.mjs';
import {MaterialPlayback} from '../packages/core/material-playback.mjs';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const rejects=fn=>assert.throws(fn);
test('PET4: independent CRC vector, LZ4 literals and overlap, bounded malformed input',()=>{
 assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
 assert.deepEqual([...decodeLz4(Uint8Array.from([0x50,1,2,3,4,5]),5)],[1,2,3,4,5]);
 const overlap=Uint8Array.from([0x1f,7,1,0,0,0x50,7,7,7,7,7]);assert.deepEqual([...decodeLz4(overlap,25)],Array(25).fill(7));
 for(const b of [[0xf0],[0x50,1],[0,0,0],[0x10,1,2,0],[0x1f,1,1,0,255],[0x10,1,1,0]])rejects(()=>decodeLz4(Uint8Array.from(b),25));
});
test('PET4: all-frame decode, RGB palette, random keyframe seeks and variable duration',()=>{
 for(const [size,count] of [[240,1],[240,13],[360,3]]){
  const bytes=pet4Fixture(size,count),d=new Pet4Decoder(bytes);const proof=inspectPet4(bytes);assert.equal(proof.frames,count);assert.equal(proof.fps,24);
  for(const i of [count-1,0,Math.min(1,count-1),count-1]){const f=d.decode(i);assert.equal(f.indices.length,size*size);assert.ok(f.indices.every(b=>b===i));assert.equal(f.rgb565[0],i);assert.equal(f.rgb565[1],0);}
  rejects(()=>d.decode(count));rejects(()=>d.decode(-1));
 }
});
test('PET4: strict header, tables, tags, tiles and CRC reject without trusting SHA alone',()=>{
 const source=pet4Fixture(240,13),base=532+4*27;
 const mutate=[b=>b[0]=0,b=>b.writeUInt16LE(0,10),b=>b.writeUInt16LE(25,8),b=>b[12]^=1,b=>b.writeUInt32LE(1,532),b=>b.writeUInt32LE(0,536),b=>b[base]=1,b=>b.writeUInt16LE(0,base+1),b=>b.writeUInt16LE(65535,base+1),b=>b[532+4*14]^=1,b=>b[base+4]^=1];
 for(const change of mutate){const b=Buffer.from(source);change(b);rejects(()=>inspectPet4(b));}
 rejects(()=>inspectPet4(source.subarray(0,source.length-1)));rejects(()=>inspectPet4(Buffer.concat([source,Buffer.from([0])])));
});
test('PET4: real codec import validates all frames and geometry, keeping per-device decoded-frame clocks',()=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'pet4-')));
 try{
  const bytes=pet4Fixture(240,3),action={id:0,bytes:bytes.length,sha256:sha256(bytes)},m={character_id:'original',variant_id:'pet4_240',codec:'PET4',license_ref:'original-MIT',display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},actions:[action]};
  writeFileSync(join(root,'0.pet'),bytes);const index=JSON.stringify({schemaVersion:1,variants:[{manifest:m,files:[{action_id:0,path:'0.pet'}]}]});writeFileSync(join(root,'index.json'),index);
  const bundle=importMaterials({directory:root,indexSha256:sha256(index),approvedLicenses:['original-MIT']});assert.equal(bundle.manifests[0].codec,'PET4');
  let now=0;const selected={status:'compatible',revision:'1',manifest:bundle.manifests[0],caps:{schema_version:1,display:m.display,codecs:['PET4'],max_asset_bytes:3145728},presentation:{mode:'exact',x:0,y:0}};
  const p=new MaterialPlayback({clock:{now:()=>now},resolve:()=>selected,readAsset:h=>bundle.readAsset(h),verifyAsset:verifyMaterial,hasAsset:h=>bundle.hasAsset(h)}),ctx={online:true,session:'s',actionId:0,intentRevision:'0'};
  p.tick('A',ctx);now=400;p.tick('A',ctx);assert.equal(p.snapshot('A').actual.decoded_frame.frame_index,0);
  now=450;p.tick('A',ctx);const a=p.snapshot('A').actual.decoded_frame;assert.equal(a.frame_index,1);
  p.tick('B',ctx);now=525;p.tick('A',ctx);assert.equal(p.snapshot('A').actual.decoded_frame.frame_index,0);assert.equal(p.snapshot('B').actual,null);
  rejects(()=>verifyMaterial(bytes,action,{...m,display:{...m.display,width:360}}));
  const broken=Buffer.from(bytes);broken[532+4*4]^=1;assert.equal(verifyMaterial(broken,action,m),false);
  rejects(()=>verifyMaterial(broken,{...action,sha256:sha256(broken)},m));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('PET4: failing first frame must not commit a new actual target',()=>{
 let now=0,revision='1',fail=false;const manifest={codec:'PET4',character_id:'c',variant_id:'v',sha256:'a'.repeat(64),display:{width:240,height:240,shape:'circle',pixel_format:'RGB565'},actions:[{id:0,bytes:18,sha256:'a'.repeat(64)}]};
 const p=new MaterialPlayback({clock:{now:()=>now},resolve:()=>({status:'compatible',revision,manifest,caps:{schema_version:1,codecs:['PET4'],display:manifest.display,max_asset_bytes:100}}),readAsset:()=>new Uint8Array(18),verifyAsset:()=>({fps:24,frames:1,frame(){if(fail)throw new Error('render');return {frame_index:0};}})}),ctx={online:true,session:'s',actionId:0,intentRevision:'0'};
 p.tick('A',ctx);now=400;p.tick('A',ctx);const previous=p.snapshot('A').actual;fail=true;revision='2';p.tick('A',ctx);now=800;p.tick('A',ctx);assert.equal(p.snapshot('A').phase,'failed');assert.deepEqual(p.snapshot('A').actual,previous);
});
