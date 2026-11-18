import {createNative400TcpOwner} from './native400-tcp-owner.mjs';
/** Explicit independent transport window. No source/config export or automatic
 * start. Real material decision/source verification remains with trusted caller.
 * Only enabled:true can bind; all activation checks remain inside the owner. */
export function createNative400LanOwner(profile,{ackMs=2000,tickMs=25,timers}={}){return createNative400TcpOwner({lanProfile:profile,ackMs,tickMs,...(timers===undefined?{}:{timers})});}
