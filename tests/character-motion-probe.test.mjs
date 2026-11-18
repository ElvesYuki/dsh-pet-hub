import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMotionProbe,movingHair,posePoint,multiplyPose,pivotRotation} from '../scripts/character-motion-probe.mjs';
const parts=()=>JSON.parse(readFileSync(new URL('../docs/art/character-layout-v1.json',import.meta.url))).parts;
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-10,`${a} != ${b}`));
test('motion probe: child joint remains anchored to the transformed parent and tips inherit both rotations',()=>{
 const p=parts(),probe=createMotionProbe(p),world=probe.matrices({head:1,back_left:-2,back_left_tip:2});
 const tip=p.find(p=>p.id==='back_left_tip'),back=p.find(p=>p.id==='back_left');
 near(posePoint(world.back_left_tip,tip.pivot),posePoint(world.back_left,tip.pivot));
 near(world.back_left_tip,multiplyPose(world.back_left,pivotRotation(tip.pivot,2)));
 near(posePoint(world.back_left,back.pivot),posePoint(world.head,back.pivot));
 near(world.head_accessories,world.head);near(world.hair_cap,world.head);near(world.body,[1,0,0,1,0,0]);
});
test('motion probe: zero and loop endpoints restore all 21 matrices; all 11 hair channels are available',()=>{
 const probe=createMotionProbe(parts()),neutral=probe.sample(0,{mode:'neutral'}),start=probe.sample(0),end=probe.sample(8),middle=probe.sample(2.125);
 for(const id of Object.keys(neutral.world)){near(neutral.world[id],[1,0,0,1,0,0]);near(start.world[id],neutral.world[id]);near(end.world[id],neutral.world[id]);}
 assert.equal(movingHair.length,11);for(const id of movingHair)assert.ok(Math.abs(middle.angles[id])>1e-6,id);
 near(probe.sample(2.125+8).world.back_right_tip,middle.world.back_right_tip);
 assert.deepEqual(probe.sample(2.125),middle,'sampling order does not mutate solver state');
});
test('motion probe: a single tip or head probe cannot move the root or change unrelated joint angles',()=>{
 const probe=createMotionProbe(parts()),tip=probe.sample(0,{mode:'single',selected:'back_right_tip',angle:-2});
 assert.deepEqual(tip.angles,{back_right_tip:-2});near(tip.world.body,[1,0,0,1,0,0]);near(tip.world.head,[1,0,0,1,0,0]);near(tip.world.back_right,[1,0,0,1,0,0]);
 const head=probe.sample(0,{mode:'single',selected:'head',angle:1.25});near(head.world.eyes,head.world.head);near(head.world.mouth,head.world.head);near(head.world.tail,[1,0,0,1,0,0]);
});
test('motion probe: invalid angle, time and hierarchy inputs fail explicitly',()=>{
 const probe=createMotionProbe(parts());assert.throws(()=>probe.matrices({body:1}),/angle/);assert.throws(()=>probe.matrices({head:NaN}),/angle/);assert.throws(()=>probe.sample(Infinity),/time/);assert.throws(()=>probe.sample(1,{strength:2}),/strength/);assert.throws(()=>probe.sample(0,{mode:'single',selected:'head',angle:3}),/selection/);
 const p=parts();p.find(p=>p.id==='head').parent='back_left_tip';assert.throws(()=>createMotionProbe(p),/cycle/);
});
