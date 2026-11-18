import {randomBytes,timingSafeEqual} from 'node:crypto';import {native400ReviewedLanControlContext} from './native400-reviewed-lan-request.mjs';import {native400LanHostControlContext,native400LanHostDescriptor} from './native400-tcp-lan-host.mjs';import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';import {sha256} from './material-import.mjs';
import {NODE_CONTROL_PROTOCOL,native400NodeControlBody,native400NodeControlAck,native400NodeControlEnvelope} from '../core/native400-node-control-access.mjs';
const prepared=new WeakMap(),fail=c=>Object.assign(Error(c),{code:c}),need=(v,c='controls_invalid_request')=>{if(!v)throw fail(c);};
/** No I/O or approval issuance. Genuine audited request, exact window and policy. */
export function prepareNative400NodeControlAccess(input){need(input&&Object.keys(input).every(k=>['request','sessionMs','clock','timers','shared','autoRecover'].includes(k)));const {request,sessionMs=60000,shared=false,autoRecover=shared,clock=()=>Math.floor(performance.now()),timers={setInterval,clearInterval}}=input,binding=native400ReviewedLanControlContext(request);need(typeof shared==='boolean'&&typeof autoRecover==='boolean'&&(!autoRecover||shared));need(Number.isInteger(sessionMs)&&sessionMs>=1&&sessionMs<=120000&&typeof clock==='function'&&timers&&typeof timers.setInterval==='function'&&typeof timers.clearInterval==='function');const descriptor={profile:NODE_CONTROL_PROTOCOL,session_ms:sessionMs,binding_sha256:sha256(C(native400LanHostDescriptor(binding.lanReview))),...(shared?{session_mode:'shared-window/1',auto_recover:autoRecover,receipt_capacity:32,attachment_capacity:16}:{})},option=Object.freeze({});prepared.set(option,{binding,sessionMs,shared,autoRecover,clock,timers,descriptor});return option;}
export function native400NodeControlDescriptor(option,lanReview){const p=prepared.get(option);need(p&&p.binding.lanReview===lanReview);p.binding.check();return structuredClone(p.descriptor);}
/** Elected owner only. Private credentials never enter status or descriptor.
 * Legacy expiry cancels its target; shared attachments expire independently.
 * Source/window loss fences either mode. */
export function createNative400NodeControlChannel(option,lanReview,owner,instanceId){const p=prepared.get(option);native400NodeControlDescriptor(option,lanReview);const lane=native400LanHostControlContext(lanReview,owner);if(p.shared)return createSharedChannel(p,lane,instanceId);let current=null,closed=false,lastTime=0,timer=null;
 const now=()=>{const t=p.clock();need(Number.isSafeInteger(t)&&t>=lastTime&&t<=Number.MAX_SAFE_INTEGER-p.sessionMs,'controls_clock_invalid');lastTime=t;return t;};
 function end(){if(current?.hasTarget){try{lane.cancel();}catch{fence();}}current=null;}
 function fence(){closed=true;current=null;if(timer!==null){p.timers.clearInterval(timer);timer=null;}lane.fence();}
 function guard(){need(!closed,'controls_closed');try{p.binding.check();const s=lane.snapshot();need(!s.window.invalid&&s.window.remaining_ms>0&&s.phase!=='closed','controls_selection_stale');if(current&&now()>=current.end)end();return s;}catch{fence();throw fail('controls_selection_stale');}}
 function auth(token){guard();need(current&&typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&timingSafeEqual(Buffer.from(current.token),Buffer.from(token)),'controls_unauthorized');return current;}
 timer=p.timers.setInterval(()=>{try{guard();}catch{}},25);
 return {authorize(){guard();end();need(!closed,'controls_closed');const t=now();current={token:randomBytes(32).toString('hex'),id:randomBytes(32).toString('hex'),end:t+p.sessionMs,seq:0n,revision:0n,last:null,hasTarget:false};return {token:current.token,service_instance_id:instanceId,control_session_id:current.id};},
  revoke(c){auth(c?.token);end();},
  request(token,method,path,body){const s=auth(token),state=lane.snapshot();if(method==='GET'&&path==='/v1/node-control/controls'){const frame=state.observation?.last_frame0??state.history;return native400NodeControlEnvelope({protocol:NODE_CONTROL_PROTOCOL,service_instance_id:instanceId,control_session_id:s.id,next_request_seq:(s.seq+1n).toString(),revision:s.revision.toString(),active:true,remaining_ms:Math.max(0,s.end-now()),transport:{phase:state.phase,network_ready:state.network.ready,frame0_history:frame?{action:frame.action,reported:true}:null},verified:null,current_display:'unknown',device_evidence:false});}
   need(method==='POST'&&path==='/v1/node-control/command');const r=native400NodeControlBody(body),text=C(r);need(r.service_instance_id===instanceId,'controls_stale_instance');need(r.control_session_id===s.id,'controls_session_conflict');
   if(BigInt(r.request_seq)===s.seq&&s.last){need(s.last.text===text,'controls_idempotency_conflict');return structuredClone(s.last.ack);}need(BigInt(r.request_seq)>s.seq,'controls_stale_request');need(BigInt(r.request_seq)===s.seq+1n,'controls_sequence_gap');need(BigInt(r.expected_revision)===s.revision,'revision_conflict');need(s.seq<(1n<<64n)-2n&&s.revision<(1n<<64n)-2n,'sequence_exhausted');need(state.network.ready&&state.phase!=='paused','controls_busy');
   const command=()=>{if(r.operation==='base')lane.base(r.action,r.ttl_ms);else lane.cancel();};try{command();}catch{throw fail('controls_operation_failed');}s.seq++;s.revision++;s.hasTarget=r.operation==='base';const ack=native400NodeControlAck({submitted:true,operation:r.operation,request_seq:r.request_seq,command_id:randomBytes(32).toString('hex'),revision:s.revision.toString()},r);s.last={text,ack};return structuredClone(ack);
  },fence,close(){fence();return lane.close();},resources:()=>({timers:timer===null?0:1,session:current?1:0,closed})};
}

