import {capabilities,keys,bounded,digest,requireThat,clone,presentation} from './protocol.mjs';
import {MaterialCatalog} from './materials.mjs';

// Resource reference for the G0 candidate, not an approved device wire profile.
export const NATIVE360=Object.freeze({namespace:'dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6',payload_bytes:5865472,stride_bytes:5869568,partition_bytes:29360128,width:360,height:360,fps:24,frames:241,codec_flag:1,key_interval:12,tile_rows:20});
export function native360Capabilities(input){
 const c=capabilities(input),p=c.cache.persistent;
 requireThat(c.schema_version===2&&p&&p.active_slots===4&&p.staging_slots===1&&p.slot_bytes===NATIVE360.payload_bytes&&c.cache.playback_bytes===NATIVE360.payload_bytes&&c.max_asset_bytes===NATIVE360.payload_bytes,'unsupported_cache_model');
 requireThat(c.display.width===466&&c.display.height===466&&c.display.shape==='circle'&&c.display.pixel_format==='RGB565'&&c.presentation_modes.includes('center')&&c.codecs.includes('PET4'),'incompatible_asset');return c;
}
export function native360Asset(a){keys(a,['id','bytes','sha256']);bounded(a.id,0,77);bounded(a.bytes,544,NATIVE360.payload_bytes);digest(a.sha256);return clone(a);}
export function native360Manifest(m,caps){
 new MaterialCatalog([m]);requireThat(m.codec==='PET4'&&m.package_schema===undefined&&m.actions.length===46&&m.display.width===360&&m.display.height===360,'incompatible_asset');
 for(const id of [0,4,1,11,43,58,7,55])requireThat(m.actions.some(a=>a.id===id),'missing_semantic_action');
 for(const a of m.actions)native360Asset(a);requireThat(presentation(caps,m).x===53&&presentation(caps,m).y===53,'incompatible_asset');return clone(m);
}
/** Trusted synchronous validator must derive SHA/media details from bytes, not accept wire booleans.
 * This resource core does not implement hashing, file I/O, decoding or publisher authorization. */
export function verifyNative360(verify,bytes,asset){
 requireThat(bytes instanceof Uint8Array&&bytes.length===asset.bytes,'asset_integrity_failed');
 const result=verify(bytes,clone(asset),NATIVE360);
 // An async hook violates this API; consume its rejection while reporting a synchronous contract error.
 if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});requireThat(false,'asset_integrity_failed');}
 requireThat(result&&typeof result==='object','asset_integrity_failed');
 keys(result,['width','height','fps','frames','codec_flag','key_interval','tile_rows','bytes','sha256']);
 requireThat(result.bytes===asset.bytes&&result.sha256===asset.sha256&&['width','height','fps','frames','codec_flag','key_interval','tile_rows'].every(k=>result[k]===NATIVE360[k]),'asset_integrity_failed');
 return clone(result);
}
