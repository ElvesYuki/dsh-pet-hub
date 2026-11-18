import { readFileSync } from 'node:fs';
const legacy=process.argv.includes('--legacy-128');
const data=JSON.parse(readFileSync(legacy?'docs/protocol/transport-budget-legacy128.json':'docs/protocol/transport-budget.json','utf8'));
const b=data.candidate_envelope_not_measurement;
const requirement=b.tls_peak_internal_allowance_bytes+b.additional_control_bytes+b.additional_worker_stack_bytes+b.required_internal_reserve_bytes;
let results;
if(legacy){
  const a=data.source_static;
  results={target_profile:data.target_profile,historical_only:true,psram_accounted_bytes:a.psram_slots*a.slot_bytes+a.frame_width*a.frame_height*2*a.rgb565_buffers+a.lvgl_pool_bytes,tls_record_buffers_only_bytes:a.tls_rx_record_bytes+a.tls_tx_record_bytes,candidate_pre_handshake_free_required_bytes:requirement,historical_download_free_approx_bytes:data.historical_report.internal_download_free_approx_bytes};
  if(results.psram_accounted_bytes!==14910464)throw new Error('Legacy budget changed; review');
}else{
  const a=data.source_static_host_report;
  const accounted=a.encoded_psram_bytes+a.rgb_and_history_psram_bytes+a.catalogs_psram_bytes+a.clip_psram_bytes+a.control_json_psram_bytes;
  results={target_profile:data.target_profile,status:'NO_GO_UNTIL_MEASURED',device_switch_confirmed_by_user:data.device_switch_confirmed_by_user,
    psram_accounted_host_bytes:accounted,psram_remainder_before_other_allocations_bytes:a.psram_physical_bytes-accounted,
    tls_record_buffers_only_bytes:a.tls_rx_record_bytes+a.tls_tx_record_bytes,candidate_pre_handshake_free_required_bytes:requirement,
    internal_download_free_bytes:data.dynamic_measurements.internal_download_free_bytes,
    reported_app_partition_headroom_bytes:a.reported_app_partition_bytes-a.reported_app_image_bytes};
  if(accounted!==6851241 || results.psram_remainder_before_other_allocations_bytes!==1537367)throw new Error('Native360 host budget changed; review');
}
if(requirement!==143360 || b.concurrent_tls_connections!==1)throw new Error('Candidate assumptions changed; review');
console.log(JSON.stringify(results,null,2));
console.log('Offline arithmetic only; source/host report is not a deployed-image or TLS heap measurement.');
