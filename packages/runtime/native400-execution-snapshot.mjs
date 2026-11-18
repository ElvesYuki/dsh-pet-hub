import {openSync,closeSync,readSync,writeFileSync,fstatSync,lstatSync,readdirSync,realpathSync,mkdtempSync,mkdirSync,chmodSync,unlinkSync,rmdirSync,constants} from 'node:fs';
import {join,dirname,isAbsolute,normalize} from 'node:path';import {createHash} from 'node:crypto';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {createNative400UsbProcessConsumer} from './native400-usb-process-consumer.mjs';
const capabilities=new WeakMap(),MAX_FILES=2048,MAX_FILE=2097152,MAX_TOTAL=33554432,MAX_RUNTIME=134217728;
const fail=c=>Object.assign(new Error(c),{code:c}),need=(v,c='execution_snapshot_invalid')=>{if(!v)throw fail(c);};
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)&&s!=='0'.repeat(64);
const absolute=p=>need(typeof p==='string'&&isAbsolute(p)&&normalize(p)===p&&!/[\u0000-\u001f\u007f]/.test(p));
const relative=p=>need(typeof p==='string'&&p.length<=512&&p.split('/').every(s=>/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(s)));
const fp=s=>['dev','ino','mode','uid','nlink','size','mtimeNs','ctimeNs'].map(k=>String(s[k])).join(':');
function dir(p,mode){const s=lstatSync(p,{bigint:true});need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===BigInt(process.getuid())&&(mode===undefined?(s.mode&0o022n)===0n:(s.mode&0o777n)===BigInt(mode)),'execution_snapshot_unsafe');return fp(s);}
function parents(root,file,mode){dir(root,mode);let p=root;for(const name of file.split('/').slice(0,-1)){p=join(p,name);dir(p,mode);}}
function read(file,limit,{privateMode,body=false,runtime=false}={}){
 let fd;try{fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const a=fstatSync(fd,{bigint:true});
  need(a.isFile()&&a.nlink===1n&&(runtime?(a.uid===0n||a.uid===BigInt(process.getuid())):a.uid===BigInt(process.getuid()))&&(privateMode===undefined?(a.mode&0o022n)===0n:(a.mode&0o777n)===BigInt(privateMode)),'execution_snapshot_unsafe');
  need(a.size>0n&&a.size<=BigInt(limit),'execution_snapshot_budget');const h=createHash('sha256'),chunks=[];let count=0;const chunk=Buffer.alloc(65536);
  for(;;){const n=readSync(fd,chunk,0,Math.min(chunk.length,limit-count+1),count);if(!n)break;count+=n;need(count<=limit,'execution_snapshot_budget');h.update(chunk.subarray(0,n));if(body)chunks.push(Buffer.from(chunk.subarray(0,n)));}
  need(BigInt(count)===a.size&&fp(a)===fp(fstatSync(fd,{bigint:true}))&&fp(a)===fp(lstatSync(file,{bigint:true})),'execution_snapshot_changed');
  return {sha256:h.digest('hex'),bytes:count,fingerprint:fp(a),...(body?{body:Buffer.concat(chunks,count)}:{})};
 }finally{if(fd!==undefined)closeSync(fd);}}
function safe(fn){try{return fn();}catch(e){if(/^execution_snapshot_/.test(e.code??''))throw e;throw fail('execution_snapshot_storage');}}
// Current-user storage is cooperative; this is not a hostile same-user filesystem sandbox.
function removeOwned(p){for(const e of readdirSync(p,{withFileTypes:true})){const f=join(p,e.name);if(e.isDirectory()&&!e.isSymbolicLink()){chmodSync(f,0o700);removeOwned(f);}else unlinkSync(f);}rmdirSync(p);}
/** Freeze only explicitly reviewed, SHA-pinned files into a private source tree.
 * No dependency resolver, module import, runtime execution or implicit discovery.
 * Declared inventory is not a proof of full Python/Node/native runtime closure.
 * close fences new runs, waits owned leases, then removes only our tree. */
