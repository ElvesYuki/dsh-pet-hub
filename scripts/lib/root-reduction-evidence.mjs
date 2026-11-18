import {keys,requireThat as need,clone,same} from '../../packages/core/protocol.mjs';
import {validateRootLoadEvidence} from './root-load-evidence.mjs';
/** Offline supervisor only. Fresh full/reduced runs must retain identical work and safety costs.
 * Timings are observations, never a pass condition or a physical latency bound. */
export function validateRootReductionEvidence(v){
 keys(v,['scope','full','reduced']);need(Object.keys(v).length===3&&v.scope==='same-root-load-host-only','invalid_root_comparison');
 for(const key of ['full','reduced'])validateRootLoadEvidence(v[key]);
 need(same(v.full.capacity,v.reduced.capacity)&&same(v.full.budget,v.reduced.budget),'unequal_root_workload');
 for(let i=0;i<4;i++){
  const a=v.full.profiles[i],b=v.reduced.profiles[i];
  for(const k of ['bindings','persistent','rounds','asset_bytes','file_bytes','initial_static_checks','trace','noop'])need(same(a[k],b[k]),'unequal_root_workload');
  for(const k of ['metadata_load','metadata_read','certificate_validity','session_check','control_round_trip','segment_round_trip'])need(a.metrics.stats[k].count===b.metrics.stats[k].count&&a.metrics.stats[k].failed===b.metrics.stats[k].failed,'unequal_root_workload');
  const count=(p,k)=>p.metrics.counters[k]??0;
  for(const k of ['metadata_bytes','asset_write_bytes','asset_write_calls','root_commit_calls','root_commit_noops','root_lock_attempts','root_lock_acquired','root_cas_checks','root_file_write_bytes','root_file_syncs','root_directory_syncs','root_renames','root_full_file_hashes'])need(count(a,k)===count(b,k),'unequal_root_workload');
  if(a.persistent){
   need(count(a,'root_full_file_hashes')===a.metrics.stats.metadata_load.count&&count(a,'root_extra_digest_calls')===a.metrics.stats.root_remember.count&&count(a,'root_verified_digest_reuses')===0,'invalid_root_comparison');
   need(count(b,'root_extra_digest_calls')===0&&count(b,'root_verified_digest_reuses')===b.metrics.stats.root_remember.count&&count(b,'root_noop_encode_skips')===count(b,'root_commit_noops'),'invalid_root_comparison');
   need(a.metrics.stats.root_encode.count===b.metrics.stats.root_encode.count+count(b,'root_noop_encode_skips')&&count(b,'root_encode_bytes')<count(a,'root_encode_bytes'),'invalid_root_comparison');
  }
 }
 return clone(v);
}
