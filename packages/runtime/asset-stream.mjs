import {setImmediate as turn} from 'node:timers/promises';
import {requireThat as need} from '../core/protocol.mjs';
/** Shared A4 segment writer. Caller keeps read/HTTP slots and the catalog pin until this settles.
 * A hook which ignores cancellation is still awaited; no racing timeout pretends its I/O exited.
 * chunk MUST perform fresh scoped authorization before every <=4KiB write. */
export async function writeAssetRange({res,range,chunk,beforeChunk=async()=>{},onChunk=()=>{}}){
 for(let offset=range.start;offset<=range.end;offset+=4096){await beforeChunk(offset);need(!res.destroyed,'response_closed');const bytes=chunk(offset,Math.min(4096,range.end-offset+1));onChunk(bytes);if(!res.write(bytes))await drain(res);await turn();}res.end();
}
function drain(res){return new Promise((resolve,reject)=>{const cleanup=()=>{res.off('drain',done);res.off('close',failed);res.off('error',failed);},done=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(Object.assign(new Error('response_closed'),{code:'response_closed'}));};res.once('drain',done);res.once('close',failed);res.once('error',failed);});}
