import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,realpathSync,existsSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deflateSync} from 'node:zlib';
import {crc32} from '../packages/core/pet4.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
import {registerCharacter,registrationSvg} from '../scripts/character-registration.mjs';
import {inspectCharacterBase,exportCharacterBase} from '../scripts/export-character-base.mjs';

// Original geometric RGBA fixture, independent of upstream character artwork.
function png(side=360,box=[70,50,281,315],filter=0,opacity=255){
 const chunk=(name,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;};
 const h=Buffer.alloc(13);h.writeUInt32BE(side);h.writeUInt32BE(side,4);h[8]=8;h[9]=6;
 const stride=side*4,raw=Buffer.alloc(side*(stride+1));let prev=Buffer.alloc(stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<side;y++){
  const row=Buffer.alloc(stride);if(y>=box[1]&&y<box[3])for(let x=box[0];x<box[2];x++){row[x*4]=64;row[x*4+1]=128;row[x*4+2]=192;row[x*4+3]=opacity;}
  raw[y*(stride+1)]=filter;
  for(let i=0;i<stride;i++){const a=i>=4?row[i-4]:0,b=prev[i],c=i>=4?prev[i-4]:0,p=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);raw[y*(stride+1)+i+1]=(row[i]-p)&255;}
  prev=row;
 }
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
async function fixture(run){
 const root=realpathSync(mkdtempSync(join(tmpdir(),'character-base-'))),source=join(root,'source'),registered=join(root,'registered');mkdirSync(source);mkdirSync(registered);
 const image=png(1254,[240,142,1021,1123]),registration=registerCharacter([240,142,1021,1123],[70,50,281,315]);
 writeFileSync(join(source,'neutral-v1.png'),image);writeFileSync(join(registered,'registration.json'),JSON.stringify({registration}));writeFileSync(join(registered,'registered.svg'),registrationSvg(image.toString('base64'),[1254,1254],registration));
 const options={sourceDir:source,registrationDir:registered,sourceSha256:sha256(image),repoRoot:root,output:'.cache/base',rendererVersion:'original-fixture',renderSvg:async()=>png()};
 try{return await run({root,source,registered,options});}finally{rmSync(root,{recursive:true,force:true});}
}

test('base PNG: all standard row filters preserve measured alpha bounds; invalid size, opacity, crop and CRC rejected',()=>{
 for(let filter=0;filter<=4;filter++){const r=inspectCharacterBase(png(360,[70,50,281,315],filter));assert.deepEqual(r.alpha16_bounds,[70,50,281,315]);assert.equal(r.max_pixel_edge_error,0);}
 assert.deepEqual(inspectCharacterBase(png(360,[70,50,281,315],0,254)).alpha_range,[0,254]);
 assert.throws(()=>inspectCharacterBase(png(359)),/size/);assert.throws(()=>inspectCharacterBase(png(360,[0,0,360,360])),/transparency/);assert.throws(()=>inspectCharacterBase(png(360,[0,0,100,100])),/registration/);
 const broken=png();broken[45]^=1;assert.throws(()=>inspectCharacterBase(broken),/crc/);
});

test('base export: freezes selected source and exact SVG, outputs native static base with no runtime-ready claim',()=>fixture(async({root,options})=>{
 let calls=0;const result=await exportCharacterBase({...options,renderSvg:async svg=>{calls++;assert.ok(svg.toString().includes('width="360" height="360"'));return png();}});
 assert.equal(calls,1);assert.equal(result.source_sha256,options.sourceSha256);assert.deepEqual(result.registration.display_offset,[53,53]);assert.equal(result.review.device_verified,false);assert.equal(result.review.layers_verified,false);
 assert.equal(result.output_sha256,sha256(readFileSync(join(root,'.cache/base/neutral-360.png'))));
 const saved=readFileSync(join(root,'.cache/base/manifest.json'));await assert.rejects(exportCharacterBase(options),/base_output_exists/);assert.deepEqual(readFileSync(join(root,'.cache/base/manifest.json')),saved);
}));

test('base export: changed source, matrix or embedded SVG rejected before calling renderer',()=>fixture(async({root,registered,options})=>{
 let calls=0;options.renderSvg=async()=>{calls++;return png();};
 await assert.rejects(exportCharacterBase({...options,sourceSha256:'0'.repeat(64)}),/source_image_changed/);
 const proof=readFileSync(join(registered,'registration.json'));const p=JSON.parse(proof);p.registration.matrix[4]+=1;writeFileSync(join(registered,'registration.json'),JSON.stringify(p));await assert.rejects(exportCharacterBase(options),/registration_changed/);writeFileSync(join(registered,'registration.json'),proof);
 writeFileSync(join(registered,'registered.svg'),'<svg/>');await assert.rejects(exportCharacterBase(options),/embedded_source_changed/);
 assert.equal(calls,0);assert.equal(existsSync(join(root,'.cache/base')),false);
}));

test('base export: renderer failure/invalid output and unsafe destinations do not publish a directory',()=>fixture(async({root,options})=>{
 await assert.rejects(exportCharacterBase({...options,renderSvg:async()=>{throw new Error('renderer_failed');}}),/renderer_failed/);
 await assert.rejects(exportCharacterBase({...options,renderSvg:async()=>png(359)}),/size/);assert.equal(existsSync(join(root,'.cache/base')),false);
 await assert.rejects(exportCharacterBase({...options,output:'../outside'}),/in_repo_cache/);
 mkdirSync(join(root,'other'));symlinkSync(join(root,'other'),join(root,'.cache'));await assert.rejects(exportCharacterBase(options),/unsafe_base_output/);assert.equal(existsSync(join(root,'other/base')),false);
}));
