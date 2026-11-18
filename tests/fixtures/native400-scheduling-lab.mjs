import {open} from 'node:fs/promises';import {join} from 'node:path';
import {native400ReviewLab} from './native400-review-lab.mjs';import {createNative400SchedulingDriver} from '../../packages/simulator/native400-scheduling-driver.mjs';
/** Private real TLS lab, explicit local4 file provider, clocks advanced only by tests. */
export async function native400SchedulingLab(t,pki,{local=true,beforeLocal=async()=>{},beforeClose=()=>{},beforeExchange=async()=>{},afterExchange=async()=>{},...options}={}){
 let driver,file;const s=await native400ReviewLab(t,pki,{...options,scheduling:true,beforeClose:async()=>{await beforeClose();await driver?.close();await file?.close();}});
 if(local)file=await open(join(s.source.directory,'4.pet'),'r');
 driver=createNative400SchedulingDriver({executor:s.executor,clock:s.deviceClock,gateway:{exchange:async({signal,deadline}={})=>{await beforeExchange({signal,deadline});await s.step();await s.flush();await afterExchange({signal,deadline});},read:async({signal}={})=>{if(!s.peer.last?.payload.read_permit)return {kind:'control'};const part=await s.peer.get({signal});await s.adapter.waitForIdle();return part;}},localSource:local?{bytes:s.metadata.manifest.actions[4].bytes,async read(offset,n,{signal}){await beforeLocal({offset,n,signal});const b=Buffer.alloc(n);const r=await file.read(b,0,n,offset);if(r.bytesRead!==n)throw Object.assign(new Error('Short local file'),{code:'source_changed'});return b;}}:null});
 await s.connect();await s.acquire();
 return Object.assign(s,{driver,advance(ms,deviceMs=ms){s.clock.advance(ms);s.deviceClock.advance(deviceMs);},async until(predicate,{limit=12000,advance=5}={}){for(let i=0;i<limit;i++){if(predicate(s.executor.snapshot(),s.adapter.snapshot().observation))return;const r=await driver.pump();if(['waiting','playing','buffering','ended','loop_wait'].includes(r.state))this.advance(advance);}throw new Error('pump limit: '+JSON.stringify(s.executor.snapshot()));}});
}
