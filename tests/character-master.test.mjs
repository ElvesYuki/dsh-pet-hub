import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCharacterLayout,splitCharacterPixels,completeCharacterPixels,padCharacterEdges,verifyCharacterComposite} from '../scripts/character-master.mjs';
const layout=()=>JSON.parse(readFileSync(new URL('../docs/art/character-layout-v1.json',import.meta.url)));
const index=(x,y)=>(y*360+x)*4;

test('character master: validates complete draw order and rejects parent cycles',()=>{
 const l=layout();validateCharacterLayout(l);
 const bad=layout();bad.parts.find(p=>p.id==='body').parent='head';assert.throws(()=>validateCharacterLayout(bad),/cycle/);
 const duplicate=layout();duplicate.draw_order[0]=duplicate.draw_order[1];assert.throws(()=>validateCharacterLayout(duplicate),/order/);
});

test('character master: eyes, mouth and dark hair outlines get independent owners without losing RGBA',()=>{
 const l=layout(),rgba=new Uint8Array(360*360*4);
 const samples=[[141,174,'eyes',[30,55,100,253]],[164,193,'mouth',[185,126,110,253]],[150,130,'fringe_center',[16,17,18,251]],[166,195,'head',[250,215,195,254]],[170,250,'body',[35,55,90,253]]];
 for(const [x,y,,color] of samples)rgba.set(color,index(x,y));
 const split=splitCharacterPixels(rgba,l),restored=new Uint8Array(rgba.length);
 for(const [x,y,id] of samples)assert.equal(split.layers[split.owners[y*360+x]].id,id);
 for(const layer of split.layers)for(let p=0;p<rgba.length;p+=4)if(layer.rgba[p+3]){assert.equal(restored[p+3],0);restored.set(layer.rgba.subarray(p,p+4),p);}
 assert.deepEqual(restored,rgba);
});

test('character master: hidden support cannot overpaint a lower visible owner or grow the silhouette',()=>{
 const l=layout(),rgba=new Uint8Array(360*360*4),paint=new Uint8Array(rgba.length),p=index(150,130),edge=index(151,130);
 rgba.set([20,40,100,251],p);rgba.set([20,40,100,250],edge);paint.set([230,200,180,255],p);paint.set([230,200,180,255],edge);paint.set([230,200,180,255],index(1,1));
 const split=splitCharacterPixels(rgba,l),done=completeCharacterPixels(rgba,l,split,new Map([['head',paint],['head_accessories',paint]]));
 assert.equal(done.find(v=>v.id==='head').rgba[p+3],255,'head skin under upper fringe');
 assert.equal(done.find(v=>v.id==='head').rgba[edge+3],0,'low alpha stays unfilled');
 assert.equal(done.find(v=>v.id==='head').rgba[index(1,1)+3],0,'no outer footprint growth');
 assert.equal(done.find(v=>v.id==='head_accessories').rgba[p+3],0,'top accessory cannot overwrite original fringe');
 assert.deepEqual(done.find(v=>v.id==='fringe_center').rgba,split.layers.find(v=>v.id==='fringe_center').rgba);
});

test('character master: real composite verification rejects contour and visible color changes',()=>{
 const source=new Uint8Array(360*360*4);source.set([80,100,170,251],index(150,130));
 const opaque=new Uint8Array(source);opaque[index(150,130)+3]=255;assert.equal(verifyCharacterComposite(source,opaque).max_alpha_difference,4);
 const grown=new Uint8Array(source);grown.set([0,0,0,1],index(1,1));assert.throws(()=>verifyCharacterComposite(source,grown),/footprint/);
 const changed=new Uint8Array(source);changed[index(150,130)]=100;assert.throws(()=>verifyCharacterComposite(source,changed),/art_changed/);
});

test('character master: edge padding is bounded, hidden below the owner, and never recursively floods',()=>{
 const l=layout(),rgba=new Uint8Array(360*360*4);
 for(let x=145;x<160;x++)rgba.set([30,50,100,253],index(x,130));
 const split=splitCharacterPixels(rgba,l),completed=split.layers.map(p=>({...p,rgba:new Uint8Array(p.rgba)})),head=completed.find(p=>p.id==='head');
 head.rgba.set([240,210,190,255],index(145,130));
 const padded=padCharacterEdges(rgba,l,split,completed,3),result=padded.find(p=>p.id==='head');
 assert.equal(result.rgba[index(148,130)+3],255);assert.equal(result.rgba[index(149,130)+3],0,'padding reads the original buffer, not newly padded texels');
 assert.equal(result.rgba[index(145,129)+3],0,'no expansion into transparent source');
 assert.deepEqual(result.rgba.subarray(index(145,130),index(145,130)+4),head.rgba.subarray(index(145,130),index(145,130)+4));
 assert.deepEqual(padded.find(p=>p.id==='fringe_center').rgba,completed.find(p=>p.id==='fringe_center').rgba,'visible top owner preserved');
 assert.throws(()=>padCharacterEdges(rgba,l,split,completed,10),/padding/);
});
