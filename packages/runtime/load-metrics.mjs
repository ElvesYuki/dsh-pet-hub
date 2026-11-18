import {bounded,keys,requireThat,clone} from '../core/protocol.mjs';
const NAMES=['certificate_leaf','metadata_read','metadata_load','peer_binding','session_check','tls_handshake','segment_round_trip','control_round_trip','instrumentation','instrumentation_batch','lane_wait'];
export const ROOT_METRICS=['root_prepare','root_publish','root_exchange','root_commit','root_checkpoint_validate','root_lock','root_cas','root_encode','root_file_write','root_file_sync','root_rename','root_directory_sync','root_remember','root_lock_release','root_transaction'];
export const ROOT_COUNTERS=['root_commit_calls','root_commit_noops','root_file_write_bytes','root_lock_attempts','root_lock_acquired','root_cas_checks','root_file_syncs','root_directory_syncs','root_renames','root_encode_bytes','root_full_file_hashes','root_extra_digest_calls','root_verified_digest_reuses','root_noop_encode_skips'];
const EXTRA=['certificate_static','certificate_validity',...ROOT_METRICS];
const COUNTERS=['metadata_bytes','asset_write_bytes','asset_write_calls'];
const BINS=[0.05,0.1,0.25,0.5,1,2,5,10,25,50,100,250,1000,10000];
/** Explicit synchronous/async numeric instrumentation. Fixed names and bins; no raw inputs or retained samples.
 * Inclusive scopes overlap; totals must not be summed as disjoint time. Work errors propagate unchanged. */
export function createLoadMetrics({now=()=>performance.now()}={}){
 let stats={},counters={};
 function sample(name,ms,failed){requireThat([...NAMES,...EXTRA].includes(name),'metric_name');requireThat(Number.isFinite(ms)&&ms>=0,'metric_clock');const s=stats[name]??={count:0,failed:0,total_ms:0,max_ms:0,buckets:Array(BINS.length+1).fill(0)};s.count++;s.failed+=failed?1:0;s.total_ms+=ms;s.max_ms=Math.max(s.max_ms,ms);const index=BINS.findIndex(upper=>ms<=upper);s.buckets[index<0?BINS.length:index]++;}
 return {
  measure(name,work){requireThat([...NAMES,...EXTRA].includes(name),'metric_name');const start=now();let failed=true;try{const value=work();failed=false;return value;}finally{sample(name,now()-start,failed);}},
  async measureAsync(name,work){requireThat([...NAMES,...EXTRA].includes(name),'metric_name');const start=now();let failed=true;try{const value=await work();failed=false;return value;}finally{sample(name,now()-start,failed);}},
  record(name,ms){sample(name,ms,false);},
  add(name,n){requireThat([...COUNTERS,...ROOT_COUNTERS].includes(name),'metric_name');bounded(n,0,2**31-1);const next=(counters[name]??0)+n;bounded(next,0,Number.MAX_SAFE_INTEGER);counters[name]=next;},
  reset(){stats={};counters={};},
  snapshot(){return clone({stats,counters,bin_upper_ms:BINS});}
 };
}
/** Validates the deliberately numeric-only evidence before a supervisor persists it. */
export function validateTransportObservations(v){
 keys(v,['profiles','budget','scope']);requireThat(v.scope==='host-samples-not-physical-bounds');requireThat(Array.isArray(v.profiles)&&v.profiles.length===4);
 for(const p of v.profiles){keys(p,['bindings','write_bytes','range_bytes','rounds','asset_bytes','initial_static_checks','elapsed_ms','metrics']);for(const k of ['bindings','write_bytes','range_bytes','rounds','asset_bytes'])bounded(p[k],1,2**24);if(p.initial_static_checks!==undefined)bounded(p.initial_static_checks,0,2**24);requireThat(Number.isFinite(p.elapsed_ms)&&p.elapsed_ms>=0);keys(p.metrics,['stats','counters','bin_upper_ms']);requireThat(JSON.stringify(p.metrics.bin_upper_ms)===JSON.stringify(BINS));keys(p.metrics.stats,[...NAMES,...EXTRA]);requireThat(NAMES.every(k=>Object.hasOwn(p.metrics.stats,k)));keys(p.metrics.counters,COUNTERS);requireThat(COUNTERS.every(k=>Object.hasOwn(p.metrics.counters,k)));for(const n of Object.values(p.metrics.counters))bounded(n,0,Number.MAX_SAFE_INTEGER);for(const s of Object.values(p.metrics.stats)){keys(s,['count','failed','total_ms','max_ms','buckets']);bounded(s.count,0,Number.MAX_SAFE_INTEGER);bounded(s.failed,0,s.count);for(const k of ['total_ms','max_ms'])requireThat(Number.isFinite(s[k])&&s[k]>=0);requireThat(Array.isArray(s.buckets)&&s.buckets.length===BINS.length+1);for(const n of s.buckets)bounded(n,0,s.count);requireThat(s.buckets.reduce((a,b)=>a+b,0)===s.count);}}
 requireThat(Array.isArray(v.budget)&&v.budget.length===3);for(const b of v.budget){keys(b,['ahead','control_ms','queue_ms','command_delay_ms','max_round_trip_ms','send_horizon_ms','worst_rtt_fits']);for(const k of ['ahead','control_ms','queue_ms','command_delay_ms','max_round_trip_ms','send_horizon_ms'])bounded(b[k],0,30000);requireThat(typeof b.worst_rtt_fits==='boolean');}return clone(v);
}

/** Both strategies must use the same fixed workload; only known numeric observations may leave the lab. */
export function validateVerificationComparison(v){keys(v,['baseline','scoped','scope']);requireThat(v.scope==='same-load-host-only');for(const key of ['baseline','scoped']){validateTransportObservations(v[key]);for(const p of v[key].profiles)bounded(p.initial_static_checks,0,2**24);}for(let i=0;i<4;i++)for(const k of ['bindings','write_bytes','range_bytes','rounds','asset_bytes'])requireThat(v.baseline.profiles[i][k]===v.scoped.profiles[i][k]);return clone(v);}
