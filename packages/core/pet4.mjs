import {requireThat,bounded} from './protocol.mjs';
// Independent implementation from PET4 layout and the published LZ4 block format.
import {crc32} from './crc32.mjs';
export {crc32};
export function decodeLz4(input,size,output){return decodeBlock(input,size,output,7200);}
/** Explicit native400 tile entry; keeps the legacy decodeLz4 limit unchanged. */
export function decodeNative400Tile(input,output){return decodeBlock(input,8000,output,8000);}
function decodeBlock(input,size,output,limit){
  requireThat(input instanceof Uint8Array);bounded(size,1,limit);
  const out=output??new Uint8Array(size);requireThat(out instanceof Uint8Array&&out.length===size&&out.buffer!==input.buffer,'lz4_output');let p=0,q=0,lastMatch=-1,lastLiteral=0;
  const length=base=>{let n=base;if(base===15){let b;do{requireThat(p<input.length,'lz4_truncated');b=input[p++];n+=b;requireThat(n<=size,'lz4_overflow');}while(b===255);}return n;};
  while(p<input.length){
    const token=input[p++],literals=length(token>>>4);lastLiteral=literals;
    requireThat(literals<=input.length-p&&literals<=size-q,'lz4_bounds');out.set(input.subarray(p,p+literals),q);p+=literals;q+=literals;
    if(p===input.length)break;
    requireThat(p+2<=input.length,'lz4_truncated');const offset=input[p]|input[p+1]<<8;p+=2;
    requireThat(offset>0&&offset<=q,'lz4_offset');const match=length(token&15)+4;
    requireThat(match<=size-q,'lz4_overflow');lastMatch=q;
    for(let i=0;i<match;i++){out[q]=out[q-offset];q++;}
  }
  requireThat(q===size&&p===input.length&&lastLiteral>=Math.min(5,size)&&(lastMatch<0||lastMatch<=size-12),'lz4_terminal');return out;
}
export class Pet4Decoder {
  #bytes;#view;#offsets;#crcs;#base;#palette;#history;#scratch;#last=-1;#tileLimit=7200;
  constructor(source,{profile='legacy'}={}){
    requireThat(['legacy','native400-candidate-v1'].includes(profile),'pet4_profile');
    requireThat(source instanceof Uint8Array&&source.length>=544,'pet4_header');this.#bytes=new Uint8Array(source);const b=this.#bytes,v=new DataView(b.buffer);this.#view=v;
    requireThat(String.fromCharCode(...b.subarray(0,4))==='PET4','pet4_magic');
    this.width=v.getUint16(4,true);this.height=v.getUint16(6,true);this.fps=v.getUint16(8,true);this.frames=v.getUint16(10,true);
    const candidate=profile==='native400-candidate-v1';this.#tileLimit=candidate?8000:7200;
    requireThat((candidate?this.width===400:[240,360].includes(this.width))&&this.height===this.width&&this.fps===24&&this.frames>=1&&this.frames<=(candidate?241:360),'pet4_profile');
    requireThat(b.length<=(candidate?16777216:this.width===240?3145728:5865472),'pet4_size');
    requireThat(v.getUint16(524,true)===12&&v.getUint16(526,true)===1&&crc32(b.subarray(4,528))===v.getUint32(528,true),'pet4_header_crc');
    this.#base=532+4*(2*this.frames+1);requireThat(this.#base<b.length,'pet4_table');
    this.#offsets=Array.from({length:this.frames+1},(_,i)=>v.getUint32(532+4*i,true));
    this.#crcs=Array.from({length:this.frames},(_,i)=>v.getUint32(532+4*(this.frames+1+i),true));
    requireThat(this.#offsets[0]===0&&this.#offsets[this.frames]===b.length-this.#base,'pet4_offsets');
    for(let i=0;i<this.frames;i++){
      requireThat(this.#offsets[i]<this.#offsets[i+1]&&this.#offsets[i+1]<=b.length-this.#base,'pet4_offsets');
      const tag=b[this.#base+this.#offsets[i]];requireThat(tag<=1&&(i%12!==0||tag===0),'pet4_keyframe');
    }
    this.#palette=Uint16Array.from({length:256},(_,i)=>v.getUint16(12+2*i,true));this.#history=new Uint8Array(this.width*this.height);this.#scratch=new Uint8Array(this.width*20);
  }
  decode(frame){
    return this.decodeInto(frame,{indices:new Uint8Array(this.width*this.height),rgb565:new Uint8Array(this.width*this.height*2)});
  }
  /** Caller-owned output; omitting RGB avoids conversion during CRC-only validation. */
  decodeInto(frame,{indices,rgb565}={}){
    bounded(frame,0,this.frames-1);const b=this.#bytes,v=this.#view,tile=this.width*20;
    if(indices!==undefined)requireThat(indices instanceof Uint8Array&&indices.length===this.#history.length,'pet4_output');
    if(rgb565!==undefined)requireThat(rgb565 instanceof Uint8Array&&rgb565.length===this.#history.length*2,'pet4_output');
    if(indices&&rgb565)requireThat(indices.buffer!==rgb565.buffer,'pet4_output');
    let start=Math.floor(frame/12)*12;
    if(this.#last>=start&&this.#last<=frame)start=this.#last+1;
    try {
      for(let f=start;f<=frame;f++){
        let p=this.#base+this.#offsets[f];const end=this.#base+this.#offsets[f+1],tag=b[p++];
        requireThat(!tag||this.#last===f-1,'pet4_delta');
        for(let off=0;off<this.#history.length;off+=tile){
          requireThat(p+2<=end,'pet4_tile');const size=v.getUint16(p,true);p+=2;
          requireThat(size>0&&size<=tile+Math.floor(tile/255)+16&&size<=end-p,'pet4_tile');
          const raw=decodeBlock(b.subarray(p,p+size),tile,this.#scratch,this.#tileLimit);p+=size;
          if(tag)for(let i=0;i<tile;i++)this.#history[off+i]^=raw[i];else this.#history.set(raw,off);
        }
        requireThat(p===end&&crc32(this.#history)===this.#crcs[f],'pet4_frame_crc');this.#last=f;
      }
      if(indices)indices.set(this.#history);
      if(rgb565)for(let i=0;i<this.#history.length;i++){const color=this.#palette[this.#history[i]];rgb565[2*i]=color&255;rgb565[2*i+1]=color>>>8;}
      return {indices,rgb565};
    }catch(e){this.#last=-1;throw e;}
  }
}
