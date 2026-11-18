import {resolveCharacterBehavior} from './layered-character-profiles.mjs';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*(3-2*p);};
export function blinkStarts(until,behavior){
 const p=resolveCharacterBehavior(behavior).profiles.expression_v1,r=p.blink;
 assert(Number.isFinite(until)&&until>=0&&until<=p.max_seconds,'invalid_expression_time');
 const times=[];let t=r.first,seed=r.seed;
 while(t<=until){times.push(t);seed=(seed*r.multiplier+r.increment)>>>0;t+=r.interval_min+(seed/r.modulus)*r.interval_range;}
 return times;
}
export function sampleExpression(time,headTouch=null,behavior){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.expression_v1,r=p.touch;
 assert(Number.isFinite(time)&&time>=0&&time<=p.max_seconds,'invalid_expression_time');
 if(headTouch)assert(Number.isFinite(headTouch.start)&&Number.isFinite(headTouch.last)&&headTouch.start>=0&&headTouch.last>=headTouch.start&&headTouch.last<=time,'invalid_expression_touch');
 let eye='open',relaxed=0,smile=0,owner='blink';
 if(headTouch){
  const entry=time-headTouch.start,age=time-headTouch.last;
  if(age<r.hold){
   owner='head_touch';const fade=1-smooth((age-r.release_start)/r.release_duration);relaxed=smooth(entry/r.entry)*fade;smile=relaxed;
   if(entry<r.eye_entry[0])eye='half';else if(entry<r.eye_entry[1])eye='closed';else if(age<r.eye_release[0])eye='smile';else if(age<r.eye_release[1])eye='closed';else if(age<r.eye_release[2])eye='half';else eye='open';
   return {eye,brows:{neutral:1-relaxed,relaxed,raised:0},mouth:{closed:1-smile,smile},owner};
  }
 }
 const starts=blinkStarts(time,b),start=starts.at(-1),age=start===undefined?Infinity:time-start;
 const overlapsRelease=headTouch&&start<headTouch.last+r.hold,e=p.blink.thresholds;
 if(!overlapsRelease){if(age<e[0])eye='half';else if(age<e[1])eye='closed';else if(age<e[2])eye='half';}
 return {eye,brows:{neutral:1,relaxed:0,raised:0},mouth:{closed:1,smile:0},owner};
}
