// Fixed reviewed executable bootstrap, not a configurable approval/provider module.
import {readFileSync,lstatSync,realpathSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
let ownedHome=null;try{const h=process.env.HOME,token=process.env.PET_HOLD_HOME_TOKEN,s=lstatSync(h),marker=JSON.parse(readFileSync(join(h,'.hold-owner.json'),'utf8'));if(realpathSync(h)!==h||!s.isDirectory()||s.uid!==process.getuid()||(s.mode&0o777)!==0o700||!/^([a-f0-9]{64})$/.test(token)||marker.profile!=='pet-hold-owned-home/1'||marker.token!==token)throw Error('home');ownedHome=h;}catch{process.exit(2);}
const instance=randomBytes(32).toString('hex');
let run=null,started=false,attempted=false,closing=false,ending=null,heart=null,watch=null,force=null,seq=0,pending=null,lastError=null;
function send(value){if(process.connected)process.send({instance,...value},e=>{if(e)void finish('parent_lost');});}
function rejectPending(){if(pending){clearTimeout(pending.timer);pending.reject(Error('host_disconnected'));pending=null;}}
async function finish(reason){if(ending)return ending;closing=true;clearInterval(heart);clearTimeout(watch);if(!process.connected)rejectPending();force=setTimeout(()=>process.exit(2),3000);
 ending=(async()=>{try{await run?.close();send({kind:'final',reason,constructed:!!run,started,snapshot:run?.snapshot()??null,resources:run?.resources()??null});}catch{lastError='cleanup_unknown';send({kind:'final',reason:lastError,constructed:!!run,started,resources:run?.resources()??null});}finally{clearTimeout(force);rejectPending();if(ownedHome&&existsSync(ownedHome))rmSync(ownedHome,{recursive:true,force:true});if(process.connected)process.disconnect();}})();return ending;
}
process.on('disconnect',()=>void finish('parent_lost'));
process.on('SIGTERM',()=>void finish('terminated'));
process.on('message',async m=>{try{
 if(!m||typeof m!=='object'||JSON.stringify(m).length>8192)throw Error('message');
 if(m.kind==='close'){void finish('closed');return;}
 if(m.instance!==instance)throw Error('instance');
 if(m.kind==='response'){
  if(!pending||pending.id!==m.id)return;const p=pending;pending=null;clearTimeout(p.timer);p.signal?.removeEventListener('abort',p.abort);
  if(m.ok)p.resolve(m.value);else p.reject(Object.assign(Error('scoped_request_failed'),{status:m.status??503}));return;
 }
 if(m.kind==='confirm'){if(run&&!closing)await run.confirm();return;}
 if(m.kind!=='start'||attempted||closing)throw Error('start');attempted=true;clearTimeout(watch);
 const {base,runMs,sourceMs,expectedRevision}=m.options;
 const client={request(method,path,body,{signal}={}){return new Promise((resolve,reject)=>{
  if(pending||!process.connected)return reject(Error('host_busy'));
  const id=++seq,abort=()=>{if(pending?.id!==id)return;clearTimeout(pending.timer);pending=null;signal?.removeEventListener('abort',abort);send({kind:'abort_request',id});reject(Error('request_aborted'));};
  pending={id,resolve,reject,signal,abort,timer:setTimeout(abort,2500)};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}send({kind:'request',id,method,path,...(body===undefined?{}:{body})});
 });}};
 const manifest=JSON.parse(readFileSync(join(process.argv[2],'manifest.json'),'utf8')),entry=manifest.entries.find(e=>e.role==='manager');
 const module=await import(pathToFileURL(join(process.argv[2],entry.root,entry.path)).href);
 if(closing)return;run=module.createNative400PetHoldRun({enabled:true,client,base,runMs,sourceMs,expectedRevision});
 await run.start();started=true;if(closing)return;send({kind:'armed',constructed:true,started:true,snapshot:run.snapshot(),resources:run.resources()});
 heart=setInterval(()=>{const snapshot=run.snapshot();send({kind:'state',constructed:true,started:true,snapshot,resources:run.resources()});if(snapshot.phase==='closed')void finish('run_closed');},100);
 watch=setTimeout(()=>void finish('watchdog'),runMs+3000);
}catch{lastError='child_failed';send({kind:'failed',error:lastError});void finish(lastError);}});
watch=setTimeout(()=>void finish('startup_timeout'),5000);
// Reuse original pinned loader, registered hooks and exact import receipt. It
// imports the manager entry without constructing it; above start then calls it.
await import('./native400-node-load-child.mjs');
if(process.exitCode){send({kind:'failed',error:'import_failed'});await finish('import_failed');}
else if(!closing)send({kind:'loaded',pid:process.pid});
