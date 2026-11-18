// Synthetic authoring events only. No artwork, device or real pet state.
export const profileScenes={
 idle:[],thinking:[{type:'state',time:0,state:'thinking'}],working:[{type:'state',time:0,state:'working'}],success:[{type:'success',time:2,id:'done'}],
 latest_base:[{type:'state',time:0,state:'working'},{type:'touch',time:2,x:205,y:120},{type:'state',time:2.3,state:'thinking'}],
 rapid_states:Array.from({length:20},(_,i)=>({type:'state',time:i*.2,state:['working','thinking','idle'][i%3]})),
 success_latest:[{type:'state',time:0,state:'working'},{type:'success',time:2,id:'done'},{type:'state',time:2.3,state:'thinking'}],
 repeated_success:[{type:'success',time:1,id:'a'},{type:'success',time:1.1,id:'b'},{type:'success',time:1.2,id:'a'},{type:'success',time:2.5,id:'a'},{type:'success',time:3.5,id:'c'}],
 state_speech:[{type:'state',time:0,state:'working'},{type:'touch',time:2.3,x:205,y:120},{type:'success',time:3.5,id:'done'},{type:'state',time:4,state:'thinking'},{type:'touch',time:5.1,x:205,y:120}],
 state_stop:[{type:'state',time:0,state:'thinking'},{type:'state',time:3,state:'idle'},{type:'idle',time:3.6,enabled:false}],
 wave:[],wave_cancel:[],wave_latest:[{type:'state',time:0,state:'working'},{type:'touch',time:1.6,x:205,y:120},{type:'state',time:2,state:'thinking'}],
 wave_speech:[{type:'state',time:0,state:'working'},{type:'success',time:1.8,id:'wave-done'},{type:'touch',time:2.2,x:175,y:245}]
};
export const waveScripts={wave:[{type:'start',time:1}],wave_cancel:[{type:'start',time:1},{type:'cancel',time:1.8,generation:1}],wave_latest:[{type:'start',time:1}],wave_speech:[{type:'start',time:1},{type:'start',time:1.2}]};
const speech=[{type:'start',time:1,id:'A',duration:6},{type:'pause',time:2.5,generation:1,paused:true},{type:'pause',time:3,generation:1,paused:false},{type:'start',time:4,id:'B',duration:3},{type:'stop',time:5.5,generation:2}];
export const speechScripts={state_speech:speech,wave_speech:speech};
export const canonicalBehavior=value=>JSON.stringify(function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}(value));
export function runProfileScenes(modules,parts,record,behavior){
 for(const [name,events] of Object.entries(profileScenes)){
  const engine=modules.motion.createNaturalMotion(parts,{states:true,behavior});let index=0;
  for(let frame=0;frame<=288;frame++){
   const time=frame/24;while(index<events.length&&events[index].time<=time){const e=events[index++];const r=e.type==='state'?engine.setBase(e.time,e.state):e.type==='success'?engine.complete(e.time,e.id):e.type==='touch'?engine.touch(e.time,e.x,e.y):engine.setIdle(e.time,e.enabled);record(name,'input',r);}
   const pose=engine.advance(time),speech=modules.speech.replaySpeech(pose.time,speechScripts[name]??[],behavior).status(),wave=modules.wave.replayCharacterWave(pose.time,waveScripts[name]??[],behavior);
   const face=modules.speech.composeSpeechMouth(modules.states.composeCharacterStateFace(modules.expression.sampleExpression(pose.time,pose.head_expression,behavior),pose.character_state,behavior),speech,behavior);
   record(name,'frame',{pose,status:engine.status(),face,speech,wave});
  }
 }
 const legacy=modules.motion.createNaturalMotion(parts,{behavior});for(let frame=0;frame<=288;frame++){const t=frame/24;if(frame===24)legacy.touch(t,205,120);if(frame===60)legacy.setIdle(t,false);record('legacy','frame',{pose:legacy.advance(t),status:legacy.status()});}
 const a=new Uint8ClampedArray(24*20*4),b=new Uint8ClampedArray(a.length);for(let y=3;y<17;y++)for(let x=3;x<14;x++)a.set([20,40,90,255],(y*24+x)*4);for(let y=4;y<16;y++)for(let x=8;x<20;x++)b.set([50,70,110,255],(y*24+x)*4);
 for(const u of [0,.1,.25,.5,.75,.9,1])record('contour','pixels',[...modules.morph.morphArmRgba(a,b,24,20,u,behavior)]);
}
export function runProfileBoundaries(modules,record,behavior){
 const epsilon=1e-10;
 for(const time of [0,.05,.055,.1,.11,.12,.16,.2,.3,.45,.5,.85,.91,1,1.02,1.05,1.07,1.11,1.23,1.3,1.4,1.95,2.15,2.2,2.35,2.4,5,60])for(const t of [time-epsilon,time,time+epsilon]){
  if(t<0||t>60)continue;
  const c=modules.states.createCharacterStates(behavior);c.setBase(0,'thinking');c.complete(0,'done');const state=c.sample(t);
  const expr=modules.expression.sampleExpression(t,{start:0,last:0},behavior),face=modules.states.composeCharacterStateFace(expr,state,behavior);
  const w=modules.wave.createCharacterWave(behavior);w.start(0);const wave=w.sample(t),talk=modules.speech.createSpeechPreview(behavior);talk.start(0,{id:'boundary'});const speech=talk.sample(t);
  record('boundaries','sample',{time:t,state,expr,face,wave,speech});
 }
 record('boundaries','blink_schedule',modules.expression.blinkStarts(3600,behavior));
 for(const at of [0,.225,.45,1.2,1.95,2.399999]){const w=modules.wave.createCharacterWave(behavior);w.start(0);const before=w.sample(at),cancel=w.cancel(at,1);record('boundaries','cancel',{before,cancel,same:w.sample(at),middle:w.sample(at+.15),after:w.sample(at+.3)});}
}