export function createNative400ExecutionSnapshot(input){
 let stage;
 try{return safe(()=>{
  exact(input,['enabled','directory','roots','entries','runtime','beforeSeal']);need(input.enabled===true&&process.platform!=='win32');const {directory,runtime}=input;absolute(directory);need(realpathSync(directory)===directory,'execution_snapshot_unsafe');dir(directory,0o700);
  exact(runtime,['executable','sha256','kind']);absolute(runtime.executable);need(['node','python'].includes(runtime.kind)&&hex(runtime.sha256));need(realpathSync(runtime.executable)===runtime.executable,'execution_snapshot_unsafe');
  const executable=read(runtime.executable,MAX_RUNTIME,{runtime:true});need(executable.sha256===runtime.sha256,'execution_snapshot_pin');
  need(Array.isArray(input.roots)&&input.roots.length>=1&&input.roots.length<=8&&Array.isArray(input.entries)&&input.entries.length>=1&&input.entries.length<=2);
  let count=0;const roots=input.roots.map(r=>{exact(r,['label','directory','files']);need(typeof r.label==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(r.label));absolute(r.directory);need(realpathSync(r.directory)===r.directory,'execution_snapshot_unsafe');dir(r.directory);need(Array.isArray(r.files)&&r.files.length>0);count+=r.files.length;need(count<=MAX_FILES,'execution_snapshot_budget');const files=r.files.map(f=>{exact(f,['path','sha256']);relative(f.path);need(hex(f.sha256));return {path:f.path,sha256:f.sha256};}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);need(new Set(files.map(f=>f.path)).size===files.length);return {label:r.label,directory:r.directory,files};}).sort((a,b)=>a.label<b.label?-1:1);
  need(new Set(roots.map(r=>r.label)).size===roots.length);const entries=input.entries.map(e=>{exact(e,['role','root','path']);need(['manager','consumer'].includes(e.role));relative(e.path);need(roots.some(r=>r.label===e.root&&r.files.some(f=>f.path===e.path)));return {role:e.role,root:e.root,path:e.path};}).sort((a,b)=>a.role<b.role?-1:1);need(new Set(entries.map(e=>e.role)).size===entries.length);
  need(input.beforeSeal===undefined||typeof input.beforeSeal==='function');stage=mkdtempSync(join(directory,'execution-'));chmodSync(stage,0o700);const sourceStats=new Map(),manifestRoots=[];let total=0;
  for(const r of roots){const dest=join(stage,r.label);mkdirSync(dest,{mode:0o700});const files=[];for(const f of r.files){parents(r.directory,f.path);const source=join(r.directory,f.path),data=read(source,MAX_FILE,{body:true});need(data.sha256===f.sha256,'execution_snapshot_pin');total+=data.bytes;need(total<=MAX_TOTAL,'execution_snapshot_budget');const target=join(dest,f.path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,data.body,{flag:'wx',mode:0o600});chmodSync(target,0o400);sourceStats.set(source,data.fingerprint);files.push({path:f.path,sha256:f.sha256,bytes:data.bytes});}manifestRoots.push({label:r.label,files});}
  if(input.beforeSeal){const v=input.beforeSeal();if(v&&typeof v.then==='function'){Promise.resolve(v).catch(()=>{});throw fail('execution_snapshot_invalid');}}
  for(const r of roots)for(const f of r.files){parents(r.directory,f.path);const file=join(r.directory,f.path),data=read(file,MAX_FILE);need(data.sha256===f.sha256&&data.fingerprint===sourceStats.get(file),'execution_snapshot_changed');}
  const currentRuntime=read(runtime.executable,MAX_RUNTIME,{runtime:true});need(currentRuntime.fingerprint===executable.fingerprint&&currentRuntime.sha256===runtime.sha256,'execution_snapshot_changed');
  const manifest={schema_version:1,profile:'native400-execution-snapshot/1',coverage:'declared-inventory-only',runtime:{kind:runtime.kind,sha256:executable.sha256,bytes:executable.bytes},entries,roots:manifestRoots};const serialized=C(manifest),digest=hash(serialized);writeFileSync(join(stage,'manifest.json'),serialized,{flag:'wx',mode:0o400});
  function seal(p){for(const e of readdirSync(p,{withFileTypes:true}))if(e.isDirectory())seal(join(p,e.name));chmodSync(p,0o500);}seal(stage);
  const expected=new Map([['manifest.json',{sha256:digest,bytes:Buffer.byteLength(serialized)}]]);for(const r of manifestRoots)for(const f of r.files)expected.set(`${r.label}/${f.path}`,f);
  let fenced=false,removed=false,leases=0,closing=null,releaseWait=null;
  function verify(){return safe(()=>{need(!removed,'execution_snapshot_closed');const found=new Set();function walk(p,prefix=''){dir(p,0o500);for(const e of readdirSync(p,{withFileTypes:true})){const name=prefix+e.name,file=join(p,e.name);if(e.isDirectory()&&!e.isSymbolicLink()){need([...expected.keys()].some(k=>k.startsWith(name+'/')),'execution_snapshot_changed');walk(file,name+'/');}else{need(expected.has(name),'execution_snapshot_changed');const a=expected.get(name),b=read(file,MAX_FILE,{privateMode:0o400});need(a.bytes===b.bytes&&a.sha256===b.sha256,'execution_snapshot_changed');found.add(name);}}}walk(stage);need(found.size===expected.size,'execution_snapshot_changed');const r=read(runtime.executable,MAX_RUNTIME,{runtime:true});need(r.fingerprint===executable.fingerprint&&r.sha256===executable.sha256,'execution_snapshot_changed');return true;});}
  const entry=role=>{need(!fenced,'execution_snapshot_closed');const e=entries.find(e=>e.role===role);need(e,'execution_snapshot_entry');return join(stage,e.root,e.path);};
  const result=Object.freeze({manifest:()=>structuredClone(manifest),snapshot:()=>({schema_version:1,profile:'native400-execution-snapshot-view/1',sha256:digest,coverage:'declared-inventory-only',files:count,bytes:total,fenced,removed,active_runs:leases,runtime_closure_proven:false,device_evidence:false}),verify,entry,
   close(){fenced=true;if(closing)return closing;closing=(async()=>{if(leases)await new Promise(r=>releaseWait=r);safe(()=>{chmodSync(stage,0o700);removeOwned(stage);});removed=true;})();closing=closing.catch(e=>{closing=null;throw e;});return closing;}});
  capabilities.set(result,{verify,entry,directory:stage,executable:runtime.executable,acquire(){need(!fenced,'execution_snapshot_closed');leases++;let released=false;return ()=>{if(!released){released=true;leases--;if(!leases){releaseWait?.();releaseWait=null;}}};},pin:role=>{const e=entries.find(e=>e.role===role);need(e,'execution_snapshot_entry');return roots.find(r=>r.label===e.root).files.find(f=>f.path===e.path).sha256;}});verify();return result;
 });}catch(e){if(stage){try{chmodSync(stage,0o700);removeOwned(stage);}catch{throw fail('execution_snapshot_cleanup_incomplete');}}if(/^execution_snapshot_/.test(e.code??''))throw e;throw fail('execution_snapshot_storage');}
}
/** Internal trusted local lease for import-only diagnostics, not IPC authority.
 * Caller must retain until its actual I/O exits, verify, then release once. */
