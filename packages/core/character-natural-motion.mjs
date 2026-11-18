import {resolveCharacterBehavior,layeredTouch} from './layered-character-profiles.mjs';
import {createMotionProbe,multiplyPose,pivotRotation} from './character-motion-probe.mjs';
import {createCharacterStates} from './character-states.mjs';

const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function characterTouchRegion(x,y){
 ensure(Number.isFinite(x)&&Number.isFinite(y),'invalid_touch_coordinates');
 const [left,top,right,bottom]=layeredTouch.bounds;
 if(x<left||x>right||y<top||y>bottom)return null;
 return y<layeredTouch.head_y_lt?'head':'body'; // The browser additionally requires an actual source-alpha hit.
}

/** Stateful, deterministic authoring solver in explicit virtual seconds. advance is monotonic,
 * at most 60s per call; all integration uses 120Hz integer ticks. Controls preserve x/v.
 * Optional full behavior is admitted/snapshotted once; omitted behavior keeps the v4 defaults.
 * No clock, DOM, devices or event queue. Returned poses/status contain copies, never solver state.
 */
export function createNaturalMotion(parts,{states=false,behavior}={}){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.natural_120hz_v1,naturalStep=1/p.integration_hz;
 ensure(typeof states==='boolean','invalid_natural_state_option');
 const stateController=states?createCharacterStates(b):null;
 const rig=createMotionProbe(parts),by=new Map(parts.map(p=>[p.id,p])),channels=new Map();
 const channel=(id,omega,zeta,limit,speed)=>channels.set(id,{id,x:0,v:0,omega,zeta,limit,speed});
 // Legacy non-state authoring mode retains its old arm bounds; package v1 requires states.
 for(const [id,c] of Object.entries(p.channels))channel(id,c.omega,c.zeta,!states&&id.startsWith('arm_')?.65:c.limit,!states&&id.startsWith('arm_')?3:c.speed);
 let tick=0,requested=0,idle=true,gesture=null,lastTouch=-Infinity,accepted=0,rejected=0,headExpression=null;
 const spring=(s,target,force=0)=>{
  s.v=clamp(s.v+((target-s.x)*s.omega*s.omega-2*s.zeta*s.omega*s.v+force)*naturalStep,-s.speed,s.speed);
  const next=s.x+s.v*naturalStep;s.x=clamp(next,-s.limit,s.limit);
  if(next!==s.x&&Math.sign(s.v)===Math.sign(next))s.v=0;
 };
 const breathAt=t=>{const phase=(t%p.breath.period)/p.breath.period,q=phase<p.breath.inhale?phase/p.breath.inhale:(1-phase)/p.breath.exhale;return .5-.5*Math.cos(Math.PI*q);};
 function integrate(){
  tick++;const t=tick*naturalStep,profile=stateController?.sample(t).motion,breath=idle?breathAt(t):0,age=gesture?(tick-gesture.tick)*naturalStep:Infinity;
  const pulse=age<p.touch.pulse_seconds?Math.sin(Math.PI*age/p.touch.pulse_seconds)**2:0;
  if(age>=p.touch.pulse_seconds)gesture=null;
  const dir=gesture?.direction??0,kind=gesture?.region;
  const head=channels.get('head'),oldVelocity=head.v;
  spring(head,(profile?.head??0)+(idle ? p.head.sway*Math.sin(t*Math.PI/p.head.sway_pi_divisor)*(profile?.head_sway??1)+p.head.breath*breath : 0)+(kind==='head' ? p.head.head_touch : kind==='body' ? p.head.body_touch : 0)*dir*pulse);
  const acceleration=(head.v-oldVelocity)/naturalStep;
  spring(channels.get('head_y'),(profile?.head_y??0)-(-p.head_y.breath)*breath+(kind==='body' ? p.head_y.body_touch*pulse : kind==='head' ? p.head_y.head_touch*pulse : 0));
  spring(channels.get('arm_left'),(profile?.arm_left??0)-p.arms.breath*breath-(kind==='body' ? p.arms.body_touch : 0)*pulse);
  spring(channels.get('arm_right'),(profile?.arm_right??0)+p.arms.breath*breath+(kind==='body' ? p.arms.body_touch : 0)*pulse);
  spring(channels.get('tail'),(profile?.tail??0)+(idle ? p.tail.wind*Math.sin(t*Math.PI/p.tail.wind_pi_divisor) : 0)+(kind==='body' ? p.tail.body_touch*dir : 0)*pulse);
  p.moving_hair.forEach((id,i)=>{
   const s=channels.get(id),phase=i*p.hair.phase_step,wind=idle ? (id==='back_center' ? p.hair.wind_back_center : id.startsWith('fringe') ? p.hair.wind_fringe : p.hair.wind_other)*Math.sin(t*Math.PI/p.hair.wind_pi_divisor-phase) : 0;
   const parent=id.endsWith('_tip')?channels.get(id.replace('_tip','')):null;
   const target=wind+(parent?parent.x*p.hair.parent_position-parent.v*(-p.hair.parent_velocity):0);
   const force=-acceleration*(id==='ahoge'?-p.hair.acceleration_ahoge:id.startsWith('back')?-p.hair.acceleration_back:-p.hair.acceleration_other);
   spring(s,target,force);
  });
 }
 function advance(time){
  ensure(Number.isFinite(time)&&time>=requested&&time-requested<=b.rules.max_step_seconds,'invalid_natural_time');
  const end=Math.floor(time/naturalStep+p.tick_epsilon);while(tick<end)integrate();requested=time;return pose();
 }
 function setIdle(time,enabled){ensure(typeof enabled==='boolean','invalid_idle_control');advance(time);idle=enabled;return pose();}
 function setBase(time,id){ensure(stateController&&b.profiles.character_states_v1.base_states.includes(id),'invalid_natural_base_state');advance(time);const result=stateController.setBase(tick*naturalStep,id);return {...result,pose:pose()};}
 function complete(time,id){ensure(stateController&&typeof id==='string'&&id.length>0&&id.length<=b.profiles.character_states_v1.id_max_length,'invalid_natural_completion');advance(time);return stateController.complete(tick*naturalStep,id);}
 function touch(time,x,y){
  const region=characterTouchRegion(x,y);advance(time);
  if(!region||(tick-lastTouch)<p.touch.cooldown_ticks){rejected++;return {accepted:false,reason:region?'cooldown':'outside',region};}
  const side=clamp((x-p.touch.side_center)/p.touch.side_divisor,-1,1),direction=(side<0?-1:1)*(p.touch.direction_min+p.touch.direction_range*Math.abs(side));lastTouch=tick;accepted++;gesture={tick,region,direction};
  if(region==='head'){const now=tick*naturalStep;headExpression={start:headExpression&&now-headExpression.last<p.touch.expression_hold?headExpression.start:now,last:now};}
  const head=channels.get('head');head.v=clamp(head.v+direction*(region==='head'?p.touch.head_impulse:p.touch.body_impulse),-head.speed,head.speed);
  for(const id of p.moving_hair){const s=channels.get(id);s.v=clamp(s.v-direction*(id==='ahoge'?p.touch.hair_impulse_ahoge:id.endsWith('_tip')?p.touch.hair_impulse_tip:p.touch.hair_impulse_other),-s.speed,s.speed);}
  return {accepted:true,region,direction};
 }
 function pose(){
  const angles={head:channels.get('head').x};for(const id of p.moving_hair)angles[id]=channels.get(id).x;
  const world=rig.matrices(angles),dy=channels.get('head_y').x,translation=[1,0,0,1,0,dy];
  for(const p of parts){let ancestor=p;while(ancestor&&ancestor.id!=='head')ancestor=by.get(ancestor.parent);if(ancestor)world[p.id]=multiplyPose(translation,world[p.id]);}
  for(const id of ['arm_left','arm_right','tail']){angles[id]=channels.get(id).x;world[id]=multiplyPose(world[by.get(id).parent],pivotRotation(by.get(id).pivot,angles[id]));}
  return {time:tick*naturalStep,idle,angles,head_y:dy,world,feedback:gesture?{region:gesture.region,age:(tick-gesture.tick)*naturalStep}:null,head_expression:headExpression?{...headExpression}:null,...(stateController?{character_state:stateController.sample(tick*naturalStep)}:{})};
 }
 function status(){return {time:tick*naturalStep,requested_time:requested,idle,accepted_touches:accepted,rejected_touches:rejected,cooldown_seconds:p.touch.cooldown_ticks/p.integration_hz,channel_count:channels.size,active_feedback:gesture?1:0,channels:Object.fromEntries([...channels].map(([id,s])=>[id,{x:s.x,v:s.v,limit:s.limit,speed_limit:s.speed}]))};}
 return {advance,setIdle,setBase,complete,touch,pose,status};
}

/** Replay a bounded authoring timeline; events at the same time retain caller order. */
export function replayNaturalMotion(parts,time,events=[],options={}){
 const b=resolveCharacterBehavior(options.behavior);
 ensure(Number.isFinite(time)&&time>=0&&time<=b.rules.max_replay_seconds&&Array.isArray(events)&&events.length<=b.rules.events_per_channel,'invalid_natural_replay');
 const engine=createNaturalMotion(parts,{...options,behavior:b});let previous=0;
 for(const event of events){
  ensure(Number.isFinite(event.time)&&event.time>=previous&&event.time<=b.rules.max_replay_seconds&&['touch','idle',...(options.states?['state','success']:[])].includes(event.type),'invalid_natural_event');previous=event.time;
  if(event.time>time)continue;
  if(event.type==='idle')engine.setIdle(event.time,event.enabled);else if(event.type==='state')engine.setBase(event.time,event.state);else if(event.type==='success')engine.complete(event.time,event.id);else engine.touch(event.time,event.x,event.y);
 }
 engine.advance(time);return engine;
}
export function sampleNaturalMotion(parts,time,events=[],options={}){const engine=replayNaturalMotion(parts,time,events,options);return {pose:engine.pose(),status:engine.status()};}
