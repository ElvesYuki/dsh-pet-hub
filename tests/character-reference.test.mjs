import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {crc32} from '../packages/core/pet4.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {pet4Fixture} from './fixtures/pet4.mjs';
import {prepareCharacterReference,referenceGeometry,referencePng} from '../scripts/prepare-character-reference.mjs';

function fixture(run){
 const root=realpathSync(mkdtempSync(join(tmpdir(),'character-reference-'))),source=join(root,'source');mkdirSync(source);
 const bytes=pet4Fixture(360,3),actions=[0,1,4,55,58].map(id=>({id,name:'<img src=x onerror=bad()>',bytes:bytes.length,sha256:sha256(bytes),frames:3,fps:24}));
 for(const a of actions)writeFileSync(join(source,`${a.id}.pet`),bytes);
 const manifest={width:360,height:360,fps:24,safe_diameter:333,actions},save=()=>{const raw=JSON.stringify(manifest);writeFileSync(join(source,'manifest.json'),raw);return sha256(raw);};
 const options={repoRoot:root,sourceDir:source,output:'.cache/reference',licenseRef:'dsh-pet-nc-86181ce',manifestSha256:save()};
 try{return run({root,source,manifest,save,options});}finally{rmSync(root,{recursive:true,force:true});}
}

test('reference: PNG preserves native RGB565 colors, opaque black, dimensions and chunk integrity',()=>{
 const pixels=Buffer.alloc(360*360*2);pixels.writeUInt16LE(0xf800,0);pixels.writeUInt16LE(0x07e0,2);pixels.writeUInt16LE(0x001f,4);
 const png=referencePng(pixels),parts=[];let p=8;
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 while(p<png.length){const n=png.readUInt32BE(p),name=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);assert.equal(png.readUInt32BE(p+8+n),crc32(png.subarray(p+4,p+8+n)));if(name==='IDAT')parts.push(data);if(name==='IHDR'){assert.equal(data.readUInt32BE(0),360);assert.equal(data.readUInt32BE(4),360);assert.equal(data[9],6);}p+=n+12;}
 const raw=inflateSync(Buffer.concat(parts));assert.equal(raw.length,360*1441);assert.deepEqual([...raw.subarray(1,17)],[255,0,0,255,0,255,0,255,0,0,255,255,0,0,0,255]);
 for(let y=0;y<360;y++)assert.equal(raw[y*1441],0);
 assert.throws(()=>referencePng(Buffer.alloc(10)),/invalid_reference_pixels/);
});

test('reference: isolated native-size export escapes labels, avoids source paths and never overwrites',()=>fixture(({root,options})=>{
 const result=prepareCharacterReference(options),dir=join(root,'.cache/reference'),html=readFileSync(join(dir,'index.html'),'utf8');
 assert.equal(result.records.length,15);assert.deepEqual(result.records.filter(r=>r.action_id===0).map(r=>r.frame_index),[0,1,2]);
 assert.ok(html.includes('&lt;img src=x onerror=bad()&gt;'));assert.ok(!html.includes('<img src=x onerror=bad()>'));assert.ok(html.includes('left:53px;top:53px'));assert.ok(!JSON.stringify(result).includes(root));
 const before=readFileSync(join(dir,'reference.json'));assert.throws(()=>prepareCharacterReference(options),/reference_output_exists/);assert.deepEqual(readFileSync(join(dir,'reference.json')),before);
 assert.equal(referenceGeometry.display_offset*2+referenceGeometry.content_size,referenceGeometry.display_size);
 const draft=JSON.parse(readFileSync(new URL('../docs/art/character-authoring-template.json',import.meta.url)));assert.deepEqual(draft.coordinates.display_offset,[53,53]);assert.equal(draft.coordinates.safe_circle.radius,referenceGeometry.safe_diameter/2);
}));

test('reference: digest, licensing, dimensions, source symlinks and sampled CRC failures publish nothing',()=>fixture(({root,source,manifest,save,options})=>{
 const empty=()=>assert.equal(existsSync(join(root,'.cache/reference')),false);
 assert.throws(()=>prepareCharacterReference({...options,manifestSha256:'0'.repeat(64)}),/source_manifest_changed/);empty();
 assert.throws(()=>prepareCharacterReference({...options,licenseRef:'MIT'}),/unapproved_reference_license/);empty();
 manifest.width=240;assert.throws(()=>prepareCharacterReference({...options,manifestSha256:save()}),/unsupported_reference_profile/);empty();manifest.width=360;options.manifestSha256=save();
 const asset=join(source,'0.pet'),bytes=readFileSync(asset);bytes[532+4*4]^=1;writeFileSync(asset,bytes);assert.throws(()=>prepareCharacterReference(options),/source_asset_changed/);empty();
 manifest.actions[0].sha256=sha256(bytes);options.manifestSha256=save();assert.throws(()=>prepareCharacterReference(options));empty();
 rmSync(asset);symlinkSync(join(source,'1.pet'),asset);assert.throws(()=>prepareCharacterReference(options),/unsafe_asset_path/);empty();
}));

test('reference: refuses outside-cache output and symlinked output ancestors',()=>fixture(({root,options})=>{
 for(const output of ['reference','.cache','../escape','.cache/../../escape'])assert.throws(()=>prepareCharacterReference({...options,output}),/reference_output_must_be_in_repo_cache/);
 const other=join(root,'other');mkdirSync(other);symlinkSync(other,join(root,'.cache'));
 assert.throws(()=>prepareCharacterReference(options),/unsafe_reference_output/);assert.equal(existsSync(join(other,'reference')),false);
}));
