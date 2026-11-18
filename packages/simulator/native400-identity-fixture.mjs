import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {crc32} from '../core/pet4.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {native400SourceCandidate,native400Metadata} from '../core/native400-identity.mjs';
import {sha256} from '../runtime/material-import.mjs';

/** Original black, constant-index PET4 with extra full frames at 5/17; no upstream assets. */
export function makeIdentity400Pet4(frames=241){
 const tile=8000,ext=[];let n=tile-1-5-19;while(n>=255){ext.push(255);n-=255;}ext.push(n);
 const packed=Buffer.from([0x1f,0,1,0,...ext,0x50,0,0,0,0,0]),len=Buffer.alloc(2);len.writeUInt16LE(packed.length);
 const head=Buffer.alloc(532);head.write('PET4');head.writeUInt16LE(400,4);head.writeUInt16LE(400,6);head.writeUInt16LE(24,8);head.writeUInt16LE(frames,10);head.writeUInt16LE(12,524);head.writeUInt16LE(1,526);head.writeUInt32LE(crc32(head.subarray(4,528)),528);
 const table=Buffer.alloc(4*(2*frames+1)),parts=[],crc=crc32(new Uint8Array(160000));let off=0;
 for(let f=0;f<frames;f++){table.writeUInt32LE(off,4*f);const b=Buffer.concat([Buffer.from([f%12===0||f===5||f===17?0:1]),...Array.from({length:20},()=>Buffer.concat([len,packed]))]);parts.push(b);off+=b.length;table.writeUInt32LE(crc,4*(frames+1+f));}
 table.writeUInt32LE(off,4*frames);return Buffer.concat([head,table,...parts]);
}
const hashZeros=(bytes,frames)=>{const h=createHash('sha256'),block=new Uint8Array(bytes);for(let i=0;i<frames;i++)h.update(block);return h.digest('hex');};
let base;
/** Synthetic independent approval is confined to these original MIT test bytes. */
export function native400IdentityFixture(directory){
 base??=new Map([118,241].map(frames=>[frames,{bytes:makeIdentity400Pet4(frames),index:hashZeros(160000,frames),rgb:hashZeros(320000,frames)}]));
 const ids=Array.from({length:78},(_,i)=>i),semantics={idle:0,touch:4,thinking:1,working:11,result:43,success:58,waiting:7,error:55};
 const source={schema:'native400-compact-approved/1',profile:'native400-candidate-v1',recipe:'native400-compact-approved-v1',license_ref:'original-test-MIT',geometry:{crop:[124,-6,400,400],display:[466,466],offset:[33,33],extra_mask:false},review_manifest_sha256:sha256('original-review'),visual_approval:{approved:true,review_manifest_sha256:sha256('original-review'),action_ids:ids},error_metric:0.25,actions:ids.map(id=>{const frames=id===42?118:241,b=base.get(frames);return {id,width:400,height:400,frames,fps:24,bytes:b.bytes.length,sha256:sha256(b.bytes),source_sha256:sha256(`original-source-${id}`),index_sha256:b.index,rgb565_sha256:b.rgb,extra_keyframes:2};})};
 const host={schemaVersion:1,variants:[{manifest:{package_schema:2,pet4_profile:'native400-candidate-v1',character_id:'original400',variant_id:'all78',codec:'PET4',license_ref:'original-test-MIT',display:{width:400,height:400,shape:'circle',pixel_format:'RGB565'},semantics,actions:source.actions.map(a=>({id:a.id,bytes:a.bytes,sha256:a.sha256,fps:24,frames:a.frames,loop:a.id===4?'once_idle':a.id===58?'once_hold':'loop'}))},files:ids.map(id=>({action_id:id,path:`${id}.pet`}))}]};
 let candidate,approval,sourceBytes,indexBytes;
 function commit(){
  sourceBytes=Buffer.from(JSON.stringify(source)+'\n');indexBytes=Buffer.from(JSON.stringify(host)+'\n');candidate=native400SourceCandidate({sourceBytes,indexBytes,hash:sha256});
  const x=candidate.identity;approval={schema_version:1,profile:x.profile,namespace_scope:x.namespace_scope,namespace:x.namespace,firmware_package_sha256:x.firmware_package_sha256,hub_manifest_sha256:x.hub_manifest_sha256,source_manifest_sha256:x.source_manifest_sha256,source_index_sha256:x.source_index_sha256,action_ids:ids,license_ref:'original-test-MIT',approval_id:'original400-v1',credits:['dsh-pet-hub original MIT fixture'],source_kind:'original-test',usage:'offline-validation'};
  if(directory){writeFileSync(join(directory,'manifest.json'),sourceBytes);writeFileSync(join(directory,'source-index.json'),indexBytes);writeFileSync(join(directory,'package.json'),C(candidate.package)+'\n');writeFileSync(join(directory,'catalog.json'),C(candidate.catalog)+'\n');}
 }
 if(directory){mkdirSync(directory,{mode:0o700});for(const a of source.actions)writeFileSync(join(directory,`${a.id}.pet`),base.get(a.frames).bytes);}
 commit();return {directory,source,host,commit,get sourceBytes(){return sourceBytes;},get indexBytes(){return indexBytes;},get pkg(){return candidate.package;},get catalog(){return candidate.catalog;},get approval(){return approval;},get candidate(){return candidate;},bytes:id=>Buffer.from(base.get(id===42?118:241).bytes),metadata(){return native400Metadata({package:candidate.package,catalog:candidate.catalog,approval,sourceSha256:sha256(sourceBytes),sourceIndexSha256:sha256(indexBytes),hash:sha256});}};
}
