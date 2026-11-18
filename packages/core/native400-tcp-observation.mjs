import {roundPetCanonical as tcpObsCanonical} from './round-pet-identity.mjs';
import {tcpU64,tcpBytes} from './native400-tcp.mjs';
const tcpObsNeed=(ok,c='tcp_observation_invalid')=>{if(!ok)throw Object.assign(new Error(c),{code:c});};
const tcpObsExact=(v,keys)=>tcpObsNeed(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
const tcpObsU=v=>{tcpU64(v);return v;},tcpObsNonzero=v=>{tcpObsNeed(tcpU64(v)>0n);return v;};
const tcpObsScope=s=>{tcpObsExact(s,['connection','boot','session','mapping']);for(const k of ['connection','boot','session'])tcpObsNonzero(s[k]);tcpObsNeed(tcpBytes(s.mapping).some(Boolean));return structuredClone(s);};
/** INTERNAL decoded-field proposal ONLY, no wire/type negotiation. Trusted caller
 * must opt in, pin scope and independently recovered identities. Reports are LAN
 * assertions, never cryptographic/whole-media/persistence evidence. */
export function createNative400TcpObservation({candidateEnabled=false,scope,records,clock}){
 tcpObsNeed(candidateEnabled===true,'tcp_observation_disabled');scope=tcpObsScope(scope);tcpObsNeed(typeof clock==='function'&&Array.isArray(records)&&records.length===4);
 const assets=new Map();for(const r of records){tcpObsExact(r,['action','bytes','frames','asset_sha256']);tcpObsNeed([0,1,4,11].includes(r.action)&&!assets.has(r.action)&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=0xffffffff&&r.frames===241);tcpBytes(r.asset_sha256);assets.set(r.action,structuredClone(r));}
 let lastTime=0,closed=false,blocked=false,high=0n,lastBody=null,base=null,proof=null,actual=null,history=null,error=null,baseHigh=0n,tokenHigh=0n,tokenSource=null;
 function time(){const n=clock();tcpObsNeed(Number.isSafeInteger(n)&&n>=0&&n>=lastTime,'tcp_observation_clock');lastTime=n;return n;}
 function historical(){if(actual)history={...actual,historical:true};actual=null;}
 function tick(){try{const t=time();if(base&&t>=base.deadline){base=null;proof=null;if(actual?.origin==='remote')historical();}return t;}catch(e){blocked=true;error='clock_failed';base=proof=null;historical();throw e;}}
 function open(){tcpObsNeed(!closed&&!blocked,'tcp_observation_closed');}
 const identity=(r)=>{tcpObsExact(r,['action','bytes','frames','asset_sha256']);const a=assets.get(r.action);tcpObsNeed(a&&Object.keys(a).every(k=>a[k]===r[k]),'tcp_observation_identity');return structuredClone(a);};
 function target(r){tcpObsNonzero(r.token);tcpObsNonzero(r.source);tcpObsNonzero(r.basis_seq);tcpObsNeed(base&&base.seq===r.basis_seq&&base.action===r.asset.action,'tcp_observation_stale_target');identity(r.asset);}
 function sameSource(r,x){return x&&r.basis_seq===x.basis_seq&&r.token===x.token&&r.source===x.source;}
 function ingest(r){open();tcpObsNeed(r&&typeof r==='object');const incoming=tcpObsScope(r.scope);if(!Object.keys(scope).every(k=>incoming[k]===scope[k]))return false;const seq=tcpObsNonzero(r.report_seq),n=tcpU64(seq);if(n<high)return false;
  const body=tcpObsCanonical(r);if(n===high){if(body!==lastBody){blocked=true;error='sequence_conflict';base=proof=null;historical();throw Object.assign(new Error(error),{code:error});}tick();return false;}
  tick();
  try{
   const common=['kind','scope','report_seq','basis_seq','token','source'];
   if(r.kind==='verified'){
    tcpObsExact(r,[...common,'asset','integrity']);target(r);tcpObsNeed(r.integrity==='file_sha_metadata_frame0_crc','tcp_observation_integrity');if(tcpU64(r.token)<tokenHigh||tcpU64(r.token)===tokenHigh&&tokenSource!==r.source)return false;tokenHigh=tcpU64(r.token);tokenSource=r.source;proof={basis_seq:r.basis_seq,token:r.token,source:r.source,action:r.asset.action,integrity:r.integrity};
   }else if(r.kind==='state'){
    tcpObsExact(r,[...common,'origin','asset','frame0_committed']);tcpObsNeed(typeof r.frame0_committed==='boolean'&&['remote','touch','local'].includes(r.origin));identity(r.asset);tcpObsNonzero(r.token);tcpObsNonzero(r.source);
    if(tcpU64(r.token)<tokenHigh||tcpU64(r.token)===tokenHigh&&tokenSource!==r.source)return false;
    if(r.origin==='remote'){target(r);tcpObsNeed(!r.frame0_committed||sameSource(r,proof),'tcp_observation_unverified');if(actual?.origin==='touch')tcpObsNeed(r.token!==actual.token&&r.source!==actual.source,'tcp_observation_stale_touch');if(!sameSource(r,proof))proof=null;}
    else{tcpObsNeed(r.basis_seq==='0'&&(r.origin==='touch'?r.asset.action===4:[0,1,11].includes(r.asset.action)));proof=null;}
    tokenHigh=tcpU64(r.token);tokenSource=r.source;historical();actual={origin:r.origin,action:r.asset.action,basis_seq:r.basis_seq,token:r.token,source:r.source,frame0_committed:r.frame0_committed,historical:false,evidence:'untrusted-device-report'};
   }else if(['exit','error'].includes(r.kind)){
    tcpObsExact(r,[...common,'reason','front_retained']);tcpObsNeed(typeof r.front_retained==='boolean'&&['cancelled','expired','source_failed','decode_failed','display_failed','local_complete'].includes(r.reason));tcpObsU(r.basis_seq);tcpObsNonzero(r.token);tcpObsNonzero(r.source);if(!sameSource(r,actual)&&!sameSource(r,proof))return false;if(sameSource(r,actual))historical();if(r.basis_seq!=='0')base=null;proof=null;error=r.reason;
   }else tcpObsNeed(false);
   high=n;lastBody=body;return true;
  }catch(e){if(e.code==='tcp_observation_stale_target')return false;blocked=true;error=e.code??'invalid_report';base=proof=null;historical();throw e;}
 }
 return {setBase(seq,action,deadline){open();const t=tick();tcpObsNeed(tcpU64(seq)>baseHigh&&[0,1,11].includes(action)&&Number.isSafeInteger(deadline)&&deadline>t&&deadline-t<=60000);baseHigh=tcpU64(seq);base={seq,action,deadline};proof=null;if(actual?.origin==='remote')historical();},cancel(){open();tick();base=proof=null;if(actual?.origin==='remote')historical();},ingest,tick,close(){if(closed)return;closed=true;base=proof=null;historical();},snapshot(){if(!closed&&!blocked)tick();return {profile:'native400-tcp-observation-proposal/1',phase:closed?'closed':blocked?'blocked':'active',desired:base?{seq:base.seq,action:base.action,remaining_ms:base.deadline-lastTime}:null,verified:proof?{...proof,evidence:'untrusted-device-report',whole_media:false}:null,actual:actual?structuredClone(actual):null,history:history?structuredClone(history):null,error,authenticated:false,device_evidence:false,wire_supported:false};}};
}
