import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync,lstatSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {resolve,join,dirname,sep} from 'node:path';import {parseArgs} from 'node:util';
/** Bounded POSIX test-process-group owner shared by offline verification CLIs. No raw diagnostics persisted. */
export async function verifyIsolated({files,expected,layer,scope,prefix,evidence,timeoutMs=30000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error('invalid supervision timeout');
 const {values}=parseArgs({options:{output:{type:'string'}}}),output=values.output&&resolve(values.output);
 if(!output?.startsWith(resolve('.cache')+sep))throw new Error('explicit ignored .cache output required');
 if(process.platform==='win32')throw new Error('POSIX test-process supervision required');
 const root=mkdtempSync(join(tmpdir(),prefix)),started=performance.now();let child,timer,killTimer,interrupted=false,timeout=false,stdout='',overflow=false,result,childClosed=false,terminationError;
 function killOwned(signal){if(!child?.pid)return;try{process.kill(-child.pid,signal);}catch(error){if(error.code==='ESRCH')return;terminationError=error.code==='EPERM'?'permission_denied':'termination_failed';if(!childClosed)try{child.kill(signal);}catch{terminationError='termination_failed';}}}
 const stop=()=>{interrupted=true;killOwned('SIGTERM');killTimer??=setTimeout(()=>killOwned('SIGKILL'),500);};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  child=spawn(process.execPath,['--test','--test-timeout=30000','--test-reporter=tap',...files],{detached:true,env:{...process.env,HUB_TEST_TMPDIR:root},stdio:['ignore','pipe','pipe']});
  timer=setTimeout(()=>{timeout=true;stop();},timeoutMs);
  child.stdout.on('data',bytes=>{if(stdout.length+bytes.length>1048576){overflow=true;stop();}else stdout+=bytes.toString();});child.stderr.resume();
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{childClosed=true;resolve(code);});});
  const cases=[...stdout.matchAll(/^ok \d+ - (.+)$/gm)].map(m=>m[1]);result={passed:code===0&&cases.length===expected&&!interrupted&&!overflow,layer,cases,timeout,interrupted,observed_wall_ms:Math.round(performance.now()-started),scope};
  if(result.passed&&evidence){try{
   if(!/^[a-z-]+\.json$/.test(evidence.file)||typeof evidence.validate!=='function')throw new Error('evidence');
   const file=join(root,evidence.file),s=lstatSync(file);
   if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.size>262144)throw new Error('evidence');
   result.observations=evidence.validate(JSON.parse(readFileSync(file,'utf8')));
  }catch{result.passed=false;result.error='evidence_invalid';}}
 }finally{
  clearTimeout(timer);clearTimeout(killTimer);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);killOwned('SIGKILL');rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:20});
 }
 if(terminationError){result.passed=false;result.termination_error=terminationError;delete result.observations;}
 result.temporary_environment_removed=!existsSync(root);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,temporary_environment_removed:result.temporary_environment_removed}));if(!result.passed)process.exitCode=1;
}
