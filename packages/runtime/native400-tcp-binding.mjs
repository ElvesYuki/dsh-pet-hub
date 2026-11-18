import {createNative400BootstrapInspector,NATIVE400_BOOT_NAMESPACE} from '../core/native400-bootstrap.mjs';
import {native400Metadata} from '../core/native400-identity.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {clone,digest,requireThat as need} from '../core/protocol.mjs';
import {createNative400SourceSelection} from './native400-source-selection.mjs';
import {createNative400BootstrapReview} from './native400-bootstrap-review.mjs';
import {native400TcpCatalog} from './native400-tcp.mjs';
import {createNative400TcpOwner} from './native400-tcp-owner.mjs';
import {sha256} from './material-import.mjs';

const prepared=new WeakMap();
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)),'tcp_binding_invalid');
const failure=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const PROFILE='native400-tcp-offline-binding/1';

/** Trusted-code-only offline decision. No I/O. The opaque result cannot be
 * reconstructed from JSON/journal/UI state. Existing two approvals retain their
 * original offline scope; this decision grants no production or device usage. */
export function prepareNative400TcpBinding(input){
 exact(input,['package','catalog','approval','mappingApproval','decision']);
 const {decision,...inputs}=clone(input),inspector=createNative400BootstrapInspector({...inputs,hash:sha256});
 const metadata=native400Metadata({...inputs,sourceSha256:inputs.approval.source_manifest_sha256,sourceIndexSha256:inputs.approval.source_index_sha256,hash:sha256});
 exact(decision,['schema_version','profile','usage','source_map_sha256','mapping_sha256','hub_index_sha256','integrity_policy','presentation_policy']);
 need(decision.schema_version===1&&decision.profile===PROFILE&&decision.usage==='offline-loopback'&&decision.integrity_policy==='file-sha-metadata-frame0-crc'&&decision.presentation_policy==='first-frame-history-only','tcp_binding_scope');
 for(const k of ['source_map_sha256','mapping_sha256','hub_index_sha256'])digest(decision[k]);
 need(decision.hub_index_sha256===metadata.identity.source_index_sha256,'tcp_binding_index_domain');
 const option=Object.freeze({});prepared.set(option,{inputs,inspector,metadata,decision,descriptor:{schema_version:1,profile:PROFILE,inputs_sha256:sha256(C({inputs,decision}))}});return option;
}

/** Opaque trusted option identity for host sourceKey, without approval bodies. */
export function native400TcpBindingDescriptor(option){const v=prepared.get(option);need(v,'tcp_binding_disabled');return clone(v.descriptor);}

/** Explicit fresh PC-file review and a single temporary TCP02 owner. ready resolves
 * a public snapshot only after pinned-fd full hashes and independent digest checks.
 * start additionally requires explicit loopback/port0 opt-in. No network config
 * export or current ESP inventory. Hooks/clock/timers are trusted test dependencies.
 * close fences synchronously and waits actual owned reads/sockets; idempotent.
 * signal cancellation closes the whole task, including an already started owner. */
export function createNative400TcpBindingReview(option,{enabled=false,file,signal,clock=()=>Math.floor(performance.now()),timeoutMs=10000,beforeRead,beforeCheck,ackMs,tickMs,timers,peerAddress}={}){
 const config=prepared.get(option);need(enabled===true&&config,'tcp_binding_disabled');
 need(signal===undefined||typeof signal.addEventListener==='function'&&typeof signal.removeEventListener==='function','tcp_binding_invalid');need(!signal?.aborted,'tcp_binding_closed');
 const {inputs,inspector,metadata,decision}=config;
 let closed=false,closing=null,reader=null,owner=null,phase='reading',error=null,binding=null;
 const selection=createNative400SourceSelection({file,clock,timeoutMs,beforeCheck});
 const alive=()=>{need(!closed&&!signal?.aborted,'tcp_binding_closed');};
 const ready=(async()=>{
  try{
   const expectedSource=await selection.ready;alive();
   reader=createNative400BootstrapReview({file,...inputs,expectedSource,timeoutMs,beforeRead});
   const map=inspector.validateMap(await reader.ready);await reader.close();alive();reader.checkSource();
   need(map.sha256===decision.source_map_sha256,'tcp_binding_source_map');
   need(!map.content.selection.degraded_roots&&!map.content.selection.fallback_from_newer,'tcp_binding_degraded_roots');
   const records=map.content.objects.map(o=>({action:o.action_id,bytes:o.bytes,frames:o.frames,asset_sha256:o.file_sha256}));
   const catalog=native400TcpCatalog(metadata,records,{namespace_sha256:NATIVE400_BOOT_NAMESPACE,hub_index_sha256:decision.hub_index_sha256});
   need(catalog.mapping===decision.mapping_sha256,'tcp_binding_mapping');
   owner=createNative400TcpOwner({...catalog,clock,peerAddress,...(ackMs===undefined?{}:{ackMs}),...(tickMs===undefined?{}:{tickMs}),...(timers===undefined?{}:{timers})});
   binding={schema_version:1,profile:PROFILE,scope:'offline-loopback',source_map_sha256:map.sha256,mapping_sha256:catalog.mapping,namespace_boot:NATIVE400_BOOT_NAMESPACE,hub_index_sha256:decision.hub_index_sha256,root_sequence:map.content.selection.sequence,integrity_policy:decision.integrity_policy,presentation_policy:decision.presentation_policy,inventory:'pc-source-snapshot-only',whole_media:false,device_evidence:false};
   phase='bound';return clone(binding);
  }catch(cause){error=closed?'tcp_binding_closed':/^(tcp_binding_|bootstrap_)/.test(cause.code??'')?cause.code:'tcp_binding_review_failed';if(!closed)phase='failed';throw failure(error,cause);}
  finally{if(phase!=='bound'){signal?.removeEventListener('abort',onAbort);await reader?.close();await selection.close();}}
 })();ready.catch(()=>{});
 const available=()=>{alive();need(phase==='bound'&&owner,'tcp_binding_not_ready');};
 const onAbort=()=>{void close().catch(()=>{error='tcp_binding_cleanup_failed';});};
 function close(){
  if(closing)return closing;closed=true;phase='closed';
  const exits=[owner?.close(),reader?.close(),selection.close()];signal?.removeEventListener('abort',onAbort);
  return closing=(async()=>{await Promise.all(exits);try{await ready;}catch{} })();
 }
 const task={ready,
  async start({enabled=false,host='127.0.0.1',port=0}={}){need(enabled===true&&host==='127.0.0.1'&&port===0,'tcp_owner_offline_only');await ready;available();return owner.start({enabled,host,port});},
  networkLink(epoch,ready){available();return owner.networkLink(epoch,ready);},
  base(action,ttl){available();owner.base(action,ttl);},cancel(){available();owner.cancel();},reapply(){available();owner.reapply();},pause(){available();owner.pause();},resume(){available();owner.resume();},tick(){available();owner.tick();},
  snapshot(){return {phase,error,binding:binding?{...clone(binding),historical:closed}:null,owner:owner?.snapshot()??null,device_evidence:false};},
  resources(){return {closed,open_files:(reader?.resources().open_files??0)+selection.resources().open_files,retained_cache_bytes:0,owner:owner?.resources()??{sockets:0,sessions:0,timers:0,listening:false,active:0}};},close};
 if(signal){signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();}
 return task;
}
