import {clone,same,increment,bounded,requireThat as need} from '../core/protocol.mjs';
import {assetRange} from './asset-segment.mjs';
/** A4 single-use read permits and <=4KiB checked reads, shared by both offline profiles.
 * state(socket, issuing=false) MUST run under the caller's fresh synchronous readView and assert session/control.
 * Invalidating aborts work but never removes a ticket; endRead belongs to the actual handler exit.
 * readAsset is the trusted synchronous A2 reader; this object owns no fd, listener or auth cache. */
export function createRoundPetReadLane({clock,state,manifest,packageRef,readAsset,readBudget=null,nextId}){
 if(readBudget){need(Object.keys(readBudget).sort().join(',')==='cleanup_ms,exchange_ms,margin_ms,segment_ms','invalid_read_budget');for(const v of Object.values(readBudget))bounded(v,1,30000);readBudget=clone(readBudget);}
 need(nextId===undefined||typeof nextId==='function');let permit=null,sequence='0';const reads=new Map();
 function current(ticket){const r=reads.get(ticket);need(r&&!r.controller.signal.aborted,'read_not_authorized');const s=state(r.socket);need(clock.now()<r.permit.deadline&&s.authorized&&s.valid&&same(s.target,r.permit.target)&&same(s.control,r.permit.control)&&same(s.context,r.permit.context),'read_not_authorized');return r;}
 return {
  issue(correlation=null){permit=null;if(!readBudget)return null;const s=state(undefined,true);if(reads.size||s.busy||!s.authorized||!s.target||!s.valid)return null;const t=clock.now(),needed=Object.values(readBudget).reduce((a,b)=>a+b,0);if(s.horizon-t<needed)return null;const deadline=Math.min(t+readBudget.segment_ms,s.horizon-readBudget.exchange_ms-readBudget.cleanup_ms-readBudget.margin_ms);sequence=increment(sequence);permit={id:nextId?nextId():`read_${sequence}`,target:clone(s.target),control:clone(s.control),context:clone(s.context),correlation:clone(correlation),deadline};return {id:permit.id,target:clone(permit.target),package_ref:clone(packageRef),remaining_ms:deadline-t};},
  begin(socket,headers){need(permit&&reads.size===0&&headers['x-round-pet-read']===permit.id,'read_not_authorized');const s=state(socket);need(clock.now()<permit.deadline&&s.valid&&s.authorized&&!s.busy&&same(s.target,permit.target)&&same(s.context,permit.context)&&same(s.control,permit.control),'read_not_authorized');const ticket=Object.freeze({segment_read:true});reads.set(ticket,{socket,permit:clone(permit),controller:new AbortController()});permit=null;return ticket;},
  timeout(ticket){const r=reads.get(ticket);need(r,'stale_task');return Math.max(1,r.permit.deadline-clock.now());},
  signal(ticket){const r=reads.get(ticket);need(r,'stale_task');return r.controller.signal;},
  page(ticket,offset,limit){current(ticket);bounded(offset,0,manifest.actions.length-1);bounded(limit,1,8);return clone(manifest.actions.slice(offset,offset+limit));},
  identity(ticket){return clone(current(ticket).permit);},
  range(ticket,headers,hash){const r=current(ticket);need(hash===r.permit.target.asset_sha256,'incompatible_asset');const a=manifest.actions.find(a=>a.id===r.permit.target.action_id);need(a?.sha256===hash,'incompatible_asset');return {...assetRange(headers,a.bytes,hash),total:a.bytes,sha:hash};},
  chunk(ticket,range,offset,length){current(ticket);bounded(length,1,Math.min(4096,range.end-offset+1));bounded(offset,range.start,range.end);const bytes=readAsset(range.sha,offset,length);need(bytes instanceof Uint8Array&&bytes.length===length,'asset_changed');current(ticket);return Buffer.from(bytes);},
  invalidate(){permit=null;for(const r of reads.values())r.controller.abort();},
  end(ticket){reads.delete(ticket);},
  resources:()=>({reads:reads.size,permit:permit?1:0})
 };
}
