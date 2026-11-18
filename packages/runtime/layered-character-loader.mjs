/** Serialized candidate lifecycle. IO and synchronous transactional commit belong to adapters. */
export function createLayeredCharacterLoader({readSnapshot,prepare,commit,onStatus=()=>{}}){
 let generation=0,current=null,pending=null,running=null,closed=false,phase='empty';
 const report=(value,error)=>{phase=value;try{onStatus({phase,generation,has_current:!!current,...(error?{error:error.code??error.message}: {})});}catch{}};
 const dispose=value=>{try{value?.close();}catch{}};
 const stale=job=>closed||job.generation!==generation||job.abort.signal.aborted;
 async function pump(){
  while(pending){const job=pending;pending=null;running=job;let snapshot,candidate;
   try{
    report('reading');snapshot=await readSnapshot(job.input,job.abort.signal);if(stale(job))throw new DOMException('Aborted','AbortError');
    report('preparing');candidate=await prepare(snapshot,job.abort.signal);if(stale(job))throw new DOMException('Aborted','AbortError');
    const old=current;commit(candidate,old);current=candidate;candidate=null;dispose(old);report('ready');job.resolve({status:'ready',generation:job.generation});
   }catch(error){const cancelled=stale(job);if(!pending)report(closed?'closed':current?'ready':'empty',cancelled?null:error);job.resolve({status:cancelled?'cancelled':'failed',generation:job.generation,...(!cancelled?{error:error.code??error.message}: {})});}
   finally{dispose(candidate);dispose(snapshot);running=null;}
  }
 }
 let draining=Promise.resolve();
 function load(input){
  if(closed)return Promise.resolve({status:'closed'});generation++;running?.abort.abort();if(pending){pending.abort.abort();pending.resolve({status:'cancelled',generation:pending.generation});}
  const promise=new Promise(resolve=>{pending={input,generation,abort:new AbortController(),resolve};});
  // One pump, including across synchronous reads and callbacks.
  if(!running)draining=pump();return promise;
 }
 async function cancel(){generation++;running?.abort.abort();if(pending){pending.resolve({status:'cancelled',generation:pending.generation});pending=null;}await draining;if(!closed)report(current?'ready':'empty');}
 async function close(){if(!closed){closed=true;await cancel();dispose(current);current=null;report('closed');}else await draining;}
 return {load,cancel,close,status:()=>({phase,generation,has_current:!!current}),current:()=>current};
}
