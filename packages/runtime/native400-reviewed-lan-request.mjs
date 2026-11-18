import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {keys,requireThat as need} from '../core/protocol.mjs';
import {native400LanInputAuditContext} from './native400-lan-input-audit.mjs';
import {prepareNative400LanRequest} from './native400-tcp-lan-request.mjs';
import {native400LanHostHandoffGuard} from './native400-tcp-lan-host.mjs';
const requests=new WeakMap(),controlRequests=new WeakMap();
const fail=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)),'reviewed_lan_invalid');
const text=v=>need(typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v),'reviewed_lan_invalid');

/** Trusted local source-to-request assembly, never an approval generator.
 * audit must be this process's completed/live audit task. materialReview and
 * windowDecision are separately supplied caller decisions, not file self-grants.
 * Only checks identity/scope/reference consistency; does not authenticate rights,
 * source_kind, credits or firmware agreement. No I/O, listener or credentials.
 * close owns only this request; audit/service must be closed by their owners. */
export function prepareNative400ReviewedLanRequest(input){
 let request;
 try{
  keys(input,['audit','materialReview','windowDecision','endpoint','windowMs','clock','interfaces','ackMs','tickMs','timers']);
  const {audit,endpoint,windowMs,...options}=input,context=native400LanInputAuditContext(audit);need(context,'reviewed_lan_source_unavailable');
  const review=structuredClone(options.materialReview),decision=structuredClone(options.windowDecision),e=context.evidence;
  C(review);exact(review,['schema_version','profile','review_id','usage','source_evidence_sha256','mapping_sha256','license_ref','credits','source_kind','remote_actions','touch_actions','media_distribution','persistent_write','index_policy']);
  need(review.schema_version===1&&review.profile==='native400-cached-control-material-review/1'&&review.usage==='local-noncommercial-cached-control','reviewed_lan_scope');
  text(review.review_id);text(review.license_ref);need(['original-test','reviewed-upstream'].includes(review.source_kind),'reviewed_lan_scope');
  need(C(review.remote_actions)==='[0,1,11]'&&C(review.touch_actions)==='[4]'&&review.media_distribution===false&&review.persistent_write===false&&review.index_policy==='trusted-local-raw-index-pin-no-compiled-check','reviewed_lan_scope');
  need(Array.isArray(review.credits)&&review.credits.length>=1&&review.credits.length<=16,'reviewed_lan_invalid');review.credits.forEach(text);need(new Set(review.credits).size===review.credits.length,'reviewed_lan_invalid');
  need(review.source_evidence_sha256===e.sha256&&review.mapping_sha256===e.content.mapping_sha256,'reviewed_lan_reference');
  need(review.license_ref===context.license_ref,'reviewed_lan_license');
  need((decision?.usage==='single-device-cached-control'||decision?.usage==='loopback-rehearsal'&&review.source_kind==='original-test')&&decision.source_review_sha256===e.sha256&&decision.mapping_sha256===e.content.mapping_sha256&&decision.material_approval_id===review.review_id,'reviewed_lan_reference');
  need(decision.license_ref===review.license_ref&&C(decision.credits)===C(review.credits),'reviewed_lan_license');
  const bound=()=>{const c=native400LanInputAuditContext(audit);return c!==null&&c.evidence.sha256===e.sha256;};
  const live=()=>need(bound(),'reviewed_lan_source_unavailable');
  const dependencies=Object.fromEntries(['clock','interfaces','ackMs','tickMs','timers'].filter(k=>options[k]!==undefined).map(k=>[k,options[k]]));
  request=prepareNative400LanRequest({request:{schema_version:1,profile:'native400-hub-lan-request/1',identity:e.content.identity,endpoint,window_ms:windowMs},decision,...dependencies});
  live();let closed=false;
  const result=Object.freeze({lanReview:request.lanReview,
   snapshot:()=>({schema_version:1,profile:'native400-reviewed-lan-request-view/1',closed,source_bound:!closed&&bound(),handed_off:request.snapshot().handed_off,inventory:'historical-pc-file-only',device_evidence:false,authenticated:false}),
   deviceConfig(args){need(!closed,'reviewed_lan_closed');live();const config=request.deviceConfig(args);live();return config;},
   close(){closed=true;request.close();}
  });
  controlRequests.set(result,{lanReview:request.lanReview,check(){need(!closed,'reviewed_lan_closed');live();return true;}});
  requests.set(result,args=>{
   need(!closed,'reviewed_lan_closed');live();const transport=native400LanHostHandoffGuard(request.lanReview,args.owner),config=result.deviceConfig(args);
   const check=()=>{need(!closed,'reviewed_lan_closed');live();return transport();};check();return {config,check};
  });return result;
 }catch(cause){request?.close();if(/^reviewed_lan_/.test(cause.code??''))throw cause;throw fail('reviewed_lan_invalid',cause);}
}

/** Internal trusted file-consumer bridge. Rejects cloned/duck-typed requests;
 * consumes the existing one-shot config and captures its live transport guard. */
export function beginNative400ReviewedConfigHandoff(request,args){const take=requests.get(request);need(take,'reviewed_lan_invalid');return take(args);}

/** Internal non-USB control binding; genuine live request only, no config export. */
export function native400ReviewedLanControlContext(request){const c=controlRequests.get(request);need(c,'reviewed_lan_invalid');c.check();return {...c};}
