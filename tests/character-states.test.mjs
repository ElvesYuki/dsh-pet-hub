import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCharacterStates,composeCharacterStateFace} from '../scripts/character-states.mjs';
import {createNaturalMotion,replayNaturalMotion} from '../scripts/character-natural-motion.mjs';
import {sampleExpression} from '../scripts/character-expression.mjs';
import {composeSpeechMouth} from '../scripts/character-speech.mjs';
const parts=()=>JSON.parse(readFileSync(new URL('../docs/art/character-layout-v1.json',import.meta.url))).parts;

test('character states: changing a transition target starts at its CURRENT weights and never jumps',()=>{
 const s=createCharacterStates();assert.equal(s.sample(0).transitioning,false);s.setBase(0,'working');const mid=s.sample(.2);s.setBase(.2,'thinking');assert.deepEqual(s.sample(.2).weights,mid.weights);
 const end=s.sample(.7);assert.equal(end.base,'thinking');assert.deepEqual(end.weights,{idle:0,thinking:1,working:0});
 for(let i=8;i<20;i++)assert.ok(Math.abs(Object.values(s.sample(i/10).weights).reduce((a,b)=>a+b,0)-1)<1e-12);
});
test('character states: work to touch to thinking restores latest base while physical x/v remain continuous',()=>{
 const p=parts(),n=createNaturalMotion(p,{states:true});n.setBase(0,'working');n.advance(2);n.touch(2,205,120);n.advance(2.3);const before=n.pose(),velocities=n.status().channels;n.setBase(2.3,'thinking');assert.deepEqual(n.pose().world,before.world);assert.deepEqual(n.status().channels,velocities);assert.deepEqual(n.pose().head_expression,before.head_expression);
 const after=n.advance(3.5),face=composeCharacterStateFace(sampleExpression(after.time,after.head_expression),after.character_state);assert.equal(after.character_state.base,'thinking');assert.equal(after.character_state.weights.thinking,1);assert.equal(face.eye,'half');assert.notEqual(face.owner,'head_touch');assert.deepEqual(after.world.body,[1,0,0,1,0,0]);
});
test('character states: success plays once without changing base; repetition does not stack or grow memory',()=>{
 const c=createCharacterStates();c.setBase(0,'working');assert.equal(c.complete(1,'a').accepted,true);assert.equal(c.complete(1.1,'b').reason,'busy');assert.equal(c.complete(1.2,'a').reason,'duplicate');c.setBase(1.3,'thinking');assert.equal(c.sample(2.5).success,null);assert.equal(c.sample(2.5).base,'thinking');assert.equal(c.complete(2.5,'a').reason,'duplicate');
 for(let i=0;i<100;i++)assert.equal(c.complete(3+i*1.5,'id-'+i).accepted,true);assert.equal(c.status().remembered_completion_ids,32);
});
test('character states: eye blink timing remains independent; touch and speech retain channel priorities',()=>{
 const c=createCharacterStates();c.setBase(0,'thinking');const state=c.sample(2.23),blink=sampleExpression(2.23);assert.equal(composeCharacterStateFace(blink,state).eye,'closed');c.complete(2.23,'done');const success=c.sample(2.5),face=composeCharacterStateFace(sampleExpression(2.5),success);assert.equal(face.eye,'smile');
 const touch=sampleExpression(2.5,{start:2.3,last:2.3});assert.deepEqual(composeCharacterStateFace(touch,success),touch);const speaking=composeSpeechMouth(face,{owner:'speech',mouth:'round'});assert.equal(speaking.eye,'smile');assert.deepEqual(speaking.mouth,{round:1});
});
test('character states: fixed-step sampling and ordered replay preserve transitions and completion',()=>{
 const p=parts(),script=[{type:'state',time:0,state:'working'},{type:'touch',time:2,x:205,y:120},{type:'state',time:2.3,state:'thinking'},{type:'success',time:4,id:'done'}];
 const a=replayNaturalMotion(p,5,script,{states:true}),b=createNaturalMotion(p,{states:true});let j=0;for(let i=0;i<=300;i++){const t=i/60;while(j<script.length&&script[j].time<=t){const e=script[j++];if(e.type==='state')b.setBase(e.time,e.state);else if(e.type==='touch')b.touch(e.time,e.x,e.y);else b.complete(e.time,e.id);}b.advance(t);}
 assert.deepEqual(a.pose(),b.pose());assert.deepEqual(a.status(),b.status());
});
test('character states: invalid states, IDs and backwards time fail without overwriting valid state',()=>{
 const c=createCharacterStates();c.setBase(1,'working');const old=c.status();assert.throws(()=>c.setBase(2,'success'),/base_state/);assert.deepEqual(c.status(),old);assert.throws(()=>c.complete(2,''),/completion/);assert.throws(()=>c.sample(.5),/time/);
 const n=createNaturalMotion(parts());assert.throws(()=>n.setBase(0,'thinking'),/base_state/);assert.throws(()=>replayNaturalMotion(parts(),1,[{type:'state',time:0,state:'working'}]),/event/);
});
