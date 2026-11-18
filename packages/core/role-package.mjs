import {keys,requireThat,bounded,clone} from './protocol.mjs';
export const SEMANTICS=['idle','thinking','working','result','success','waiting','error','touch'];
export function validateRolePackage(m){
  requireThat(m.package_schema===2,'role_contract_required');keys(m.semantics,SEMANTICS);
  for(const key of SEMANTICS){bounded(m.semantics[key],0,2**32-1);requireThat(m.actions.some(a=>a.id===m.semantics[key]),'missing_semantic_action');}
  for(const a of m.actions){bounded(a.fps,1,120);bounded(a.frames,1,360);requireThat(['loop','once_hold','once_idle'].includes(a.loop),'invalid_loop');}
  requireThat(m.actions.find(a=>a.id===m.semantics.idle).loop==='loop','idle_must_loop');return clone(m);
}
/** Event key prevents a completed once_idle action restarting on each tick. */
export function roleFrame(manifest,actionId,elapsedMs){
  const a=manifest.actions.find(a=>a.id===actionId);requireThat(a,'unknown_action');bounded(elapsedMs,0,Number.MAX_SAFE_INTEGER);
  const frame=Math.floor(elapsedMs*a.fps/1000);
  if(a.loop==='loop')return {action_id:a.id,frame_index:frame%a.frames,completed:false};
  if(frame<a.frames)return {action_id:a.id,frame_index:frame,completed:false};
  if(a.loop==='once_hold')return {action_id:a.id,frame_index:a.frames-1,completed:true};
  const idle=manifest.actions.find(x=>x.id===manifest.semantics.idle);
  const after=Math.max(0,elapsedMs-a.frames*1000/a.fps);
  return {action_id:idle.id,frame_index:Math.floor(after*idle.fps/1000)%idle.frames,completed:true};
}
