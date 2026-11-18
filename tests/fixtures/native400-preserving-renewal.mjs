import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {TcpDeviceModel,TcpHubControl} from '../../packages/core/native400-tcp-control.mjs';
import {TcpDevicePlaybackModel} from '../../packages/core/native400-tcp-playback.mjs';
import {decodeTcp,encodeTcp,tcpPayload,tcpHex,TcpParser} from '../../packages/core/native400-tcp.mjs';
export const records=[0,4,1,11].map(action=>({action,frames:241,asset_sha256:(action+1).toString(16).padStart(2,'0').repeat(32)}));
export function verifyRenewalPins(pins){
 assert.equal(pins.contract,'native400-preserving-renewal/1');assert.equal(process.versions.node,pins.node);
 const expected=['crc32','native400-scheduling','native400-tcp-control','native400-tcp','pet4','protocol'].map(n=>'packages/core/'+n+'.mjs').sort();assert.deepEqual(Object.keys(pins.files).sort(),expected);
 const closure=new Set();function visit(name){if(closure.has(name))return;closure.add(name);const text=readFileSync(name,'utf8');for(const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)){assert.ok(m[1].startsWith('./'));visit('packages/core/'+m[1].slice(2));}}visit('packages/core/native400-tcp-control.mjs');assert.deepEqual([...closure].sort(),expected);
 for(const [p,hash]of Object.entries(pins.files)){assert.equal(realpathSync(p),resolve(p));assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),hash,p);}
}
export function renewalRig(){
 let time=0,seq=1n;const model=new TcpDeviceModel({boot:'42',mapping:'22'.repeat(32),records,clock:()=>time}),generation=model.connect(),playback=new TcpDevicePlaybackModel(model);
 const open={type:1,session:'17',seq:'1',payload:tcpPayload(1,{boot:'42',mapping:'22'.repeat(32),controller:'44'.repeat(16)})};assert.equal(model.receive(open,generation).code,1);
 function base(action=11,ttl=5000,asset=records.find(r=>r.action===action)?.asset_sha256??'ff'.repeat(32)){return {type:2,session:'17',seq:(++seq).toString(),payload:tcpPayload(2,{action,ttl,asset})};}
 function other(type){return {type,session:'17',seq:(++seq).toString(),payload:new Uint8Array()};}
 function receive(r){return model.receive(r,generation);}
 function ready(source='7'){let s=playback.begin();assert.ok(s);assert.ok(playback.verified(s,records.find(r=>r.action===s.action).asset_sha256));s=playback.bind(s,source,Number(source));assert.ok(s);assert.ok(playback.decoded(s));return s;}
 return {model,playback,generation,open,base,other,receive,ready,get time(){return time;},set time(t){time=t;}};
}
/** Replay independently captured C++ wire transcript into actual hub AND the
 * updated device/worker oracle. Original synthetic callbacks follow the trace's
 * explicit source lifecycle. No C++ code, upstream script, socket or device runs. */
export function verifyRenewalTrace(golden){
 assert.equal(golden.contract,'native400-preserving-renewal/1');assert.equal(golden.fixture_only,true);assert.equal(golden.rows.length,24);
 let now=0,pendingOpen,playing=null;const cfg={boot:'42',mapping:'22'.repeat(32),records,clock:()=>now},model=new TcpDeviceModel(cfg),generation=model.connect(),playback=new TcpDevicePlaybackModel(model),hub=new TcpHubControl({...cfg,session:'17',controller:'44'.repeat(16)}),hg=hub.connect();
 function ready(time,source){now=time;playing=playback.begin();assert.ok(playing);assert.ok(playback.verified(playing,records.find(r=>r.action===playing.action).asset_sha256));playing=playback.bind(playing,String(source),source);assert.ok(playing);assert.ok(playback.decoded(playing));}
 function loop(time,source){now=time;assert.ok(playback.eof(playing));ready(time,source);}
 for(const row of golden.rows){
  if(row.label==='initial_frame0')ready(11,7);
  if(row.label==='renewed_frame0')loop(4000,8);
  if(row.label==='renew_during_draw')loop(7000,9);
  if(row.label==='latest_frame0')loop(7200,10);
  if(row.label==='new_instance_frame0')ready(7401,11);
  if(row.label==='touch'){now=7500;model.touch();ready(7500,12);}
  if(row.label==='touch_latest_frame0'){now=7700;assert.ok(playback.eof(playing));ready(7701,13);}
  if(row.label==='short_frame0')ready(7901,14);
  now=row.now;let generated=[];
  if(row.label==='hello')generated=[model.hello()];
  else if(row.input){
   const input=decodeTcp(Buffer.from(row.input,'hex'));let expected;
   if(!row.replay){if(input.type===1){expected=pendingOpen;pendingOpen=null;}else if(input.type===2){const d=new DataView(input.payload.buffer,input.payload.byteOffset,input.payload.length);hub.base(d.getUint16(0,true),d.getUint32(4,true));expected=hub.next();}else{assert.equal(input.type,3);hub.cancel();expected=hub.next();}assert.equal(tcpHex(encodeTcp(expected)),row.input);}
   const ack=model.receive(input,generation);generated=[{type:129,session:input.session,seq:input.seq,payload:tcpPayload(129,ack)}];
  }else if(/frame0|old_draw/.test(row.label)){
   const r=playback.presented(playing,{drawAt:row.label==='old_draw'?7099:now});if(r)generated=[r];
  }
  assert.equal(generated.map(r=>tcpHex(encodeTcp(r))).join(''),row.output,row.label+' bytes');
  const parser=new TcpParser();parser.feed(Buffer.from(row.output,'hex'),r=>{const next=hub.receive(r,hg);if(next)pendingOpen=next;});parser.eof();hub.tick();
  const target=model.tick(),stamp=playback.stamp();assert.deepEqual({token:target.token,origin:{local:0,remote:1,touch:2}[target.origin],action:target.action,source:Number(stamp?.source??0),cycle:Number(stamp?.cycle??0),mail:stamp?.mail??0,current:playback.current(playing),needs_start:playback.needsStart()},Object.fromEntries(['token','origin','action','source','cycle','mail','current','needs_start'].map(k=>[k,row[k]])),row.label+' semantics');
  const state=hub.snapshot();if(row.label==='renew'){assert.equal(state.accepted.token,row.token);assert.equal(state.last_frame0,null);}if(['renewed_frame0','latest_frame0','touch_latest_frame0'].includes(row.label)){assert.equal(state.last_frame0.seq,state.accepted.seq);assert.equal(state.current_display,'unknown');}if(row.label==='expired')assert.equal(state.accepted,null);
 }
 return {rows:golden.rows.length,wire:true,device_oracle:true,playback_oracle:true,actual_host_class:true,synthetic_callbacks:true,sockets:false,ESP:false};
}
