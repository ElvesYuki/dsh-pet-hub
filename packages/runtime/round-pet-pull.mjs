import {createRoundPetReadLane} from './round-pet-read-lane.mjs';
import {writeAssetRange} from './asset-stream.mjs';
import {PullControlQueue,PULL_PROFILE,decodePullMessage,encodePullMessage} from '../core/round-pet-pull.mjs';
import {RoundPetObservations} from '../core/round-pet-observations.mjs';
import {observationTarget,observationRecord,observationKeys as exact} from '../core/round-pet-observation-schema.mjs';
import {clone,same,requireThat as need,uint64,increment,bounded} from '../core/protocol.mjs';
import {parseRoundPetJson} from '../core/round-pet-identity.mjs';
/** Explicit single-device candidate owner. Does not listen or modify a running service.
 * sessions/store/readAsset are trusted adapters; readView is synchronous and never spans await.
 * Every authenticated observation proof is minted only for this socket/record/context. */
export function createRoundPetPull({sessions,readView,clock,caps,manifest,packageRef,readAsset,readBudget=null,ackMs=4000,leaseMs=15000,onOpen,authorizeOperation,rootCheckpoint=null,rootAuthority=null,metrics}){
 need(typeof readView==='function'&&typeof readAsset==='function');bounded(ackMs,1,30000);bounded(leaseMs,1,30000);
 for(const hook of [onOpen,authorizeOperation])need(hook===undefined||typeof hook==='function');
 caps=clone(caps);manifest=clone(manifest);packageRef=clone(packageRef);readBudget=clone(readBudget);
 if(readBudget){exact(readBudget,['segment_ms','exchange_ms','cleanup_ms','margin_ms']);for(const value of Object.values(readBudget))bounded(value,1,30000);}
 let entry=null,queue=new PullControlQueue(clock),closed=false,blocked=false,storageBlocked=false,lastTime=0,sequence='0',lastRequest='0',activeTarget=null,authorized=false,grant=null,horizon=0,lastOutcome=null,lastError=null,observationOpened=false,preparedRoot=null;
 const receipts=new WeakMap(),http=new Set(),idle=new Set();
 function now(){const t=clock.now();bounded(t,0,Number.MAX_SAFE_INTEGER);need(t>=lastTime,'clock_regressed');lastTime=t;return t;}
 function active(){need(!closed&&!blocked&&entry,'pull_blocked');queue.expire();return now();}
 function current(socket){active();need(socket===entry.socket&&same(sessions.assertCurrent(socket),entry.context),'stale_session');return entry.context;}
 function controlCurrent(context,control){return !!entry&&same(context,entry.context)&&same(sessions.assertCurrent(entry.socket),context)&&!!grant&&same(grant,control)&&now()<horizon;}
 const observations=new RoundPetObservations({caps,manifest,packageRef,clock,rootCheckpoint,sessionCurrent:context=>!!entry&&same(context,entry.context)&&same(sessions.assertCurrent(entry.socket),context),controlCurrent,verifyObservation:(proof,payload)=>{const e=receipts.get(proof);return !!e&&same(e,payload)&&!!entry&&same(sessions.assertCurrent(entry.socket),payload.context);}});
 function fault(code){if(preparedRoot){observations.discardPrepared(preparedRoot.ticket);preparedRoot=null;}if(blocked||closed)return;blocked=true;lastError=code;const p=queue.pending();if(p){lastOutcome={kind:p.kind,status:'outcome_unknown'};if(p.kind==='storage.save')storageBlocked=true;}readLane.invalidate();authorized=false;queue.close();if(entry){try{if(observationOpened)observations.disconnect(entry.context);}finally{sessions.invalidate(entry.context);}}return code;}
 function scoped(work){try{return readView(work);}catch(error){if(!['queue_full','inventory_unconfirmed','unsafe_cache_write','playback_unverified','already_available','storage_outcome_unknown','invalid_message','incompatible_asset','stale_revision','idempotency_conflict'].includes(error.code))fault(error.code??'pull_failed');throw error;}}
 function hook(fn,...args){if(!fn)return;const value=fn(...args);if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});need(false,'async_pull_hook');}}
 function authorityCall(fn,...args){const value=fn(...args);if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});need(false,'async_root_authority');}return value;}
 function next(){sequence=increment(sequence);return sequence;}
 function enqueue(kind,payload,deadline){active();queue.check(deadline);return queue.put(kind,payload,deadline);}
 function observe(socket,record){observationRecord(record,manifest,caps);const payload={context:clone(current(socket)),record:clone(record)},proof=Object.freeze({pull_observation:true});receipts.set(proof,payload);if(rootAuthority&&['inventory.snapshot','storage.report'].includes(record.type)){const revision=authorityCall(rootAuthority.prepare,payload.context),prepared=metrics?metrics.measure('root_prepare',()=>observations.prepareIngest(payload.context,record,proof)):observations.prepareIngest(payload.context,record,proof);preparedRoot={...prepared,revision};return prepared.accepted;}return observations.ingest(payload.context,record,proof);}
 function receive(socket,o){
  if(!o)return;const p=queue.pending();if(o.dispatch_id!==null)need(p&&o.dispatch_id===p.dispatch_id,'stale_dispatch');
  if(o.kind==='lease'){
   need(p?.kind.startsWith('lease.'),'stale_dispatch');const raw=Buffer.from(o.wire,'base64');need(raw.toString('base64')===o.wire,'invalid_pull_receipt');const accepted=sessions.accept(socket,raw);need(accepted.packet.request_id===p.payload.request_id&&accepted.packet.request_seq===p.payload.request_seq&&accepted.packet.kind===p.payload.kind,'stale_dispatch');grant=clone(accepted.packet.grant);horizon=accepted.observation.sent_at+accepted.observation.lease_ms;queue.ack(p.dispatch_id);
  }else if(o.kind==='record'){
   if(p&&o.dispatch_id!==null){const type=p.kind==='playback.set'?'playback.report':p.kind==='storage.save'?'storage.report':p.kind==='query.display'?'display.report':p.kind==='query.inventory'?'inventory.snapshot':null;need(o.record.type===type,'stale_dispatch');
    if(p.kind==='playback.set')need(same(o.record.target,p.payload.target)&&['accepted','failed','cancelled'].includes(o.record.phase),'stale_dispatch');
    if(p.kind==='storage.save')need(o.record.operation_id===p.payload.operation_id,'stale_dispatch');
    if(p.kind.startsWith('query.'))need(o.record.query_id===p.payload.query_id,'stale_query');
   }
   const desired=observations.snapshot().devices[0]?.desired,superseded=p?.kind==='playback.set'&&o.dispatch_id!==null&&desired?.revision!==p.payload.target.revision;
   if(superseded){observationRecord(o.record,manifest,caps);need(same(o.record.package_ref,packageRef)&&same(o.record.control,grant),'stale_dispatch');}
   else need(observe(socket,o.record)!==false,'stale_observation');
   if(o.record.type==='storage.report'&&o.record.status==='outcome_unknown'){if(preparedRoot)preparedRoot.storageBlocked=true;else storageBlocked=true;}
   if(o.record.type==='inventory.snapshot'&&o.record.known===true){if(preparedRoot)preparedRoot.storageBlocked=false;else storageBlocked=false;}
   if(p&&o.dispatch_id!==null){if(p.kind==='playback.set')authorized=!superseded&&o.record.phase==='accepted';if(preparedRoot)preparedRoot.ack=p.dispatch_id;else queue.ack(p.dispatch_id);}
  }else{
   need(p&&['playback.cancel','binding.revoke'].includes(p.kind),'stale_dispatch');queue.ack(p.dispatch_id);authorized=false;readLane.invalidate();if(p.kind==='binding.revoke')fault('revoke_acknowledged');
  }
 }
 function dispatch(socket){
  const job=queue.take(ackMs);if(!job)return null;let payload=job.payload;if(['playback.set','storage.save'].includes(job.kind))hook(authorizeOperation,job.kind,clone(payload));
  if(job.kind.startsWith('lease.')){const kind=job.kind.slice(6),request=sessions.beginLease(socket,{request_id:job.dispatch_id,kind,expected_epoch:kind==='acquire'?job.payload.expected_epoch:grant.control_epoch,...(kind==='renew'?{lease_id:grant.lease_id}:{})});payload={request_id:request.request_id,request_seq:request.request_seq,kind,expected_epoch:request.expected_epoch,lease_id:request.lease_id??null,lease_ms:leaseMs};}
  else if(job.kind==='playback.set'){need(controlCurrent(entry.context,grant),'lease_expired');sessions.expect(socket,payload.target);observations.sent(entry.context,payload.target,grant);activeTarget=clone(payload.target);authorized=false;payload={target:activeTarget,control:clone(grant),package_ref:clone(packageRef)};}
  else if(job.kind==='storage.save'){need(!storageBlocked,'storage_outcome_unknown');need(controlCurrent(entry.context,grant)&&authorized&&same(payload.target,activeTarget),'lease_expired');observations.expectSave(entry.context,payload.operation_id,payload.target);}
  else if(job.kind.startsWith('query.'))payload={query_id:observations.query(entry.context,job.kind.slice(6))};
  // The pending record carries the exact on-wire payload used to correlate the next HTTP receipt.
  queue.payload(job.dispatch_id,payload);return {dispatch_id:job.dispatch_id,kind:job.kind,payload};
 }
 const readLane=createRoundPetReadLane({clock,manifest,packageRef,readAsset,readBudget,nextId:()=>`read_${next()}`,state(socket=entry?.socket,issuing=false){if(!issuing)current(socket);return {context:entry.context,target:activeTarget,control:grant,horizon,authorized,valid:(!issuing||(authorized&&!!activeTarget&&!queue.hasWork()))&&controlCurrent(entry.context,grant),busy:queue.hasWork()};}});
 const issuePermit=()=>readLane.issue();
 const api={
  observations,
  open(socket,selectedVersions){return scoped(()=>{need(!closed,'closed');const context=sessions.assertCurrent(socket);if(entry&&same(entry.context,context))return clone(context);queue.close();queue=new PullControlQueue(clock);entry={socket,context:clone(context)};observationOpened=false;blocked=false;grant=null;horizon=0;activeTarget=null;authorized=false;readLane.invalidate();lastRequest='0';lastOutcome=null;lastError=null;observations.open(context,selectedVersions);observationOpened=true;hook(onOpen,clone(context));return clone(context);});},
  lease(kind,deadline,expected_epoch='0'){return scoped(()=>{need(['acquire','renew'].includes(kind),'invalid_pull_control');uint64(expected_epoch);if(kind==='renew')need(grant&&now()<horizon,'lease_expired');const pending=queue.pending();if(pending?.kind==='lease.'+kind){need(kind==='renew'||pending.payload.expected_epoch===expected_epoch,'queue_full');return false;}return enqueue('lease.'+kind,{expected_epoch},deadline);});},
  base(target,deadline){return scoped(()=>{active();queue.check(deadline);observationTarget(target,manifest,caps);hook(authorizeOperation,'playback.set',{target:clone(target)});if(observations.request(entry.context,target)===false)return false;enqueue('playback.set',{target:clone(target)},deadline);readLane.invalidate();authorized=false;return true;});},
  save(deadline,{victim_action_id}={}){return scoped(()=>{need(!storageBlocked,'storage_outcome_unknown');need(activeTarget&&authorized,'incompatible_asset');const operation_id=`save_${next()}`,payload={operation_id,target:clone(activeTarget),package_ref:clone(packageRef),...(victim_action_id===undefined?{}:{victim_action_id})};if(victim_action_id!==undefined){bounded(victim_action_id,0,77);need(![0,4].includes(victim_action_id),'unsafe_cache_write');}hook(authorizeOperation,'storage.save',clone(payload));enqueue('storage.save',payload,deadline);return operation_id;});},
  query(kind,deadline){return scoped(()=>{need(['display','inventory'].includes(kind),'invalid_observation');return enqueue('query.'+kind,{},deadline);});},
  cancel(deadline){return scoped(()=>{need(activeTarget,'stale_revision');readLane.invalidate();authorized=false;return enqueue('playback.cancel',{operation_id:`cancel_${next()}`,command_id:activeTarget.command_id},deadline);});},
  revoke(deadline){return scoped(()=>{readLane.invalidate();authorized=false;return enqueue('binding.revoke',{operation_id:`revoke_${next()}`},deadline);});},
  exchange(socket,bytes){if(rootAuthority){const run=()=>{const v=scoped(()=>{const ctx=current(socket),packet=decodePullMessage(bytes);need(same(packet.context,ctx)&&uint64(packet.request_seq)>uint64(lastRequest),'stale_request');receive(socket,packet.observation);return packet;});if(preparedRoot){const p=preparedRoot;try{authorityCall(rootAuthority.commit,p.revision,p.checkpoint);(()=>{const publish=()=>readView(()=>{current(socket);observations.commitPrepared(p.ticket);});return metrics?metrics.measure('root_publish',publish):publish();})();if(p.ack)queue.ack(p.ack);if(p.storageBlocked!==undefined)storageBlocked=p.storageBlocked;preparedRoot=null;}catch(e){observations.discardPrepared(p.ticket);preparedRoot=null;fault(e.code??'root_commit_failed');throw e;}}return scoped(()=>{const ctx=current(socket);active();lastRequest=v.request_seq;const control=dispatch(socket),read_permit=control?null:issuePermit();return encodePullMessage({profile:PULL_PROFILE,schema_version:1,type:'exchange.response',context:clone(ctx),request_id:v.request_id,request_seq:v.request_seq,control,read_permit,poll_after_ms:control||v.observation?0:500});});};return metrics?metrics.measure('root_exchange',run):run();}return scoped(()=>{const ctx=current(socket),v=decodePullMessage(bytes);need(same(v.context,ctx)&&uint64(v.request_seq)>uint64(lastRequest),'stale_request');receive(socket,v.observation);active();lastRequest=v.request_seq;const control=dispatch(socket),read_permit=control?null:issuePermit();return encodePullMessage({profile:PULL_PROFILE,schema_version:1,type:'exchange.response',context:clone(ctx),request_id:v.request_id,request_seq:v.request_seq,control,read_permit,poll_after_ms:control||v.observation?0:500});});},
  enterHTTP(){need(!closed&&http.size===0,'http_busy');const token=Object.freeze({pull_http:true});http.add(token);return token;},
  leaveHTTP(token){http.delete(token);if(http.size===0){for(const resolve of idle)resolve();idle.clear();}},
  waitForIdle(){return http.size===0?Promise.resolve():new Promise(resolve=>idle.add(resolve));},
  beginRead(socket,headers){return scoped(()=>readLane.begin(socket,headers));},
  readTimeout:ticket=>readLane.timeout(ticket),
  page(ticket,page){return scoped(()=>{bounded(page,0,Math.ceil(manifest.actions.length/8)-1);const bytes=Buffer.from(JSON.stringify({profile:PULL_PROFILE,package_ref:packageRef,page,total_pages:Math.ceil(manifest.actions.length/8),actions:readLane.page(ticket,page*8,8)}));need(bytes.length<=4096,'pull_size');return bytes;});},
  range:(ticket,headers,hash)=>scoped(()=>readLane.range(ticket,headers,hash)),
  chunk:(ticket,range,offset,length)=>scoped(()=>readLane.chunk(ticket,range,offset,length)),
  endRead:ticket=>readLane.end(ticket),
  fail:code=>fault(code),
  resources:()=>({closed,blocked,error:lastError,storage_blocked:storageBlocked,http:http.size,...readLane.resources(),queue:queue.resources(),last_outcome:clone(lastOutcome)}),
  async close(){if(!closed){fault('pull_closed');closed=true;queue.close();observations.close();}if(http.size)await new Promise(resolve=>idle.add(resolve));readLane.invalidate();entry=null;grant=null;activeTarget=null;horizon=0;},
 };
 return api;
}

