import {lstatSync,opendirSync,openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {resolve,join,parse,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {layeredRequire as need,parseLayeredJson} from '../core/layered-character-json.mjs';
import {validateLayeredManifest,validateLayeredDocuments,layeredLimits} from '../core/layered-character-package.mjs';
import {decodeLayeredPng} from './layered-character-png.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Verify an explicit bounded in-memory directory snapshot. Returns metadata only, never activates.
 * expectedManifestSha256 and allowedArtworkLicenses must come from the caller, not package code. */
export function verifyLayeredBundle({manifestBytes,files,expectedManifestSha256,allowedArtworkLicenses=[],supportedProfiles}={}){
 need(manifestBytes instanceof Uint8Array&&manifestBytes.byteLength<=layeredLimits.json,'resource_limit');
 need(typeof expectedManifestSha256==='string'&&/^[a-f0-9]{64}$/.test(expectedManifestSha256)&&hash(manifestBytes)===expectedManifestSha256,'integrity_failed');
 const options={allowedArtworkLicenses,...(supportedProfiles?{supportedProfiles}: {})},manifest=parseLayeredJson(manifestBytes),stats=validateLayeredManifest(manifest,options);
 need(files instanceof Map&&files.size===manifest.files.length,'invalid_reference');
 need(stats.declared_bytes+manifestBytes.byteLength<=layeredLimits.totalBytes,'resource_limit');const documents={};
 for(const f of manifest.files){const bytes=files.get(f.path);need(bytes instanceof Uint8Array&&bytes.byteLength===f.bytes&&hash(bytes)===f.sha256,'integrity_failed',f.id);if(f.kind==='json')try{documents[f.id]=parseLayeredJson(bytes);}catch(error){error.resource_id=f.id;throw error;}}
 const result=validateLayeredDocuments(manifest,documents.rig,documents.behavior,documents.provenance,options);
 for(const f of manifest.files)if(f.kind==='png')try{decodeLayeredPng(files.get(f.path));}catch(error){error.resource_id=f.id;throw error;}
 return {status:'validated_data_only_not_loaded',format:manifest.format,format_version:1,manifest_sha256:expectedManifestSha256,character_id:manifest.character_id,variant_id:manifest.variant_id,version:manifest.version,...result,total_bytes:stats.declared_bytes+manifestBytes.byteLength};
}
/** Canonical stable directory boundary shared by read-only audit and offline authoring. */
export function layeredDirectoryRoot(directory){
 need(typeof directory==='string'&&directory.length>0&&directory.length<=4096,'invalid_reference');const root=resolve(directory);let current=parse(root).root;
 for(const segment of root.slice(current.length).split('/').filter(Boolean)){current=join(current,segment);const stat=lstatSync(current);need(stat.isDirectory()&&!stat.isSymbolicLink(),'invalid_reference');}
 return root;
}
/** Bounded ordinary package/authoring JSON or PNG read; never follows directory/leaf links. */
export function readLayeredFile(root,file,limit,expectedBytes){
 need(typeof file==='string'&&file.length<=240&&/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:json|png)$/.test(file),'invalid_reference');
 layeredDirectoryRoot(join(root,dirname(file)));
 const filename=join(root,file),before=lstatSync(filename);need(before.isFile()&&!before.isSymbolicLink(),'invalid_reference');need(before.size>0&&before.size<=limit,'resource_limit');
 if(expectedBytes!==undefined)need(before.size===expectedBytes,'integrity_failed');
 const fd=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=fstatSync(fd);need(stat.isFile()&&stat.ino===before.ino&&stat.dev===before.dev&&stat.size===before.size,'invalid_reference');const bytes=Buffer.alloc(stat.size);let offset=0;while(offset<bytes.length){const n=readSync(fd,bytes,offset,bytes.length-offset,offset);need(n>0,'integrity_failed');offset+=n;}const after=fstatSync(fd);need(after.size===stat.size&&after.mtimeMs===stat.mtimeMs&&after.ctimeMs===stat.ctimeMs,'integrity_failed');return bytes;}finally{closeSync(fd);}
}
/** Read-only L1 directory audit: no decoded images retained, no renderer, export or service.
 * Refuses symlinks including path ancestors. Caller-owned stable directories only; not an OS sandbox. */
export function verifyLayeredDirectory({directory,...options}={}){
 try{
  const root=layeredDirectoryRoot(directory),manifestBytes=readLayeredFile(root,'manifest.json',layeredLimits.json);
  need(hash(manifestBytes)===options.expectedManifestSha256,'integrity_failed');
  const manifest=parseLayeredJson(manifestBytes);validateLayeredManifest(manifest,options);
  const expected=new Set(['manifest.json',...manifest.files.map(f=>f.path)]),actual=[];
  const walk=(folder,prefix='')=>{const handle=opendirSync(folder);let entry,count=0;try{while((entry=handle.readSync())){need(++count<=73,'resource_limit');const name=entry.name,file=prefix+name,stat=lstatSync(join(folder,name));need(!stat.isSymbolicLink(),'invalid_reference');if(stat.isDirectory()){need(file==='textures','invalid_reference');walk(join(folder,name),file+'/');}else{need(stat.isFile()&&expected.has(file),'invalid_reference');actual.push(file);}}}finally{handle.closeSync();}};walk(root);
  need(actual.length===expected.size&&actual.every(p=>expected.has(p)),'invalid_reference');const files=new Map();let total=manifestBytes.length;
  for(const f of manifest.files){total+=f.bytes;need(total<=layeredLimits.totalBytes,'resource_limit');files.set(f.path,readLayeredFile(root,f.path,f.kind==='png'?layeredLimits.textureBytes:layeredLimits.json,f.bytes));}
  return verifyLayeredBundle({manifestBytes,files,...options});
 }catch(error){if(['invalid_format','invalid_reference','resource_limit','integrity_failed','invalid_texture','invalid_rig','unsupported_profile','license_unresolved'].includes(error.code))throw error;const wrapped=new Error('invalid_reference',{cause:error});wrapped.code='invalid_reference';throw wrapped;}
}
