import {roundPetCanonical as bridgeCanonical} from './round-pet-identity.mjs';
import {tcpU64,tcpBytes} from './native400-tcp.mjs';
const bridgeNeed=(ok)=>{if(!ok)throw Error('bridge_event_invalid');},bridgeU32=n=>bridgeNeed(Number.isInteger(n)&&n>=0&&n<=0xffffffff),bridgeU64=n=>tcpU64(n),bridgeExact=(v,keys)=>bridgeNeed(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
const kinds=['Connected','Ack','WholeSha','FrameReady','Presented','IntentInvalidated','Failure','ConfigRejected','ConnectionClosed','Completed'],reasons=['None','Replaced','Disconnected','Invalidated','Overflow','Playback'];
/** Internal Bridge event observer, not wire decoder. Caller explicitly selects a
 * local transport; no event may configure or approve its own identity. All stages
 * are reported assertions, never actual hardware/whole-media/I/O-exit proof. */
export function createNative400BridgeEvents({candidateEnabled=false,records}){
 bridgeNeed(candidateEnabled===true&&Array.isArray(records)&&records.length===4);const ids=new Set(records.map(r=>r.action));bridgeNeed([0,1,4,11].every(x=>ids.has(x)));for(const r of records)tcpBytes(r.asset_sha256);
 let transport=0,highTransport=0,closed=false,blocked=false,tokenHigh=0n,retiredToken=0n,highestIntent=null,presentedHigh=0n,cycleHigh=0n,lastObserved=0n,goal=null,stage=null,first=null,history=null,completed=null,last=null,error=null;
 const historic=()=>{if(first)history={...first,historical:true};first=null;};
 function validate(e){bridgeExact(e,['kind','reason','transport','stamp','decision','reused_sha','at_ms','observed_ms']);bridgeNeed(kinds.includes(e.kind)&&reasons.includes(e.reason)&&typeof e.reused_sha==='boolean');bridgeU32(e.transport);bridgeU64(e.at_ms);bridgeU64(e.observed_ms);
  const s=e.stamp;bridgeExact(s,['intent','source','cycle','mail','action','transport']);const t=s.intent;bridgeExact(t,['origin','action','session','request','token']);bridgeNeed(['Local','Remote','Touch'].includes(t.origin));bridgeU32(s.mail);bridgeU32(s.transport);bridgeNeed(Number.isInteger(s.action)&&s.action>=0&&s.action<=65535&&Number.isInteger(t.action)&&t.action>=0&&t.action<=65535);for(const x of [s.source,s.cycle,t.session,t.request,t.token])bridgeU64(x);bridgeExact(e.decision,['code','replay','action','token']);bridgeNeed([1,2,3,4,5,16,17,18,19,20].includes(e.decision.code)&&typeof e.decision.replay==='boolean'&&Number.isInteger(e.decision.action)&&e.decision.action>=0&&e.decision.action<=65535);bridgeU64(e.decision.token);return s;
 }
 const exactStamp=(a,b)=>a&&b&&bridgeCanonical(a)===bridgeCanonical(b);
 const intentSame=(a,b)=>a&&b&&['origin','action','session','request','token'].every(k=>a[k]===b[k]);
 function observe(e){bridgeNeed(!closed&&!blocked);bridgeNeed(e&&typeof e==='object');bridgeU32(e.transport);if(!transport||e.transport!==transport)return false;
  try{const s=validate(e),stamp=structuredClone(s),t=s.intent;
   const checkTime=()=>{if(bridgeU64(e.observed_ms)<lastObserved||bridgeU64(e.at_ms)>bridgeU64(e.observed_ms))throw Error('bridge_event_time');};
   if(['Connected','Ack'].includes(e.kind)){checkTime();lastObserved=bridgeU64(e.observed_ms);return true;}
   if(e.kind==='ConnectionClosed'||e.kind==='ConfigRejected'){checkTime();historic();stage=null;transport=0;error=e.kind;return true;}
   bridgeNeed(s.transport===transport&&bridgeU64(s.cycle)>0n&&[0,1,4,11].includes(s.action));bridgeNeed(t.origin==='Local'?t.action===0:t.action===s.action);bridgeNeed(t.origin==='Remote'?[0,1,11].includes(s.action)&&bridgeU64(t.session)>0n&&bridgeU64(t.request)>0n:t.origin==='Touch'?s.action===4&&t.session==='0'&&t.request==='0':[0,1,11].includes(s.action)&&t.session==='0'&&t.request==='0');
   if((t.origin!=='Local'&&bridgeU64(t.token)<=retiredToken)||(['WholeSha','FrameReady','Presented'].includes(e.kind)&&completed&&bridgeU64(s.cycle)<=bridgeU64(completed.cycle)))return false;
   if(bridgeU64(t.token)<tokenHigh||bridgeU64(s.cycle)<cycleHigh||(bridgeU64(t.token)===tokenHigh&&highestIntent&&!intentSame(highestIntent,t)))return false;
   if(t.origin==='Remote'&&(!goal||goal.session!==t.session||goal.request!==t.request||goal.action!==s.action))return false;checkTime();
   const key=e.kind+':'+bridgeCanonical(stamp);if(last?.key===key){bridgeNeed(last.body===bridgeCanonical(e));return false;}
   if(e.kind==='WholeSha'){
    if(stage?.stamp.cycle===s.cycle)return false;
    bridgeNeed(t.origin!=='Local'&&s.source==='0'&&s.mail===0);if(bridgeU64(t.token)>tokenHigh)historic();stage={stamp,file_sha_reported:true,reused_sha:e.reused_sha,frame_ready:false};
   }else if(e.kind==='FrameReady'){
    if(!stage||!intentSame(stage.stamp.intent,t)||stage.stamp.cycle!==s.cycle||bridgeU64(s.source)===0n||stage.frame_ready)return false;
    stage={...stage,stamp,frame_ready:true,decoded_at_ms:e.at_ms};
   }else if(e.kind==='Presented'){
    if(!stage?.frame_ready||!exactStamp(stage.stamp,s)||t.origin!=='Remote')return false;
    bridgeNeed(bridgeU64(e.at_ms)>=bridgeU64(stage.decoded_at_ms));if(bridgeU64(t.token)<=presentedHigh)return false;presentedHigh=bridgeU64(t.token);first={token:t.token,source:s.source,mail:s.mail,cycle:s.cycle,action:s.action,view_completed_ms:e.at_ms,worker_observed_ms:e.observed_ms,historical:false,evidence:'untrusted-bridge-view-completion-report'};
   }else if(e.kind==='Completed'){
    bridgeNeed(bridgeU64(s.source)>0n);if(completed&&bridgeU64(s.cycle)<=bridgeU64(completed.cycle))return false;
    if(stage&&!intentSame(stage.stamp.intent,t))return false;if(!stage&&t.origin!=='Local'&&(!completed||completed.token!==t.token||completed.action!==s.action))return false;
    if(stage&&stage.stamp.cycle===s.cycle&&(!stage.frame_ready||!exactStamp(stage.stamp,s)))return false;
    completed={action:s.action,cycle:s.cycle,token:t.token,source:s.source,origin:t.origin,whole_cycle_reported:true,io_exited:false};if(t.origin==='Touch')retiredToken=bridgeU64(t.token);historic();stage=null;
   }else{
    if(stage&&!intentSame(stage.stamp.intent,t))return false;if(stage&&stage.stamp.cycle===s.cycle&&stage.stamp.source!=='0'&&!exactStamp(stage.stamp,s))return false;
    if(t.origin!=='Local'&&bridgeU64(t.token)>retiredToken)retiredToken=bridgeU64(t.token);historic();stage=null;error=e.kind;
   }
   tokenHigh=bridgeU64(t.token);highestIntent=structuredClone(t);cycleHigh=bridgeU64(s.cycle);lastObserved=bridgeU64(e.observed_ms);last={key,body:bridgeCanonical(e)};return true;
  }catch(err){blocked=true;transport=0;historic();stage=null;error='invalid_current_event';throw err;}
 }
 return {begin(gen){bridgeU32(gen);bridgeNeed(!closed&&!blocked&&gen>highTransport);historic();transport=highTransport=gen;goal=stage=completed=last=null;error=null;},expectBase(session,request,action){bridgeNeed(!closed&&!blocked&&transport&&bridgeU64(session)>0n&&bridgeU64(request)>0n&&[0,1,11].includes(action));if(!goal||goal.session!==session||goal.request!==request||goal.action!==action){historic();stage=completed=last=null;}goal={session,request,action};},observe,revokeThrough(gen){bridgeU32(gen);if(!transport||gen<transport)return false;historic();stage=null;transport=0;error='transport_revoked';return true;},close(){closed=true;transport=0;stage=null;historic();},snapshot(){return structuredClone({profile:'native400-bridge-events-proposal/1',phase:closed?'closed':blocked?'blocked':transport?'observing':'disconnected',stages:stage,first_frame:first,history,completed,error,whole_media:false,physical_scan_complete:false,io_exited:false,wire_supported:false,device_evidence:false});}};
}
