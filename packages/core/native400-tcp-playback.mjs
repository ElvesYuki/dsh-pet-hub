import {tcpU64} from './native400-tcp.mjs';
const sameIntent=(a,b)=>!!a&&!!b&&['origin','action','token','seq'].every(k=>a[k]===b[k]);
const sameStamp=(a,b)=>sameIntent(a?.intent,b?.intent)&&['source','cycle','mail','action','transport'].every(k=>a[k]===b[k]);
/** Pure simulated worker/display oracle for preserving-renewal/1. It has no I/O
 * or media decoder. Caller supplies synthetic SHA/decode/draw callbacks. A stamp
 * names a playback start and source cycle, not the latest command's request. */
export class TcpDevicePlaybackModel {
 constructor(device){this.device=device;this.cycle=0n;this.stored=null;this.drawn='0';this.completed='0';}
 needsStart(){const t=this.device.tick();return this.stored?!sameIntent(this.stored.intent,t):t.origin!=='local';}
 stamp(){return this.stored?structuredClone(this.stored):null;}
 current(s){return !!s&&sameStamp(s,this.stored)&&sameIntent(s.intent,this.device.tick());}
 begin(intent=this.device.tick(),action=intent.action){
  if(!sameIntent(intent,this.device.tick())||intent.origin!=='local'&&intent.action!==action||this.cycle===(1n<<64n)-1n)return null;
  if(intent.origin==='remote'&&!this.device.beginCycle(intent.token))return null;
  this.fileSha=this.decodedFrame=false;this.framePosition=0;
  this.stored={intent:{...intent},source:'0',cycle:(++this.cycle).toString(),mail:0,action,transport:this.device.connected?this.device.generation:0};return this.stamp();
 }
 verified(s,sha){if(!this.current(s)||this.device.records.find(r=>r.action===s.action)?.asset_sha256!==sha)return false;this.fileSha=true;return true;}
 bind(s,source,mail){if(!this.current(s)||!this.fileSha||s.source!=='0'||tcpU64(source)===0n||!Number.isInteger(mail)||mail<0||mail>0xffffffff)return null;this.stored={...this.stored,source,mail};return this.stamp();}
 decoded(s,frame=0,valid=true){if(!this.current(s)||!this.fileSha||s.source==='0'||frame!==0||!valid||this.decodedFrame)return false;if(s.intent.origin==='remote'&&!this.device.prepare(s.intent.token,s.source,this.device.records.find(r=>r.action===s.action).asset_sha256))return false;this.decodedFrame=true;this.decodedAt=this.device.time;return true;}
 presented(s,{frame=0,drawCurrent=true,drawAt}={}){
  this.device.tick();drawAt??=this.device.time;
  if(!Number.isSafeInteger(drawAt)||drawAt>this.device.time||drawAt<this.decodedAt||!this.current(s)||!this.fileSha||!this.decodedFrame||!drawCurrent||frame!==0||s.source==='0'||s.intent.origin!=='remote'||this.drawn===s.cycle)return null;
  // A valid old draw cannot be retried later with a fresh timestamp to prove a
  // renewal. Bad stamps/non-frame0/invalid draws never consume the valid cycle.
  this.drawn=s.cycle;return this.device.presented(s.intent.token,s.source,0,drawAt);
 }
 advanceFrame(s,frame){if(!this.current(s)||!this.decodedFrame||!Number.isInteger(frame)||frame<0||frame>0xffffffff)return false;this.framePosition=frame;return true;}
 eof(s,complete=true){if(!this.current(s)||s.source==='0'||!this.fileSha||!this.decodedFrame||!complete||this.completed===s.cycle)return false;this.completed=s.cycle;return s.intent.origin==='touch'?this.device.touchDone(s.intent.token):true;}
}
