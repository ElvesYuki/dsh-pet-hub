import {bounded,requireThat as need} from './protocol.mjs';
/** Trusted offline cost declarations, never measured device bounds. The trigger
 * reserves a poll gap, one compute, response tail, source exit and cleanup before
 * the unchanged ACK/exchange/margin floor. No lease or job extension. */
export function native400CycleBudget({ackMs=4000,readBudget}={}){
 bounded(ackMs,1,4000);if(readBudget){for(const [k,max] of Object.entries({segment_ms:1000,exchange_ms:500,cleanup_ms:100,margin_ms:10}))bounded(readBudget[k],1,max);}
 const b={poll_ms:500,compute_ms:100,exchange_ms:500,source_ms:1000,cleanup_ms:100,margin_ms:10,ack_ms:ackMs};
 b.renew_floor_ms=ackMs+b.exchange_ms+b.margin_ms;b.silent_ms=b.poll_ms+b.compute_ms+b.exchange_ms+b.source_ms+b.cleanup_ms;b.renew_trigger_ms=b.renew_floor_ms+b.silent_ms+b.margin_ms;
 return Object.freeze(b);
}
/** Necessary planned-cost check to first complete play, not a total-wall guarantee.
 * Catalog/file/control/source/compute costs are declarations; unmodelled waiting
 * or actual overshoot must still fail at the original independent deadline. */
export function native400JobBudget({bytes,frames,pages=20,jobMs=120000}){
 bounded(bytes,1,5865472);need(frames===118||frames===241,'invalid_timing');bounded(pages,0,20);bounded(jobMs,1,120000);
 const b=native400CycleBudget(),segments=Math.ceil(bytes/32768),reads=pages+2*segments;
 const cycle=2*b.exchange_ms+b.source_ms+b.cleanup_ms+2*b.margin_ms;
 const compute=4*frames+2*segments+6,play=Math.ceil(frames*1000/24),required=reads*cycle+compute*b.compute_ms+play;
 return {fits_declared_plan:required<=jobMs,required_ms:required,job_ms:jobMs,segments_per_pass:segments,initial_pages:pages,read_cycles:reads,compute_steps:compute,play_ms:play,indefinite_loop:false};
}
