import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import {join} from 'node:path';
import {requireThat as need,bounded,digest,clone,same} from '../core/protocol.mjs';
import {layeredDirectoryRoot} from './layered-character-validator.mjs';
import {privatePath} from './paths.mjs';

function fingerprint(fd){const s=fstatSync(fd,{bigint:true});need(s.isFile()&&s.uid===BigInt(process.getuid())&&(s.mode&0o077n)===0n,'unsafe_store');return Object.fromEntries(['dev','ino','size','uid','mode','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));}
function readExact(fd,offset,length){const out=Buffer.alloc(length);let n=0;while(n<length){const got=readSync(fd,out,n,length-n,offset+n);need(got>0,'asset_changed');n+=got;}return out;}
/** Worker-only full inspection on one fd; the proof fingerprints exactly the bytes that were verified.
 * Proofs are ephemeral private metadata, not wire attestations or durable authorization. */
export function inspectRoundPetBlob(path,bytes,inspect){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const before=fingerprint(fd);need(before.size===String(bytes),'asset_changed');const detail=inspect(readExact(fd,0,bytes));need(same(before,fingerprint(fd)),'asset_changed');return {detail,fingerprint:before};}finally{closeSync(fd);}
}
/** Synchronous <=4KiB reader for a pinned, fully worker-validated A2 bundle. No library or fd cache.
 * Caller keeps the import/lifecycle pin until all HTTP handlers exit; close only drops local proofs. */
export function createRoundPetReader(directory,bundle){
 const root=layeredDirectoryRoot(join(directory,'material-store',bundle.identity.index_sha256,'blobs'));privatePath(root,'directory');
 const approved=new Map(bundle.manifests[0].actions.map(a=>[a.sha256,a.bytes])),proofs=clone(bundle.blobProofs);let closed=false,invalidated=false,openFiles=0,readCalls=0;
 need(proofs&&approved.size===Object.keys(proofs).length,'asset_proof_required');for(const [hash,bytes] of approved){digest(hash);need(proofs[hash]?.size===String(bytes),'asset_proof_required');}
 return {read(hash,offset,length){
  need(!closed,'reader_closed');digest(hash);const bytes=approved.get(hash);need(bytes!==undefined,'unknown_asset');bounded(offset,0,bytes-1);bounded(length,1,Math.min(4096,bytes-offset));let fd;
  try{layeredDirectoryRoot(root);privatePath(root,'directory');fd=openSync(join(root,hash),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);openFiles++;need(same(fingerprint(fd),proofs[hash]),'asset_changed');const out=readExact(fd,offset,length);need(same(fingerprint(fd),proofs[hash]),'asset_changed');readCalls++;return out;}catch(error){invalidated=true;throw error;}finally{if(fd!==undefined){closeSync(fd);openFiles--;}}
 },resources:()=>({closed,invalidated,open_files:openFiles,read_calls:readCalls,retained_library_bytes:0}),close(){closed=true;approved.clear();for(const k of Object.keys(proofs))delete proofs[k];}};
}
