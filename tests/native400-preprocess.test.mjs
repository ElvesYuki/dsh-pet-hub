import test from 'node:test';import assert from 'node:assert/strict';
import {preprocessFrame,summarizePreprocess,PREPROCESS_TIERS} from '../scripts/native400-preprocess.mjs';import {makePalette,to565} from '../packages/core/pet4-encode.mjs';
import {spawnSync} from 'node:child_process';import vm from 'node:vm';import {preprocessPage} from '../scripts/native400-preprocess-page.mjs';
function frame(v=100){return Uint8Array.from({length:7*7*3},()=>v);}
test('preprocess keeps black and strong edges exact, does not mutate input or smear newly appearing foreground',()=>{
 const a=frame();for(let y=0;y<7;y++)for(let x=0;x<3;x++)a.fill(0,(y*7+x)*3,(y*7+x+1)*3);
 const copy=Uint8Array.from(a),old=frame(0),out=preprocessFrame(a,{width:7,height:7,spatial:18,temporal:5},old);
 assert.deepEqual(a,copy);assert.deepEqual(out,a);assert.deepEqual(old,frame(0));
});
test('temporal hold is bounded against current source: slow color change eventually updates, large motion never holds',()=>{
 let previous=frame(100),out;
 for(const v of [101,102,103,104,105,106,150]){
  const source=frame(v);out=preprocessFrame(source,{width:7,height:7,spatial:12,temporal:3},previous);
  const center=(3*7+3)*3;assert.ok(Math.abs(out[center]-v)<=3);if(v===150)assert.equal(out[center],150);previous=out;
 }
});
test('palette optional limit preserves default output and bounds used colors including exact black',()=>{
 const h=new Uint32Array(65536);for(let i=1;i<128;i++)h[to565(i*2,255-i,i)]=i;
 const legacy=makePalette(h),explicit=makePalette(h,{maxColors:256});assert.deepEqual(legacy,explicit);
 for(const maxColors of [2,16,96,128]){const {palette,lookup}=makePalette(h,{maxColors});assert.equal(palette[0],0);assert.equal(lookup[0],0);assert.ok(new Set(palette).size<=maxColors);for(let i=0;i<h.length;i++)if(h[i])assert.ok(lookup[i]<maxColors);}
 for(const n of [0,1,257,3.5])assert.throws(()=>makePalette(h,{maxColors:n}),/palette_color_limit/);
});
test('short-frame encoding samples preserve legacy 241 schedule and never seek past any actual frame count',()=>{
 const r=spawnSync('python3',['-B','-c',String.raw`import importlib.util,pathlib
s=importlib.util.spec_from_file_location('encoder',pathlib.Path('scripts/encode-native400-preprocess.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert m.sample_frames(241)==[0,30,60,120,180,240]
assert m.sample_frames(118)==[0,30,60,117]
for count in range(1,242):
 a=m.sample_frames(count)
 assert a==sorted(set(a)) and a[0]==0 and a[-1]==count-1 and all(0<=f<count for f in a)
print('ok')`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'ok');
});
test('summary uses byte-weighted totals, retains negative outcomes and derives cap from actual lengths',()=>{
 const m={tiers:[{key:'compact'}],actions:[{id:0,frames:241,baseline:{bytes:100},variants:[{key:'compact',bytes:50}]},{id:42,frames:118,baseline:{bytes:10000},variants:[{key:'compact',bytes:9900}]},{id:1,frames:241,baseline:{bytes:5865472},variants:[{key:'compact',bytes:5865473,within_legacy_limit:true}]}]};
 const s=summarizePreprocess(m),t=s.tiers[0];assert.equal(t.bytes_saved,149);assert.equal(s.baseline_bytes,5875572);assert.ok(Math.abs(t.saved_percent-149/5875572*100)<1e-12);assert.deepEqual(t.smaller_ids,[0,42]);assert.deepEqual(t.larger_ids,[1]);assert.deepEqual(t.exceeds_legacy_limit_ids,[1]);assert.equal(t.frames,600);
});
test('single-tier 118-frame HTML has two panels and correct boundaries; metadata cannot terminate its script',()=>{
 const name='test </script> <tag>',v={key:'compact',label:'压缩优先',bytes:900,bytes_saved:100,saved_percent:10,actual_palette_colors:96,within_legacy_limit:true,additional_foreground_mae_rgb:[1,2,3]};
 const m={tiers:[PREPROCESS_TIERS[2]],actions:[{id:42,name,frames:118,fps:24,baseline:{bytes:1000},variants:[v]}]};
 const html=preprocessPage(m),script=html.match(/<script>'use strict';([\s\S]*)<\/script>/)[1];new vm.Script(script);
 assert.equal((html.match(/<canvas /g)||[]).length,2);assert.ok(html.includes('max="117"'));assert.ok(html.includes('118帧'));assert.ok(!html.includes('id="worst-conservative"'));
 const encoded=script.match(/const REVIEW=(.*);\n/)[1];assert.equal(JSON.parse(encoded).actions[0].name,name);
});
