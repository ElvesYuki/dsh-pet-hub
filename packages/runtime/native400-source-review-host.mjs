import {createNative400ReviewController} from './native400-review-controller.mjs';
import {createNative400ReviewChannel} from './native400-review-channel.mjs';
import {mkdirSync} from 'node:fs';import {join} from 'node:path';
import {clone,keys,requireThat as need} from '../core/protocol.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {createNative400BootstrapInspector} from '../core/native400-bootstrap.mjs';
import {openNative400SourceReview} from './native400-review-manager.mjs';
import {privatePath} from './paths.mjs';import {sha256} from './material-import.mjs';
const prepared=new WeakMap();
/** Trusted-code-only preparation, no I/O. Fresh approvals are validated/snapshotted;
 * opaque option cannot be deserialized from config/ledger or substituted by id.
 * createJournal defaults false. beforeOpen/fault are internal test hooks only. */
export function prepareNative400SourceReview(input){
 keys(input,['package','catalog','approval','mappingApproval','createJournal','beforeOpen','fault','controls']);
 const {package:pkg,catalog,approval,mappingApproval,createJournal=false,beforeOpen=async()=>{},fault,controls}=input;
 need(typeof createJournal==='boolean'&&typeof beforeOpen==='function'&&(fault===undefined||typeof fault==='function'),'invalid_source_review_option');
 let controlPolicy;
 if(controls!==undefined){keys(controls,['sessionMs','jobMs','clock','timers','beforeRead','beforeCheck']);const {sessionMs=300000,jobMs=30000,...hooks}=controls;need(Number.isSafeInteger(sessionMs)&&sessionMs>=1&&sessionMs<=300000&&Number.isSafeInteger(jobMs)&&jobMs>=1&&jobMs<=30000,'invalid_source_review_option');for(const key of ['clock','beforeRead','beforeCheck'])need(hooks[key]===undefined||typeof hooks[key]==='function','invalid_source_review_option');need(hooks.timers===undefined||typeof hooks.timers?.setTimeout==='function'&&typeof hooks.timers?.clearTimeout==='function','invalid_source_review_option');controlPolicy={sessionMs,jobMs,...hooks};}
 const inputs=clone({package:pkg,catalog,approval,mappingApproval});createNative400BootstrapInspector({...inputs,hash:sha256});
 const descriptor={schema_version:1,profile:'native400-source-review-host/1',scope:'offline-source-review',inputs_sha256:sha256(C(inputs)),create_journal:createJournal,...(controlPolicy?{controls:{profile:'native400-source-review-controls/1',session_ms:controlPolicy.sessionMs,job_ms:controlPolicy.jobMs}}:{})};
 const option=Object.freeze({});prepared.set(option,{inputs,descriptor,beforeOpen,fault,controlPolicy});return option;
}
function at(option){const value=prepared.get(option);need(value,'invalid_source_review_option');return value;}
/** Stable sourceKey material only. No source filename/approval bodies or filesystem access. */
export function native400SourceReviewDescriptor(option){return clone(at(option).descriptor);}
/** Only the elected service may call this factory. Journal path is fixed below its
 * private runtime; no source read/review/revalidation or repair occurs at startup. */
export async function createNative400SourceReviewOwner(option,{directory,instanceId}){
 const {inputs,descriptor,beforeOpen,fault,controlPolicy}=at(option);await beforeOpen({instanceId});
 const journalDirectory=join(directory,'native400-source-review');
 try{privatePath(directory,'directory');if(descriptor.create_journal)try{mkdirSync(journalDirectory,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}privatePath(journalDirectory,'directory');}
 catch(cause){throw Object.assign(new Error('review_journal_invalid',{cause}),{code:'review_journal_invalid'});}
 if(controlPolicy)return createNative400ReviewChannel(createNative400ReviewController({directory:journalDirectory,create:descriptor.create_journal,...inputs,...controlPolicy,serviceInstanceId:instanceId,fault}),instanceId);
 return openNative400SourceReview({directory:journalDirectory,create:descriptor.create_journal,...inputs,fault});
}
