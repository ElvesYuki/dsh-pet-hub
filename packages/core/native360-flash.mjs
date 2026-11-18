import {keys,uint64,increment,bounded,requireThat,clone,same} from './protocol.mjs';
import {NATIVE360,native360Capabilities,native360Asset,verifyNative360} from './native360-profile.mjs';

const failure=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
/** Pure logical Flash owner; medium/validator are trusted synchronous adapters, never wire inputs.
 * begin/append/commit publish exactly one root; marker-attempt failure blocks writes until recover.
 * read leases are opaque and pin physical object generations even after a same-ID replacement.
 * close releases ownership without erasing data. No filesystem, actual V2 layout or physical timing. */
export class Native360FlashModel {
 #medium;#verify;#owner=Object.freeze({flash_owner:true});#root=null;#rootIndex=0;#entries=[];
 #pending=null;#leases=new Map();#closed=false;#busy=false;#uncertain=false;#reason=null;
 constructor({medium,caps,verifyAsset=()=>false,namespace=NATIVE360.namespace,create=false}){
  native360Capabilities(caps);requireThat(namespace===NATIVE360.namespace,'incompatible_asset');requireThat(typeof verifyAsset==='function');
  this.#medium=medium;this.#verify=verifyAsset;medium.claim(this.#owner);
  try{if(create){requireThat(medium.isErased(),'flash_not_erased');medium.writeRoot(0,{schema_version:1,namespace,sequence:'0',state:'EMPTY',refs:[]});}this.#recover();}
  catch(error){this.#closed=true;medium.release(this.#owner);throw error;}
 }
 #active(){requireThat(!this.#closed,'closed');}
 #healthy(){this.#active();requireThat(!this.#uncertain,this.#reason??'storage_commit_unknown');}
 #run(work){this.#active();requireThat(!this.#busy,'flash_busy');this.#busy=true;try{return work();}finally{this.#busy=false;}}
 #validateRoot(root){
  keys(root,['schema_version','namespace','sequence','state','refs']);const seq=uint64(root.sequence);
  requireThat(root.schema_version===1&&root.namespace===NATIVE360.namespace&&['EMPTY','IDLE_READY','OFFLINE_READY'].includes(root.state)&&Array.isArray(root.refs)&&root.refs.length<=4,'flash_metadata_invalid');
  const slots=new Set(),ids=new Set(),entries=[];
  for(const ref of root.refs){keys(ref,['slot','generation']);bounded(ref.slot,0,4);uint64(ref.generation);requireThat(!slots.has(ref.slot),'flash_metadata_invalid');slots.add(ref.slot);
   const header=this.#medium.readHeader(ref.slot);requireThat(header,'flash_metadata_invalid');keys(header,['namespace','generation','validator_version','asset']);native360Asset(header.asset);
   requireThat(header.namespace===root.namespace&&header.validator_version===1&&header.generation===ref.generation&&uint64(header.generation)>0n&&uint64(header.generation)<=seq&&!ids.has(header.asset.id),'flash_metadata_invalid');ids.add(header.asset.id);
   verifyNative360(this.#verify,this.#medium.readBytes(ref.slot,0,header.asset.bytes),header.asset);entries.push({slot:ref.slot,...clone(header)});
  }
  requireThat(root.state==='EMPTY'?entries.length===0:root.state==='IDLE_READY'?entries.length===1&&ids.has(0):ids.has(0)&&ids.has(4),'flash_metadata_invalid');
  return {root:clone(root),entries};
 }
 #recover(){
  const candidates=[];
  for(let index=0;index<2;index++){const raw=this.#medium.readRoot(index);if(raw===null)continue;
   try{candidates.push({index,...this.#validateRoot(raw)});}catch(error){if(!['invalid_message','flash_metadata_invalid','asset_integrity_failed'].includes(error.code))throw error;}
  }
  requireThat(candidates.length>0,'flash_recovery_failed');
  if(candidates.length===2&&candidates[0].root.sequence===candidates[1].root.sequence)requireThat(same(candidates[0].root,candidates[1].root),'flash_roots_conflict');
  candidates.sort((a,b)=>uint64(a.root.sequence)>uint64(b.root.sequence)?-1:1);const best=candidates[0];
  this.#root=best.root;this.#rootIndex=best.index;this.#entries=best.entries;this.#uncertain=false;this.#reason=null;
 }
 #find(asset){return this.#entries.find(e=>same(e.asset,asset));}
 #receipt(e){return {namespace:NATIVE360.namespace,asset:clone(e.asset),root_seq:this.#root.sequence,object_generation:e.generation};}
 #pinned(slot){return [...this.#leases.values()].some(e=>e.slot===slot);}
 lookup(asset){this.#healthy();native360Asset(asset);const e=this.#find(asset);return e?this.#receipt(e):null;}
 inventory(){this.#active();return this.#uncertain?{known:false,reason:this.#reason,root_seq:null,entries:[]}:{known:true,root_seq:this.#root.sequence,state:this.#root.state,namespace:NATIVE360.namespace,entries:this.#entries.map(e=>({...this.#receipt(e),slot:e.slot,offline_available:true}))};}
 begin(asset,{victim_action_id}={}){return this.#run(()=>{
  this.#healthy();asset=native360Asset(asset);requireThat(!this.#pending,'cache_busy');const hit=this.#find(asset);if(hit)return {already_saved:true,receipt:this.#receipt(hit)};
  const sequence=increment(this.#root.sequence),existing=this.#entries.find(e=>e.asset.id===asset.id);
  requireThat(this.#root.state!=='EMPTY'||asset.id===0,'protected_defaults_missing');requireThat(this.#root.state!=='IDLE_READY'||[0,4].includes(asset.id),'protected_defaults_missing');
  let victim=existing;
  if(victim_action_id!==undefined)bounded(victim_action_id,0,77);
  if(victim)requireThat(victim_action_id===undefined||victim_action_id===asset.id,'cache_busy');
  else if(victim_action_id!==undefined){victim=this.#entries.find(e=>e.asset.id===victim_action_id);requireThat(victim&&!this.#pinned(victim.slot)&&![0,4].includes(victim.asset.id),'cache_busy');}
  else requireThat(this.#entries.length<4,'cache_busy');
  const slot=[0,1,2,3,4].find(s=>!this.#entries.some(e=>e.slot===s)&&!this.#pinned(s));requireThat(slot!==undefined,'cache_busy');
  const refs=this.#root.refs.map(clone),ref={slot,generation:sequence};if(victim)refs[refs.findIndex(r=>r.slot===victim.slot)]=ref;else refs.push(ref);
  const state=this.#root.state==='EMPTY'?'IDLE_READY':this.#root.state==='IDLE_READY'&&asset.id===4?'OFFLINE_READY':this.#root.state;
  try{this.#medium.eraseRoot(1-this.#rootIndex);this.#medium.prepareObject(slot,asset.bytes);}catch(cause){throw failure('storage_failed',cause);}
  const ticket=Object.freeze({flash_transaction:true});this.#pending={ticket,slot,asset,sequence,written:0,root:{...clone(this.#root),sequence,state,refs}};return {already_saved:false,ticket};
 });}
 #transaction(ticket){this.#healthy();requireThat(this.#pending?.ticket===ticket,'stale_task');return this.#pending;}
 append(ticket,bytes){return this.#run(()=>{const p=this.#transaction(ticket);requireThat(!p.gate,'commit_in_progress');requireThat(bytes instanceof Uint8Array);bounded(bytes.length,1,Math.min(4096,p.asset.bytes-p.written));try{this.#medium.writeChunk(p.slot,p.written,bytes);}catch(cause){this.#pending=null;throw failure('storage_failed',cause);}p.written+=bytes.length;return p.written;});}
 /** Complete payload enters a non-cancellable commit gate. Token is local/opaque, never wire. */
 gateCommit(ticket){return this.#run(()=>{const p=this.#transaction(ticket);requireThat(p.written===p.asset.bytes,'asset_incomplete');requireThat(!p.gate,'commit_in_progress');p.gate=Object.freeze({flash_commit_gate:true});return p.gate;});}
 commit(ticket,{gate}={}){return this.#run(()=>{
  const p=this.#transaction(ticket);requireThat(p.written===p.asset.bytes,'asset_incomplete');requireThat(gate===undefined?!p.gate:p.gate===gate,'stale_commit_gate');
  try{verifyNative360(this.#verify,this.#medium.readBytes(p.slot,0,p.asset.bytes),p.asset);this.#medium.writeHeader(p.slot,{namespace:NATIVE360.namespace,generation:p.sequence,validator_version:1,asset:clone(p.asset)});}
  catch(cause){this.#pending=null;throw failure(cause.code==='asset_integrity_failed'?'asset_integrity_failed':'storage_failed',cause);}
  // Once the root marker is attempted, an error cannot prove that it did not persist.
  try{this.#medium.writeRoot(1-this.#rootIndex,clone(p.root));requireThat(same(this.#medium.readRoot(1-this.#rootIndex),p.root),'flash_readback_failed');}
  catch(cause){this.#pending=null;this.#uncertain=true;this.#reason='storage_commit_unknown';throw failure('storage_commit_unknown',cause);}
  const entry={slot:p.slot,namespace:NATIVE360.namespace,generation:p.sequence,validator_version:1,asset:clone(p.asset)};this.#entries=p.root.refs.map(r=>r.slot===p.slot?entry:this.#entries.find(e=>e.slot===r.slot));this.#root=p.root;this.#rootIndex=1-this.#rootIndex;this.#pending=null;return this.#receipt(this.#find(p.asset));
 });}
 cancel(ticket){return this.#run(()=>{requireThat(!this.#transaction(ticket).gate,'commit_in_progress');this.#pending=null;return {cancelled:true};});}
 openRead(asset){return this.#run(()=>{this.#healthy();native360Asset(asset);requireThat(this.#leases.size<8,'capacity_exceeded');const e=this.#find(asset);requireThat(e,'asset_unavailable');const ticket=Object.freeze({flash_read:true});this.#leases.set(ticket,clone(e));return ticket;});}
 read(ticket,offset,length){this.#healthy();const e=this.#leases.get(ticket);requireThat(e,'stale_task');bounded(offset,0,e.asset.bytes);bounded(length,0,Math.min(4096,e.asset.bytes-offset));requireThat(same(this.#medium.readHeader(e.slot),{namespace:e.namespace,generation:e.generation,validator_version:e.validator_version,asset:e.asset}),'stale_task');return this.#medium.readBytes(e.slot,offset,length);}
 releaseRead(ticket){this.#active();return this.#leases.delete(ticket);}
 recover(){return this.#run(()=>{requireThat(!this.#pending&&this.#leases.size===0,'cache_busy');this.#uncertain=true;this.#reason='flash_recovery_required';this.#recover();return this.inventory();});}
 reboot(){return this.#run(()=>{this.#pending=null;this.#leases.clear();this.#uncertain=true;this.#reason='flash_recovery_required';this.#recover();return this.inventory();});}
 resources(){return {closed:this.#closed,busy:this.#busy,uncertain:this.#uncertain,pending:this.#pending?1:0,read_leases:this.#leases.size,active_refs:this.#entries.length};}
 close(){if(this.#closed)return;requireThat(!this.#busy,'flash_busy');this.#pending=null;this.#leases.clear();this.#medium.release(this.#owner);this.#entries=[];this.#root=null;this.#closed=true;}
}
