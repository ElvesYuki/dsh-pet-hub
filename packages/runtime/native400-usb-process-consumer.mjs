import {spawn} from 'node:child_process';import {openSync,closeSync,readSync,fstatSync,lstatSync,realpathSync,constants} from 'node:fs';import {isAbsolute,normalize,dirname} from 'node:path';
import {parseRoundPetJson} from '../core/round-pet-identity.mjs';import {sha256} from './material-import.mjs';import {privatePath} from './paths.mjs';
const fail=c=>Object.assign(new Error(c),{code:c}),need=(ok)=>{if(!ok)throw fail('config_process_invalid');};
const path=p=>need(typeof p==='string'&&isAbsolute(p)&&normalize(p)===p&&!/[\u0000-\u001f\u007f]/.test(p));
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)));
function scriptCheck(file,expected){let fd;try{fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const a=fstatSync(fd,{bigint:true});need(a.isFile()&&a.uid===BigInt(process.getuid())&&a.nlink===1n&&(a.mode&0o022n)===0n&&a.size>0n&&a.size<=262144n);const raw=Buffer.alloc(Number(a.size)+1);let n=0;while(n<raw.length){const count=readSync(fd,raw,n,raw.length-n,n);if(!count)break;n+=count;}need(n===Number(a.size)&&sha256(raw.subarray(0,n))===expected);const b=fstatSync(fd,{bigint:true}),p=lstatSync(file,{bigint:true});need(['dev','ino','size','uid','mode','nlink','mtimeNs','ctimeNs'].every(k=>a[k]===b[k]&&a[k]===p[k]));}finally{if(fd!==undefined)closeSync(fd);}}
/** Explicit fixed-argv POSIX consumer for the existing USB tool. Default off.
 * Only entry-script SHA/observed metadata is pinned, not its import closure or
 * interpreter. No shell, discovery, config-body read/hash or automatic retry.
 * run settles after child+stdio close; close signals only our process group.
 * Host process exit is NOT device STA cleanup. Raw output/errors never escape. */
export function createNative400UsbProcessConsumer({enabled=false,executable,script,scriptSha256,port,holdSeconds=0,graceMs=1000}){
 need(enabled===true&&process.platform!=='win32');path(executable);path(script);path(port);need(port.startsWith('/dev/')&&port.length<=256&&typeof scriptSha256==='string'&&scriptSha256.length===64&&/^[a-f0-9]{64}$/.test(scriptSha256)&&scriptSha256!=='0'.repeat(64));
 need(Number.isInteger(holdSeconds)&&holdSeconds>=0&&holdSeconds<=120&&Number.isInteger(graceMs)&&graceMs>=10&&graceMs<=5000);
 let used=false,closed=false,started=false,exited=true,child=null,done=null,resolveDone,killTimer=null,termSent=false,pending='',stdout=0,stderr=0,queued=false,invalid=false,failed=false,error=null,outcome='unknown',detach=()=>{};const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 const kill=signal=>{if(!child?.pid||exited)return;try{process.kill(-child.pid,signal);}catch(e){if(e.code!=='ESRCH')error='process_termination_failed';}};
 function stop(){closed=true;if(!termSent&&!exited){termSent=true;kill('SIGTERM');killTimer=setTimeout(()=>{killTimer=null;kill('SIGKILL');},graceMs);}}
 function bad(){invalid=true;error='process_output_invalid';pending='';stop();}
 function line(text){try{
  need(Buffer.byteLength(text)<=2048);const v=parseRoundPetJson(Buffer.from(text));
  if(v.result==='queued-not-connected-or-presented'){exact(v,['result']);need(!queued&&!failed);queued=true;}
  else if(v.result==='status'){exact(v,['result','phase','cleanup_complete']);need(queued&&!failed&&Number.isInteger(v.phase)&&v.phase>=0&&v.phase<=6&&typeof v.cleanup_complete==='boolean');}
  else if(v.result==='failed-or-unconfirmed'){exact(v,Object.hasOwn(v,'reason')?['result','reason','automatic_retry']:['result','automatic_retry']);need(v.automatic_retry===false&&(!Object.hasOwn(v,'reason')||typeof v.reason==='string'&&v.reason.length<=256));failed=true;error='process_report_failed';stop();}
  else need(false);
 }catch{bad();}}
 function data(bytes){if(invalid)return;stdout+=bytes.length;if(stdout>131072){bad();return;}try{pending+=decoder.decode(bytes,{stream:true});let n;while((n=pending.indexOf('\n'))!==-1){const text=pending.slice(0,n);pending=pending.slice(n+1);line(text);if(invalid){pending='';return;}}if(Buffer.byteLength(pending)>2048)bad();}catch{bad();}}
 return {run({file,signal}){
  if(used||closed)throw fail('config_process_used');used=true;need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');if(signal?.aborted){closed=true;return Promise.resolve('unknown');}
  try{path(file);privatePath(file,'file');need(realpathSync(file)===file);const s=lstatSync(file);need(s.nlink===1&&s.size>0&&s.size<=16384);scriptCheck(script,scriptSha256);}catch{error='process_input_invalid';return Promise.resolve('unknown');}
  started=true;exited=false;done=new Promise(r=>resolveDone=r);
  try{child=spawn(executable,[script,'--config',file,'--apply','--port',port,'--hold-seconds',String(holdSeconds)],{cwd:dirname(script),shell:false,detached:true,env:{PATH:process.env.PATH??'',LANG:'C.UTF-8',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});}
  catch{error='process_spawn_failed';exited=true;resolveDone();return done.then(()=>outcome);}
  child.stdout.on('data',data);child.stderr.on('data',b=>{stderr+=b.length;if(stderr>16384)bad();});child.on('error',()=>{error='process_spawn_failed';failed=true;});
  child.once('close',code=>{try{pending+=decoder.decode();if(pending.length)invalid=true;}catch{invalid=true;}if(invalid&&!error)error='process_output_invalid';pending='';outcome=code===0&&queued&&!invalid&&!failed&&!closed?'queued':'unknown';exited=true;clearTimeout(killTimer);killTimer=null;detach();resolveDone();});
  const abort=()=>stop();signal?.addEventListener('abort',abort,{once:true});detach=()=>signal?.removeEventListener('abort',abort);if(signal?.aborted)stop();return done.then(()=>outcome);
 },close(){stop();return done??Promise.resolve();},
 snapshot:()=>({schema_version:1,profile:'native400-usb-process-consumer-view/1',started,exited,closed,queued_seen:queued,protocol_valid:!invalid,outcome,error,device_evidence:false,device_cleanup:'unknown'}),
 resources:()=>({child_running:started&&!exited,streams_open:started&&!exited,timers:killTimer===null?0:1})};
}
