/** Public A5 summary: only bounded enums/counts; no paths, config, inode proofs or credential data. */
export function publicAssemblyView(v){
 if(v==null)return null;const need=ok=>{if(!ok)throw new Error('invalid_assembly_view');};
 need(v.schema_version===1&&v.profile==='round-pet-assembly-review/1'&&v.production_listener===false&&typeof v.review_enabled==='boolean');
 need(['validating','disabled','review','suspended','blocked','failed','closing','closed'].includes(v.phase));need(v.phase==='review'||!v.review_enabled);
 need(v.error===null||(typeof v.error==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(v.error)));need(typeof v.inventory_confirmed==='boolean');
 need(['blocked','inventory_unknown','playback_unverified','already_available','needs_victim','ready'].includes(v.write_gate));
 const counts={};for(const k of ['open_files','active_http','managed_sessions']){need(Number.isSafeInteger(v.counts?.[k])&&v.counts[k]>=0&&v.counts[k]<=64);counts[k]=v.counts[k];}need(typeof v.counts.worker_alive==='boolean');counts.worker_alive=v.counts.worker_alive;
 return {schema_version:1,profile:v.profile,production_listener:false,review_enabled:v.review_enabled,phase:v.phase,error:v.error,inventory_confirmed:v.inventory_confirmed,write_gate:v.write_gate,counts};
}
