import {randomBytes} from 'node:crypto';
import {Registry} from '../core/registry.mjs';
import {createLeaseGuard} from '../core/lease-budget.mjs';
import {keys,id,digest,uint64,increment,bounded,frame,capabilities,clone,same,requireThat} from '../core/protocol.mjs';
import {createMTLSPeerAuth} from './mtls-peer.mjs';
const random=()=>randomBytes(32).toString('hex');
const limited=v=>{frame(v);requireThat(Buffer.byteLength(JSON.stringify(v))<=4096,'hello_size');};
/** Opt-in session owner, no listener or OS power hooks. store is the sole binding/credential authority.
 * begin/confirm use real mTLS sockets; all callbacks/receipts/tasks are tied to one generated session.
 * revoke/rotate are synchronous CAS control operations; errors never imply successful persistence.
 * suspend/resume are explicit injected events. close fences resources, but does not close caller-owned store.
 * verification defaults scoped (static certificate cache + synchronous store view); full is a trusted reference.
 * Each new request/block still performs full metadata validation; no view crosses an await.
 * registry/guard/auth are exposed only for trusted assembly/diagnostics, never directly to IPC/UI. */
export function createSessionRuntime({store,rootDER,clock,now,manifest,policy,controller_id,service_instance_id=random(),metrics,verification='scoped',deviceProfile=null}){
 requireThat(['full','scoped'].includes(verification),'verification_strategy');if(verification==='scoped')requireThat(typeof store.withReadView==='function','binding_view_required');
 id(controller_id);id(service_instance_id);const pending=new Map(),sessions=new Map(),generations=new Map(),history=new Map();let auth,guard,closed=false,mode='running',lastMono=clock.now(),tickets=new WeakMap(),admissions=new WeakMap();bounded(lastMono,0,Number.MAX_SAFE_INTEGER);
 if(deviceProfile){keys(deviceProfile,['capabilities','target','decodeLease']);requireThat(Object.keys(deviceProfile).length===3&&Object.values(deviceProfile).every(v=>typeof v==='function'),'invalid_device_profile');deviceProfile=Object.freeze({...deviceProfile});}
 const registry=new Registry({store,clock,manifest,...(deviceProfile?{validateCapabilities:deviceProfile.capabilities,validateTarget:deviceProfile.target}:{}),verifyPeer:(...args)=>auth.verifyPeer(...args)});
 const active=()=>requireThat(!closed,'closed');
 function generation(device){requireThat(generations.has(device)||generations.size<64,'capacity_exceeded');const g=increment(generations.get(device)??'0');generations.set(device,g);return g;}
 function cancel(t){t.controller.abort();t.entry.tasks.delete(t.ticket);tickets.delete(t.ticket);}
 function clearPending(device){for(const [socket,p] of pending)if(device===undefined||p.context.device_id===device){admissions.delete(p.admission);pending.delete(socket);socket.destroy();}}
 function invalidate(context,fromAuth=false){const e=sessions.get(context.device_id);if(!e||!same(e.context,context))return false;sessions.delete(context.device_id);generation(context.device_id);clearPending(context.device_id);const actual=registry.lastActual(context);if(actual)history.set(context.device_id,{action_id:actual.action_id,context:clone(context),current:false});for(const task of e.tasks.values())cancel(task);guard.invalidate(context.device_id);registry.invalidate(context);if(!fromAuth)auth.revoke(context.device_id);return true;}
 function halt(){mode='suspended';clearPending();for(const e of [...sessions.values()])invalidate(e.context);}
 function mono(){active();const t=clock.now();if(!Number.isSafeInteger(t)||t<0){halt();requireThat(false,'clock_invalid');}if(t<lastMono){halt();requireThat(false,'clock_regressed');}lastMono=t;return t;}
 function running(){active();requireThat(mode==='running','session_suspended');return mono();}
 function expire(){const t=mono();for(const [socket,p] of pending)if(t>=p.at+5000){admissions.delete(p.admission);pending.delete(socket);socket.destroy();}for(const e of sessions.values())for(const task of e.tasks.values())if(t>=task.deadline)cancel(task);}
 function currentWork(socket){running();const context=auth.assertCurrent(socket),e=sessions.get(context.device_id);requireThat(e&&e.socket===socket&&same(e.context,context)&&e.generation===generations.get(context.device_id)&&store.isAdmitted(context.device_id),'stale_session');return e;}
 function current(socket){return metrics?metrics.measure('session_check',()=>currentWork(socket)):currentWork(socket);}
 auth=createMTLSPeerAuth({rootDER,now,controller_id,service_instance_id,metrics,cacheCertificates:verification==='scoped',...(deviceProfile?{decodeReceipt:deviceProfile.decodeLease}:{}),lookupByFingerprint:fp=>store.lookupByFingerprint(fp),onInvalidate:context=>invalidate(context,true),verifySessionAdmission(ticket,socket,context){const e=admissions.get(ticket);if(!e||e.socket!==socket||!same(e.context,context)||e.generation!==generations.get(context.device_id))return false;admissions.delete(ticket);return true;}});
 guard=createLeaseGuard({registry,clock,policy,verifyResponse:(...args)=>auth.verifyResponse(...args)});
 const api={
  registry,guard,auth,
  begin(socket,input){const t=running();limited(input);keys(input,['protocol','type','boot_id','capabilities']);requireThat(input.protocol==='hub-device/1'&&input.type==='hello.begin','unsupported_protocol');id(input.boot_id);const caps=(deviceProfile?.capabilities??capabilities)(input.capabilities);expire();const b=auth.identify(socket);requireThat(b.controller_id===controller_id,'stale_service');requireThat(!sessions.has(b.device_id),'session_busy');const old=pending.get(socket);if(old){requireThat(same(old.input,input)&&same(old.binding,b),'stale_hello');return clone(old.challenge);}
   requireThat(pending.size<32&&!([...pending.values()].some(p=>p.context.device_id===b.device_id)),'capacity_exceeded');const context={device_id:b.device_id,binding_id:b.binding_id,binding_epoch:b.binding_epoch,boot_id:input.boot_id,session_id:random(),controller_id,service_instance_id},challenge={protocol:'hub-device/1',type:'hello.challenge',challenge_id:random(),context};const admission=Object.freeze({session_admission:true}),g=generation(b.device_id);admissions.set(admission,{socket,context:clone(context),generation:g});pending.set(socket,{at:t,context,binding:clone(b),input:clone(input),caps,challenge,generation:g,admission});socket.once('close',()=>{const p=pending.get(socket);if(p)admissions.delete(p.admission);pending.delete(socket);const e=sessions.get(b.device_id);if(e?.socket===socket)invalidate(e.context);});return clone(challenge);
  },
  confirm(socket,input){const t=running();limited(input);keys(input,['protocol','type','challenge_id','context']);requireThat(input.protocol==='hub-device/1'&&input.type==='hello.confirm','unsupported_protocol');id(input.challenge_id);const existing=[...sessions.values()].find(e=>e.socket===socket);if(existing){current(socket);requireThat(input.challenge_id===existing.challenge_id&&same(input.context,existing.context),'stale_hello');return {protocol:'hub-device/1',type:'hello.ready',context:clone(existing.context)};}
   const p=pending.get(socket);requireThat(p&&t<p.at+5000&&p.generation===generations.get(p.context.device_id),'challenge_expired');requireThat(p.challenge.challenge_id===input.challenge_id&&same(p.context,input.context),'stale_hello');requireThat(same(auth.identify(socket),p.binding)&&store.isAdmitted(p.context.device_id),'stale_credential');pending.delete(socket);
   try{const proof=auth.establish(socket,p.context,p.admission);registry.connect({protocol:'hub-device/1',device_id:p.context.device_id,binding_id:p.context.binding_id,binding_epoch:p.context.binding_epoch,boot_id:p.context.boot_id,session_id:p.context.session_id,capabilities:p.caps},proof);sessions.set(p.context.device_id,{socket,context:p.context,generation:p.generation,challenge_id:p.challenge.challenge_id,tasks:new Map()});}catch(error){admissions.delete(p.admission);auth.revoke(p.context.device_id);throw error;}return {protocol:'hub-device/1',type:'hello.ready',context:clone(p.context)};
  },
  assertCurrent(socket){return clone(current(socket).context);},
  beginLease(socket,input){const e=current(socket);return guard.begin(e.context,input);},
  accept(socket,bytes){const e=current(socket),v=auth.attest(socket,bytes),observation=guard.accept(e.context,v.packet,v.proof);return {...v,observation};},
  expect(socket,command){guard.expect(current(socket).context,command);},
  track(socket,{timeout_ms=30000}={}){const e=current(socket);expire();bounded(timeout_ms,1,30000);requireThat(e.tasks.size<8,'capacity_exceeded');const ticket=Object.freeze({session_task:true}),controller=new AbortController(),task={ticket,controller,entry:e,deadline:mono()+timeout_ms};bounded(task.deadline,0,Number.MAX_SAFE_INTEGER);e.tasks.set(ticket,task);tickets.set(ticket,task);return {ticket,signal:controller.signal};},
  complete(ticket,report){const task=tickets.get(ticket);requireThat(task,'stale_task');try{const e=current(task.entry.socket);requireThat(e===task.entry&&!task.controller.signal.aborted&&mono()<task.deadline,'stale_task');return registry.report(e.context,report);}finally{cancel(task);}},
  cancel(ticket){const task=tickets.get(ticket);if(task)cancel(task);},
  /** Caller-owned transport teardown: discard only this socket's challenge/session, no metadata write. */
  discard(socket){active();const p=pending.get(socket);if(p){admissions.delete(p.admission);pending.delete(socket);}for(const e of sessions.values())if(e.socket===socket){invalidate(e.context);break;}},
  invalidate,
  revoke({device_id,expected_revision,operation_id}){active();id(operation_id);uint64(expected_revision);requireThat(!store.resources().uncertain,'storage_commit_unknown');const data=store.read(),record=store.record(device_id);if(record.state==='pending_revocation'&&record.operation_id===operation_id)return {revision:data.revision,state:'pending_revocation'};requireThat(data.revision===expected_revision,'revision_conflict');store.freeze(device_id);clearPending(device_id);const e=sessions.get(device_id);if(e)invalidate(e.context);const result=store.revoke(expected_revision,device_id,operation_id);return {revision:result.revision,state:'pending_revocation'};},
  rotate({device_id,expected_revision,certificate_sha256}){active();digest(certificate_sha256);uint64(expected_revision);requireThat(store.read().revision===expected_revision,'revision_conflict');store.freeze(device_id);clearPending(device_id);const e=sessions.get(device_id);if(e)invalidate(e.context);const result=store.rotate(expected_revision,device_id,certificate_sha256);store.unfreeze(device_id);return {revision:result.revision,credential_epoch:result.bindings[device_id].credential_epoch};},
  suspend(){active();halt();},
  resume(){active();requireThat(mode==='suspended','invalid_resume');const wall=now();requireThat(Number.isSafeInteger(wall)&&wall>=0,'untrusted_time');mono();mode='running';},
  expire,
  snapshot(){active();return {mode,devices:registry.summary().devices.map(r=>({...r,last_observed:clone(history.get(r.device_id)??null)}))};},
  resources(){return {closed,mode,pending:pending.size,sessions:sessions.size,tasks:[...sessions.values()].reduce((n,e)=>n+e.tasks.size,0)};},
  close(){if(closed)return;halt();auth.close();guard.close();history.clear();generations.clear();tickets=new WeakMap();admissions=new WeakMap();closed=true;}
 };
 if(verification==='scoped')for(const name of ['begin','confirm','assertCurrent','beginLease','accept','expect','track','complete','snapshot']){const work=api[name];api[name]=(...args)=>store.withReadView(()=>work(...args));}
 return api;
}
