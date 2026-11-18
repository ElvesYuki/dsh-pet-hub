import {crc32} from './crc32.mjs';
import {requireThat} from './protocol.mjs';
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
/** Original greedy LZ4 block encoder; leaves five trailing literals and last match >=12 bytes from end. */
export function encodeLz4(raw){requireThat(raw instanceof Uint8Array&&raw.length>=5&&raw.length<=8000,'lz4_input');const n=raw.length,out=[],table=new Int32Array(4096).fill(-1);let anchor=0,i=0;const extra=n=>{while(n>=255){out.push(255);n-=255;}out.push(n);};
 while(i<=n-12){const h=(Math.imul((raw[i]|raw[i+1]<<8|raw[i+2]<<16|raw[i+3]<<24)>>>0,2654435761)>>>20),p=table[h];table[h]=i;
 if(p<0||i-p>65535||raw[p]!==raw[i]||raw[p+1]!==raw[i+1]||raw[p+2]!==raw[i+2]||raw[p+3]!==raw[i+3]){i++;continue;}
 let len=4;while(i+len<n-5&&raw[p+len]===raw[i+len])len++;const literals=i-anchor;out.push(Math.min(literals,15)<<4|Math.min(len-4,15));if(literals>=15)extra(literals-15);for(let k=anchor;k<i;k++)out.push(raw[k]);out.push((i-p)&255,(i-p)>>>8);if(len>=19)extra(len-19);i+=len;anchor=i;
 }
 const tail=n-anchor;out.push(Math.min(tail,15)<<4);if(tail>=15)extra(tail-15);for(let k=anchor;k<n;k++)out.push(raw[k]);return Uint8Array.from(out);
}
export const to565=(r,g,b)=>(r>>3)<<11|(g>>2)<<5|(b>>3);
export const rgb565=c=>[Math.round((c>>>11)*255/31),Math.round(((c>>>5)&63)*255/63),Math.round((c&31)*255/31)];
/** Black is exact index zero; maxColors includes black (2–256), default encoding remains unchanged. */
export function makePalette(histogram,{maxColors=256}={}){requireThat(Number.isInteger(maxColors)&&maxColors>=2&&maxColors<=256,'palette_color_limit');requireThat(histogram.length===65536,'histogram');const colors=[];for(let c=1;c<65536;c++)if(histogram[c])colors.push(c);const channels=colors.map(c=>rgb565(c));const rgb=new Map(colors.map((c,i)=>[c,channels[i]]));
 const box=cs=>{const min=[255,255,255],max=[0,0,0];let weight=0;for(const c of cs){weight+=histogram[c];for(let j=0;j<3;j++){min[j]=Math.min(min[j],rgb.get(c)[j]);max[j]=Math.max(max[j],rgb.get(c)[j]);}}let axis=0;for(let j=1;j<3;j++)if(max[j]-min[j]>max[axis]-min[axis])axis=j;return {cs,weight,axis,span:max[axis]-min[axis]};};
 const boxes=colors.length?[box(colors)]:[];while(boxes.length<maxColors-1){let pick=-1,score=-1;boxes.forEach((b,i)=>{const s=b.span*b.weight;if(b.cs.length>1&&s>score){pick=i;score=s;}});if(pick<0)break;const b=boxes.splice(pick,1)[0];b.cs.sort((a,c)=>rgb.get(a)[b.axis]-rgb.get(c)[b.axis]||a-c);let weight=0,split=1;for(;split<b.cs.length;split++){weight+=histogram[b.cs[split-1]];if(weight>=b.weight/2)break;}split=Math.min(split,b.cs.length-1);boxes.push(box(b.cs.slice(0,split)),box(b.cs.slice(split)));}
 const palette=new Uint16Array(256);boxes.forEach((b,i)=>{const sums=[0,0,0];for(const c of b.cs)for(let j=0;j<3;j++)sums[j]+=rgb.get(c)[j]*histogram[c];palette[i+1]=to565(...sums.map(n=>Math.round(n/b.weight)));});
 const lookup=new Uint8Array(65536),pcolors=Array.from(palette,rgb565);for(const c of colors){const q=rgb.get(c);let best=Infinity,index=0;for(let i=0;i<=boxes.length;i++){const p=pcolors[i],d=2*(q[0]-p[0])**2+3*(q[1]-p[1])**2+(q[2]-p[2])**2;if(d<best){best=d;index=i;}}lookup[c]=index;}return {palette,lookup};
}
export class Pet4Encoder400 {
 #palette;#parts=[];#crcs=[];#previous=new Uint8Array(160000);
 constructor(palette){requireThat(palette instanceof Uint16Array&&palette.length===256,'palette');this.#palette=new Uint16Array(palette);}
 append(indices){requireThat(indices instanceof Uint8Array&&indices.length===160000&&this.#parts.length<241,'encoder_frame');const delta=this.#parts.length%12!==0,parts=[Uint8Array.of(delta?1:0)];for(let off=0;off<160000;off+=8000){const raw=new Uint8Array(8000);for(let i=0;i<8000;i++)raw[i]=indices[off+i]^(delta?this.#previous[off+i]:0);const packed=encodeLz4(raw);parts.push(Uint8Array.of(packed.length&255,packed.length>>>8),packed);}this.#previous.set(indices);this.#crcs.push(crc32(indices));this.#parts.push(join(parts));}
 finish(){const frames=this.#parts.length;requireThat(frames>0,'encoder_empty');const header=new Uint8Array(532),v=new DataView(header.buffer);header.set([80,69,84,52]);v.setUint16(4,400,true);v.setUint16(6,400,true);v.setUint16(8,24,true);v.setUint16(10,frames,true);this.#palette.forEach((c,i)=>v.setUint16(12+2*i,c,true));v.setUint16(524,12,true);v.setUint16(526,1,true);v.setUint32(528,crc32(header.subarray(4,528)),true);const table=new Uint8Array(4*(2*frames+1)),t=new DataView(table.buffer);let offset=0;this.#parts.forEach((p,i)=>{t.setUint32(4*i,offset,true);offset+=p.length;});t.setUint32(4*frames,offset,true);this.#crcs.forEach((c,i)=>t.setUint32(4*(frames+1+i),c,true));const bytes=join([header,table,...this.#parts]);requireThat(bytes.length<=16777216,'candidate_size');return bytes;}
}
