import {inflateSync} from 'node:zlib';import {layeredRequire as need} from '../core/layered-character-json.mjs';
import {planLayeredPng,restoreLayeredPngRows} from '../core/layered-character-png.mjs';
/** Bounded Node inflater over the same chunk/filter contract used by the browser loader. */
export function decodeLayeredPng(bytes){
 const plan=planLayeredPng(bytes);let raw;
 try{const result=inflateSync(plan.compressed,{maxOutputLength:plan.raw_bytes,info:true});need(result.engine.bytesWritten===plan.compressed.length,'invalid_texture');raw=result.buffer;}catch{need(false,'invalid_texture');}
 return restoreLayeredPngRows(raw);
}
