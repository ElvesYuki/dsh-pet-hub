import {native400SourceCandidate,native400Metadata} from '../core/native400-identity.mjs';
import {roundPetCanonical as C,parseRoundPetJson} from '../core/round-pet-identity.mjs';
import {requireThat as need,keys,same} from '../core/protocol.mjs';
import {Pet4Decoder} from '../core/pet4.mjs';
import {createHash} from 'node:crypto';
import {readRegular,sha256} from './material-import.mjs';
import {layeredDirectoryRoot} from './layered-character-validator.mjs';

export function native400Record(m){return {schema_version:1,recipe:'round-pet-native400-provenance/1',package:m.package,catalog:m.catalog,approval:m.approval,identity:m.identity};}
export const native400RecordText=m=>C(native400Record(m))+'\n';
/** Reopen only with a new caller-supplied trusted decision, never the ledger's own approval. */
export function native400FromRecord(record,approval){
 keys(record,['schema_version','recipe','package','catalog','approval','identity']);need(Object.keys(record).length===6&&record.schema_version===1&&record.recipe==='round-pet-native400-provenance/1','invalid_round_pet_provenance');
 need(same(record.approval,approval),'round_pet_approval_required');
 const m=native400Metadata({package:record.package,catalog:record.catalog,approval,sourceSha256:approval.source_manifest_sha256,sourceIndexSha256:approval.source_index_sha256,hash:sha256});
 need(same(record,native400Record(m)),'invalid_round_pet_provenance');return m;
}
/** Normalizes bytes without approving, creating files or importing media. Raw source hashes
 * retain formatting/float provenance; only the new package uses the integer canonical recipe. */
export function reviewNative400Source(sourceBytes,indexBytes){return native400SourceCandidate({sourceBytes,indexBytes,hash:sha256});}
/** Selected immutable source snapshot. Re-derive the candidate to reject transplanted package/catalog. */
export function readNative400Source(directory,approval){
 const root=layeredDirectoryRoot(directory),source=readRegular(root,'manifest.json',1048576),index=readRegular(root,'source-index.json',262144);
 const candidate=reviewNative400Source(source,index),pkg=parseRoundPetJson(readRegular(root,'package.json',262144)),catalog=parseRoundPetJson(readRegular(root,'catalog.json',262144));
 need(same(pkg,candidate.package)&&same(catalog,candidate.catalog),'native400_source_mismatch');
 return native400Metadata({package:pkg,catalog,approval,sourceSha256:sha256(source),sourceIndexSha256:sha256(index),hash:sha256});
}
export function matchNative400Timing(proof,timing){for(const k of ['width','height','fps','frames','index_sha256','rgb565_sha256','extra_keyframes'])need(proof[k]===timing[k],'timing_mismatch');}
/** Full F/LZ4/frame CRC/index+RGB digests and extra tag0 count; one asset at a time.
 * A returned player is an offline decoder, not a device-first-frame or persistent-save acknowledgement. */
export function verifyNative400Asset(bytes,action,timing,{player=false}={}){
 need(bytes instanceof Uint8Array&&bytes.length>=544&&bytes.length<=5865472&&bytes.length===action.bytes&&sha256(bytes)===action.sha256,'asset_integrity_failed');
 const d=new Pet4Decoder(bytes,{profile:'native400-candidate-v1'});need(d.frames===(action.id===42?118:241),'incompatible_asset');
 const indices=new Uint8Array(160000),rgb=new Uint8Array(320000),ih=createHash('sha256'),rh=createHash('sha256'),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),base=532+4*(2*d.frames+1);let extra=0;
 for(let f=0;f<d.frames;f++){d.decodeInto(f,{indices,rgb565:rgb});ih.update(indices);rh.update(rgb);if(f%12!==0&&bytes[base+view.getUint32(532+4*f,true)]===0)extra++;}
 const proof={width:400,height:400,fps:24,frames:d.frames,index_sha256:ih.digest('hex'),rgb565_sha256:rh.digest('hex'),extra_keyframes:extra};matchNative400Timing(proof,timing);
 if(!player)return proof;
 return {...proof,frame(frameIndex){d.decodeInto(frameIndex,{rgb565:rgb});return {frame_index:frameIndex,rgb565_sha256:sha256(rgb),width:400,height:400};},pixels(frameIndex){const out=new Uint8Array(320000);d.decodeInto(frameIndex,{rgb565:out});return out;}};
}
