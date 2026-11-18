import {resolveCharacterBehavior} from './layered-character-profiles.mjs';
// Silent authoring choreography, NOT audio/phoneme synchronization. Explicit virtual seconds only.
const speechCheck=(ok,message)=>{if(!ok)throw new Error(message);};
/** Silent choreography; optional full behavior is captured before any start/pause/stop control. */
export function createSpeechPreview(behavior){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.silent_speech_v1,speechCues=p.cues;
 let time=0,generation=0,active=null;
 function advance(next){
  speechCheck(Number.isFinite(next)&&next>=time&&next-time<=b.rules.max_step_seconds,'invalid_speech_time');
  if(active&&!active.paused){active.elapsed+=next-time;if(active.elapsed>=active.duration)active=null;}
  time=next;
 }
 function start(next,{id,duration=p.duration_default}={}){
  speechCheck(typeof id==='string'&&id.length>0&&id.length<=p.id_max_length&&Number.isFinite(duration)&&duration>=p.duration_min&&duration<=p.duration_max,'invalid_speech_start');
  advance(next);generation++;active={id,generation,duration,elapsed:0,paused:false};return {generation,id};
 }
 function pause(next,token,paused=true){
  speechCheck(Number.isSafeInteger(token)&&token>0&&typeof paused==='boolean','invalid_speech_control');advance(next);
  if(!active||active.generation!==token)return {accepted:false,reason:'stale_generation'};
  active.paused=paused;return {accepted:true,generation:token};
 }
 function stop(next,token){
  speechCheck(Number.isSafeInteger(token)&&token>0,'invalid_speech_control');advance(next);
  if(!active||active.generation!==token)return {accepted:false,reason:'stale_generation'};
  active=null;return {accepted:true,generation:token};
 }
 function status(){
  if(!active)return {time,generation,active:false,owner:'expression',stage:'idle',mouth:null};
  const t=active.elapsed,phase=(t-p.start_seconds)%p.period;
  let mouth=p.paused_mouth,stage=active.paused?'paused':t<p.start_seconds?'starting':t>=active.duration-p.end_seconds?'ending':phase>=p.gap_start?'gap':'speaking';
  if(stage==='speaking')for(const [at,state] of speechCues)if(phase>=at)mouth=state;
  return {time,generation:active.generation,id:active.id,active:true,owner:'speech',stage,mouth,elapsed:t,duration:active.duration,paused:active.paused};
 }
 function sample(next){advance(next);return status();}
 return {start,pause,stop,sample,status};
}

export function replaySpeech(time,events=[],behavior){
 const b=resolveCharacterBehavior(behavior);
 speechCheck(Number.isFinite(time)&&time>=0&&time<=b.rules.max_replay_seconds&&Array.isArray(events)&&events.length<=b.rules.events_per_channel,'invalid_speech_replay');
 const engine=createSpeechPreview(b);let previous=0;
 for(const e of events){
  speechCheck(Number.isFinite(e.time)&&e.time>=previous&&e.time<=b.rules.max_replay_seconds&&['start','pause','stop'].includes(e.type),'invalid_speech_event');previous=e.time;
  if(e.time>time)continue;
  if(e.type==='start')engine.start(e.time,{id:e.id,duration:e.duration});else if(e.type==='pause')engine.pause(e.time,e.generation,e.paused);else engine.stop(e.time,e.generation);
 }
 engine.sample(time);return engine;
}

/** Speech owns only mouth (including closed pauses); eyes/brows remain with the current expression. */
export function composeSpeechMouth(face,speech,behavior){
 const b=resolveCharacterBehavior(behavior);
 if(speech.owner!==b.rules.mouth_owner)return {...face,mouth_owner:'expression'};
 speechCheck(['closed','small','open','round'].includes(speech.mouth),'invalid_speech_mouth');
 return {...face,mouth:{[speech.mouth]:1},mouth_owner:b.rules.mouth_owner};
}
