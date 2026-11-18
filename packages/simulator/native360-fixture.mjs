import {createHash} from 'node:crypto';
import {crc32} from '../core/pet4.mjs';
import {NATIVE360} from '../core/native360-profile.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const native360Caps=()=>({schema_version:2,protocols:['hub-device/1'],codecs:['PET4'],firmware_version:'synthetic',board_profile:'synthetic_175c',display:{width:466,height:466,shape:'circle',pixel_format:'RGB565'},presentation_modes:['center'],cache:{playback_bytes:5865472,persistent:{active_slots:4,staging_slots:1,slot_bytes:5865472}},max_asset_bytes:5865472,max_downloads:1,inputs:['touch'],outputs:['display']});
// Deliberately NOT actual PET4: trusted model fixture, never production admission.
export function native360SyntheticBytes(id){const b=new Uint8Array(544+id%7);b.set([83,89,78,65,id]);return b;}
export function native360SyntheticVerify(bytes,asset){if(bytes[0]!==83||bytes[4]!==asset.id||sha(bytes)!==asset.sha256)return false;return {...Object.fromEntries(['width','height','fps','frames','codec_flag','key_interval','tile_rows'].map(k=>[k,NATIVE360[k]])),bytes:bytes.length,sha256:sha(bytes)};}
export function native360Manifest(){const ids=[...Array(41).keys(),43,55,58,67,77];return {character_id:'synthetic_whale',variant_id:'synthetic_native360',codec:'PET4',display:{width:360,height:360,shape:'circle',pixel_format:'RGB565'},license_ref:'original-test-MIT',sha256:sha('synthetic-manifest'),actions:ids.map(id=>{const bytes=native360SyntheticBytes(id);return {id,bytes:bytes.length,sha256:sha(bytes)};})};}
/** Original constant-index 360 PET4: real LZ4 match, every frame has valid CRC.
 * A compact 241-frame validation vector; no upstream pictures or extra full-frame working set. */
export function makeNative360Pet4(frames=241){
 const side=360,tile=7200,extension=[];let n=tile-1-5-19;while(n>=255){extension.push(255);n-=255;}extension.push(n);
 const packed=Buffer.from([0x1f,0,1,0,...extension,0x50,0,0,0,0,0]),length=Buffer.alloc(2);length.writeUInt16LE(packed.length);
 const header=Buffer.alloc(532);header.write('PET4');header.writeUInt16LE(side,4);header.writeUInt16LE(side,6);header.writeUInt16LE(24,8);header.writeUInt16LE(frames,10);header.writeUInt16LE(0x07e0,12);header.writeUInt16LE(12,524);header.writeUInt16LE(1,526);header.writeUInt32LE(crc32(header.subarray(4,528)),528);
 const table=Buffer.alloc(4*(2*frames+1)),parts=[],checksum=crc32(new Uint8Array(side*side));let offset=0;
 for(let f=0;f<frames;f++){table.writeUInt32LE(offset,4*f);const part=Buffer.concat([Buffer.from([f%12===0?0:1]),...Array.from({length:18},()=>Buffer.concat([length,packed]))]);parts.push(part);offset+=part.length;table.writeUInt32LE(checksum,4*(frames+1+f));}
 table.writeUInt32LE(offset,4*frames);return Buffer.concat([header,table,...parts]);
}
