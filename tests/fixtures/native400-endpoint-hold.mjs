import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {F,until} from './native400-controls-test-support.mjs';
import {TcpDevicePlaybackModel} from '../../packages/core/native400-tcp-playback.mjs';
import {TcpDeviceModel} from '../../packages/core/native400-tcp-control.mjs';
import {TcpParser,encodeTcp,tcpPayload} from '../../packages/core/native400-tcp.mjs';
import {native400TcpMapping} from '../../packages/runtime/native400-tcp.mjs';
import {createNative400PetBridge} from '../../packages/runtime/native400-pet-bridge.mjs';
import {createNative400PetHoldSource} from '../../packages/runtime/native400-pet-hold-source.mjs';
const settle=()=>new Promise(r=>setTimeout(r,20));
// One endpoint model survives sockets, including its local touch stamp. HTTP/UDS/TCP
// are real loopback I/O; clock, SHA preparation and display are explicitly modeled.
export async function endpointHold(t,{autoRecover=true,sessionMs=60000,sourceMs=60000,wrap}={}){
 const f=await F(t),x=await f.start({shared:true,autoRecover,sessionMs}),model=new TcpDeviceModel({boot:'42',mapping:native400TcpMapping(f.identity),records:f.identity.records,clock:()=>f.time});
 const playback=new TcpDevicePlaybackModel(model);
 let peer,sourceId=100n,value={state:'thinking',counter:1},httpStatus=200,requests=0;const peers=[];
 async function connect(){const g=model.connect(),a=x.window.address(),socket=net.connect(a.port,a.address),records=[],acks=[],parser=new TcpParser(),closed=new Promise(r=>socket.once('close',r));socket.on('error',()=>{});socket.on('close',()=>model.disconnect(g));socket.on('data',bytes=>parser.feed(bytes,r=>{records.push(r);const ack=model.receive(r,g);acks.push({seq:r.seq,...ack});socket.write(encodeTcp({type:129,session:r.session,seq:r.seq,payload:tcpPayload(129,ack)}));}));await new Promise(r=>socket.once('connect',r));socket.write(encodeTcp(model.hello()));peer={socket,g,records,acks,closed};peers.push(peer);await until(()=>x.window.snapshot().transport.phase==='open');await settle();return peer;}
 await connect();
 const server=http.createServer((req,res)=>{requests++;res.statusCode=httpStatus;res.setHeader('content-type','application/json');res.end(JSON.stringify({sections:{workStatus:{counter:value.counter,data:{state:value.state}}}}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const source=createNative400PetHoldSource({base:`http://127.0.0.1:${server.address().port}/dsh-pet-7340`,clock:()=>f.time,sourceMs});
 const b=createNative400PetBridge({enabled:true,mode:'hold-state',arbitration:'endpoint-arbitrated',source,expectedRevision:'0',client:wrap?wrap(x.client):x.client});
 let closed=false;async function close(){if(closed)return;closed=true;await b.close();source.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const p of peers)p.socket.destroy();await Promise.all(peers.map(p=>p.closed));await x.window.close();assert.equal(b.snapshot().timer_active,false);assert.equal(x.window.resources().service_owned,false);assert.equal(x.window.resources().transport.sockets,0);assert.equal(x.window.resources().transport.sessions,0);assert.equal(x.window.resources().transport.timers,0);}
 t.after(close);
 async function poll(){await b.poll();await settle();}
 async function advance(end,{poll:doPoll=true}={}){while(f.time<end){f.time=Math.min(end,f.time+500);x.window.tick();model.tick();await settle();if(doPoll)await poll();}}
 function beginCycle(){let stamp=playback.stamp();if(stamp&&playback.current(stamp))assert.equal(playback.eof(stamp),true);stamp=playback.begin();assert.ok(stamp);assert.equal(playback.verified(stamp,f.identity.records.find(r=>r.action===stamp.action).asset_sha256),true);const source=(++sourceId).toString();stamp=playback.bind(stamp,source,Number(sourceId));assert.ok(stamp);assert.equal(playback.decoded(stamp),true);return stamp;}
 function frame({newCycle=false,drawAt}={}){const stamp=playback.needsStart()||!playback.stamp()||newCycle?beginCycle():playback.stamp();const r=playback.presented(stamp,{drawAt});assert.ok(r);return r;}
 async function present(options){const r=frame(options);peer.socket.write(encodeTcp(r));await until(()=>x.window.snapshot().transport.frame0_history?.action===model.target.action);return r;}
 return {f,x,model,playback,beginCycle,source,b,connect,poll,advance,present,frame,close,get peer(){return peer;},get requests(){return requests;},value:(state,counter)=>value={state,counter},httpStatus:n=>httpStatus=n};
}
