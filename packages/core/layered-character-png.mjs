import {crc32} from './crc32.mjs';import {layeredRequire} from './layered-character-json.mjs';
/** Shared strict PNG chunk plan. Platform adapter must validate/limit the entire zlib stream. */
export function planLayeredPng(bytes){
 layeredRequire(bytes instanceof Uint8Array&&bytes.byteLength<=4194304,'resource_limit');
 const need=ok=>layeredRequire(ok,'invalid_texture'),signature=[137,80,78,71,13,10,26,10];need(bytes.length>=45&&signature.every((v,i)=>bytes[i]===v));const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let p=8,header=false,ended=false,idat=false,count=0;const chunks=[],ancillary=new Set();
 while(p<bytes.length){need(++count<=1024&&p+12<=bytes.length);const n=view.getUint32(p);need(n<=bytes.length-p-12);const type=String.fromCharCode(...bytes.subarray(p+4,p+8)),data=bytes.subarray(p+8,p+8+n);need(/^[A-Za-z]{4}$/.test(type)&&crc32(bytes.subarray(p+4,p+8+n))===view.getUint32(p+8+n));
  if(!header){need(type==='IHDR'&&n===13&&view.getUint32(p+8)===360&&view.getUint32(p+12)===360&&data[8]===8&&data[9]===6&&data[10]===0&&data[11]===0&&data[12]===0);header=true;}
  else if(type==='IDAT'){need(n>0);idat=true;chunks.push(data);}
  else if(type==='IEND'){need(idat&&n===0&&p+12===bytes.length);ended=true;}
  else{need(!idat&&!ancillary.has(type)&&Object.hasOwn({sRGB:1,pHYs:9},type)&&n===({sRGB:1,pHYs:9})[type]);need(type==='sRGB'?data[0]<=3:data[8]<=1);ancillary.add(type);}
  p+=n+12;
 }
 need(header&&idat&&ended);const compressed=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of chunks){compressed.set(c,offset);offset+=c.length;}return {compressed,raw_bytes:518760};
}
export function restoreLayeredPngRows(raw){
 const need=ok=>layeredRequire(ok,'invalid_texture');need(raw instanceof Uint8Array&&raw.length===518760);const rgba=new Uint8Array(518400);let previous=new Uint8Array(1440);
 const paeth=(a,b,c)=>{const v=a+b-c,da=Math.abs(v-a),db=Math.abs(v-b),dc=Math.abs(v-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<360;y++){const filter=raw[y*1441];need(filter<=4);const row=rgba.subarray(y*1440,(y+1)*1440);for(let i=0;i<1440;i++){const a=i>=4?row[i-4]:0,u=previous[i],c=i>=4?previous[i-4]:0,predict=filter===0?0:filter===1?a:filter===2?u:filter===3?Math.floor((a+u)/2):paeth(a,u,c);row[i]=(raw[y*1441+i+1]+predict)&255;}previous=row;}return rgba;
}
