import {spawn} from 'node:child_process';import {readFileSync,realpathSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {isBuiltin} from 'node:module';
import {acquireNative400ExecutionSnapshot} from './native400-execution-snapshot.mjs';import {parseRoundPetJson,roundPetCanonical as C} from '../core/round-pet-identity.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),fail=c=>Object.assign(Error(c),{code:c}),need=(v,c='node_load_invalid')=>{if(!v)throw fail(c);};
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)),'node_load_receipt');
const bootstrapPath='packages/runtime/native400-node-load-child.mjs',localBootstrap=fileURLToPath(new URL('./native400-node-load-child.mjs',import.meta.url));
export function validateNative400NodeLoadReceipt(v,loan,bootstrapSha){
 exact(v,['schema_version','profile','ok','node_version','snapshot_sha256','bootstrap_sha256','bootstrap_builtins','entry','loaded','builtins','exports','coverage','device_evidence']);const entry=loan.manifest.entries.find(e=>e.role==='manager');
 need(v.schema_version===1&&v.profile==='native400-node-import-receipt/1'&&v.ok===true&&v.node_version==='v24.14.1'&&v.snapshot_sha256===loan.sha256&&v.bootstrap_sha256===bootstrapSha&&C(v.bootstrap_builtins)==='["node:crypto","node:fs","node:module","node:path","node:url"]'&&C(v.entry)===C(entry)&&v.coverage==='observed-node-imports'&&v.device_evidence===false,'node_load_receipt');
 const inventory=new Map(loan.manifest.roots.flatMap(r=>r.files.map(f=>[`${r.label}/${f.path}`,f]))),seen=new Set();need(Array.isArray(v.loaded)&&v.loaded.length>=1&&v.loaded.length<=2048,'node_load_receipt');
 for(const f of v.loaded){exact(f,['root','path','sha256','bytes','format']);const key=`${f.root}/${f.path}`,match=inventory.get(key);need(match&&!seen.has(key)&&f.sha256===match.sha256&&f.bytes===match.bytes&&['module','json'].includes(f.format),'node_load_receipt');seen.add(key);}
 need(seen.has(`${entry.root}/${entry.path}`)&&Array.isArray(v.builtins)&&v.builtins.length<=256&&v.builtins.every(x=>typeof x==='string'&&x.startsWith('node:')&&isBuiltin(x))&&new Set(v.builtins).size===v.builtins.length,'node_load_receipt');
 need(Array.isArray(v.exports)&&v.exports.length<=128&&v.exports.every(x=>typeof x==='string'&&x.length<=128)&&new Set(v.exports).size===v.exports.length,'node_load_receipt');return structuredClone(v);
}
/** Default-off import-only audit of a reviewed manager module in a fresh Node.
 * Holds the genuine TCP15 lease through actual child/stdio close and postflight.
 * Not an untrusted-code sandbox, service launcher or full runtime closure proof. */
export function createNative400NodeLoadAudit(input){
 need(input&&typeof input==='object'&&Object.keys(input).every(k=>['enabled','snapshot','timeoutMs','signal'].includes(k)));const {enabled=false,snapshot,timeoutMs=5000,signal}=input;
 need(enabled===true&&process.platform!=='win32'&&process.version==='v24.14.1'&&Number.isInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=30000);need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');
 const loan=acquireNative400ExecutionSnapshot(snapshot,'manager');let child=null,childDone=null,timer=null,killTimer=null,termSent=false,closed=false,finished=false,started=false,exited=true,error=null,receipt=null,stdout=[],stdoutSize=0,stderrSize=0,overflow=false;
 const startedAt=performance.now(),deadline=startedAt+timeoutMs;
 const kill=kind=>{if(!child?.pid||exited)return;try{process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')error??='node_load_termination_failed';}};
 function stop(code){closed=true;error??=code;if(!termSent&&!exited){termSent=true;kill('SIGTERM');killTimer=setTimeout(()=>{killTimer=null;kill('SIGKILL');},200);}}
 const abort=()=>stop('node_load_aborted');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();timer=setTimeout(()=>stop('node_load_deadline'),timeoutMs);
 const ready=Promise.resolve().then(async()=>{try{
  need(!closed,'node_load_closed');need(loan.manifest.runtime.kind==='node'&&realpathSync(loan.executable)===realpathSync(process.execPath),'node_load_runtime');loan.verify();need(performance.now()<deadline,'node_load_deadline');need(!closed,'node_load_closed');
  const bootstrapSha=hash(readFileSync(localBootstrap)),choices=loan.manifest.roots.flatMap(r=>r.files.filter(f=>f.path===bootstrapPath&&f.sha256===bootstrapSha).map(f=>join(loan.directory,r.label,f.path)));need(choices.length===1,'node_load_bootstrap');
  started=true;exited=false;try{child=spawn(loan.executable,['--no-addons','--disable-proto=throw','--no-warnings',choices[0],loan.directory,loan.sha256],{cwd:loan.directory,detached:true,shell:false,env:{LANG:'C.UTF-8',NODE_DISABLE_COMPILE_CACHE:'1'},stdio:['ignore','pipe','pipe']});}catch{exited=true;throw fail('node_load_spawn');}
  child.stdout.on('data',b=>{stdoutSize+=b.length;if(stdoutSize>2097152){overflow=true;stdout=[];stop('node_load_output');}else if(!overflow)stdout.push(b);});child.stderr.on('data',b=>{stderrSize+=b.length;if(stderrSize>16384)stop('node_load_output');});child.on('error',()=>{error??='node_load_spawn';});
  childDone=new Promise(resolve=>child.once('close',code=>{exited=true;clearTimeout(killTimer);killTimer=null;resolve(code);}));const code=await childDone;need(!closed,error??'node_load_closed');need(!overflow&&code===0&&!error,'node_load_failed');
  const bytes=Buffer.concat(stdout);need(bytes.length>0&&bytes.at(-1)===10&&bytes.subarray(0,-1).indexOf(10)===-1,'node_load_output');const v=parseRoundPetJson(bytes);const result=validateNative400NodeLoadReceipt(v,loan,bootstrapSha);loan.verify();need(!closed&&performance.now()<deadline,'node_load_deadline');receipt=result;return structuredClone(receipt);
 }catch(e){error??=/^(node_load_|execution_snapshot_)/.test(e.code??'')?e.code:'node_load_failed';throw fail(error);}finally{clearTimeout(timer);clearTimeout(killTimer);timer=null;killTimer=null;signal?.removeEventListener('abort',abort);stdout=[];loan.release();finished=true;}});ready.catch(()=>{});
 return {ready,async close(){if(!finished)stop('node_load_closed');else closed=true;await ready.catch(()=>{});},snapshot:()=>({schema_version:1,profile:'native400-node-load-audit-view/1',started,exited,closed,finished,error,import_completed:receipt!==null,loaded:receipt?.loaded.length??0,coverage:'observed-node-imports',full_runtime_closure_proven:false,device_evidence:false}),resources:()=>({child_running:started&&!exited,streams_open:started&&!exited,timers:(timer!==null?1:0)+(killTimer!==null?1:0),snapshot_lease:!finished})};
}
