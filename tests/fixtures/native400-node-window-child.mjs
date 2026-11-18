// Original MIT rehearsal only. No product config, device or USB provider.
import {readFileSync} from 'node:fs';import {prepareNative400LanProfile} from '../../packages/runtime/native400-tcp-lan-profile.mjs';import {prepareNative400LanHost} from '../../packages/runtime/native400-tcp-lan-host.mjs';import {createNative400NodeControlWindow} from '../../packages/runtime/native400-node-control-window.mjs';import {createInterface} from 'node:readline';
const {directory,data}=JSON.parse(readFileSync(process.argv[2],'utf8'));if(data.decision.usage!=='loopback-rehearsal'||data.endpoint.listen_address!=='127.0.0.1'||data.endpoint.peer_address!=='127.0.0.1')throw Error('rehearsal only');
const profile=prepareNative400LanProfile({...data,interfaces:()=>({test0:[{address:'127.0.0.1',family:'IPv4',internal:true}]})}),window=createNative400NodeControlWindow({enabled:true,directory,lanReview:prepareNative400LanHost({profile})});const info=await window.ready;if(info.role==='owner')window.networkLink(1,true);

const lines=createInterface({input:process.stdin}),keep=setInterval(()=>{},1000);let stopped=false;
async function stop(){if(stopped)return;stopped=true;lines.close();process.stdin.destroy();clearInterval(keep);await window.close();console.log(JSON.stringify({result:'closed',resources:window.resources()}));}
process.once('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));lines.on('line',line=>{try{const v=JSON.parse(line);if(v.operation==='base')window.base(v.action,v.ttl);else if(v.operation==='cancel')window.cancel();else if(v.operation==='status'){console.log(JSON.stringify({result:'status',view:window.snapshot()}));return;}else if(v.operation==='close'){void stop();return;}else throw Error('unsupported original operation');console.log(JSON.stringify({result:'submitted'}));}catch{console.log(JSON.stringify({result:'rejected'}));}});

// Publish readiness only after shutdown and command handlers are installed.
console.log(JSON.stringify({...info,view:window.snapshot(),address:info.role==='owner'?window.address():null}));
