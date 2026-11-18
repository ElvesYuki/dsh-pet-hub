import {crc32} from '../core/pet4.mjs';
/** Original MIT geometric test animation, literal-only PET4/LZ4; no upstream media. */
export function makePet4Sample(side=360,style=0){
 const frames=13,tile=side*20,parts=[],crcs=[];let previous=new Uint8Array(side*side);
 for(let f=0;f<frames;f++){
  const raw=new Uint8Array(side*side),cx=side*(0.3+f/30),cy=side*0.5;
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){const ring=Math.hypot(x-side/2,y-side/2);raw[y*side+x]=Math.hypot(x-cx,y-cy)<side/8?1+style%3:ring>side*.34&&ring<side*.37?4:((x>>5)+(y>>5))%2?5:0;}
  const delta=f%12!==0,chunk=[Buffer.from([delta?1:0])];
  for(let off=0;off<raw.length;off+=tile){const block=Buffer.from(raw.subarray(off,off+tile));if(delta)for(let i=0;i<tile;i++)block[i]^=previous[off+i];
   const extension=[];let n=tile-15;while(n>=255){extension.push(255);n-=255;}extension.push(n);
   const packed=Buffer.concat([Buffer.from([0xf0,...extension]),block]),length=Buffer.alloc(2);length.writeUInt16LE(packed.length);chunk.push(length,packed);
  }
  previous=raw;parts.push(Buffer.concat(chunk));crcs.push(crc32(raw));
 }
 const header=Buffer.alloc(532);header.write('PET4');header.writeUInt16LE(side,4);header.writeUInt16LE(side,6);header.writeUInt16LE(24,8);header.writeUInt16LE(frames,10);
 [0x18c6,0xf800,0x07e0,0x001f,0xffe0,0x294a].forEach((c,i)=>header.writeUInt16LE(c,12+2*i));header.writeUInt16LE(12,524);header.writeUInt16LE(1,526);header.writeUInt32LE(crc32(header.subarray(4,528)),528);
 const table=Buffer.alloc(4*(2*frames+1));let offset=0;parts.forEach((p,i)=>{table.writeUInt32LE(offset,4*i);offset+=p.length;});table.writeUInt32LE(offset,4*frames);crcs.forEach((c,i)=>table.writeUInt32LE(c,4*(frames+1+i)));
 return Buffer.concat([header,table,...parts]);
}
