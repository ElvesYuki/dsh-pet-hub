import {validateNative400MaterialRefs} from './native400-wire.mjs';
import {clone,same,uint64,requireThat as need} from './protocol.mjs';
const streams={'playback.report':'report_seq','asset.verified':'verification_seq','display.report':'display_seq','storage.status':'storage_seq','cancel.report':'cancel_seq','touch.event':'event_seq','control.receipt':'receipt_seq'};
/** Post-authentication, bounded 400 projection. Input is a validated exchange envelope;
 * caller must establish session/control authority before ingest. Invalid input is atomic.
 * No authentication, persistence, clocks, device execution or synthetic save facts. */
export class Native400Observations {
 #metadata;#context;#state;#history;#scheduling;
 constructor({metadata,context,history=null,scheduling=false}){this.#scheduling=scheduling;this.#metadata=metadata;this.#context=clone(context);this.#history=clone(history);this.#state={desired:null,control:null,phase:null,admission:null,actual:history?{...clone(history),historical:true}:null,maintenance:'none',sequences:{},verificationHigh:'0',proofs:new Map(),commitHigh:'0',active:false,touch:null,touchVerificationHigh:'0'};}
 request(target,control,{mode=null}={}){this.#state.mode=mode;this.#state.desired=clone(target);this.#state.control=clone(control);this.#state.phase='requested';this.#state.admission=null;this.#state.active=true;if(this.#state.actual&&!(this.#scheduling&&this.#state.touch?.stage==='started'&&this.#state.actual.origin==='local'))this.#state.actual.historical=true;}
 cancel(){this.#state.admission=null;this.#state.active=false;this.#state.phase='cancelled';if(this.#state.actual&&!(this.#scheduling&&this.#state.touch?.stage==='started'&&this.#state.actual.origin==='local'))this.#state.actual.historical=true;}
 ingest(message,{control,retiredAcceptance=false,retiredRecord=false}={}){
  const v=validateNative400MaterialRefs(message,this.#metadata);need(v.type==='exchange.request'&&same(v.context,this.#context),'stale_session');const r=v.payload.observation?.record;need(r&&streams[r.type],'invalid_observation');const s=clone(this.#state),key=streams[r.type];need(!s.sequences[key]||uint64(r[key])>uint64(s.sequences[key]),'stale_sequence');
  if(r.control)need(same(r.control,control),'stale_control');
  if(retiredRecord){need(['playback.report','display.report'].includes(r.type),'stale_observation');if(r.verification_seq){need(uint64(r.verification_seq)>uint64(s.verificationHigh),'stale_verification');s.verificationHigh=r.verification_seq;}if(r.actual&&uint64(r.actual.commit_seq)>uint64(s.commitHigh))s.commitHigh=r.actual.commit_seq;s.sequences[key]=r[key];this.#state=s;return this.snapshot();}
  if(r.type==='playback.report'){
   if(retiredAcceptance){need(r.phase==='accepted','stale_revision');}
   else{need(s.active&&same(r.target,s.desired)&&same(r.control,s.control),'stale_revision');const phases=['requested','accepted','verifying','verified'];need(!['failed','cancelled'].includes(s.phase),'stale_revision');if(phases.includes(r.phase))need(phases.indexOf(r.phase)>=phases.indexOf(s.phase),'stale_observation');s.phase=r.phase;if(this.#scheduling&&['accepted','verifying'].includes(r.phase))s.maintenance=r.phase==='accepted'?'priming':'verifying';if(r.phase==='accepted')s.admission=r.admission;if(['failed','cancelled'].includes(r.phase))s.admission=null;if(['failed','cancelled'].includes(r.phase)){s.active=false;if(s.actual)s.actual.historical=true;if(r.phase==='failed')s.maintenance='failed';}}
  }
  if(r.type==='asset.verified'||(r.type==='playback.report'&&r.phase==='verified')){
   need((r.type==='asset.verified'||s.active)&&uint64(r.verification_seq)>uint64(s.verificationHigh),'stale_verification');const asset=r.asset_ref??{action_id:r.target.action_id,asset_sha256:r.target.asset_sha256};
   if(r.type==='asset.verified'){need([0,4].includes(asset.action_id),'touch_only');if(this.#scheduling&&asset.action_id===4)need(s.touch?.stage==='started'&&uint64(r.verification_seq)>uint64(s.touchVerificationHigh),'stale_touch');}
   if(s.proofs.size===4){const evict=[...s.proofs.keys()].find(k=>k!==s.actual?.verification_seq&&k!==r.verification_seq);need(evict,'observation_capacity');s.proofs.delete(evict);}
   s.proofs.set(r.verification_seq,{context:clone(v.context),asset:clone(asset),target:clone(r.target??null)});s.verificationHigh=r.verification_seq;
  }
  if(r.type==='display.report'){
   if(r.actual){const a=r.actual,p=s.proofs.get(a.verification_seq);if(a.historical&&!same(a.source_context,this.#context)){need(this.#history&&same({...this.#history,historical:true},a),'stale_verification');}
    else{need(p&&same(p.context,a.source_context)&&same(p.asset,a.asset_ref),'stale_verification');if(a.origin==='remote')need(p.target&&same(p.target,a.source_target),'stale_verification');
     if(!a.historical){if(this.#scheduling){if(a.origin==='remote')need(s.touch?.stage!=='started','stale_touch');else if(a.asset_ref.action_id===4)need(s.touch?.stage==='started'&&uint64(a.verification_seq)>uint64(s.touchVerificationHigh),'stale_touch');}if(a.origin==='remote')need(s.active,'stale_revision');if(a.origin==='remote')need(same(a.source_target,s.desired)&&same(a.control,control),'stale_revision');need(uint64(a.commit_seq)>=uint64(s.commitHigh)&&uint64(a.commit_seq)-uint64(a.first_frame_commit_seq)>=BigInt(a.frame_index),'stale_frame');if(s.actual&&same(s.actual.source_context,a.source_context)&&uint64(a.commit_seq)===uint64(s.commitHigh))need(a.frame_index===s.actual.frame_index&&same(a.asset_ref,s.actual.asset_ref)&&same(a.source_target,s.actual.source_target)&&a.first_frame_commit_seq===s.actual.first_frame_commit_seq,'stale_frame');if(s.actual&&same(s.actual.source_context,a.source_context)&&!same(s.actual.asset_ref,a.asset_ref))need(uint64(a.commit_seq)>uint64(s.commitHigh),'stale_frame');s.commitHigh=a.commit_seq;}
    }
   }s.actual=clone(r.actual);s.maintenance=r.maintenance;
  }
  if(r.type==='touch.event'){if(this.#scheduling){need(r.stage==='started'?s.touch?.stage!=='started':s.touch?.stage==='started','stale_touch');if(r.stage==='started'){s.touchVerificationHigh=s.verificationHigh;if(s.active){s.phase='accepted';s.admission='deferred_local';}s.maintenance='priming';if(s.actual?.origin==='remote')s.actual.historical=true;}else{if(s.actual?.origin==='local')s.actual.historical=true;s.maintenance=s.active?'verifying':'none';}}s.touch=clone(r);}
  if(this.#scheduling&&r.type==='display.report'&&s.mode==='once_hold'&&r.display_state==='held'&&r.maintenance==='none'&&r.actual?.origin==='remote'&&same(r.actual.source_target,s.desired)&&r.actual.frame_index===(r.actual.asset_ref.action_id===42?117:240)&&s.touch?.stage!=='started'){s.phase='ended';s.active=false;s.admission=null;}
  s.sequences[key]=r[key];this.#state=s;return this.snapshot();
 }
 snapshot(){const s=this.#state;return {context:clone(this.#context),desired:clone(s.desired),phase:s.phase,admission:s.admission,actual:clone(s.actual),maintenance:s.maintenance,touch:clone(s.touch),storage:{capability:'unsupported',inventory_known:false,saved:null,offline_available:null},sequences:clone(s.sequences),verified_proofs:s.proofs.size,active:s.active};}
 history(){return clone(this.#state.actual);}
 close(){this.cancel();if(this.#state.actual)this.#state.actual.historical=true;this.#state.touch=null;this.#state.proofs.clear();}
}
