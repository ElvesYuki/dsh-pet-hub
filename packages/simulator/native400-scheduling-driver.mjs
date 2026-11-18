import {native400CycleBudget} from '../core/native400-cycle-budget.mjs';
import {createPullRequestOwner} from '../runtime/pull-request-owner.mjs';
import {requireThat as need,bounded} from '../core/protocol.mjs';
/** Explicit offline peer pump, no listener/timer polling. Owns one source operation,
 * borrows real TLS gateway/executor and an optional local4 reader. Caller supplies time.
 * Touch fences immediately but drains an admitted GET; close waits actual source exit. */
export function createNative400SchedulingDriver({executor,clock,gateway,localSource=null,pollMs=500,ioMs=1000}){
 const budget=native400CycleBudget();bounded(pollMs,1,budget.poll_ms);bounded(ioMs,1,budget.source_ms);need(executor.snapshot().schedule&&typeof gateway.exchange==='function'&&typeof gateway.read==='function','scheduling_dependencies');const owner=createPullRequestOwner({clock});let busy=false,closed=false,closing=null,nextPoll=0,lastFailure=null,signature=null,pumpExit=null,resolvePump=null,lastClock=-1,computeSpent=0;
 function now(){const n=clock.now();bounded(n,0,Number.MAX_SAFE_INTEGER);need(n>=lastClock,'clock_failed');lastClock=n;return n;}
 function compute(fn){const start=now(),result=fn();computeSpent+=now()-start;need(computeSpent<=budget.compute_ms,'compute_budget_exceeded');return result;}
 const stamp=()=>{const s=executor.snapshot();return [s.context?.session_id,s.schedule?.generation,s.work?.action,s.work?.pass,s.work?.local].join(':');};
 const current=s=>!closed&&stamp()===s;
 async function poll(force=false){if(force||executor.resources().outbox||now()>=nextPoll){await owner.run({deadline:now()+budget.exchange_ms,operation:({signal,deadline})=>gateway.exchange({signal,deadline})});nextPoll=now()+pollMs;}}
 async function read(){const token=stamp();await poll(true);if(!current(token))return 'discarded';const s=executor.snapshot();need(s.work,'window_phase');let part;
  if(s.work.local){need(localSource&&typeof localSource.read==='function','unsupported_feature');const offset=s.work.received,n=Math.min(32768,localSource.bytes-offset);need(n>0,'invalid_segment');part=await owner.run({deadline:now()+ioMs,operation:async({signal})=>({kind:'asset',offset,bytes:await localSource.read(offset,n,{signal})})});}
  else part=await owner.run({deadline:now()+ioMs,operation:({signal,deadline})=>gateway.read({signal,deadline})});
  if(closed)return 'closed';await poll(true);if(!current(token))return 'discarded';if(part.kind==='asset')compute(()=>executor.supply(part.offset,part.bytes));return part.kind;
 }
 function reportPhase(){const s=executor.snapshot(),key=[s.schedule?.generation,s.work?.pass,s.model.phase].join(':');if(key!==signature){signature=key;if(['buffering','ended','loop_wait'].includes(s.model.phase)&&s.actual)compute(()=>executor.display());}}
 const api={
  touch(){need(!closed,'driver_closed');return executor.requestTouch({sourceAvailable:!!localSource});},
  async pump(){need(!closed,'driver_closed');need(!busy,'driver_busy');busy=true;computeSpent=0;pumpExit=new Promise(r=>resolvePump=r);
   try{let s=executor.snapshot();if(s.schedule?.touch?.phase==='pending'){compute(()=>executor.beginTouch());await poll(true);return {state:'touch_started'};}
    await poll();s=executor.snapshot();if(!s.context)return {state:'offline'};if(!s.work)return {state:'idle'};
    if(s.work.failed){if(s.work.local){compute(()=>executor.endTouch({failed:true}));await poll(true);}return {state:'failed'};}
    const frames=s.work.action===42?118:241;
    if(s.work.pass_verified){if(s.model.phase==='verified'){compute(()=>executor.replay());return {state:'replay'};}compute(()=>executor.tick());reportPhase();s=executor.snapshot();if(s.model.phase==='ended'&&s.work.local){compute(()=>executor.endTouch());await poll(true);return {state:'touch_ended'};}if(s.model.phase==='loop_wait'&&s.work.mode==='base_loop'){need(s.schedule.latest?.active,'stale_revision');compute(()=>executor.replay());return {state:'loop'};}await poll();return {state:s.model.phase};}
    if(s.model.decoded_frames===frames&&s.model.ready_frame===null){compute(()=>executor.verify());await poll(true);return {state:'verified'};}
    if(!s.work.received)return {state:await read()};
    if(s.model.ready_frame===null){if(compute(()=>executor.decode()))return {state:'decoded'};compute(()=>executor.tick());reportPhase();await poll();return {state:await read()};}
    const wasBuffering=s.model.phase==='buffering',frame=compute(()=>executor.prepareFrame());if(frame){const a=compute(()=>executor.submitFrame(frame));if(a.frame_index===0||a.frame_index===frames-1||wasBuffering){compute(()=>executor.display());await poll(true);}return {state:'frame',frame:a.frame_index,action:a.asset_ref.action_id};}
    s=executor.snapshot();const due=Math.ceil(s.model.ready_frame*1000/24);if(['priming','buffering'].includes(s.model.phase)||s.model.elapsed_ms>=due){if(compute(()=>executor.demand()).receive)return {state:await read()};return {state:'backpressure'};}return {state:'waiting'};
   }catch(error){lastFailure=error.code??'driver_failed';const s=executor.snapshot();if(!closed&&s.context&&s.work?.failed){try{if(s.work.local)compute(()=>executor.endTouch({failed:true}));await poll(true);return {state:'failed',error:lastFailure};}catch(recovery){lastFailure=recovery.code??'driver_failed';executor.disconnect();throw recovery;}}executor.disconnect();throw error;}
   finally{busy=false;resolvePump();pumpExit=null;resolvePump=null;}
  },
  resources:()=>({closed,busy,source:owner.resources(),last_failure:lastFailure,cycle_budget:budget}),
  close(){if(closing)return closing;closed=true;executor.disconnect();return closing=(async()=>{await Promise.all([owner.close(),pumpExit]);await localSource?.close?.();})();}
 };return api;
}
