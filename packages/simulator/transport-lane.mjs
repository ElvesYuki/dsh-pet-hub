import {bounded,requireThat} from '../core/protocol.mjs';
/** Offline reference only: one actual in-flight operation; FIFO controls ahead of the next segment.
 * No preemption/timer guarantee: callers must bound I/O; trusted onFault must not throw. Late/failing work freezes, never dispatches next.
 * close aborts and waits for the actual operation, even if it ignores AbortSignal. */
export function createTransportLane({clock,control_ms,segment_ms,wait_ms,onFault,metrics}){
 bounded(control_ms,1,30000);bounded(segment_ms,1,30000);bounded(wait_ms,1,30000);requireThat(typeof onFault==='function');const control=[],segment=[];let active=null,blocked=false,closed=false,running=null;
 function clear(error){for(const queue of [control,segment])for(const job of queue.splice(0))job.reject(error);}
 async function pump(){while(!closed&&!blocked&&(control.length||segment.length)){const job=control.shift()??segment.shift();active=job;const at=clock.now();try{requireThat(Number.isSafeInteger(at)&&at>=job.at,'lane_clock');requireThat(at-job.at<=wait_ms,'lane_wait_exceeded');metrics?.record('lane_wait',at-job.at);const value=await job.run({signal:job.abort.signal});const end=clock.now();requireThat(!closed&&!job.abort.signal.aborted,'lane_closed');requireThat(Number.isSafeInteger(end)&&end>=at&&end-at<=job.budget,'lane_budget_exceeded');job.resolve(value);}catch(error){blocked=true;job.abort.abort();job.reject(error);clear(error);if(!closed)onFault(error.code??'lane_work_failed');}finally{active=null;}}}
 function schedule(){if(!running)running=Promise.resolve().then(pump).finally(()=>{running=null;if(!closed&&!blocked&&(control.length||segment.length))schedule();});}
 return {
  enqueue({kind,bytes,run}){requireThat(!closed&&!blocked,'lane_blocked');requireThat(['control','segment'].includes(kind)&&typeof run==='function');bounded(bytes,1,kind==='segment'?32768:4096);const queue=kind==='control'?control:segment;requireThat(queue.length<(kind==='control'?8:1),'capacity_exceeded');const at=clock.now();bounded(at,0,Number.MAX_SAFE_INTEGER);const promise=new Promise((resolve,reject)=>queue.push({at,run,resolve,reject,abort:new AbortController(),budget:kind==='control'?control_ms:segment_ms}));schedule();return promise;},
  resources:()=>({closed,blocked,inflight:active?1:0,control_pending:control.length,segment_pending:segment.length}),
  async close(){closed=true;const error=Object.assign(new Error('lane closed'),{code:'lane_closed'});clear(error);active?.abort.abort();await running;}
 };
}
