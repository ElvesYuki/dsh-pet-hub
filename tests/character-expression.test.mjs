import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blinkStarts,sampleExpression} from '../scripts/character-expression.mjs';
import {createNaturalMotion} from '../scripts/character-natural-motion.mjs';
const parts=()=>JSON.parse(readFileSync(new URL('../docs/art/character-layout-v1.json',import.meta.url))).parts;

test('expressions: deterministic irregular blink schedule and complete open-half-closed-half-open cycle',()=>{
 const starts=blinkStarts(30);assert.deepEqual(starts,blinkStarts(30));assert.ok(starts.length>5);
 const gaps=starts.slice(1).map((t,i)=>t-starts[i]);assert.ok(new Set(gaps).size>2);
 const t=starts[0];assert.equal(sampleExpression(t-.01).eye,'open');assert.equal(sampleExpression(t+.02).eye,'half');assert.equal(sampleExpression(t+.08).eye,'closed');assert.equal(sampleExpression(t+.16).eye,'half');assert.equal(sampleExpression(t+.21).eye,'open');
});
test('expressions: head-touch owns eyes over a scheduled blink and exits through half-open',()=>{
 const head={start:2.1,last:2.1};assert.equal(sampleExpression(2.12,head).eye,'half');assert.equal(sampleExpression(2.17,head).eye,'closed');
 const happy=sampleExpression(2.3,head);assert.equal(happy.eye,'smile');assert.equal(happy.owner,'head_touch');assert.equal(happy.mouth.smile,1);
 assert.equal(sampleExpression(3.05,head).eye,'half');assert.equal(sampleExpression(3.2,head).eye,'open');
});
test('expressions: repeated head hits extend the hold without restarting entry; body hits preserve the independent face channel',()=>{
 const motion=createNaturalMotion(parts());motion.touch(1,205,120);motion.advance(1.2);const before=motion.pose().world;motion.touch(1.2,205,120);assert.deepEqual(motion.pose().world,before);
 assert.deepEqual(motion.pose().head_expression,{start:1,last:1.2});assert.equal(sampleExpression(1.2,motion.pose().head_expression).eye,'smile');
 motion.touch(1.4,175,245);assert.deepEqual(motion.pose().head_expression,{start:1,last:1.2});assert.equal(sampleExpression(1.4,motion.pose().head_expression).owner,'head_touch');
 motion.advance(3);assert.equal(sampleExpression(3,motion.pose().head_expression).owner,'blink');
});
test('expressions: brow and mouth weights are bounded, complementary and replay independent',()=>{
 const head={start:1,last:1};let previous=0;
 for(let i=0;i<=107;i++){const t=1+i/100,f=sampleExpression(t,head);assert.ok(Math.abs(Object.values(f.brows).reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(Math.abs(f.mouth.closed+f.mouth.smile-1)<1e-12);for(const w of [...Object.values(f.brows),...Object.values(f.mouth)])assert.ok(w>=0&&w<=1);if(t<1.16){assert.ok(f.mouth.smile>=previous);previous=f.mouth.smile;}}
 assert.deepEqual(sampleExpression(1.5,head),sampleExpression(1.5,head));
});
test('expressions: invalid times and impossible head-touch records are rejected',()=>{
 assert.throws(()=>sampleExpression(-1),/time/);assert.throws(()=>blinkStarts(Infinity),/time/);assert.throws(()=>sampleExpression(1,{start:2,last:2}),/touch/);assert.throws(()=>sampleExpression(2,{start:1,last:.5}),/touch/);
});
