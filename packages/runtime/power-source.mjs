import {spawn} from 'node:child_process';
import {privatePath} from './paths.mjs';
import {readFileSync,realpathSync} from 'node:fs';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
import {keys,uint64,increment,requireThat} from '../core/protocol.mjs';

/** Owns one bounded NDJSON child. start waits for seq=0 ready; EOF/bad input/exit fails closed.
 * onEvent/onFailure are trusted synchronous owner callbacks. No shell, restart or OS power changes.
 * close is async/idempotent, ends stdin, terminates and awaits only this owned child. */
export function createProcessPowerSource({command,args=[],kind,identity}){
 requireThat(['fixture','macos-iokit'].includes(kind)&&typeof identity==='string'&&identity.length>0&&identity.length<=128,'invalid_power_source');
 return {descriptor:Object.freeze({kind,identity}),async start({onEvent,onFailure}){
  let closed=false,failed=false,ready=false,buffer=Buffer.alloc(0),seq=null,done=false,deadline,force,startResolve,startReject;
  const startup=new Promise((resolve,reject)=>{startResolve=resolve;startReject=reject;});
  const child=spawn(command,args,{stdio:['pipe','pipe','pipe']});
  const exited=new Promise(resolve=>child.once('close',()=>{done=true;clearTimeout(deadline);clearTimeout(force);if(!closed&&!failed)fail('power_source_exit');resolve();}));
  function terminate(){if(done)return;child.stdin.end();child.kill('SIGTERM');force??=setTimeout(()=>{if(!done)child.kill('SIGKILL');},500);}
  function fail(code){if(closed||failed)return;failed=true;clearTimeout(deadline);if(!ready)startReject(Object.assign(new Error('power source unavailable'),{code}));onFailure(code);terminate();}
  function receive(bytes){if(closed||failed)return;buffer=Buffer.concat([buffer,bytes]);if(buffer.length>4096){fail('power_frame_size');return;}while(true){const end=buffer.indexOf(10);if(end<0){if(buffer.length>512)fail('power_frame_size');return;}const raw=buffer.subarray(0,end);buffer=buffer.subarray(end+1);try{requireThat(raw.length>0&&raw.length<=512,'power_frame_size');const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));keys(v,['protocol','type','seq']);uint64(v.seq);requireThat(v.protocol==='hub-power/1'&&['ready','suspend','resume'].includes(v.type),'power_schema');requireThat(seq===null?v.seq==='0'&&v.type==='ready':v.seq===increment(seq)&&v.type!=='ready','power_sequence');seq=v.seq;onEvent(v.type);if(!ready){ready=true;clearTimeout(deadline);startResolve();}}catch(error){fail(['power_frame_size','power_sequence','power_schema'].includes(error.code)?error.code:'power_schema');return;}}}
  child.stdin.on('error',()=>fail('power_source_pipe'));child.stdout.on('error',()=>fail('power_source_pipe'));child.stdout.on('data',receive);child.stderr.resume();child.once('error',()=>fail('power_source_spawn'));deadline=setTimeout(()=>fail('power_source_timeout'),1500);
  const handle={resources:()=>({closed,failed,ready,child_running:!done}),async close(){if(closed){await exited;return;}closed=true;clearTimeout(deadline);buffer=Buffer.alloc(0);child.stdout.off('data',receive);terminate();await exited;}};
  try{await startup;return handle;}catch(error){await handle.close();throw error;}
 }};
}
/** Explicit private executable, compiled outside production startup. No download/compiler invocation. */
export function createMacOSPowerSource({executable}){
 requireThat(process.platform==='darwin','power_platform_unsupported');privatePath(dirname(executable),'directory');privatePath(executable,'file');
 const command=realpathSync(executable),identity=createHash('sha256').update(readFileSync(command)).digest('hex');
 return createProcessPowerSource({command,kind:'macos-iokit',identity});
}
