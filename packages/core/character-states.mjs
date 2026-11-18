import {resolveCharacterBehavior,layeredBehaviorBaseline} from './layered-character-profiles.mjs';
export const characterBaseStates=layeredBehaviorBaseline.profiles.character_states_v1.base_states;
const stateCheck=(ok,message)=>{if(!ok)throw new Error(message);};
const stateEase=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Explicit-time state solver. Optional full fixed-v1 behavior; old zero-argument calls preserved. */
export function createCharacterStates(behavior){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.character_states_v1,m=p.motion;
 let clock=0,base='idle',from={idle:1,thinking:0,working:0},changedAt=-p.blend_seconds,success=null;
 const acceptedIds=[];
 function sample(time){
  stateCheck(Number.isFinite(time)&&time>=clock&&time-clock<=b.rules.max_step_seconds,'invalid_character_state_time');clock=time;
  const blend=stateEase((time-changedAt)/p.blend_seconds),weights={};for(const id of p.base_states)weights[id]=from[id]*(1-blend)+(id===base?blend:0);
  const age=success?time-success.start:Infinity,successActive=age<p.completion_seconds,pulse=successActive?Math.sin(Math.PI*age/p.completion_seconds)**2:0;
  const expression=successActive?stateEase(age/p.expression_entry)*(1-stateEase((age-p.expression_exit_start)/p.expression_exit_duration)):0;
  const w=weights.working,t=weights.thinking,wave=Math.sin(time*Math.PI/m.arm_pi_divisor);
  return {time,base,weights,transitioning:blend<1,success:successActive?{id:success.id,age,pulse,expression}:null,motion:{head:m.head_thinking*t-(-m.head_working)*w+m.head_success*pulse,head_sway:1-(-m.sway_thinking)*t-(-m.sway_working)*w,head_y:m.head_y_working*w-(-m.head_y_success)*pulse,arm_left:m.arm_amplitude*w*wave-m.arm_success*pulse,arm_right:-m.arm_amplitude*w*wave+m.arm_success*pulse,tail:m.tail_success*pulse}};
 }
 function setBase(time,id){
  stateCheck(p.base_states.includes(id),'invalid_character_base_state');const current=sample(time);
  if(base===id)return {accepted:false,reason:'unchanged',base};from={...current.weights};base=id;changedAt=time;return {accepted:true,base};
 }
 function complete(time,id){
  stateCheck(typeof id==='string'&&id.length>0&&id.length<=p.id_max_length,'invalid_completion_id');const current=sample(time);
  if(acceptedIds.includes(id))return {accepted:false,reason:'duplicate'};
  if(current.success)return {accepted:false,reason:'busy'};
  success={id,start:time};acceptedIds.push(id);if(acceptedIds.length>p.completion_history)acceptedIds.shift();return {accepted:true,id};
 }
 function status(){return {...sample(clock),remembered_completion_ids:acceptedIds.length};}
 return {sample,setBase,complete,status};
}
/** Touch retains face ownership; speech is composed later and owns only the mouth. */
export function composeCharacterStateFace(face,state,behavior){
 const p=resolveCharacterBehavior(behavior).profiles.character_states_v1;
 if(!state||face.owner==='head_touch'||face.owner==='manual'||face.owner==='bare')return face;
 if(state.success){
  const {age,expression:a}=state.success,e=p.success_eye_thresholds,eye=age<e[0]?'half':age<e[1]?'closed':age<e[2]?'smile':age<e[3]?'closed':age<e[4]?'half':'open';
  return {...face,eye,brows:{neutral:1-a,relaxed:a,raised:0},mouth:{closed:1-a,smile:a},owner:'success'};
 }
 const thinking=state.weights.thinking;
 return {...face,eye:face.eye==='open'&&thinking>=p.thinking_half_threshold?'half':face.eye,brows:{neutral:1-thinking,relaxed:0,raised:thinking},owner:face.owner};
}
