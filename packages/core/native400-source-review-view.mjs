// Dependency-free public boundary, also included in the fixed client bundle.
const sourceReviewNeed=(ok,code='invalid_source_review')=>{if(!ok)throw Object.assign(new Error(code),{code});};
/** Display label only. Absolute source paths are never a public or disk field. */
export function native400ReviewSourceName(v){sourceReviewNeed(typeof v==='string'&&v.trim().length>0&&v.length<=128&&!/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v)&&!['.','..'].includes(v),'review_source_name_invalid');return v;}
export const NATIVE400_REVIEW_ERRORS=Object.freeze(['review_authorization_invalid','review_authorization_denied','review_authorization_reentrant','bootstrap_selection_invalid','bootstrap_selection_mismatch','bootstrap_selection_changed','bootstrap_selection_revoked','bootstrap_selection_expired','bootstrap_selection_clock','sequence_exhausted','review_failed','review_cancelled','review_closed','review_busy','review_history_missing','review_map_changed','review_commit_unknown','review_storage_failed','review_journal_invalid','review_journal_locked','review_journal_rollback','review_source_name_invalid','revision_conflict','bootstrap_cancelled','bootstrap_deadline','bootstrap_unsafe_source','bootstrap_source_changed','bootstrap_read_failed','bootstrap_payload_mismatch','bootstrap_no_valid_root','bootstrap_equal_roots','bootstrap_below_floor','bootstrap_map_invalid','bootstrap_map_approval_mismatch']);
/** Allowlist source-audit view, never a device observation. No approval bodies/paths,
 * filesystem, device controls, or implicit promotion of historical records. */
export function publicNative400SourceReviewView(v){
 if(v===undefined||v===null)return null;const need=sourceReviewNeed,uint64=x=>{need(typeof x==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(x)&&BigInt(x)<=(1n<<64n)-1n);return BigInt(x);},digest=x=>need(typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)),bounded=(x,min,max)=>need(Number.isSafeInteger(x)&&x>=min&&x<=max);const bad='invalid_source_review';need(v&&typeof v==='object'&&!Array.isArray(v),bad);
 need(v.schema_version===1&&v.profile==='native400-source-review-view/1'&&v.scope==='offline-source-review'&&v.device_evidence===false,bad);
 const phases=['empty','historical','reviewing','current','failed','cancelled','closed','uncertain'];need(phases.includes(v.phase)&&typeof v.current_run==='boolean',bad);uint64(v.revision);
 need(v.current_run===(v.phase==='current')&&((v.revision==='0')===(v.history===null)),bad);
 let history=null,attempt=null;
 if(v.history!==null){const x=v.history;need(x&&typeof x==='object'&&x.media_validation==='not-performed',bad);native400ReviewSourceName(x.source_name);digest(x.map_sha256);digest(x.cache_sha256);digest(x.namespace_boot);uint64(x.root_sequence);need(x.root_sequence!=='0'&&Array.isArray(x.objects)&&x.objects.length===4,bad);const ids=new Set(),slots=new Set();
  const objects=x.objects.map(o=>{need(o&&[0,4,1,11].includes(o.action_id)&&!ids.has(o.action_id)&&!slots.has(o.slot),bad);bounded(o.slot,0,4);uint64(o.generation);need(o.generation!=='0',bad);digest(o.file_sha256);ids.add(o.action_id);slots.add(o.slot);return {action_id:o.action_id,slot:o.slot,generation:o.generation,file_sha256:o.file_sha256};});
  history={source_name:x.source_name,map_sha256:x.map_sha256,cache_sha256:x.cache_sha256,namespace_boot:x.namespace_boot,root_sequence:x.root_sequence,objects,media_validation:'not-performed'};
 }
 if(v.attempt!==null){const x=v.attempt;need(x&&['review','revalidate'].includes(x.kind),bad);native400ReviewSourceName(x.source_name);attempt={source_name:x.source_name,kind:x.kind};}
 need(v.error===null||NATIVE400_REVIEW_ERRORS.includes(v.error),bad);
 need(v.phase!=='current'||history!==null,bad);need(v.phase!=='historical'||history!==null,bad);need(v.phase!=='empty'||history===null,bad);
 need((v.phase==='reviewing')===(attempt!==null),bad);need(['failed','cancelled','uncertain'].includes(v.phase)?v.error!==null:v.error===null,bad);
 need(v.phase!=='uncertain'||v.error==='review_commit_unknown',bad);
 return {schema_version:1,profile:v.profile,scope:v.scope,phase:v.phase,revision:v.revision,current_run:v.current_run,history,attempt,error:v.error,device_evidence:false};
}
