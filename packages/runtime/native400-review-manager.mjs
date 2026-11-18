import {basename} from 'node:path';
import {createNative400BootstrapInspector} from '../core/native400-bootstrap.mjs';
import {publicNative400SourceReviewView,native400ReviewSourceName,NATIVE400_REVIEW_ERRORS} from '../core/native400-source-review-view.mjs';
import {uint64,clone,requireThat as need} from '../core/protocol.mjs';
import {sha256} from './material-import.mjs';
import {openNative400ReviewJournal} from './native400-review-journal.mjs';
import {createNative400BootstrapReview} from './native400-bootstrap-review.mjs';
const failure=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
/** Explicit offline owner. Fresh caller approvals before disk access; stored decisions
 * never authorize themselves. All reopen results start historical. review writes CAS;
 * revalidate reruns the actual source reader and compares the complete original map.
 * expectedSource is passed to the actual reader and its revocation check guards
 * the existing journal valid gate and publication. No selection metadata is stored.
 * Optional authorizationGate is strictly synchronous Boolean and fences admission,
 * existing journal valid and publication; invalid/async/reentrant mutation fails closed.
 * Cancellation fences immediately; busy/close await actual I/O exit. No service route. */
export function openNative400SourceReview({directory,create=false,package:pkg,catalog,approval,mappingApproval,fault}){
 const inputs=clone({package:pkg,catalog,approval,mappingApproval}),inspector=createNative400BootstrapInspector({...inputs,hash:sha256});
 const journal=openNative400ReviewJournal({directory,create,validateMap:inspector.validateMap,fault});let data=journal.read(),phase=data.record?'historical':'empty',error=null,attempt=null,job=null,closed=false,closing=null,checkingGate=false;
 function snapshot(){const r=data.record,c=r?.map.content;return publicNative400SourceReviewView({schema_version:1,profile:'native400-source-review-view/1',scope:'offline-source-review',phase,revision:data.revision,current_run:phase==='current',history:r?{source_name:r.source_name,map_sha256:r.map.sha256,cache_sha256:c.cache.sha256,namespace_boot:c.identity.namespace_boot,root_sequence:c.selection.sequence,objects:c.objects,media_validation:c.checks.media_validation}:null,attempt,error,device_evidence:false});}
 const available=()=>{need(!checkingGate,'review_authorization_reentrant');need(!closed,'review_closed');need(!journal.resources().uncertain,'review_commit_unknown');need(!job,'review_busy');};
 function start(kind,{file,expectedRevision,minimumSequence,sourceName,signal,timeoutMs,beforeRead,expectedSource,authorizationGate}={}){
  available();need(authorizationGate===undefined||typeof authorizationGate==='function','review_authorization_invalid');uint64(expectedRevision);need(typeof file==='string'&&file.length>0,'review_source_name_invalid');const label=native400ReviewSourceName(sourceName??(kind==='revalidate'&&data.record?data.record.source_name:basename(file)));
  const token={controller:new AbortController(),cancelled:false,reader:null,promise:null,selectionError:null,authorizationError:null};job=token;phase='reviewing';error=null;attempt={source_name:label,kind};
  const valid=()=>{
   if(closed||token.cancelled||token.controller.signal.aborted||job!==token||token.authorizationError||token.selectionError)return false;
   if(authorizationGate!==undefined){try{need(!checkingGate,'review_authorization_reentrant');checkingGate=true;const granted=authorizationGate();if(granted&&typeof granted.then==='function')Promise.resolve(granted).catch(()=>{});need(typeof granted==='boolean','review_authorization_invalid');need(granted,'review_authorization_denied');}catch(cause){const code=cause.code==='review_authorization_denied'?'review_authorization_denied':'review_authorization_invalid';token.authorizationError??=failure(code,cause);return false;}finally{checkingGate=false;}}
   try{token.reader?.checkSource();return true;}catch(cause){token.selectionError??=cause;return false;}
  };
  const cancel=()=>{token.cancelled=true;token.controller.abort();if(!closed){phase='cancelled';error='review_cancelled';attempt=null;}};
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  token.promise=(async()=>{
   try{
    need(valid(),'review_cancelled');const current=journal.read();need(current.revision===expectedRevision,'revision_conflict');
    if(kind==='revalidate')need(current.record!==null,'review_history_missing');
    const floor=minimumSequence??(kind==='revalidate'?current.record.map.content.selection.minimum_sequence:'0');
    token.reader=createNative400BootstrapReview({file,...inputs,minimumSequence:floor,signal:token.controller.signal,timeoutMs,beforeRead,expectedSource});
    const map=inspector.validateMap(await token.reader.ready);await token.reader.close();need(valid(),'review_cancelled');
    if(kind==='revalidate'){
     need(map.sha256===current.record.map.sha256&&label===current.record.source_name,'review_map_changed');
     const fresh=journal.read();need(fresh.revision===expectedRevision,'revision_conflict');data=fresh;
    }else data=journal.commit(expectedRevision,{source_name:label,map},{valid});
    need(valid(),'review_cancelled');phase='current';error=null;attempt=null;return snapshot();
   }catch(cause){
    const stillValid=valid();
    const code=journal.resources().uncertain?'review_commit_unknown':!stillValid?(token.authorizationError?.code??token.selectionError?.code??'review_cancelled'):NATIVE400_REVIEW_ERRORS.includes(cause.code)?cause.code:'review_failed';
    if(!closed){phase=code==='review_commit_unknown'?'uncertain':code==='review_cancelled'?'cancelled':'failed';error=code;attempt=null;}
    throw failure(code,cause);
   }finally{
    if(token.reader)await token.reader.close();signal?.removeEventListener('abort',cancel);if(job===token)job=null;
   }
  })();token.promise.catch(()=>{});return token.promise;
 }
 return {snapshot,review:options=>start('review',options),revalidate:options=>start('revalidate',options),
  cancel(){need(!checkingGate,'review_authorization_reentrant');if(job){job.cancelled=true;job.controller.abort();if(!closed){phase='cancelled';error='review_cancelled';attempt=null;}}},
  resources:()=>({closed,busy:!!job,uncertain:journal.resources().uncertain,open_files:job?.reader?.resources().open_files??0,retained_cache_bytes:0,stream_buffer_max:65536}),
  close(){need(!checkingGate,'review_authorization_reentrant');if(closing)return closing;closed=true;phase='closed';error=null;attempt=null;if(job){job.cancelled=true;job.controller.abort();}return closing=(async()=>{try{await job?.promise;}catch{}finally{journal.close();}})();}
 };
}
