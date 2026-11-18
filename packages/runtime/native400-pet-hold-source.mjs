import {readPetState,validatePetUrl} from '../source-pet/index.mjs';
const sources=new WeakMap();
/** Explicit HTTP response-liveness source. Never stamps a cached page read fresh.
 * Receipts and source lifetime stay in-process, separate from control authority. */
export function createNative400PetHoldSource({base,clock=()=>Math.floor(performance.now()),sourceMs=60000}={}){
 validatePetUrl(base);if(typeof clock!=='function'||!Number.isSafeInteger(sourceMs)||sourceMs<1||sourceMs>120000)throw Error('hold_source_invalid');
 let last=-1,closed=false;const receipts=new WeakMap();function now(){const t=clock();if(!Number.isSafeInteger(t)||t<0||t<last){closed=true;throw Error('hold_clock_invalid');}last=t;return t;}const start=now();if(start>Number.MAX_SAFE_INTEGER-sourceMs)throw Error('hold_source_invalid');const end=start+sourceMs;
 function check(value){const t=now(),stamp=receipts.get(value);if(closed||t>=end||stamp===undefined||t-stamp>1500)throw Error('hold_sample_stale');return {remaining_ms:end-t};}
 const option=Object.freeze({close(){closed=true;}});sources.set(option,Object.freeze({time:now,async read({signal}={}){const t=now();if(closed||t>=end)throw Error('hold_source_expired');const value=Object.freeze({status:'ready',...await readPetState(base,{signal})});receipts.set(value,t);check(value);return value;},check}));return option;
}
/** Internal trusted bridge loan; JSON/clone/page-cache handles are rejected. */
export function native400PetHoldContext(option){const c=sources.get(option);if(!c)throw Error('hold_source_invalid');return c;}
