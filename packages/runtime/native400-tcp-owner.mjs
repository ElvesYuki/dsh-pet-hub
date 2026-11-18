import {acquireNative400LanProfile} from './native400-tcp-lan-profile.mjs';
import {createNative400TcpNetwork} from '../core/native400-tcp-network.mjs';
import net from 'node:net';import {randomBytes} from 'node:crypto';
import {TcpHubControl} from '../core/native400-tcp-control.mjs';import {attachNative400Tcp} from './native400-tcp.mjs';
const need=(ok,code='tcp_owner_invalid')=>{if(!ok)throw Object.assign(new Error(code),{code});};
/** Explicit temporary host owner, no production config or automatic ESP dial.
 * Endpoint initiates TCP. Incoming reconnect requires a fresh HELLO/session;
 * previous BASE is never replayed until explicit reapply with remaining lifetime.
 * close fences synchronously; returned promise waits all sockets and listener exit.
 * Optional peerAddress requires explicit local networkLink epochs before admission;
 * every new epoch fences active TCP, including up/up. It is not authentication.
 * clock/timers are trusted dependencies for isolated verification. */
export function createNative400TcpOwner({mapping,records,peerAddress,lanProfile,ackMs=2000,tickMs=25,clock=()=>Math.floor(performance.now()),timers={setInterval,clearInterval}}){
 const lan=lanProfile===undefined?null:acquireNative400LanProfile(lanProfile);if(lan){need(mapping===undefined&&records===undefined&&peerAddress===undefined,'tcp_lan_profile_invalid');({mapping,records,peerAddress,clock}=lan);}
 need(Number.isInteger(tickMs)&&tickMs>=1&&tickMs<=1000&&typeof clock==='function'&&typeof timers?.setInterval==='function'&&typeof timers?.clearInterval==='function');
 const network=peerAddress===undefined?null:createNative400TcpNetwork({peerAddress});
 const config=structuredClone({mapping,records,ackMs});new TcpHubControl({...config,session:'1',controller:'01'.repeat(16),clock});
 let listenWait=null,server=null,active=null,starting=false,closed=false,closing=null,paused=false,fatal=false,timer=null,epoch=0,lastTime=0,failures=0,retryAt=0,desired=null,revision=0,cancel=false,history=null,error=null,running=false,everConnected=false;
 const sockets=new Set(),sessions=new Set();
 function now(){const t=clock();need(Number.isSafeInteger(t)&&t>=0&&t>=lastTime&&t<=Number.MAX_SAFE_INTEGER-60000,'tcp_owner_clock');lastTime=t;return t;}
 function invalidate(entry,reason){if(active!==entry)return;history=entry.lastFrame??entry.model.snapshot().last_frame0;active=null;cancel=false;error=reason;const t=lastTime;failures=Math.min(5,failures+1);retryAt=t+Math.min(2000,100*2**(failures-1));entry.lane.close();}
 function windowAlive(){if(!lan)return true;try{lan.check();return true;}catch{void owner.close().catch(()=>{error='listener_close_failed';});return false;}}
 function pump(){if(!windowAlive())return;if(running||closed||paused||!active)return;running=true;const entry=active;try{
  const t=now();entry.model.tick();if(entry.model.phase!=='open'||entry.lane.busy||entry.model.pending)return;
  if(desired&&t>=desired.deadline&&entry.sent===desired.revision&&!entry.expired){entry.expired=true;cancel=true;}
  if(cancel){entry.model.cancel();cancel=false;}
  else if(desired&&desired.bound===entry.epoch&&desired.revision!==entry.sent&&t<desired.deadline){entry.model.base(desired.action,desired.deadline-t);entry.sent=desired.revision;entry.expired=false;}
  const r=entry.model.next();if(r)entry.lane.send(r);
 }catch(e){if(e.code==='tcp_owner_clock'){fatal=true;paused=true;}invalidate(entry,e.code==='tcp_owner_clock'?'clock_failed':'session_failed');}finally{running=false;}}
 function accept(socket){sockets.add(socket);socket.once('close',()=>sockets.delete(socket));socket.on('error',()=>{});
  if(!windowAlive()){socket.destroy();return;}let t;try{t=now();}catch{fatal=paused=true;active&&invalidate(active,'clock_failed');socket.destroy();return;}
  if(closed||paused||active||t<retryAt){socket.destroy();return;}if(network&&!network.allows(socket.remoteAddress)){socket.destroy();return;}socket.setNoDelay(true);
  const session=(BigInt('0x'+randomBytes(8).toString('hex'))||1n).toString(),controller=randomBytes(16).toString('hex');
  const model=new TcpHubControl({...config,session,controller,clock:now}),entry={model,epoch:++epoch,sent:0,expired:false,lane:null};
  try{entry.lane=attachNative400Tcp(socket,model,{...(lan?{beforeReceive:()=>active===entry&&windowAlive()}:{}),onProgress(){if(active!==entry)return;entry.lastFrame=model.snapshot().last_frame0??entry.lastFrame;if(model.phase==='open')error=null;pump();},onClose(){invalidate(entry,'disconnected');}});}catch{socket.destroy();return;}
  active=entry;sessions.add(entry.lane);entry.lane.done.then(()=>sessions.delete(entry.lane));
  if(desired&&!everConnected&&desired.bound===null)desired.bound=entry.epoch;everConnected=true;
 }
 function applyRecovery(key){need(windowAlive(),'tcp_lan_profile_invalid');const available=(!network||network.snapshot().ready)&&!closed&&!paused&&!fatal&&active?.model.phase==='open'&&desired;
  if(key&&(!available||desired.key!==key||!desired.autoEligible))return false;need(available,'tcp_reapply_unavailable');const t=now();if(key&&t>=desired.deadline)return false;need(t<desired.deadline,'tcp_reapply_unavailable');desired={...desired,autoEligible:true,revision:++revision,bound:active.epoch};pump();return true;
 }
 const owner={
  async start({enabled=false,host=lan?.host??'127.0.0.1',port=0}={}){need(enabled===true&&host===(lan?.host??'127.0.0.1')&&port===0,'tcp_owner_offline_only');need(!closed&&!starting&&!server);if(lan)lan.claim();starting=true;server=net.createServer(accept);server.maxConnections=2;
   try{listenWait=new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host,port},resolve);});await listenWait;need(!closed,'tcp_owner_closed');server.on('error',()=>{error='listener_failed';void owner.close();});timer=timers.setInterval(pump,tickMs);return owner.address();}
   catch(e){await owner.close();throw e;}finally{starting=false;}
  },
  networkLink(epoch,ready){need(windowAlive(),'tcp_lan_profile_invalid');need(network&&!closed,'tcp_network_unavailable');if(!network.link(epoch,ready))return false;if(desired)desired.bound=-1;if(active)invalidate(active,'network_changed');return true;},
  address(){need(server?.listening&&!closed);return {...server.address()};},
  base(action,ttl=5000){need(windowAlive(),'tcp_lan_profile_invalid');need((!network||network.snapshot().ready)&&!closed&&!paused&&!fatal&&[0,1,11].includes(action)&&Number.isInteger(ttl)&&ttl>=1&&ttl<=60000);const t=now();desired={action,key:Symbol(),autoEligible:true,deadline:t+ttl,revision:++revision,bound:active?.epoch??(!everConnected?null:-1)};pump();},
  reapply(){applyRecovery();},
  captureRecovery(){const key=desired?.key;need(key,'tcp_reapply_unavailable');return Object.freeze({isCurrent:()=>!!desired&&desired.key===key,canRecover:()=>!!desired&&desired.key===key&&desired.autoEligible&&!closed&&!paused&&!fatal,restore:()=>applyRecovery(key)});},
  cancel(){need(!closed);desired=null;cancel=true;pump();},
  pause(){need(!closed);if(desired)desired.autoEligible=false;paused=true;if(active)invalidate(active,'paused');},
  resume(){need(!closed&&!fatal);paused=false;},
  tick:pump,
  snapshot(){windowAlive();try{now();}catch{fatal=paused=true;if(active)invalidate(active,'clock_failed');}return {phase:closed?'closed':paused?'paused':active?.model.phase??(server?.listening?'waiting':'disabled'),desired:desired?{action:desired.action,remaining_ms:Math.max(0,desired.deadline-lastTime)}:null,recovery_required:!!desired&&everConnected&&desired.bound!==active?.epoch,observation:active?.model.snapshot()??null,history:history?{...history,historical:true}:null,error,...(lan?{window:lan.snapshot()}:{}),...(network?{network:network.snapshot()}:{}),authenticated:false,device_evidence:false};},
  resources(){return {sockets:sockets.size,sessions:sessions.size,timers:timer===null?0:1,listening:!!server?.listening,active:active?1:0};},
  close(){if(closing)return closing;lan?.revoke();closed=true;paused=true;if(timer!==null){timers.clearInterval(timer);timer=null;}if(active)invalidate(active,'closed');const exits=[...sessions].map(x=>x.done);for(const s of sockets)s.destroy();return closing=(async()=>{await listenWait?.catch(()=>{});if(server?.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await Promise.all(exits);desired=history=null;})();}
 };return owner;
}
