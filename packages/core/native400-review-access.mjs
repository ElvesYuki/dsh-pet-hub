import {publicNative400ControlsView} from './native400-review-controls-view.mjs';
import {publicNative400SourceReviewView} from './native400-source-review-view.mjs';
const accessNeed=ok=>{if(!ok)throw Object.assign(new Error('controls_invalid_response'),{code:'controls_invalid_response'});};
/** Private transport envelope. Selection references never belong in public render models.
 * Reconstruct and cross-check against the authoritative controls/session projection. */
export function native400ReviewEnvelope(input){
 const controls=publicNative400ControlsView(input?.controls),sourceReview=publicNative400SourceReviewView(input?.sourceReview);accessNeed(controls&&sourceReview);
 let selection=null;
 if(input.selection!==null){const s=input.selection,c=controls;accessNeed(s&&c.session?.active&&c.selection&&c.phase==='ready');
  accessNeed(typeof s.selection_id==='string'&&/^[a-f0-9]{64}$/.test(s.selection_id));
  accessNeed(s.service_instance_id===c.service_instance_id&&s.reviewer_session_id===c.session.reviewer_session_id&&s.selection_seq===c.selection_seq&&s.next_request_seq===(BigInt(c.request_seq_high_water)+1n).toString()&&BigInt(s.next_request_seq)<(1n<<64n)&&s.expected_revision===c.selection.expected_revision&&s.source_name===c.selection.source_name&&s.approval_inputs_sha256===c.selection.approval_inputs_sha256);
  selection=Object.fromEntries(['service_instance_id','reviewer_session_id','selection_id','selection_seq','next_request_seq','expected_revision','source_name','approval_inputs_sha256'].map(k=>[k,s[k]]));
 }
 return {controls,selection,sourceReview};
}
/** ACK confirms admission only. Never translates admission into current/device evidence. */
export function native400StartAck(v,request){accessNeed(v?.accepted===true&&typeof v.job_id==='string'&&/^[a-f0-9]{64}$/.test(v.job_id)&&v.request_seq===request.request_seq);return {accepted:true,job_id:v.job_id,request_seq:v.request_seq};}
export function native400CancelAck(v,request){
 accessNeed(v?.job_id===request.job_id&&typeof v.job_id==='string'&&/^[a-f0-9]{64}$/.test(v.job_id));
 if(v.io_exited===false){accessNeed(v.accepted===true&&v.cancel_requested===true);return {accepted:true,job_id:v.job_id,cancel_requested:true,io_exited:false};}
 accessNeed(v.io_exited===true&&['completed','failed','cancelled','outcome_unknown'].includes(v.status));return {job_id:v.job_id,status:v.status,io_exited:true};
}
