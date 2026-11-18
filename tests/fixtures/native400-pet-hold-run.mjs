import http from 'node:http';
import assert from 'node:assert/strict';
import {F,status} from './native400-controls-test-support.mjs';
import {createNative400PetHoldRun} from '../../packages/runtime/native400-pet-hold-run.mjs';
export const settle=()=>new Promise(r=>setTimeout(r,20));
export async function holdRun(t,{runMs=45000,sourceMs=60000,sessionMs=60000,wrap,clock,realTimers=false}={}){
 const f=await F(t),x=await f.start({shared:true,sessionMs}),peer=await f.peer(x.window);let state='thinking',counter=1,requests=0,gate=null,httpStatus=200,after=null;
 const server=http.createServer(async(req,res)=>{requests++;if(gate)await gate;res.statusCode=httpStatus;res.setHeader('content-type','application/json');res.end(JSON.stringify({sections:{workStatus:{counter,data:{state}}}}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const intervals=new Map(),timeouts=new Map(),timers={setInterval(fn){const key=Symbol();intervals.set(key,fn);return key;},clearInterval:key=>intervals.delete(key),setTimeout(fn){const key=Symbol();timeouts.set(key,fn);return key;},clearTimeout:key=>timeouts.delete(key)};
 const raw=x.client,client={request:async(...a)=>{const v=await raw.request(...a);if(after&&a[0]==='GET'){const fn=after;after=null;await fn();}return v;}};
 const input={enabled:true,client:wrap?wrap(client):client,base:`http://127.0.0.1:${server.address().port}/dsh-pet-7340`,expectedRevision:'0',runMs,sourceMs,clock:clock??(()=>f.time),...(realTimers?{}:{timers})},run=createNative400PetHoldRun(input);
 let closed=false;async function close(){if(closed)return;closed=true;await run.close();server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(intervals.size,0);assert.equal(timeouts.size,0);assert.equal(run.resources().source_open,false);}
 t.after(close);
 return {f,x,peer,run,input,intervals,timeouts,close,status:()=>status(x),async start(){await run.start();await run.poll();await settle();},async poll(){await run.poll();await settle();},async advance(to,{poll=true}={}){while(f.time<to){f.time=Math.min(to,f.time+500);x.window.tick();peer.model.tick();await settle();if(poll)await this.poll();}},deadline(){for(const fn of [...timeouts.values()])fn();},get requests(){return requests;},value:(value,n)=>{state=value;counter=n;},httpStatus:n=>httpStatus=n,gate:p=>gate=p,after:fn=>after=fn};
}
