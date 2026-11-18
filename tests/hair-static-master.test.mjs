import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHairLayout,splitHairPixels,reconstructHairPixels,insideHairPolygon,completeHiddenHairPixels} from '../scripts/hair-static-master.mjs';
const layout=()=>JSON.parse(readFileSync(new URL('../docs/art/hair-layout-v1.json',import.meta.url)));

test('hair layout: all twelve layers, tip parent chains and coordinates are explicit; cycles rejected',()=>{
 const l=layout();validateHairLayout(l);assert.equal(l.parts.length,12);assert.equal(l.parts.find(p=>p.id==='back_left_tip').parent,'back_left');
 const bad=layout();bad.parts.find(p=>p.id==='back_left').parent='back_left_tip';assert.throws(()=>validateHairLayout(bad),/cycle/);
 const missing=layout();missing.parts.pop();assert.throws(()=>validateHairLayout(missing),/required/);
 assert.equal(insideHairPolygon(1,1,[[0,0],[2,0],[2,2],[0,2]]),true);assert.equal(insideHairPolygon(3,1,[[0,0],[2,0],[2,2],[0,2]]),false);
});

test('hair split: preserves original visible RGBA and pixel positions with one owner and residual',()=>{
 const rgba=new Uint8Array(360*360*4);
 for(let y=40;y<320;y++)for(let x=65;x<290;x++){const p=(y*360+x)*4;rgba.set([40,80,160,254],p);}
 const {layers,owners}=splitHairPixels(rgba,layout());assert.equal(layers.length,13);assert.deepEqual(reconstructHairPixels(layers),rgba);
 for(const layer of layers.slice(1))assert.ok(layer.count>0,layer.id);
 assert.equal(layers.reduce((n,l)=>n+l.count,0),280*225);assert.equal(owners[170*360+140],0,'eyes remain in residual');assert.equal(owners[270*360+250],0,'tail remains in residual');
});

test('hair split: skin/white details remain residual and overlapping layer edits fail explicitly',()=>{
 const rgba=new Uint8Array(360*360*4);rgba.set([240,200,180,255],(120*360+150)*4);rgba.set([245,245,245,255],(121*360+150)*4);rgba.set([30,60,140,255],(65*360+140)*4);
 const {layers,owners}=splitHairPixels(rgba,layout());assert.equal(owners[120*360+150],0);assert.equal(owners[121*360+150],0);assert.ok(owners[65*360+140]>0);
 layers[0].rgba.set([30,60,140,255],(65*360+140)*4);assert.throws(()=>reconstructHairPixels(layers),/overlap/);
});

test('hair completion: preserves visible pixels, fills only occluded dense coverage and leaves rest untouched',()=>{
 const rgba=new Uint8Array(360*360*4),paint=new Uint8Array(rgba.length),l=layout();
 for(let y=40;y<320;y++)for(let x=65;x<290;x++){const p=(y*360+x)*4;rgba.set([40,80,160,254],p);paint.set([30,60,130,255],p);}
 rgba.set([40,80,160,100],(110*360+150)*4);
 rgba.set([220,190,150,252],(111*360+152)*4);rgba.set([220,190,150,251],(111*360+153)*4);
 const split=splitHairPixels(rgba,l),done=completeHiddenHairPixels(rgba,l,split.layers,paint);
 assert.deepEqual(done[0].rgba,split.layers[0].rgba);assert.ok(done.slice(1).some(p=>p.completion_pixel_count>0));
 assert.ok(done.slice(1).some(p=>p.rgba[(111*360+152)*4+3]===255));
 assert.ok(done.slice(1).every(p=>p.rgba[(111*360+153)*4+3]===0));
 for(let i=1;i<done.length;i++)for(let p=0;p<rgba.length;p+=4){
  if(split.layers[i].rgba[p+3])assert.deepEqual(done[i].rgba.subarray(p,p+4),split.layers[i].rgba.subarray(p,p+4));
  else if(done[i].rgba[p+3]){assert.ok(rgba[p+3]>=252);assert.ok(insideHairPolygon(p/4%360+.5,Math.floor(p/4/360)+.5,l.parts[i-1].polygon));}
 }
});
