import {mkdir,lstat,readdir,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {MaterialCatalog} from '../core/materials.mjs';
import {requireThat,keys,digest,same} from '../core/protocol.mjs';
import {sha256,manifestDigest} from './material-import.mjs';
const versionId=/^[a-f0-9]{64}$/,stageId=/^\.staging-[a-f0-9-]{36}$/,trashId=/^\.trash-[a-f0-9-]{36}$/;
async function privateStat(path){const s=await lstat(path);requireThat(!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0,'unsafe_store');return s;}
async function tree(path){let count=0,bytes=0;const fingerprint=[],files=new Map();
 async function visit(p,relative,depth){requireThat(++count<=10000&&depth<=4,'store_scan_limit');const s=await privateStat(p);requireThat(s.isDirectory()||s.isFile(),'unsafe_store');fingerprint.push([relative,s.dev,s.ino,s.size,s.mtimeMs,s.mode]);
  if(s.isFile()){bytes+=s.size;files.set(relative,s.size);}else for(const name of (await readdir(p)).sort())await visit(join(p,name),relative?`${relative}/${name}`:name,depth+1);
 }
 await visit(path,'',0);return {bytes,files,fingerprint};
}
async function metadata(path,entryId,files){
 requireThat(files.get('version.json')<=1048576&&files.get('index.json')<=262144,'unknown_metadata');
 const raw=await readFile(join(path,'index.json')),data=JSON.parse(await readFile(join(path,'version.json'),'utf8'));
 keys(data,['schemaVersion','index_sha256','manifests']);digest(data.index_sha256);requireThat(data.schemaVersion===1&&sha256(raw)===data.index_sha256&&(!versionId.test(entryId)||data.index_sha256===entryId),'unknown_metadata');
 new MaterialCatalog(data.manifests);const index=JSON.parse(raw);requireThat(index.schemaVersion===1&&Array.isArray(index.variants)&&index.variants.length===data.manifests.length,'unknown_metadata');
 const expected=new Map([['version.json',files.get('version.json')],['index.json',files.get('index.json')]]);
 data.manifests.forEach((m,i)=>{const clean={...m};delete clean.sha256;requireThat(same(clean,index.variants[i].manifest)&&manifestDigest(clean)===m.sha256,'unknown_metadata');for(const a of m.actions){requireThat(!expected.has(`blobs/${a.sha256}`)||expected.get(`blobs/${a.sha256}`)===a.bytes,'unknown_metadata');expected.set(`blobs/${a.sha256}`,a.bytes);}});
 requireThat(files.size===expected.size&&[...expected].every(([p,n])=>files.get(p)===n),'unknown_metadata');return data;
}
/** Same-owner serialization. No automatic eviction or force-delete. */
export function createStoreLifecycle(directory,{quotaBytes=1073741824,references=()=>({}),nonStoredManifests=[]}={}){
 requireThat(Number.isSafeInteger(quotaBytes)&&quotaBytes>=1&&quotaBytes<=8589934592,'invalid_quota');
 const root=join(directory,'material-store'),active=new Map(),pinned=new Set(),pins=new Map(),memoryOnly=new Set(nonStoredManifests);let queue=Promise.resolve(),busy=false;
 const lock=fn=>{const result=queue.then(fn,fn);queue=result.catch(()=>{});return result;};
 const ensure=async()=>{try{await mkdir(root,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}requireThat((await privateStat(root)).isDirectory(),'unsafe_store');};
 async function inspect(){await ensure();const names=(await readdir(root)).sort();requireThat(names.length<=128,'store_scan_limit');const rows=[];let valid=true;
  for(const name of names){let t;try{t=await tree(join(root,name));}catch{valid=false;rows.push({entry_id:name,kind:'unknown',bytes:null,reasons:['unsafe_entry'],fingerprint:null});continue;}
   const kind=versionId.test(name)?'version':stageId.test(name)?'staging':trashId.test(name)?'trash':'unknown';let data=null;const reasons=[];
   if(kind==='version'||kind==='trash'){try{data=await metadata(join(root,name),name,t.files);}catch{reasons.push('unknown_metadata');}}
   if(kind==='unknown')reasons.push('unknown_entry');
   if(active.has(name))reasons.push('active_validation');if(pinned.has(name)||pinned.has(data?.index_sha256))reasons.push('active_catalog');
   rows.push({entry_id:name,kind,bytes:t.bytes,reasons,fingerprint:t.fingerprint,packages:data?.manifests.filter(m=>m.package_schema===2).map(m=>({character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,display:m.display}))??[],characters:[...new Set(data?.manifests.map(m=>m.character_id)??[])],manifests:data?.manifests.map(m=>m.sha256)??[]});
  }
  const refs=await references(),unresolved=new Set();const known=new Set(rows.flatMap(r=>r.manifests??[]));
  for(const [reason,hashes] of Object.entries(refs))for(const hash of hashes??[]){digest(hash);if(memoryOnly.has(hash))continue;if(!known.has(hash))unresolved.add(hash);for(const row of rows)if(row.manifests?.includes(hash)&&!row.reasons.includes(reason))row.reasons.push(reason);}
  if(unresolved.size)for(const row of rows)if(row.kind!=='staging'&&!row.reasons.includes('unresolved_reference'))row.reasons.push('unresolved_reference');
  const used=rows.reduce((n,r)=>n+(r.bytes??0),0),reserved=[...active].reduce((n,[name,value])=>n+Math.max(0,value-(rows.find(r=>r.entry_id===name)?.bytes??0)),0);
  const serial={quota_bytes:quotaBytes,used_bytes:used,reserved_bytes:reserved,valid,refs,pinned:[...pinned].sort(),active:[...active].sort(),rows};
  return {revision:sha256(JSON.stringify(serial)),quota_bytes:quotaBytes,used_bytes:used,reserved_bytes:reserved,over_quota:used+reserved>quotaBytes,valid,entries:rows.map(r=>({entry_id:r.entry_id,kind:r.kind,bytes:r.bytes,protected:r.reasons.length>0,reasons:r.reasons,manifest_count:r.manifests?.length??0,characters:r.characters??[],packages:r.packages??[]})),_rows:rows};
 }
 const publicView=s=>{const {_rows,...view}=s;return view;};
 return {get busy(){return busy;},holdVersion(index){digest(index);pinned.add(index);pins.set(index,(pins.get(index)??0)+1);return ()=>this.endCatalog(index);},beginStage(name,index){requireThat(stageId.test(name),'invalid_stage');digest(index);active.set(name,0);pinned.add(index);pins.set(index,(pins.get(index)??0)+1);},finishStage(name){active.delete(name);},endCatalog(index){const n=(pins.get(index)??0)-1;if(n<=0){pins.delete(index);pinned.delete(index);}else pins.set(index,n);},
  reserve(name,bytes){return lock(async()=>{requireThat(active.has(name)&&Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=538181632,'invalid_reservation');const old=active.get(name);active.set(name,bytes);try{const s=await inspect();requireThat(active.has(name),'store_closed');requireThat(s.valid,'unsafe_store');requireThat(!s.over_quota,'quota_exceeded');}catch(e){if(active.has(name))active.set(name,old);throw e;}});},
  idle:()=>lock(async()=>{}),
  list:async()=>publicView(await inspect()),
  cleanup(input){return lock(async()=>{busy=true;try{
   keys(input,['expected_revision','entry_ids']);digest(input.expected_revision);requireThat(Array.isArray(input.entry_ids)&&input.entry_ids.length>0&&input.entry_ids.length<=32&&new Set(input.entry_ids).size===input.entry_ids.length,'invalid_cleanup');
   const before=await inspect();requireThat(before.revision===input.expected_revision,'revision_conflict');requireThat(before.valid,'unsafe_store');
   const chosen=input.entry_ids.map(name=>{requireThat(typeof name==='string'&&(versionId.test(name)||stageId.test(name)||trashId.test(name)),'invalid_cleanup');const row=before._rows.find(r=>r.entry_id===name);requireThat(row,'unknown_version');requireThat(row.reasons.length===0,'protected_version');return row;});
   // Validate the complete batch before the first rename; references cannot mutate through service while busy.
   const removed=[];
   for(const row of chosen){const path=join(root,row.entry_id),current=await tree(path);requireThat(same(current.fingerprint,row.fingerprint),'revision_conflict');const trash=join(root,`.trash-${randomUUID()}`);await rename(path,trash);
    try{requireThat(same((await tree(trash)).fingerprint,row.fingerprint),'revision_conflict');await rm(trash,{recursive:true});removed.push(row.entry_id);}catch(e){try{await rename(trash,path);}catch{}throw e;}
   }
   return {removed,repository:publicView(await inspect())};
  }finally{busy=false;}});}
 };
}
