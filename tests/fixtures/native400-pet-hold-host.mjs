import assert from 'node:assert/strict';
import {readdirSync,readFileSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import http from 'node:http';
import {createNative400ExecutionSnapshot} from '../../packages/runtime/native400-execution-snapshot.mjs';
import {createNative400PetHoldHost} from '../../packages/runtime/native400-pet-hold-host.mjs';
import {TcpDevicePlaybackModel} from '../../packages/core/native400-tcp-playback.mjs';
import {encodeTcp} from '../../packages/core/native400-tcp.mjs';
import {F,status,until} from './native400-controls-test-support.mjs';
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export function hostSnapshot(t,{beforeSeal,entry='packages/runtime/native400-pet-hold-run.mjs',directory}={}){
 const root=directory??realpathSync(mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'fixed-hold-'))),paths=[],hash=b=>createHash('sha256').update(b).digest('hex');
 function walk(base){for(const e of readdirSync(base,{withFileTypes:true})){const p=join(base,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.mjs'))paths.push(p);}}walk('packages');paths.push('packages/core/native400-wire-contract.json','packages/core/round-pet-wire-contract.json','package.json');
 const files=paths.sort().map(path=>({path,sha256:hash(readFileSync(path))})),executable=realpathSync(process.execPath);
 const snapshot=createNative400ExecutionSnapshot({enabled:true,directory:root,roots:[{label:'host',directory:realpathSync('.'),files}],entries:[{role:'manager',root:'host',path:entry}],runtime:{kind:'node',executable,sha256:hash(readFileSync(executable))},...(beforeSeal?{beforeSeal}:{})});
 t.after(async()=>{await snapshot.close();if(!directory)rmSync(root,{recursive:true,force:true});});return {snapshot,root};
}
export async function hostFixture(t,{runMs=1000,closeMs=1000,windowMs=60000,sourceMs=60000,signal,observe,wireEffects=true}={}){
 const cleanup=[],owner={after:fn=>cleanup.push(fn)};const f=await F(owner),x=await f.start({shared:true,sessionMs:windowMs}),peer=await f.peer(x.window),playback=new TcpDevicePlaybackModel(peer.model),freeze=hostSnapshot(owner);
 let state='thinking',counter=1,requests=0,httpStatus=200,gate=null,source=100n,cycleAt=0;const presented=[];
 const server=http.createServer(async(req,res)=>{requests++;if(gate)await gate;res.statusCode=httpStatus;res.setHeader('content-type','application/json');res.end(JSON.stringify({sections:{workStatus:{counter,data:{state}}}}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/dsh-pet-7340`,host=createNative400PetHoldHost({enabled:true,snapshot:freeze.snapshot,window:x.window,base,runMs,sourceMs,closeMs,...(signal?{signal}:{}),...(observe?{observe}:{})});
 const origin=performance.now(),ticker=setInterval(()=>{f.time=Math.floor(performance.now()-origin);x.window.tick();peer.model.tick();if(!wireEffects)return;const target=peer.model.target,old=playback.stamp();if(playback.needsStart()||old&&target.origin==='remote'&&performance.now()-cycleAt>=500){if(old&&playback.current(old))playback.eof(old);let s=playback.begin();if(!s)return;assert.ok(playback.verified(s,f.identity.records.find(r=>r.action===s.action).asset_sha256));s=playback.bind(s,(++source).toString(),Number(source));assert.ok(playback.decoded(s));cycleAt=performance.now();const report=playback.presented(s);if(report){presented.push(report);peer.socket.write(encodeTcp(report));}}},10);
 let closed=false;const close=async()=>{if(closed)return;closed=true;clearInterval(ticker);await host.close();server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup.reverse())await fn();};t.after(close);
 return {f,x,peer,playback,host,...freeze,base,presented,close,status:()=>status(x),value:(s,n)=>{state=s;counter=n;},httpStatus:n=>httpStatus=n,gate:p=>gate=p,get requests(){return requests;},async started(){const v=await host.start();await until(()=>peer.records.some(r=>r.type===2));return v;}};
}
