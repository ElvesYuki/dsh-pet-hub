// Original MIT isolated-process fixture, not a product configuration loader.
import {readFileSync,appendFileSync} from 'node:fs';import {startOrAttach} from '../../packages/runtime/service.mjs';import {prepareNative400TcpBinding} from '../../packages/runtime/native400-tcp-binding.mjs';import {prepareNative400TcpHost} from '../../packages/runtime/native400-tcp-host.mjs';
const {directory,file,input}=JSON.parse(readFileSync(process.argv[2],'utf8'));
const option=prepareNative400TcpHost({binding:prepareNative400TcpBinding(input),file,peerAddress:'127.0.0.1',beforeRead:async({offset})=>{if(offset===0)appendFileSync(process.argv[3],'read\n',{mode:0o600});}});
const hub=await startOrAttach({directory,tcpReview:option});if(hub.tcpReview)await hub.tcpReview.ready;
console.log(JSON.stringify({role:hub.role,instanceId:hub.instanceId}));
const keep=setInterval(()=>{},1000);process.once('SIGTERM',()=>{clearInterval(keep);hub.close().then(()=>process.exit(0),()=>process.exit(1));});
