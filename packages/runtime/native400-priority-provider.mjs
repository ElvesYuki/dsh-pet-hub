import {decodePrioritySnapshot} from '../core/native400-priority-draft.mjs';import {tcpU64} from '../core/native400-tcp.mjs';
/** Offline trusted transport adapter. No socket, timer, admission or grant minting.
 * receive must be called only by the capability-negotiated connection owner. */
export function createNative400PriorityProvider({enabled=false,capability,boot,session,connection,clock=()=>Math.floor(performance.now())}={}){
 if(typeof enabled!=='boolean'||enabled&&(capability!=='ptc1-priority-poll/1'||tcpU64(boot)===0n||tcpU64(session)===0n||!connection||typeof connection!=='object'||typeof clock!=='function'))throw Error('priority_provider_invalid');
 let closed=false,latched=false,reason=enabled?'initial_unknown':'disabled',last=-1,lastQuery=-Infinity,high=0n,pending=null,accepted=null;
 function fail(why){latched=true;reason=why;pending=null;}
 function now(){const t=clock();if(!Number.isSafeInteger(t)||t<0||t<last){fail('clock_invalid');return null;}last=t;return t;}
 function tick(){const t=now();if(t===null)return null;if(pending&&t>=pending.start+250)fail('query_expired');if(accepted&&t-accepted.at>=1000)fail('snapshot_stale');return t;}
 return Object.freeze({
  query(seq){const t=tick(),n=tcpU64(seq);if(!enabled||closed||t===null||pending||n<=high||n===0n||t-lastQuery<500)throw Error('priority_query_unavailable');high=n;lastQuery=t;pending={seq,start:t};return Object.freeze({type:5,session,seq,payload:new Uint8Array()});},
  receive({connection:incoming,session:wireSession,seq,payload}){if(!enabled||closed||incoming!==connection||wireSession!==session)return false;const t=tick();if(t===null||!pending||pending.seq!==seq)return false;let v;try{v=decodePrioritySnapshot(payload);}catch{fail('invalid_snapshot');return false;}if(v.boot!==boot){fail('boot_mismatch');return false;}const at=pending.start,previous=accepted?.value;
   if(previous&&(BigInt(v.revision)<BigInt(previous.revision)||BigInt(v.local_epoch)<BigInt(previous.local_epoch)||v.revision===previous.revision&&(v.local_epoch!==previous.local_epoch||v.mode!==previous.mode))){fail('state_conflict');return false;}
   if(v.mode!=='clear'||previous&&(v.revision!==previous.revision||v.local_epoch!==previous.local_epoch))fail('local_change');pending=null;accepted={value:v,at};if(!latched)reason='clear';return true;
  },
  priority(){if(!enabled||closed||tick()===null)return 'unknown';if(latched)return reason==='local_change'&&accepted?.value.mode==='local'?'local':'unknown';return accepted?'clear':'unknown';},
  disconnect(){closed=true;fail('disconnected');},close(){closed=true;fail('closed');},
  snapshot:()=>({enabled,closed,latched,reason,pending:!!pending,has_snapshot:!!accepted,device_evidence:false})
 });
}
