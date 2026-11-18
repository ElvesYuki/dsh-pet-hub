// Pure authoring math. All textures and pivots share native 360 canvas coordinates.
import {layeredMovingHair} from './layered-character-profiles.mjs';
export const movingHair=layeredMovingHair;
export const probePeriod=8;
const identity=()=>[1,0,0,1,0,0];
const check=(ok,message)=>{if(!ok)throw new Error(message);};
export function multiplyPose(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function posePoint(m,p){return [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];}
export function pivotRotation(p,degrees){const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[x,y]=p;return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}

/** Validate once and compile parent references. Returned sampler is deterministic, with no clock,
 * DOM, physics state or root movement. Unknown/oversized angles are rejected, never clamped silently.
 */
export function createMotionProbe(parts){
 check(Array.isArray(parts)&&parts.length===21,'probe_parts_required');
 const by=new Map(parts.map(p=>[p.id,p]));
 check(by.size===21&&['body','head','hair_cap','head_accessories',...movingHair].every(id=>by.has(id)),'probe_parts_required');
 for(const p of parts){
  check((p.parent===null||by.has(p.parent))&&Array.isArray(p.pivot)&&p.pivot.length===2&&p.pivot.every(n=>Number.isFinite(n)&&n>=0&&n<=360),'invalid_probe_part');
  const seen=new Set();let current=p;while(current){check(!seen.has(current.id),'probe_parent_cycle');seen.add(current.id);current=by.get(current.parent);}
 }
 check(by.get('body').parent===null&&by.get('head').parent==='body'&&by.get('head_accessories').parent==='head'&&by.get('hair_cap').parent==='head'&&movingHair.every(id=>by.get(id).parent===(id.endsWith('_tip')?id.replace('_tip',''):'head')),'invalid_probe_hierarchy');
 function matrices(angles={}){
  check(angles&&typeof angles==='object'&&!Array.isArray(angles),'invalid_probe_angles');
  for(const [id,angle] of Object.entries(angles))check(['head',...movingHair].includes(id)&&Number.isFinite(angle)&&Math.abs(angle)<=4,'invalid_probe_angle');
  const world={};function visit(id){if(world[id])return world[id];const part=by.get(id),parent=part.parent?visit(part.parent):identity();world[id]=multiplyPose(parent,pivotRotation(part.pivot,angles[id]??0));return world[id];}
  parts.forEach(p=>visit(p.id));return world;
 }
 function sample(time,{mode='combined',selected='head',angle=2,strength=1}={}){
  check(Number.isFinite(time)&&time>=0&&Number.isFinite(strength)&&strength>=0&&strength<=1,'invalid_probe_time_or_strength');
  check(['neutral','combined','single'].includes(mode),'invalid_probe_mode');const angles={};
  if(mode==='single'){check(['head',...movingHair].includes(selected)&&Number.isFinite(angle)&&Math.abs(angle)<=2,'invalid_probe_selection');angles[selected]=angle*strength;}
  if(mode==='combined'){
   const t=(time%probePeriod)/probePeriod*2*Math.PI;
   // Integer harmonics close the 8-second loop. Phase differences are diagnostic, not a physical solver.
   movingHair.forEach((id,i)=>{const phase=i*.47,amplitude=id.endsWith('_tip')?1.7:id==='ahoge'?1.8:id==='back_center'?.45:id.startsWith('fringe')?.65:1.1;angles[id]=strength*amplitude*(Math.sin(t+phase)-Math.sin(phase))*.5;});
   angles.head=strength*.8*Math.sin(t);
  }
  return {angles,world:matrices(angles)};
 }
 return {matrices,sample};
}
