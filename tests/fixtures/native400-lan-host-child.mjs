// MIT original isolated fixture; never a product LAN config loader.
import {readFileSync,appendFileSync} from 'node:fs';import {prepareNative400LanProfile} from '../../packages/runtime/native400-tcp-lan-profile.mjs';import {prepareNative400LanHost} from '../../packages/runtime/native400-tcp-lan-host.mjs';import {startOrAttach} from '../../packages/runtime/service.mjs';
const {directory,data}=JSON.parse(readFileSync(process.argv[2],'utf8')),profile=prepareNative400LanProfile({...data,interfaces:()=>{appendFileSync(process.argv[3],process.pid+'\n',{mode:0o600});return {test0:[{address:'127.0.0.1',family:'IPv4',internal:true}]};}}),option=prepareNative400LanHost({profile}),hub=await startOrAttach({directory,lanReview:option});
const hold=setInterval(()=>{},1000);process.once('SIGTERM',()=>{clearInterval(hold);hub.close().then(()=>process.exit(0),()=>process.exit(1));});
console.log(JSON.stringify({role:hub.role,instanceId:hub.instanceId}));
