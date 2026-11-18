import {clone,same,uint64,increment,bounded,requireThat as need} from './protocol.mjs';
/** One latest intent and one local episode; no I/O/auth/DSH. Caller supplies trusted
 * target/control and original deadlines. Touch, renew and loops never extend them. */
export class Native400Schedule {
 #clock;#latest=null;#touch=null;#high='0';#generation='0';#last=-1;
 constructor(clock){this.#clock=clock;}
 #now(){const n=this.#clock.now();bounded(n,0,Number.MAX_SAFE_INTEGER);need(n>=this.#last,'clock_failed');this.#last=n;return n;}
 #bump(){this.#generation=increment(this.#generation);}
 accept(target,mode,deadline){const now=this.#now();need(uint64(target.revision)>uint64(this.#high),'stale_revision');bounded(deadline,now+1,Number.MAX_SAFE_INTEGER);need(['base_loop','once_hold'].includes(mode),'invalid_message');this.#high=target.revision;this.#latest={target:clone(target),mode,deadline,active:true,reason:null};if(!this.#touch)this.#bump();return this.#touch?'deferred_local':'ready';}
 requestTouch(localMs){const now=this.#now();bounded(localMs,1,120000);if(this.#touch)return false;this.#touch={phase:'pending',deadline:now+localMs};this.#bump();return true;}
 beginTouch(){need(this.#touch?.phase==='pending'&&this.#now()<this.#touch.deadline,'local_deadline');this.#touch.phase='running';this.#bump();return this.#touch.deadline;}
 endTouch(){need(this.#touch,'stale_touch');this.#touch=null;this.#bump();return this.resume();}
 resume(){const now=this.#now();if(!this.#latest?.active)return null;if(now>=this.#latest.deadline){this.#latest.active=false;this.#latest.reason='deadline_exceeded';return null;}return clone(this.#latest);}
 cancel(target){if(this.#latest&&same(this.#latest.target,target)){this.#latest.active=false;this.#latest.reason='cancelled';}if(!this.#touch)this.#bump();}
 complete(){if(this.#latest?.mode==='once_hold'){this.#latest.active=false;this.#latest.reason='ended';}}
 fail(){if(this.#latest){this.#latest.active=false;this.#latest.reason='failed';}this.#bump();}
 reset(){this.#latest=null;this.#touch=null;this.#high='0';this.#bump();}
 snapshot(){return {latest:clone(this.#latest),touch:clone(this.#touch),generation:this.#generation};}
}