export function acquireNative400ExecutionSnapshot(snapshot,role){
 const c=capabilities.get(snapshot);need(c,'execution_snapshot_invalid');const entry=c.entry(role),release=c.acquire();
 return Object.freeze({entry,directory:c.directory,executable:c.executable,manifest:snapshot.manifest(),sha256:snapshot.snapshot().sha256,verify:c.verify,release});
}
/** Optional trusted local adapter; paths come only from a genuine live snapshot.
 * Pre/post verification and lease cover declared files until actual child/stdio
 * close. Does not authorize USB/LAN or prove all dynamic imports are included. */
export function createNative400SnapshotConsumer(input){
 exact(input,['snapshot','port','holdSeconds','graceMs']);const {snapshot,port,holdSeconds=0,graceMs=1000}=input;
 const c=capabilities.get(snapshot);need(c,'execution_snapshot_invalid');const script=c.entry('consumer'),delegate=createNative400UsbProcessConsumer({enabled:true,executable:c.executable,script,scriptSha256:c.pin('consumer'),port,holdSeconds,graceMs});let used=false,closed=false,done=null,error=null,outcome='unknown',verified=false;
 return {run(args){need(!used&&!closed,'execution_snapshot_closed');used=true;const release=c.acquire();done=(async()=>{try{c.verify();const result=await delegate.run(args);c.verify();verified=true;outcome=closed?'unknown':result;return outcome;}catch(e){error=/^execution_snapshot_/.test(e.code??'')?e.code:'execution_snapshot_consumer_failed';return 'unknown';}finally{release();}})();return done;},
  async close(){closed=true;await delegate.close();if(done)await done;},snapshot:()=>({...delegate.snapshot(),outcome,execution_snapshot_error:error,execution_snapshot_verified:verified,coverage:'declared-inventory-only'}),resources:delegate.resources};
}