/** Candidate handler only. Caller owns a private loopback HTTPS server and shutdown of all sockets.
 * Hooks are synchronous/async fixture dependencies, never user HTTP input; no production listener. */
export function createPullHandler({pull,sessions,beforeChunk=async()=>{},requestMs=2000,metrics}){
 const supported={profile:'round-pet-native360/1',playback_version:1,display_version:1,storage_version:1,inventory_version:1},helloVersions=new WeakMap();
 return async function handler(req,res){let httpTicket,readTicket,timer=setTimeout(()=>req.destroy(),requestMs);const responseClosed=new Promise(resolve=>res.once('close',resolve));
  try{
   httpTicket=pull.enterHTTP();
   if(req.method==='POST'&&req.url==='/offline-round-pet/v1/hello'){
    const wrapper=parseRoundPetJson(await body(req));exact(wrapper,['profile','schema_version','versions','hello']);need(wrapper.profile===PULL_PROFILE&&wrapper.schema_version===1&&same(wrapper.versions,supported),'unsupported_pull_profile');const value=wrapper.hello;need(['hello.begin','hello.confirm'].includes(value?.type),'invalid_hello');
    if(value.type==='hello.begin')helloVersions.set(req.socket,clone(wrapper.versions));else need(same(helloVersions.get(req.socket),wrapper.versions),'stale_hello');
    const out=value.type==='hello.begin'?sessions.begin(req.socket,value):sessions.confirm(req.socket,value);if(value.type==='hello.confirm')pull.open(req.socket,wrapper.versions);send(res,200,Buffer.from(JSON.stringify({profile:PULL_PROFILE,schema_version:1,versions:wrapper.versions,hello:out})));return;
   }
   if(req.method==='POST'&&req.url==='/offline-round-pet/v1/exchange'){send(res,200,Buffer.from(pull.exchange(req.socket,await body(req))));return;}
   need(req.method==='GET','not_found');readTicket=pull.beginRead(req.socket,req.headers);clearTimeout(timer);timer=setTimeout(()=>req.destroy(),Math.min(requestMs,pull.readTimeout(readTicket)));
   const page=/^\/offline-round-pet\/v1\/manifest\/([a-f0-9]{64})\?page=(0|[1-9][0-9]?)$/.exec(req.url);
   if(page){const bytes=pull.page(readTicket,Number(page[2]));need(JSON.parse(bytes).package_ref.hub_manifest_sha256===page[1],'incompatible_asset');send(res,200,bytes);return;}
   const asset=/^\/offline-round-pet\/v1\/assets\/([a-f0-9]{64})$/.exec(req.url);need(asset,'not_found');const range=pull.range(readTicket,req.headers,asset[1]);res.writeHead(206,{'content-length':range.length,'content-range':`bytes ${range.start}-${range.end}/${range.total}`,etag:range.etag});
   await writeAssetRange({res,range,chunk:(offset,length)=>pull.chunk(readTicket,range,offset,length),beforeChunk:offset=>beforeChunk({offset,req,res}),onChunk:bytes=>{metrics?.add('asset_write_bytes',bytes.length);metrics?.add('asset_write_calls',1);}});
  }catch(error){pull.fail(error.code??'pull_failed');if(!res.destroyed){if(res.headersSent)res.destroy();else send(res,403,Buffer.from(JSON.stringify({error:error.code??'pull_rejected'})));}}
  finally{await responseClosed;clearTimeout(timer);if(readTicket)pull.endRead(readTicket);if(httpTicket)pull.leaveHTTP(httpTicket);}
 };
 async function body(req){need(req.headers['content-type']==='application/json'&&!req.headers['transfer-encoding']&&/^[1-9][0-9]{0,3}$/.test(req.headers['content-length']??'')&&Number(req.headers['content-length'])<=4096,'pull_size');let n=0;const parts=[];for await(const chunk of req){n+=chunk.length;need(n<=4096,'pull_size');parts.push(chunk);}need(n===Number(req.headers['content-length']),'pull_size');return Buffer.concat(parts);}
 function send(res,status,bytes){res.writeHead(status,{'content-type':'application/json','content-length':bytes.length});res.end(bytes);}

}
