import {claimNative400PrivateConfigSession} from './native400-private-config-session.mjs';
const fail=c=>Object.assign(new Error(c),{code:c}),need=(ok,c='config_owner_invalid')=>{if(!ok)throw fail(c);};
const clean=c=>{const r=c.resources(),s=c.snapshot();return r.file_descriptors===0&&!r.lock_held&&!r.staging_directory&&!r.consumer_running&&r.timers===0&&!r.buffer_retained&&(!s.consumer_started||r.consumer_exit_confirmed);};
/** Single live/pending config session owner. Reservation precedes trusted sync
 * creation; closing fences new work and waits for reservations and actual I/O.
 * Unknown cleanup remains owned; no implicit retryCleanup or consumer rerun. */
export function createNative400ConfigOwner(){
 const identity={},entries=new Set();let fenced=false,closing=null;
 const begin=()=>{need(!fenced,'config_owner_closed');need(entries.size===0,'config_owner_busy');let resolve;const e={control:null,registered:new Promise(r=>resolve=r),resolve:null};e.resolve=resolve;entries.add(e);return e;};
 function install(e,task){try{if(task&&typeof task.then==='function'){Promise.resolve(task).catch(()=>{});throw fail('config_owner_invalid');}e.control=claimNative400PrivateConfigSession(task,identity);e.resolve();
   const release=()=>{if(clean(e.control))entries.delete(e);};e.control.ready.then(release,release).catch(()=>{});
   if(fenced){const p=e.control.close();p.catch(()=>{});}return task;
  }catch(error){e.resolve();entries.delete(e);throw error;}}
 function fence(){if(fenced)return;fenced=true;for(const e of entries)if(e.control){const p=e.control.close();p.catch(()=>{});}}
 return {adopt(task){return install(begin(),task);},start(factory){need(typeof factory==='function');const e=begin();let task;try{task=factory();}catch(error){e.resolve();entries.delete(e);throw error;}return install(e,task);},fence,
 resources:()=>({fenced,sessions:entries.size,pending:[...entries].filter(e=>!e.control).length}),
 close(){fence();if(closing)return closing;closing=(async()=>{const rows=[...entries];await Promise.all(rows.map(e=>e.registered));const outcomes=await Promise.allSettled(rows.filter(e=>e.control).map(async e=>{await e.control.close();need(clean(e.control),'config_owner_cleanup_incomplete');entries.delete(e);}));need(outcomes.every(r=>r.status==='fulfilled')&&entries.size===0,'config_owner_cleanup_incomplete');})();closing=closing.catch(error=>{closing=null;throw error;});return closing;}
 };
}
