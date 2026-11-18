import {resolveCharacterBehavior} from './layered-character-profiles.mjs';
// Pure explicit-time, one-shot arm authoring channel. No DOM, pet or device dependencies.
const waveEase=x=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
/** One-shot solver; optional full fixed-v1 behavior, sampled with explicit monotonic seconds. */
export function createCharacterWave(behavior){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.wave_v1;
 let clock=0,generation=0,active=null;
 function sample(time){
  if(!Number.isFinite(time)||time<clock||time-clock>b.rules.max_step_seconds)throw new Error('invalid_wave_time');clock=time;
  if(!active)return {generation,active:false,lift:0,angle:0,stage:'idle'};
  const age=time-active.start;
  let lift,angle,stage;
  if(active.cancel){const fade=1-waveEase((time-active.cancel.time)/p.cancel_seconds);lift=active.cancel.lift*fade;angle=active.cancel.angle*fade;stage='exit';}
  else{lift=waveEase(age/p.entry_seconds)*(1-waveEase((age-p.exit_start)/p.entry_seconds));angle=age>p.entry_seconds&&age<p.exit_start?p.amplitude_degrees*Math.sin((age-p.entry_seconds)*Math.PI*p.angular_frequency_pi)*Math.sin(Math.PI*(age-p.entry_seconds)/p.wave_seconds)**2:0;stage=age<p.entry_seconds?'enter':age<p.exit_start?'wave':'exit';}
  if(time>=(active.cancel?active.cancel.time+p.cancel_seconds:active.start+p.total_seconds)){active=null;return {generation,active:false,lift:0,angle:0,stage:'idle'};}
  return {generation,active:true,lift,angle,stage};
 }
 return {sample,start(time){const s=sample(time);if(s.active)return {accepted:false,reason:'busy',generation};active={start:time};generation++;return {accepted:true,generation};},cancel(time,token){if(!Number.isSafeInteger(token)||token<1)throw new Error('invalid_wave_generation');const s=sample(time);if(token!==generation)return {accepted:false,reason:'stale'};if(!s.active||active.cancel)return {accepted:false,reason:'inactive'};active.cancel={time,lift:s.lift,angle:s.angle};return {accepted:true};}};
}
export function replayCharacterWave(time,events=[],behavior){
 const b=resolveCharacterBehavior(behavior);
 if(!Array.isArray(events)||events.length>b.rules.events_per_channel)throw new Error('invalid_wave_events');const core=createCharacterWave(b);let previous=0;
 for(const e of events){if(!e||!Number.isFinite(e.time)||e.time<previous||!['start','cancel'].includes(e.type))throw new Error('invalid_wave_event');previous=e.time;if(e.time>time)continue;if(e.type==='start')core.start(e.time);else core.cancel(e.time,e.generation);}
 return {...core.sample(time)};
}
// Similarity map retains sleeve/hand proportions; shoulder and wrist share exact anchors.
export function waveArmMatrix(source,target){
 const [a,b]=source,[p,q]=target,ux=b[0]-a[0],uy=b[1]-a[1],vx=q[0]-p[0],vy=q[1]-p[1],length=ux*ux+uy*uy;
 if(!Number.isFinite(length)||length<1e-6)throw new Error('singular_arm_anchors');
 const c=(ux*vx+uy*vy)/length,s=(ux*vy-uy*vx)/length;
 return [c,s,-s,c,p[0]-c*a[0]+s*a[1],p[1]-s*a[0]-c*a[1]];
}
