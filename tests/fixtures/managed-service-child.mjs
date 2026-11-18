import {readFileSync,appendFileSync} from 'node:fs';import {join} from 'node:path';
import {startOrAttach} from '../../packages/runtime/service.mjs';import {createProcessPowerSource} from '../../packages/runtime/power-source.mjs';
import {mtlsFixtureMedia} from './mtls-lab.mjs';import {leaseDelayBudget} from '../../packages/simulator/lease-delay.mjs';
const root=process.argv[2],powerSource=createProcessPowerSource({command:process.execPath,args:['tests/fixtures/power-child.mjs','normal'],kind:'fixture',identity:'cross-process-power'}),start=powerSource.start;
powerSource.start=callbacks=>{appendFileSync(join(root,'source-starts'),'start\n',{mode:0o600});return start(callbacks);};
const owner=await startOrAttach({directory:join(root,'ipc'),managedSessions:{profile:'review',bindingDirectory:join(root,'bindings'),controller_id:'C',rootDER:readFileSync(join(root,'public-root.der')),manifest:mtlsFixtureMedia().manifest,policy:{host_ppm:500,device_ppm:500,...leaseDelayBudget({queue_ms:100,segment_ms:1000,poll_ms:500,network_ms:200,process_ms:100},{host_ppm:500}),margin_ms:10,max_lease_ms:15000},clock:{now:()=>0},now:Date.now,powerSource}});
console.log(JSON.stringify({role:owner.role}));
if(owner.role==='owner'){let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await owner.close();});}
