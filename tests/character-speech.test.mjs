import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechPreview,replaySpeech,composeSpeechMouth} from '../scripts/character-speech.mjs';
test('silent speech: starting, all mouth shapes, timed gaps and ending close before ownership releases',()=>{
 const c=createSpeechPreview();c.start(0,{id:'a',duration:3});assert.equal(c.sample(.02).mouth,'closed');const states=new Set();for(let i=3;i<65;i++)states.add(c.sample(i/24).mouth);assert.deepEqual([...states].sort(),['closed','open','round','small']);assert.equal(c.sample(2.9).stage,'ending');assert.equal(c.status().mouth,'closed');assert.equal(c.sample(3).owner,'expression');
});
test('silent speech: pause closes and freezes the session progress; resume preserves remaining duration',()=>{
 const c=createSpeechPreview(),a=c.start(0,{id:'a'});c.sample(.3);c.pause(.3,a.generation,true);const elapsed=c.status().elapsed;assert.equal(c.sample(1).mouth,'closed');assert.equal(c.status().elapsed,elapsed);c.pause(1,a.generation,false);assert.ok(c.sample(1.2).elapsed>elapsed);assert.equal(c.status().generation,a.generation);
});
test('silent speech: replacing a phrase rejects old pause/stop controls and cannot resurrect a cancelled phrase',()=>{
 const c=createSpeechPreview(),a=c.start(0,{id:'a'}),b=c.start(.2,{id:'b'});assert.ok(b.generation>a.generation);assert.equal(c.status().elapsed,0);assert.equal(c.pause(.2,a.generation).accepted,false);assert.equal(c.stop(.2,a.generation).accepted,false);assert.equal(c.status().id,'b');c.stop(.3,b.generation);assert.equal(c.pause(.4,b.generation,false).accepted,false);assert.equal(c.sample(.5).active,false);
});
test('silent speech: expression eyes survive speaking, paused mouth is closed, stop restores CURRENT smile state',()=>{
 const f={eye:'smile',brows:{relaxed:1},mouth:{smile:1}};const c=createSpeechPreview(),a=c.start(0,{id:'a'});const speaking=composeSpeechMouth(f,c.sample(.3));assert.equal(speaking.eye,'smile');assert.deepEqual(speaking.brows,f.brows);assert.equal(speaking.mouth_owner,'speech');c.pause(.3,a.generation,true);assert.deepEqual(composeSpeechMouth(f,c.status()).mouth,{closed:1});c.stop(.3,a.generation);assert.deepEqual(composeSpeechMouth(f,c.status()).mouth,{smile:1});assert.deepEqual(composeSpeechMouth({...f,mouth:{closed:1}},c.status()).mouth,{closed:1});
});
test('silent speech: ordered replay is deterministic and malformed commands preserve the current session',()=>{
 const script=[{type:'start',time:1,id:'a',duration:5},{type:'pause',time:1.4,generation:1,paused:true},{type:'start',time:2,id:'b',duration:2},{type:'stop',time:2.2,generation:1}];assert.deepEqual(replaySpeech(2.4,script).status(),replaySpeech(2.4,script).status());assert.equal(replaySpeech(2.4,script).status().id,'b');const c=createSpeechPreview();c.start(0,{id:'a'});const before=c.status();assert.throws(()=>c.start(.2,{id:'bad',duration:-1}),/start/);assert.deepEqual(c.status(),before);assert.throws(()=>c.sample(-1),/time/);assert.throws(()=>c.pause(0,0),/control/);assert.throws(()=>replaySpeech(61),/replay/);assert.throws(()=>replaySpeech(1,[{type:'stop',time:.5,generation:1},{type:'stop',time:.4,generation:1}]),/event/);
});
