import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNaturalMotion,sampleNaturalMotion,characterTouchRegion} from '../scripts/character-natural-motion.mjs';
import {posePoint,movingHair} from '../scripts/character-motion-probe.mjs';
const parts=()=>JSON.parse(readFileSync(new URL('../docs/art/character-layout-v1.json',import.meta.url))).parts;
const near=(a,b,eps=1e-9)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<eps,`${a} != ${b}`));

test('natural motion: 24fps/60fps sampling share the same fixed-step state and stationary root',()=>{
 const p=parts(),a=createNaturalMotion(p),b=createNaturalMotion(p);
 for(let i=1;i<=240;i++)a.advance(i/24);for(let i=1;i<=600;i++)b.advance(i/60);
 assert.deepEqual(a.status().channels,b.status().channels);const pose=a.pose();near(pose.world.body,[1,0,0,1,0,0]);
 near(pose.world.head_accessories,pose.world.head);near(pose.world.hair_cap,pose.world.head);
 const tip=p.find(p=>p.id==='back_left_tip');near(posePoint(pose.world.back_left_tip,tip.pivot),posePoint(pose.world.back_left,tip.pivot));
 for(const id of movingHair)assert.ok(Math.abs(pose.angles[id])>1e-6,id);
 assert.equal(a.status().channel_count,16);
});

test('natural motion: touch preserves position, adds velocity, and stopping converges without snapping',()=>{
 const engine=createNaturalMotion(parts());engine.advance(1);const before=engine.pose();assert.equal(engine.touch(1,200,120).accepted,true);
 assert.deepEqual(engine.pose().world,before.world,'touch never teleports a joint');
 engine.advance(1.2);const moving=engine.pose();engine.setIdle(1.2,false);assert.deepEqual(engine.pose().world,moving.world,'stop preserves current pose');
 engine.advance(12);const settled=engine.status();assert.equal(settled.active_feedback,0);
 for(const [id,s] of Object.entries(settled.channels)){assert.ok(Math.abs(s.x)<.0001,id);assert.ok(Math.abs(s.v)<.0001,id);}
});

test('natural motion: rapid touches are limited, angles and speed remain bounded under interruption',()=>{
 const engine=createNaturalMotion(parts());let rejected=0;
 for(let i=0;i<1800;i++){const t=i/120;const r=engine.touch(t,i%2?110:240,120);if(!r.accepted)rejected++;for(const s of Object.values(engine.status().channels)){assert.ok(Math.abs(s.x)<=s.limit);assert.ok(Math.abs(s.v)<=s.speed_limit);}}
 assert.ok(rejected>1600);assert.ok(engine.status().accepted_touches<=101);assert.equal(engine.status().active_feedback,1);
 engine.setIdle(15,false);engine.advance(24);assert.ok(Object.values(engine.status().channels).every(s=>Math.abs(s.x)<.0001));
});

test('natural motion: interrupting recovery keeps x/v and new response can replace an old target',()=>{
 const engine=createNaturalMotion(parts());engine.touch(0,210,120);engine.advance(.3);engine.setIdle(.3,false);engine.advance(.7);
 const before=engine.pose();assert.equal(engine.touch(.7,145,245).region,'body');assert.deepEqual(engine.pose().world,before.world);
 engine.advance(1);assert.equal(engine.pose().feedback.region,'body');assert.ok(Math.abs(engine.pose().angles.tail)>0);
 const reconstructed=sampleNaturalMotion(parts(),1,[{type:'touch',time:0,x:210,y:120},{type:'idle',time:.3,enabled:false},{type:'touch',time:.7,x:145,y:245}]);
 assert.deepEqual(reconstructed.pose,engine.pose());
});

test('natural motion: invalid controls, outside hits, reverse time and oversized replay fail explicitly',()=>{
 const engine=createNaturalMotion(parts());assert.equal(characterTouchRegion(1,1),null);assert.equal(engine.touch(0,1,1).accepted,false);
 assert.throws(()=>engine.advance(NaN),/time/);engine.advance(1);assert.throws(()=>engine.advance(.5),/time/);assert.throws(()=>engine.advance(100),/time/);
 assert.throws(()=>engine.touch(1,NaN,120),/coordinates/);assert.throws(()=>engine.setIdle(1,0),/control/);
 assert.throws(()=>sampleNaturalMotion(parts(),61),/replay/);assert.throws(()=>sampleNaturalMotion(parts(),1,[{type:'idle',time:.8,enabled:false},{type:'idle',time:.7,enabled:true}]),/event/);
});