/** Shared logical state belongs to the window, not to any browser attachment.
 * Tokens are bounded independent leases. Only maintenance may auto-recover;
 * status polling never calls restore. All intent handles retain original TTL. */
function createSharedChannel(p,lane,instanceId){
 const attachments=new Map();let group=null,closed=false,lastTime=0,timer=null;
 function now(){const t=p.clock();need(Number.isSafeInteger(t)&&t>=lastTime&&t<=Number.MAX_SAFE_INTEGER-p.sessionMs,'controls_clock_invalid');lastTime=t;return t;}
 function endGroup(){if(group?.intent?.isCurrent()){try{lane.cancel();}catch{fence();}}group=null;attachments.clear();}
 function fence(){closed=true;group=null;attachments.clear();if(timer!==null){p.timers.clearInterval(timer);timer=null;}lane.fence();}
 function guard(recover=false){need(!closed,'controls_closed');try{
  p.binding.check();const s=lane.snapshot();need(!s.window.invalid&&s.window.remaining_ms>0&&s.phase!=='closed','controls_selection_stale');const t=now();for(const [token,a] of attachments)if(t>=a.end)attachments.delete(token);
  if(recover&&p.autoRecover&&group?.intent?.canRecover()&&s.desired?.remaining_ms>0&&s.recovery_required&&s.phase==='open'&&s.network.ready){if(group.intent.restore())group.recoveries++;}
  return s;
 }catch{fence();throw fail('controls_selection_stale');}}
 function auth(token){guard();need(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&attachments.has(token)&&group,'controls_unauthorized');return attachments.get(token);}
 timer=p.timers.setInterval(()=>{try{guard(true);}catch{}},25);
 return {authorize(){guard();need(attachments.size<16,'controls_busy');if(!group)group={id:randomBytes(32).toString('hex'),seq:0n,revision:0n,receipts:new Map(),last:null,intent:null,recoveries:0n};const token=randomBytes(32).toString('hex');attachments.set(token,{end:now()+p.sessionMs});return {token,service_instance_id:instanceId,control_session_id:group.id};},
  detach(c){auth(c?.token);attachments.delete(c.token);return {detached:true};},
  revoke(c){auth(c?.token);endGroup();},endSession(){guard();endGroup();},
  request(token,method,path,body){const a=auth(token),s=lane.snapshot(),g=group;
   if(method==='GET'&&path==='/v1/node-control/controls'){
    const current=g.intent?.isCurrent()&&s.desired?.remaining_ms>0?s.desired:null,frame=s.observation?.last_frame0??s.history,last=g.last;
    return native400NodeControlEnvelope({protocol:NODE_CONTROL_PROTOCOL,service_instance_id:instanceId,control_session_id:g.id,next_request_seq:(g.seq+1n).toString(),revision:g.revision.toString(),active:true,remaining_ms:Math.max(0,a.end-now()),transport:{phase:s.phase,network_ready:s.network.ready,frame0_history:frame?{action:frame.action,reported:true}:null},shared:{profile:'native400-shared-control/1',limits:{profile:'shared-limits/1',source_window_ms:s.window.remaining_ms},attachments:attachments.size,desired:current?{action:current.action,remaining_ms:current.remaining_ms}:null,recovery:{enabled:p.autoRecover,pending:!!(p.autoRecover&&current&&g.intent.canRecover()&&s.recovery_required),attempts:g.recoveries.toString()},last_command:last?{operation:last.ack.operation,request_seq:last.ack.request_seq,request_id:last.request_id,revision:last.ack.revision,command_id:last.ack.command_id}:null},verified:null,current_display:'unknown',device_evidence:false});
   }
   need(method==='POST'&&path==='/v1/node-control/command');const r=native400NodeControlBody(body),text=C(r);need(r.service_instance_id===instanceId,'controls_stale_instance');need(r.control_session_id===g.id,'controls_session_conflict');const prior=g.receipts.get(r.request_seq);
   if(prior){need(prior.text===text,'controls_idempotency_conflict');return structuredClone(prior.ack);}need(BigInt(r.request_seq)>g.seq,'controls_stale_request');need(BigInt(r.request_seq)===g.seq+1n,'controls_sequence_gap');need(BigInt(r.expected_revision)===g.revision,'revision_conflict');need(g.seq<(1n<<64n)-2n&&g.revision<(1n<<64n)-2n,'sequence_exhausted');need(r.operation==='cancel'||s.network.ready&&s.phase!=='paused','controls_busy');
   try{if(r.operation==='base')g.intent=lane.base(r.action,r.ttl_ms);else{lane.cancel();g.intent=null;}}catch{throw fail('controls_operation_failed');}g.seq++;g.revision++;
   const ack=native400NodeControlAck({submitted:true,operation:r.operation,request_seq:r.request_seq,command_id:randomBytes(32).toString('hex'),revision:g.revision.toString()},r),row={text,ack,request_id:r.request_id};g.receipts.set(r.request_seq,row);g.last=row;if(g.receipts.size>32)g.receipts.delete(g.receipts.keys().next().value);return structuredClone(ack);
  },fence,close(){fence();return lane.close();},resources:()=>({timers:timer===null?0:1,session:group?1:0,attachments:attachments.size,receipts:group?.receipts.size??0,closed})};
}
