import {roundPetMetadata,parseRoundPetJson,roundPetCanonical} from '../core/round-pet-identity.mjs';
import {requireThat as need,keys,same} from '../core/protocol.mjs';
import {Pet4Decoder} from '../core/pet4.mjs';
import {createHash} from 'node:crypto';
import {readRegular,sha256} from './material-import.mjs';
import {layeredDirectoryRoot} from './layered-character-validator.mjs';

export function roundPetRecord(metadata){return {schema_version:1,recipe:'round-pet-provenance/1',package:metadata.package,catalog:metadata.catalog,approval:metadata.approval,identity:metadata.identity};}
/** Pure metadata recovery with a NEW caller-supplied approval; never adopts ledger approval as trust. */
export function roundPetFromRecord(record,approval){
 keys(record,['schema_version','recipe','package','catalog','approval','identity']);need(Object.keys(record).length===6&&record.schema_version===1&&record.recipe==='round-pet-provenance/1','invalid_round_pet_provenance');
 need(same(record.approval,approval),'round_pet_approval_required');
 const metadata=roundPetMetadata({package:record.package,catalog:record.catalog,approval,sourceSha256:approval.source_manifest_sha256,hash:sha256});
 need(same(record,roundPetRecord(metadata)),'invalid_round_pet_provenance');return metadata;
}
/** Reads selected files only; no upstream imports/execution. Roots must be stable caller-owned snapshots. */
export function readRoundPetSource(directory,approval){
 const root=layeredDirectoryRoot(directory),pkg=parseRoundPetJson(readRegular(root,'package.json',262144)),catalog=parseRoundPetJson(readRegular(root,'catalog.json',262144));
 const source=readRegular(root,'manifest.json',1048576);
 return roundPetMetadata({package:pkg,catalog,approval,sourceSha256:sha256(source),hash:sha256});
}
export function matchRoundPetTiming(proof,timing){need(proof.width===timing.width&&proof.height===timing.height&&proof.fps===timing.fps&&proof.frames===timing.frames&&proof.index_sha256===timing.index_sha256,'timing_mismatch');}
/** Full CRC and concatenated index SHA, one decoder per call, no frame array or library retained.
 * player=false avoids RGB conversion entirely. player=true owns an on-demand decoder until release. */
export function verifyRoundPetAsset(bytes,action,timing,{player=false}={}){
 need(bytes.length===action.bytes&&sha256(bytes)===action.sha256,'asset_integrity_failed');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 need(bytes.length>=544&&view.getUint16(4,true)===360&&view.getUint16(6,true)===360&&view.getUint16(8,true)===24&&view.getUint16(10,true)===241&&view.getUint16(524,true)===12&&view.getUint16(526,true)===1,'incompatible_asset');
 const decoder=new Pet4Decoder(bytes),index=new Uint8Array(360*360),hash=createHash('sha256');
 for(let f=0;f<decoder.frames;f++){decoder.decodeInto(f,{indices:index});hash.update(index);}
 const proof={width:decoder.width,height:decoder.height,fps:decoder.fps,frames:decoder.frames,index_sha256:hash.digest('hex')};matchRoundPetTiming(proof,timing);
 if(!player)return proof;
 const rgb=new Uint8Array(360*360*2);
 return {...proof,frame(frameIndex){decoder.decodeInto(frameIndex,{rgb565:rgb});return {frame_index:frameIndex,rgb565_sha256:sha256(rgb),width:360,height:360};},pixels(frameIndex){const own=new Uint8Array(rgb.length);decoder.decodeInto(frameIndex,{rgb565:own});return own;}};
}
export const roundPetRecordText=metadata=>roundPetCanonical(roundPetRecord(metadata))+'\n';
