import {clone,same,uint64,increment,bounded,requireThat as need} from '../core/protocol.mjs';
import {DEVICE_WIRE_PROFILE,deviceWireContract,decodeDeviceWire,encodeDeviceWire,createDeviceWireLedger,deviceWireError,classifyDeviceWireRequest} from '../core/round-pet-wire.mjs';
import {roundPetCanonical} from '../core/round-pet-identity.mjs';
import {PullControlQueue} from '../core/round-pet-pull.mjs';
import {RoundPetObservations} from '../core/round-pet-observations.mjs';
import {observationTarget} from '../core/round-pet-observation-schema.mjs';
import {FIRST_WINDOW_PROFILE,authorizeFirstWindow} from '../core/round-pet-first-window.mjs';
import {createRoundPetReadLane} from './round-pet-read-lane.mjs';
import {writeAssetRange} from './asset-stream.mjs';
import {createRoundPetImport} from './round-pet-import.mjs';
import {createRoundPetReader} from './round-pet-reader.mjs';
const versions=Object.fromEntries(Object.entries(deviceWireContract().defs.versions.fields).map(([k,v])=>[k,v.const]));
const envelope=(v,type,context,payload)=>({protocol:'hub-device/1',profile:DEVICE_WIRE_PROFILE,schema_version:1,type,request_id:v.request_id,request_seq:v.request_seq,context:clone(context),payload});
/** Internal, explicitly enabled temporary host adapter. Creates no socket/listener or background source.
 * Borrows sessions/readView/rootAuthority; owns A2 import/reader, A3 projection and this session's queue.
 * ready rejects on import failure. disable/close fence first, then wait for actual HTTP exit.
 * No production entry, automatic retry, physical credential provisioning or package self-approval. */
