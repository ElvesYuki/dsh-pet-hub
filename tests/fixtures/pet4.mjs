import {crc32} from '../../packages/core/pet4.mjs';
/** Original PET4 fixture using literal-only valid LZ4, no upstream media. */
export function pet4Fixture(side=240,frames=13){
 const tiles=side/20,tile=side*20,parts=[],crcs=[];let previous=new Uint8Array(side*side);
 for(let f=0;f<frames;f++){
  const raw=new Uint8Array(side*side).fill(f),delta=f%12!==0,chunk=[Buffer.from([delta?1:0])];
  for(let t=0;t<tiles;t++){
   const block=Buffer.from(raw.subarray(t*tile,(t+1)*tile));if(delta)for(let i=0;i<tile;i++)block[i]^=previous[t*tile+i];
   const extension=[];let n=tile-15;while(n>=255){extension.push(255);n-=255;}extension.push(n);
   const packed=Buffer.concat([Buffer.from([0xf0,...extension]),block]),length=Buffer.alloc(2);length.writeUInt16LE(packed.length);chunk.push(length,packed);
  }
  previous=raw;parts.push(Buffer.concat(chunk));crcs.push(crc32(raw));
 }
 const header=Buffer.alloc(532);header.write('PET4');header.writeUInt16LE(side,4);header.writeUInt16LE(side,6);header.writeUInt16LE(24,8);header.writeUInt16LE(frames,10);
 for(let i=0;i<256;i++)header.writeUInt16LE(i,12+2*i);header.writeUInt16LE(12,524);header.writeUInt16LE(1,526);header.writeUInt32LE(crc32(header.subarray(4,528)),528);
 const table=Buffer.alloc(4*(2*frames+1));let offset=0;parts.forEach((p,i)=>{table.writeUInt32LE(offset,4*i);offset+=p.length;});table.writeUInt32LE(offset,4*frames);crcs.forEach((c,i)=>table.writeUInt32LE(c,4*(frames+1+i)));
 return Buffer.concat([header,table,...parts]);
}
