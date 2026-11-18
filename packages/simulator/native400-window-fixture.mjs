import {createHash} from 'node:crypto';
import {crc32} from '../core/pet4.mjs';
import {native400IdentityFixture} from './native400-identity-fixture.mjs';
import {Native400WindowModel} from '../core/native400-window.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const windowHashFactory=()=>{const h=createHash('sha256');return {update:b=>{h.update(b);},digest:()=>new Uint8Array(h.digest())};};
function largePet4(frames,dense=false){
 // Original deterministic indices. Nonzero XOR frames and extra keys exercise a >1MiB file.
 const tile=Buffer.alloc(8000);let x=17;for(let i=0;i<tile.length;i++){x=(1664525*x+1013904223)>>>0;tile[i]=x>>>24;}
 const ext=[];let n=8000-15;while(n>=255){ext.push(255);n-=255;}ext.push(n);
 const packed=Buffer.from([0xf0,...ext,...tile]),zeroExt=[];n=8000-2-5-19;while(n>=255){zeroExt.push(255);n-=255;}zeroExt.push(n);
 const zero=Buffer.from([0x2f,0,0,1,0,...zeroExt,0x50,0,0,0,0,0]);
 const block=p=>{const l=Buffer.alloc(2);l.writeUInt16LE(p.length);return Buffer.concat([l,p]);};
 const frame=Buffer.concat([Buffer.from([0]),block(packed),...Array.from({length:19},()=>block(zero))]);
 const indices=Buffer.alloc(160000);tile.copy(indices);const rgb=Buffer.alloc(320000),header=Buffer.alloc(532);header.write('PET4');header.writeUInt16LE(400,4);header.writeUInt16LE(400,6);header.writeUInt16LE(24,8);header.writeUInt16LE(frames,10);
 for(let i=0;i<256;i++)header.writeUInt16LE((i*257)&65535,12+2*i);for(let i=0;i<160000;i++)rgb.writeUInt16LE(indices[i]*257,2*i);
 header.writeUInt16LE(12,524);header.writeUInt16LE(1,526);header.writeUInt32LE(crc32(header.subarray(4,528)),528);
 const table=Buffer.alloc(4*(2*frames+1)),ih=createHash('sha256'),rh=createHash('sha256');
 const history=Buffer.alloc(160000),currentRgb=Buffer.alloc(320000),parts=[];
 let offset=0;for(let f=0;f<frames;f++){const count=dense?(f<187?3:2):1;if(dense){indices.fill(0);for(let i=0;i<count;i++)tile.copy(indices,i*8000);}const encodedFrame=dense?Buffer.concat([Buffer.from([0]),...Array.from({length:count},()=>block(packed)),...Array.from({length:20-count},()=>block(zero))]):frame;const tag=f%12===0||f===5||f===17?0:1,encoded=Buffer.from(encodedFrame);encoded[0]=tag;parts.push(encoded);if(!tag)indices.copy(history);else for(let i=0;i<history.length;i++)history[i]^=indices[i];for(let i=0;i<history.length;i++)currentRgb.writeUInt16LE(history[i]*257,2*i);table.writeUInt32LE(offset,4*f);offset+=encoded.length;table.writeUInt32LE(crc32(history),4*(frames+1+f));ih.update(history);rh.update(currentRgb);}table.writeUInt32LE(offset,4*frames);
 return {bytes:Buffer.concat([header,table,...parts]),rgb,index_sha256:ih.digest('hex'),rgb565_sha256:rh.digest('hex'),extra_keyframes:2};
}
let large,dense;
/** MIT original bytes only; independent synthetic approval never applies to real media. */
export function windowFixture({largeAssets=true,denseAction=null,mutate}={}){
 const f=native400IdentityFixture();large??=new Map([118,241].map(n=>[n,largePet4(n)]));
 if(largeAssets){for(const a of f.source.actions){const b=large.get(a.frames);Object.assign(a,{bytes:b.bytes.length,sha256:sha(b.bytes),index_sha256:b.index_sha256,rgb565_sha256:b.rgb565_sha256,extra_keyframes:b.extra_keyframes});Object.assign(f.host.variants[0].manifest.actions[a.id],{bytes:a.bytes,sha256:a.sha256});}}
 if(denseAction!==null){dense??=largePet4(241,true);const a=f.source.actions[denseAction];Object.assign(a,{bytes:dense.bytes.length,sha256:sha(dense.bytes),index_sha256:dense.index_sha256,rgb565_sha256:dense.rgb565_sha256,extra_keyframes:dense.extra_keyframes});Object.assign(f.host.variants[0].manifest.actions[denseAction],{bytes:a.bytes,sha256:a.sha256});}
 mutate?.(f);f.commit();const bytes=id=>id===denseAction?Buffer.from(dense.bytes):largeAssets?Buffer.from(large.get(id===42?118:241).bytes):f.bytes(id);
 return {metadata:f.metadata(),bytes,rgb:largeAssets?Buffer.from(large.get(241).rgb):Buffer.alloc(320000)};
}
export function windowHarness({fixture=windowFixture(),policy,action=0,mode='once_hold',hashFactory=windowHashFactory,deadline=1000000}={}){
 let now=0;const model=new Native400WindowModel({metadata:fixture.metadata,clock:()=>now,hashFactory,policy});
 model.beginSession('session1',{deadline});const ticket=model.request({command_id:'cmd1',revision:'1',action_id:action,mode}),bytes=fixture.bytes(action),base=532+4*(2*(action===42?118:241)+1);
 model.begin(ticket,bytes.subarray(0,base));
 const feed=(t=ticket,b=bytes)=>{let p=model.snapshot().received_payload_bytes;while(p<b.length-base){const n=Math.min(32768,model.credit(t),b.length-base-p);if(n<=0)break;model.append(t,p,b.subarray(base+p,base+p+n));p+=n;}return p;};
 const verify=()=>{while(model.snapshot().decoded_frames<(action===42?118:241)){feed();model.decodeNext(ticket);}return model.finish(ticket);};
 return {model,ticket,bytes,base,fixture,feed,verify,get now(){return now;},set now(n){now=n;},advance:n=>{now+=n;}};
}