export function createRoundPetWireReview(directory,{material,sessions,readView,rootAuthority,clock,caps,executionProfile=FIRST_WINDOW_PROFILE,ackMs=4000,readBudget=null}){
 need([FIRST_WINDOW_PROFILE,'full-offline-review/1'].includes(executionProfile),'unsupported_execution_profile');
 need(sessions&&typeof readView==='function'&&rootAuthority&&clock,'review_dependencies');bounded(ackMs,1,30000);
 const catalog=createRoundPetImport(directory,material);let reader,readLane,bundle,packageRef,model,closed=false,enabled=false,phase='validating',error=null,entry=null,hello=null,ledger=null,queue=new PullControlQueue(clock),grant=null,horizon=0,target=null,authorized=false,storageBlocked=true,sequence='0',revision='0',lastMono=0,closing;
 const proofs=new WeakMap(),http=new Set(),idle=new Set();
 function now(){const n=clock.now();bounded(n,0,Number.MAX_SAFE_INTEGER);need(n>=lastMono,'clock_regressed');lastMono=n;return n;}
 function requireEnabled(){need(!closed&&enabled&&phase==='review','review_disabled');}
 function current(socket){requireEnabled();need(entry?.socket===socket&&same(entry.context,sessions.assertCurrent(socket)),'stale_session');return entry.context;}
 function controls(context,control){return !!entry&&same(context,entry.context)&&same(sessions.assertCurrent(entry.socket),context)&&same(grant,control)&&now()<horizon;}
 function fence(code){error=code;readLane?.invalidate();ledger?.close();ledger=null;queue.close();grant=null;target=null;authorized=false;storageBlocked=true;if(entry){try{model?.disconnect(entry.context);}finally{sessions.invalidate(entry.context);}}else if(hello)sessions.discard(hello.socket);entry=null;hello=null;}
 function scoped(work){try{return readView(work);}catch(e){fence(e.code??'adapter_failed');throw e;}}
 function active(){requireEnabled();need(entry&&ledger,'stale_session');current(entry.socket);queue.expire();return now();}
 function next(){sequence=increment(sequence);return sequence;}
 function admit(kind,t){const inventory=model.inventoryState();need(inventory.known,'inventory_unconfirmed');if(executionProfile===FIRST_WINDOW_PROFILE)authorizeFirstWindow(kind,t,inventory,bundle.manifests[0]);need(inventory.root_state==='OFFLINE_READY'||t.action_id===0||(inventory.root_state==='IDLE_READY'&&t.action_id===4),'unsafe_cache_write');}
 const ready=(async()=>{try{bundle=await catalog.ready;need(!closed,'closed');packageRef={namespace:bundle.identity.namespace,firmware_package_sha256:bundle.identity.firmware_package_sha256,hub_manifest_sha256:bundle.identity.hub_manifest_sha256};reader=createRoundPetReader(directory,bundle);readLane=createRoundPetReadLane({clock,manifest:bundle.manifests[0],packageRef,readBudget,readAsset:(...args)=>reader.read(...args),state(socket=entry?.socket){active();current(socket);const wire=model.wireSnapshot();return {context:entry.context,target,control:grant,horizon,busy:queue.hasWork(),valid:controls(entry.context,grant),authorized:executionProfile==='full-offline-review/1'&&authorized&&(!wire.maintenance||wire.maintenance.phase==='none'||(wire.maintenance.phase==='loading'&&model.snapshot().devices[0]?.playback?.phase==='downloading'))&&(!wire.touch||wire.touch.phase==='ended')};}});phase='disabled';return clone(packageRef);}catch(e){phase=closed?'closed':'failed';error=e.code??'import_failed';throw e;}})();ready.catch(()=>{});
 function observe(context,record){const proof=Object.freeze({wire_observation:true});proofs.set(proof,{context:clone(context),record:clone(record)});if(['storage.report','inventory.snapshot'].includes(record.type))return model.prepareIngestWire(context,record,proof);need(model.ingestWire(context,record,proof)!==false,'stale_observation');return null;}
 function dispatch(socket){const job=queue.take(ackMs);if(!job)return null;let p=job.payload;
  if(job.kind.startsWith('lease.')){const kind=job.kind.slice(6);if(kind==='renew')need(controls(entry.context,grant),'lease_expired');const r=sessions.beginLease(socket,{request_id:job.dispatch_id,kind,expected_epoch:kind==='acquire'?p.expected_epoch:grant.control_epoch,...(kind==='renew'?{lease_id:grant.lease_id}:{})});p={request_id:r.request_id,request_seq:r.request_seq,expected_epoch:r.expected_epoch,lease_id:r.lease_id??null,lease_ms:15000};}
  else if(job.kind==='playback.set'){admit(job.kind,p.target);need(controls(entry.context,grant),'lease_expired');sessions.expect(socket,p.target);model.sent(entry.context,p.target,grant);target=clone(p.target);authorized=false;const a=bundle.manifests[0].actions.find(a=>a.id===target.action_id);p={target,control:clone(grant),package_ref:clone(packageRef),asset_descriptor:{bytes:a.bytes,width:360,height:360,fps:24,frames:241,codec_flag:1,key_interval:12,tile_rows:20},mode:'base_loop'};}
  else if(job.kind==='storage.save'){admit(job.kind,p.target);need(!storageBlocked,'storage_outcome_unknown');need(controls(entry.context,grant)&&authorized&&same(p.target,target),'lease_expired');model.expectSave(entry.context,p.operation_id,p.target);}
  else if(job.kind==='playback.cancel')need(controls(entry.context,p.control),'lease_expired');
  else if(job.kind.startsWith('query.'))p={query_id:model.query(entry.context,job.kind.slice(6))};
  queue.payload(job.dispatch_id,p);return {...job,payload:p,deadline:undefined};
 }
 const api={ready,
  async enableReview(){await ready;need(!closed,'closed');need(http.size===0,'http_busy');need(!reader.resources().invalidated,'repository_revalidation_required');enabled=true;phase='review';error=null;},
  async disableReview(){enabled=false;phase='disabled';fence('review_disabled');await api.waitForIdle();},
  hello(socket,bytes){return scoped(()=>{requireEnabled();const v=decodeDeviceWire(bytes);need(['hello.begin','hello.confirm'].includes(v.type),'invalid_message');need(same(v.payload.versions,versions)&&same(v.payload.package_ref,packageRef),'unsupported_profile');
   if(v.type==='hello.begin'){need(!readLane.resources().reads,'http_busy');need(!entry&&!hello,'stale_hello');const c=sessions.begin(socket,{protocol:'hub-device/1',type:'hello.begin',boot_id:v.payload.boot_id,capabilities:v.payload.capabilities});hello={socket,context:c.context,challenge_id:c.challenge_id,request_seq:v.request_seq};socket.once('close',()=>{if(entry?.socket===socket||hello?.socket===socket)fence('transport_closed');});return encodeDeviceWire(envelope(v,'hello.challenge',c.context,{challenge_id:c.challenge_id,versions,package_ref:packageRef,execution_profile:executionProfile}));}
   need(hello?.socket===socket&&same(v.context,hello.context)&&v.payload.challenge_id===hello.challenge_id&&uint64(v.request_seq)>uint64(hello.request_seq),'stale_hello');
   const r=sessions.confirm(socket,{protocol:'hub-device/1',type:'hello.confirm',context:v.context,challenge_id:v.payload.challenge_id});entry={socket,context:clone(r.context)};hello=null;queue=new PullControlQueue(clock);ledger=createDeviceWireLedger({context:r.context,packageRef,initialRequestSeq:v.request_seq});grant=null;horizon=0;target=null;authorized=false;storageBlocked=true;
   model?.close();model=new RoundPetObservations({caps,manifest:bundle.manifests[0],packageRef,clock,rootCheckpoint:rootAuthority.checkpoint(r.context.device_id),sessionCurrent:c=>!!entry&&same(c,entry.context)&&same(sessions.assertCurrent(entry.socket),c),controlCurrent:controls,verifyObservation:(proof,payload)=>same(proofs.get(proof),payload)});model.openWire(r.context,versions);queue.put('query.inventory',{},now()+ackMs);
   return encodeDeviceWire(envelope(v,'hello.ready',r.context,{versions,package_ref:packageRef,execution_profile:executionProfile}));
  });},
  exchange(socket,bytes){let prepared=null,rootRevision,ack=null;try{
   const request=readView(()=>{active();const context=current(socket),v=decodeDeviceWire(bytes);ledger.receiveRequest(v);const o=v.payload.observation,r=o?.record,pending=queue.pending();
    if(r){if(o.dispatch_id!==null){need(pending&&o.dispatch_id===pending.dispatch_id,'stale_dispatch');ack=pending.dispatch_id;}
     if(r.type==='lease.granted'){need(ack&&pending.kind.startsWith('lease.'),'stale_dispatch');const result=sessions.accept(socket,new TextEncoder().encode(roundPetCanonical(r)));grant=clone(result.packet.grant);horizon=result.observation.sent_at+result.observation.lease_ms;}
     else if(r.type==='control.receipt'){need(ack&&pending.kind==='binding.revoke','stale_dispatch');need(false,'stale_binding');}
     else{if(['storage.report','inventory.snapshot'].includes(r.type))rootRevision=rootAuthority.prepare(context);prepared=observe(context,r);
      if(r.type==='playback.report'&&same(r.target,target)){if(r.phase==='accepted')authorized=r.admission==='ready';if(['failed','cancelled','ended'].includes(r.phase))authorized=false;}
     }
    }return v;
   });
   if(prepared){need(prepared.accepted!==false,'stale_observation');rootAuthority.commit(rootRevision,prepared.checkpoint);readView(()=>{current(socket);model.commitPrepared(prepared.ticket);});prepared=null;}
   return scoped(()=>{const r=request.payload.observation?.record;if(r?.type==='storage.report'&&r.status==='outcome_unknown')storageBlocked=true;if(r?.type==='inventory.snapshot')storageBlocked=!r.known;if(r?.type==='cancel.report'&&r.effect==='outcome_unknown')storageBlocked=true;
    if(ack)queue.ack(ack);const control=dispatch(socket);if(control)delete control.deadline;const out=envelope(request,'exchange.response',entry.context,{control,read_permit:control?null:readLane.issue({request_id:request.request_id,request_seq:request.request_seq}),poll_after_ms:control||r?0:500});ledger.receiveResponse(out);return encodeDeviceWire(out);
   });
  }catch(e){if(prepared)model.discardPrepared(prepared.ticket);fence(e.code??'adapter_failed');throw e;}},
  lease(kind,deadline,expectedEpoch='0'){return scoped(()=>{active();need(['acquire','renew'].includes(kind),'invalid_message');uint64(expectedEpoch);return queue.put('lease.'+kind,{expected_epoch:expectedEpoch},deadline);});},
  manual(actionId,deadline){return readView(()=>{active();queue.check(deadline);const m=bundle.manifests[0],a=m.actions.find(a=>a.id===actionId);need(a,'incompatible_asset');const rev=increment(revision),t={command_id:`wire_${rev}`,revision:rev,character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id:a.id,asset_sha256:a.sha256};observationTarget(t,m,caps);admit('playback.set',t);model.request(entry.context,t);queue.put('playback.set',{target:t},deadline);revision=rev;authorized=false;readLane.invalidate();return clone(t);});},
  save(deadline,{victim_action_id=null}={}){return readView(()=>{active();need(!storageBlocked,'storage_outcome_unknown');need(target&&authorized&&controls(entry.context,grant),'playback_unverified');admit('storage.save',target);const v=model.snapshot().devices[0];need(v.playback?.is_current&&['verified','playing'].includes(v.playback.phase),'playback_unverified');need(v.inventory.actions.find(a=>a.action_id===target.action_id)?.offline_available===false||executionProfile==='full-offline-review/1','already_available');const inv=model.inventoryState();if(victim_action_id!==null)need(![0,4,target.action_id].includes(victim_action_id)&&inv.active.some(a=>a.action_id===victim_action_id),'unsafe_cache_write');need(inv.active.length<4||inv.active.some(a=>a.action_id===target.action_id)||victim_action_id!==null,'unsafe_cache_write');const p={operation_id:`save_${next()}`,target:clone(target),package_ref:clone(packageRef),victim_action_id};queue.put('storage.save',p,deadline);return clone(p);});},
  cancel(deadline){return scoped(()=>{active();need(target&&grant,'stale_revision');const p={operation_id:`cancel_${next()}`,target:clone(target),control:clone(grant)};queue.put('playback.cancel',p,deadline);model.fenceTarget(entry.context,target);authorized=false;readLane.invalidate();return clone(p);});},
  query(kind,deadline){return scoped(()=>{active();need(['inventory','display'].includes(kind),'invalid_message');return queue.put('query.'+kind,{},deadline);});},
  beginRead:(socket,headers)=>scoped(()=>readLane.begin(socket,headers)),
  readTimeout:ticket=>readLane.timeout(ticket),
  readSignal:ticket=>readLane.signal(ticket),
  readIdentity:ticket=>scoped(()=>readLane.identity(ticket)),
  page(ticket,sha,offset,limit){return scoped(()=>{need(sha===packageRef.hub_manifest_sha256,'unapproved_package');const identity=readLane.identity(ticket),actions=readLane.page(ticket,offset,limit).map(a=>({action_id:a.id,asset_sha256:a.sha256,asset_descriptor:{bytes:a.bytes,width:360,height:360,fps:24,frames:241,codec_flag:1,key_interval:12,tile_rows:20}})),end=offset+actions.length;return encodeDeviceWire(envelope(identity.correlation,'manifest.page',identity.context,{package_ref:packageRef,offset,total_actions:46,next_offset:end===46?null:end,actions}));});},
  range:(ticket,headers,hash)=>scoped(()=>readLane.range(ticket,headers,hash)),
  chunk:(ticket,range,offset,length)=>scoped(()=>readLane.chunk(ticket,range,offset,length)),
  endRead:ticket=>readLane.end(ticket),
  snapshot(){return readView(()=>({profile:'temporary-wire-review/1',enabled,phase,production_listener:false,error,storage_blocked:storageBlocked,observation:model?.snapshot()??null,wire:model?.wireSnapshot()??null}));},
  enterHTTP(){need(!closed&&http.size===0,'http_busy');const ticket=Object.freeze({wire_http:true});http.add(ticket);return ticket;},
  leaveHTTP(ticket){http.delete(ticket);if(!http.size){for(const resolve of idle)resolve();idle.clear();}},
  waitForIdle:()=>http.size?new Promise(resolve=>idle.add(resolve)):Promise.resolve(),
  fail:code=>fence(code),resources:()=>({closed,enabled,phase,http:http.size,session:entry?1:0,hello:hello?1:0,queue:queue.resources(),ledger:ledger?.snapshot()??null,reader:reader?.resources()??null,read:readLane?.resources()??null,catalog_phase:catalog.snapshot().phase}),
  close(){if(closing)return closing;enabled=false;closed=true;fence('review_closed');phase='closed';closing=(async()=>{try{await ready;}catch{}await api.waitForIdle();model?.close();await reader?.close();await catalog.close();})();return closing;}
 };return api;
}
/** Explicitly mounted ONLY on caller-owned disposable loopback mTLS; no listener is created here. */
export function createWireReviewHandler(adapter,{requestMs=2000,beforeChunk=async()=>{}}={}){
 bounded(requestMs,1,30000);need(typeof beforeChunk==='function');return async(req,res)=>{let ticket,readTicket,packet=null,timer=setTimeout(()=>req.destroy(),requestMs);const done=new Promise(resolve=>res.once('close',resolve));
 try{need(req.socket.localAddress==='127.0.0.1'&&req.socket.remoteAddress==='127.0.0.1','authentication_failed');need(adapter.resources().enabled,'review_disabled');ticket=adapter.enterHTTP();
  const headBytes=Buffer.byteLength(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`)+req.rawHeaders.reduce((n,h)=>n+Buffer.byteLength(h)+2,2);need(headBytes<=8192,'message_too_large');need(!req.headers['content-encoding']&&!req.headers['transfer-encoding'],'unsupported_encoding');
  if(req.method==='POST'){
   const route=classifyDeviceWireRequest({method:req.method,path:req.url});need(['hello','exchange'].includes(route.kind),'invalid_message');need(req.headers['content-type']==='application/json','unsupported_encoding');const rawLength=req.headers['content-length'];need(/^[1-9][0-9]{0,3}$/.test(rawLength??'')&&Number(rawLength)<=4096,'message_too_large');let n=0;const parts=[];for await(const b of req){n+=b.length;need(n<=4096,'message_too_large');parts.push(b);}need(n===Number(rawLength),'invalid_message');const bytes=Buffer.concat(parts);packet=decodeDeviceWire(bytes);const out=route.kind==='hello'?adapter.hello(req.socket,bytes):adapter.exchange(req.socket,bytes);send(200,out);return;
  }
  need(req.method==='GET'&&[undefined,'0'].includes(req.headers['content-length']),'invalid_message');const route=classifyDeviceWireRequest({method:req.method,path:req.url,range:req.headers.range??null});readTicket=adapter.beginRead(req.socket,req.headers);clearTimeout(timer);timer=setTimeout(()=>req.destroy(),Math.min(requestMs,adapter.readTimeout(readTicket)));
  const identity=adapter.readIdentity(readTicket),correlation={'x-round-pet-read':identity.id,'x-round-pet-request-id':identity.correlation.request_id,'x-round-pet-request-seq':identity.correlation.request_seq};
  if(route.kind==='manifest'){send(200,adapter.page(readTicket,route.sha256,route.offset,route.limit),correlation);return;}
  need(route.kind==='asset','invalid_message');const range=adapter.range(readTicket,req.headers,route.sha256);res.writeHead(206,{'content-length':range.length,'content-range':`bytes ${range.start}-${range.end}/${range.total}`,etag:range.etag,...correlation});
  await writeAssetRange({res,range,chunk:(offset,length)=>adapter.chunk(readTicket,range,offset,length),beforeChunk:offset=>beforeChunk({offset,req,res,signal:adapter.readSignal(readTicket)})});
 }catch(e){adapter.fail(e.code??'invalid_message');if(!res.destroyed){if(res.headersSent)res.destroy();else{const code=Object.hasOwn(deviceWireContract().errors,e.code)?e.code:e.code==='review_disabled'?'temporarily_unavailable':'invalid_message',policy=deviceWireError(code);send(policy.http,encodeDeviceWire(envelope(packet??{request_id:null,request_seq:null},'error',packet?.context??null,{code})));}}}
 finally{await done;clearTimeout(timer);if(readTicket)adapter.endRead(readTicket);if(ticket)adapter.leaveHTTP(ticket);}
 function send(status,bytes,headers={}){res.writeHead(status,{'content-type':'application/json','content-length':bytes.length,...headers});res.end(bytes);}
 };}
