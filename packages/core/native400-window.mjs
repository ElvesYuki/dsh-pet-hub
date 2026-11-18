import {requireThat as need,bounded,keys,same,clone,uint64,id} from './protocol.mjs';
import {crc32,decodeNative400Tile} from './pet4.mjs';
import {native400Metadata} from './native400-identity.mjs';

export const NATIVE400_WINDOW_PROFILE='round-pet-native400-window-review/1';
const WINDOW=1048576,RGB=320000,PIXELS=160000,MAX_FILE=5865472;
const CAP={schema_version:3,profile:NATIVE400_WINDOW_PROFILE,execution_model:'frame_window',display:{width:466,height:466,pixel_format:'RGB565',shape:'circle'},media:{width:400,height:400,offset:[33,33],fps:24,max_frames:241,key_interval:12,codec_flag:1,tile_rows:20,extra_keyframes:true},max_asset_bytes:MAX_FILE,working_set:{compressed_window_bytes:WINDOW,rgb_frames:3,rgb_frame_bytes:RGB,history_bytes:PIXELS,tile_bytes:8000,packed_scratch_bytes:8064,metadata_max_bytes:2464,frame_receipt_max_bytes:7712},persistent:null};
/** Local review schema, intentionally rejected by the existing generic schema1/2 parser. */
export function native400WindowCapabilities(value=clone(CAP)){need(same(value,CAP),'unsupported_window_capabilities');return clone(CAP);}
const hex=b=>{need(b instanceof Uint8Array&&b.length===32,'invalid_hash');return Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');};
const exact=(v,fields)=>{keys(v,fields);need(Object.keys(v).length===fields.length,'invalid_window_input');};

/** Offline synchronous window actor. SHA256 factory is a trusted, synchronous incremental
 * dependency: {update(Uint8Array), digest(): Uint8Array(32)}. No authentication or I/O.
 * Caller owns local deadline/session authority and the actual display submission boundary.
 * Opaque tickets/frames are instance-local. close is idempotent; reentrant close fences
 * immediately but retains buffers until the active synchronous operation actually exits. */
export class Native400WindowModel {
 #metadata;#factory;#clock;#policy;#last=-1;#session;#high=-1n;#work;#front;#busy=false;#active;#closing=false;#closed=false;
 #ring=new Uint8Array(WINDOW);#rgbs=Array.from({length:3},()=>new Uint8Array(RGB));#history=new Uint8Array(PIXELS);#tile=new Uint8Array(8000);#packed=new Uint8Array(8064);
 constructor({metadata,hashFactory,clock,policy='verified-replay',capabilities}={}){
  native400WindowCapabilities(capabilities);need(typeof clock==='function'&&typeof hashFactory==='function','invalid_window_dependency');
  need(['verified-replay','progressive-review'].includes(policy),'invalid_integrity_policy');
  this.#clock=clock;this.#factory=hashFactory;this.#policy=policy;
  const hash=bytes=>{const h=this.#newHash();h.update(typeof bytes==='string'?new TextEncoder().encode(bytes):bytes);return hex(h.digest());};
  this.#metadata=native400Metadata({package:metadata?.package,catalog:metadata?.catalog,approval:metadata?.approval,sourceSha256:metadata?.identity?.source_manifest_sha256,sourceIndexSha256:metadata?.identity?.source_index_sha256,hash});
  this.#now();
 }
 #newHash(){const h=this.#factory();need(h&&typeof h.update==='function'&&typeof h.digest==='function'&&!h.then,'invalid_hash');return h;}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||n<0||n>Number.MAX_SAFE_INTEGER-3600000||n<this.#last){this.#invalidate('clock_failed');this.#session=undefined;need(false,'clock_failed');}this.#last=n;return n;}
 #open(){need(!this.#closing&&!this.#closed,'window_closed');}
 #invalidate(reason){const w=this.#work;if(w){w.live=false;w.owner.live=false;w.reason=reason;w.ready=undefined;w.frame=undefined;if(this.#front?.owner===w.owner&&this.#front.integrity==='pending')this.#front.integrity='failed';}this.#work=undefined;}
 #valid(w){this.#open();need(this.#work===w&&w.live,'stale_window_ticket');const n=this.#now();this.#open();need(this.#work===w&&w.live,'stale_window_ticket');if(!this.#session||n>=this.#session.deadline){this.#invalidate('deadline');this.#session=undefined;need(false,'window_deadline');}return n;}
 #get(ticket){const w=this.#work;need(w&&w.ticket===ticket,'stale_window_ticket');this.#valid(w);return w;}
 #exclusive(fn){need(!this.#busy,'window_busy');this.#open();this.#busy=true;try{return fn();}finally{this.#busy=false;if(this.#closing)this.#release();}}
 #operation(w,fn){return this.#exclusive(()=>{this.#active=w;try{const value=fn();this.#valid(w);return value;}catch(e){if(this.#work===w){if(this.#front?.owner===w.owner&&this.#front.integrity==='pending')this.#front.integrity='failed';w.phase='failed';w.integrity='failed';w.reason=e.code??'window_failed';w.live=false;w.owner.live=false;w.ready=undefined;w.frame=undefined;w.hash=undefined;w.ih=undefined;w.rh=undefined;w.receipts=undefined;}throw e;}finally{this.#active=undefined;}});}
 #update(w,h,b){const r=h.update(b);need(!r?.then,'invalid_hash');this.#valid(w);}
 #digest(w,h){const d=h.digest();this.#valid(w);need(d instanceof Uint8Array&&d.length===32,'invalid_hash');return d;}
 /** New local session replaces all candidate work; it does not authenticate a peer. */
 beginSession(session,{deadline}={}){this.#open();need(!this.#busy,'window_busy');id(session);const n=this.#now();bounded(deadline,n+1,n+3600000);this.#invalidate('new_session');this.#session={session,deadline};this.#high=-1n;return this.snapshot();}
 /** Monotonic revision within this session. Replacement is explicit, no queued targets. */
 request(command){this.#open();need(!this.#busy,'window_busy');exact(command,['command_id','revision','action_id','mode']);id(command.command_id);const rev=uint64(command.revision);bounded(command.action_id,0,77);need(['loop','once_hold'].includes(command.mode),'invalid_window_mode');
  const n=this.#now();if(!this.#session||n>=this.#session.deadline){this.#invalidate('deadline');this.#session=undefined;need(false,'window_deadline');}
  const old=this.#work;if(old?.live&&same(old.command,command))return old.ticket;need(!old||old.command.command_id!==command.command_id,'command_conflict');need(rev>this.#high,'stale_revision');
  this.#invalidate('superseded');this.#high=rev;const ticket=Object.freeze({});this.#work={ticket,owner:{live:true},command:clone(command),live:true,phase:'metadata',integrity:'pending',pass:0,loops:0,shown:-1,extra:0};return ticket;
 }
 /** Copy only PET4 header + tables. Entire encoded assets are never accepted here. */
 begin(ticket,metadataBytes){const w=this.#get(ticket);need(w.phase==='metadata','window_phase');need(metadataBytes instanceof Uint8Array,'pet4_header');
  this.#operation(w,()=>{
   const timing=this.#metadata.package.content.timing[w.command.action_id],asset=this.#metadata.manifest.actions[w.command.action_id],size=532+4*(2*timing.frames+1);
   need(metadataBytes.length===size,'pet4_table');const header=new Uint8Array(metadataBytes),v=new DataView(header.buffer);
   need(String.fromCharCode(...header.subarray(0,4))==='PET4'&&v.getUint16(4,true)===400&&v.getUint16(6,true)===400&&v.getUint16(8,true)===24&&v.getUint16(10,true)===timing.frames,'pet4_profile');
   need(v.getUint16(524,true)===12&&v.getUint16(526,true)===1&&crc32(header.subarray(4,528))===v.getUint32(528,true),'pet4_header_crc');
   const offset=i=>v.getUint32(532+4*i,true);need(offset(0)===0&&offset(timing.frames)===asset.bytes-size&&asset.bytes<=MAX_FILE,'pet4_offsets');
   for(let i=0;i<timing.frames;i++){need(offset(i+1)>offset(i)&&offset(i+1)-offset(i)<=160981,'pet4_offsets');need(offset(Math.min(i+24,timing.frames))-offset(i)<=WINDOW,'window_admission');}
   Object.assign(w,{header,view:v,timing,asset,receipts:new Uint8Array(32*timing.frames)});this.#reset(w,false);
  });return this.snapshot();
 }
 #offset(w,i){return w.view.getUint32(532+4*i,true);}
 #reset(w,replay){Object.assign(w,{read:0,received:0,used:0,next:0,shown:-1,extra:0,ready:undefined,frame:undefined,started:undefined,pause:undefined,pass:w.pass+1,phase:replay?'priming':this.#policy==='verified-replay'?'verifying':'priming',replay,hash:this.#newHash(),ih:this.#newHash(),rh:this.#newHash()});this.#valid(w);this.#history.fill(0);this.#update(w,w.hash,w.header);}
 /** Payload-relative credit; bounded by actual ring space and a 36-frame high water. */
 credit(ticket){const w=this.#get(ticket);if(!w.header||['verified','ended','failed'].includes(w.phase))return 0;return Math.min(WINDOW-w.used,this.#offset(w,Math.min((w.ready?.f??w.next)+36,w.timing.frames))-w.received);}
 append(ticket,offset,bytes){const w=this.#get(ticket);need(w.header&&w.hash,'window_phase');need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=32768,'invalid_segment');need(offset===w.received,'segment_offset');need(bytes.length<=this.credit(ticket),'window_backpressure');
  return this.#operation(w,()=>{const write=(w.read+w.used)%WINDOW,first=Math.min(bytes.length,WINDOW-write);this.#ring.set(bytes.subarray(0,first),write);this.#ring.set(bytes.subarray(first),0);this.#update(w,w.hash,this.#ring.subarray(write,write+first));if(first<bytes.length)this.#update(w,w.hash,this.#ring.subarray(0,bytes.length-first));w.received+=bytes.length;w.used+=bytes.length;return bytes.length;});
 }
 #byte(w,relative){return this.#ring[(w.read+relative)%WINDOW];}
 #frameHash(w,length){const h=this.#newHash(),first=Math.min(length,WINDOW-w.read);this.#valid(w);this.#update(w,h,this.#ring.subarray(w.read,w.read+first));if(first<length)this.#update(w,h,this.#ring.subarray(0,length-first));return this.#digest(w,h);}
 /** Decode at most one frame, checking real LZ4, XOR, CRC and review replay receipts. */
 decodeNext(ticket){const w=this.#get(ticket);need(w.header&&w.hash,'window_phase');need(!w.ready,'frame_pending');if(w.next===w.timing.frames)return false;
  const f=w.next,length=this.#offset(w,f+1)-this.#offset(w,f);if(w.used<length)return false;
  return this.#operation(w,()=>{
   const proof=this.#frameHash(w,length),expected=w.receipts.subarray(32*f,32*(f+1));if(w.replay)need(proof.every((v,i)=>v===expected[i]),'replay_integrity_failed');else expected.set(proof);
   const tag=this.#byte(w,0);need(tag<=1&&(f%12!==0||tag===0),'pet4_keyframe');if(!tag&&f%12!==0)w.extra++;
   let p=1;for(let off=0;off<PIXELS;off+=8000){need(p+2<=length,'pet4_tile');const size=this.#byte(w,p)|(this.#byte(w,p+1)<<8);p+=2;need(size>0&&size<=8047&&p+size<=length,'pet4_tile');for(let i=0;i<size;i++)this.#packed[i]=this.#byte(w,p+i);p+=size;
    decodeNative400Tile(this.#packed.subarray(0,size),this.#tile);if(tag)for(let i=0;i<8000;i++)this.#history[off+i]^=this.#tile[i];else this.#history.set(this.#tile,off);
   }
   need(p===length&&crc32(this.#history)===w.view.getUint32(532+4*(w.timing.frames+1+f),true),'pet4_frame_crc');
   const rgb=this.#rgbs.find(b=>b!==this.#front?.rgb);for(let i=0;i<PIXELS;i++){const c=w.view.getUint16(12+2*this.#history[i],true);rgb[2*i]=c&255;rgb[2*i+1]=c>>>8;}
   this.#update(w,w.ih,this.#history);this.#update(w,w.rh,rgb);w.read=(w.read+length)%WINDOW;w.used-=length;w.next++;
   if(w.replay||this.#policy==='progressive-review')w.ready={f,rgb};return true;
  });
 }
 /** Whole-file proof is independent of display submission and of persistent commit. */
 finish(ticket){const w=this.#get(ticket);need(w.hash&&w.next===w.timing.frames&&w.received===this.#offset(w,w.timing.frames),'incomplete_window');
  this.#operation(w,()=>{need(hex(this.#digest(w,w.hash))===w.asset.sha256,'file_integrity_failed');need(hex(this.#digest(w,w.ih))===w.timing.index_sha256,'index_integrity_failed');need(hex(this.#digest(w,w.rh))===w.timing.rgb565_sha256,'rgb_integrity_failed');need(w.extra===w.timing.extra_keyframes,'keyframe_count_failed');w.hash=undefined;w.ih=undefined;w.rh=undefined;w.integrity='verified';if(this.#front?.owner===w.owner)this.#front.integrity='verified';if(this.#policy==='verified-replay'&&!w.replay)w.phase='verified';});return this.snapshot();
 }
 /** A second bounded read proves each compressed frame against first-pass SHA receipts. */
 startReplay(ticket){const w=this.#get(ticket);need(w.integrity==='verified'&&!w.hash&&!w.ready,'window_phase');if(w.pass>1||this.#policy==='progressive-review')need(w.command.mode==='loop'&&w.shown===w.timing.frames-1&&this.#elapsed(w,this.#last)>=Math.ceil(w.timing.frames*1000/24),'window_phase');
  this.#operation(w,()=>{if(w.replay||this.#policy==='progressive-review')w.loops++;this.#reset(w,true);});return this.snapshot();
 }
 #available(w){let count=w.ready?1:0;for(let f=w.next;f<w.timing.frames&&this.#offset(w,f+1)<=w.received;f++)count++;return count;}
 #elapsed(w,n){return w.started===undefined?0:Math.max(0,(w.pause??n)-w.started);}
 /** Call on the virtual/scheduler clock; never skips frames to compensate for lateness. */
 tick(){this.#open();need(!this.#busy,'window_busy');const w=this.#work;if(!w)return this.snapshot();const n=this.#valid(w);
  if(w.started!==undefined&&w.shown<w.timing.frames-1&&!w.ready&&this.#elapsed(w,n)>=Math.ceil((w.shown+1)*1000/24)){w.pause??=w.started+Math.ceil((w.shown+1)*1000/24);w.phase='buffering';}
  if(w.shown===w.timing.frames-1&&this.#elapsed(w,n)>=Math.ceil(w.timing.frames*1000/24)){w.phase=w.command.mode==='once_hold'?'ended':'loop_wait';}return this.snapshot();
 }
 /** Prepare does not publish playing. Token is consumed only by submitFrame. */
 prepareFrame(ticket){const w=this.#get(ticket);need(!this.#busy,'window_busy');if(!w.ready)return null;if(w.frame)return w.frame;
  const n=this.#valid(w);if(w.started===undefined||w.pause!==undefined){if(this.#available(w)<Math.min(24,w.timing.frames-w.ready.f))return null;}
  if(w.started!==undefined&&w.pause===undefined&&this.#elapsed(w,n)<Math.ceil(w.ready.f*1000/24))return null;
  w.frame=Object.freeze({});return w.frame;
 }
 /** Software display-commit boundary for this offline model, not an ESP DMA receipt. */
 submitFrame(ticket,frame){const w=this.#get(ticket);need(!this.#busy,'window_busy');need(frame&&w.frame===frame&&w.ready,'stale_frame_token');const n=this.#valid(w);
  const {f,rgb}=w.ready;if(w.started===undefined)w.started=n;if(w.pause!==undefined){w.started+=n-w.pause;w.pause=undefined;}
  const due=w.started+Math.ceil(f*1000/24);if(n>due)w.started+=n-due;
  this.#front={owner:w.owner,action_id:w.command.action_id,revision:w.command.revision,frame:f,rgb,integrity:w.integrity};w.shown=f;w.ready=undefined;w.frame=undefined;w.phase='playing';return this.snapshot();
 }
 cancel(ticket){this.#get(ticket);need(!this.#busy,'window_busy');this.#invalidate('cancelled');return this.snapshot();}
 disconnect(){this.#open();this.#invalidate('disconnected');this.#session=undefined;return this.snapshot();}
 suspend(){return this.disconnect();}
 /** Copies pixels into caller-owned storage, never exposes an internal live buffer. */
 copyFrontInto(output){this.#open();need(!this.#busy,'window_busy');need(output instanceof Uint8Array&&output.length===RGB,'pet4_output');need(this.#front,'no_front');output.set(this.#front.rgb);return this.snapshot().actual;}
 snapshot(){const w=this.#work,f=this.#front;return {profile:NATIVE400_WINDOW_PROFILE,policy:this.#policy,closed:this.#closed,closing:this.#closing,busy:this.#busy,session:this.#session?.session??null,desired:w?clone(w.command):null,phase:w?.phase??(this.#closed?'closed':'idle'),integrity:w?.integrity??null,failure:w?.reason??null,pass:w?.pass??0,loops:w?.loops??0,decoded_frames:w?.next??0,received_payload_bytes:w?.received??0,buffered_bytes:w?.used??0,ready_frame:w?.ready?.f??null,elapsed_ms:w?.started!==undefined?this.#elapsed(w,this.#last):0,actual:f?{action_id:f.action_id,revision:f.revision,frame:f.frame,display_integrity:f.integrity,historical:this.#work?.owner!==f.owner||!f.owner.live}:null,persistent:null};}
 resources(){const w=this.#work??this.#active;return {ring_bytes:this.#ring?.length??0,rgb_bytes:this.#rgbs?.reduce((n,b)=>n+b.length,0)??0,history_bytes:this.#history?.length??0,tile_bytes:this.#tile?.length??0,packed_bytes:this.#packed?.length??0,metadata_bytes:w?.header?.length??0,receipt_bytes:w?.receipts?.length??0,buffered_bytes:w?.used??0,busy:this.#busy,closed:this.#closed};}
 #release(){this.#invalidate('closed');this.#front=undefined;this.#session=undefined;this.#ring=undefined;this.#rgbs=undefined;this.#history=undefined;this.#tile=undefined;this.#packed=undefined;this.#closed=true;}
 close(){if(this.#closed)return;this.#closing=true;this.#invalidate('closed');this.#session=undefined;if(!this.#busy)this.#release();}
}
