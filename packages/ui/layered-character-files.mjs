import {layeredRequire as need,parseLayeredJson} from '../core/layered-character-json.mjs';
import {validateLayeredManifest,validateLayeredDocuments,layeredLimits} from '../core/layered-character-package.mjs';
import {planLayeredPng,restoreLayeredPngRows} from '../core/layered-character-png.mjs';
const checkAbort=signal=>signal?.throwIfAborted();
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
/** Browser deflate adapter: bound output while reading, then apply shared row/filter validation. */
export async function validateBrowserLayeredPng(bytes,signal){
 const plan=planLayeredPng(bytes);checkAbort(signal);const reader=new Blob([plan.compressed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
 const raw=new Uint8Array(plan.raw_bytes);let size=0;
 try{while(true){checkAbort(signal);const {value,done}=await reader.read();checkAbort(signal);if(done)break;need(size+value.length<=raw.length,'invalid_texture');raw.set(value,size);size+=value.length;}need(size===raw.length,'invalid_texture');restoreLayeredPngRows(raw);}
 catch(error){await reader.cancel().catch(()=>{});if(error.name==='AbortError')throw error;need(false,'invalid_texture');}finally{reader.releaseLock();}
}
/** Explicit File-list boundary. No filesystem paths, network fetch, package code or implicit trust. */
export async function readLayeredFiles({files,expectedManifestSha256,allowedArtworkLicenses=[]},signal){
 checkAbort(signal);need(globalThis.crypto?.subtle&&globalThis.DecompressionStream,'unsupported_platform');
 need(typeof expectedManifestSha256==='string'&&/^[a-f0-9]{64}$/.test(expectedManifestSha256),'integrity_failed');
 need(Array.isArray(files)&&files.length>=5&&files.length<=layeredLimits.files+1,'resource_limit');
 const selected=new Map();let root=null,total=0;
 for(const file of files){
  const path=file.webkitRelativePath;need(typeof path==='string'&&path.length<=320,'invalid_reference');const segments=path.split('/');need(segments.length>=2&&segments.every(s=>/^[A-Za-z0-9_-]+(?:\.(?:json|png))?$/.test(s)),'invalid_reference');
  root??=segments[0];need(segments[0]===root,'invalid_reference');const relative=segments.slice(1).join('/');need(!selected.has(relative),'invalid_reference');
  need(Number.isSafeInteger(file.size)&&file.size>0&&file.size<=(relative.endsWith('.png')?layeredLimits.textureBytes:layeredLimits.json),'resource_limit');total+=file.size;need(total<=layeredLimits.totalBytes,'resource_limit');selected.set(relative,file);
 }
 async function read(path,expectedSize,expectedHash){const file=selected.get(path);need(file&&file.size===expectedSize,'integrity_failed');checkAbort(signal);const bytes=new Uint8Array(await file.arrayBuffer());checkAbort(signal);need(bytes.length===expectedSize&&await sha(bytes)===expectedHash,'integrity_failed');checkAbort(signal);return bytes;}
 const manifestFile=selected.get('manifest.json');need(manifestFile,'invalid_reference');const manifestBytes=await read('manifest.json',manifestFile.size,expectedManifestSha256),manifest=parseLayeredJson(manifestBytes),options={allowedArtworkLicenses};
 validateLayeredManifest(manifest,options);need(selected.size===manifest.files.length+1&&manifest.files.every(f=>selected.has(f.path)),'invalid_reference');
 const pngs=new Map(),documents={};
 try{
  for(const f of manifest.files){const bytes=await read(f.path,f.bytes,f.sha256);if(f.kind==='json')documents[f.id]=parseLayeredJson(bytes);else pngs.set(f.id,bytes);}
  const stats=validateLayeredDocuments(manifest,documents.rig,documents.behavior,documents.provenance,options);
  for(const bytes of pngs.values())await validateBrowserLayeredPng(bytes,signal);checkAbort(signal);
  return {manifest,...documents,pngs,summary:{...stats,total_bytes:total,manifest_sha256:expectedManifestSha256,character_id:manifest.character_id},close:()=>pngs.clear()};
 }catch(error){pngs.clear();throw error;}
}
