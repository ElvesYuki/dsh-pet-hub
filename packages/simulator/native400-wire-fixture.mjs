import {native400IdentityFixture} from './native400-identity-fixture.mjs';
import {NATIVE400_WIRE_PROFILE,native400WireContract,native400ManifestPage} from '../core/native400-wire.mjs';
/** Original MIT descriptions/approval only; no real-media or firmware input. */
export function native400WireFixture({maximum=false}={}){
 const source=native400IdentityFixture(),table=native400WireContract(),name=s=>maximum?s.padEnd(80,'X'):s,n=maximum?'18446744073709551615':'1';
 if(maximum){source.host.variants[0].manifest.character_id=name('character');source.host.variants[0].manifest.variant_id=name('variant');source.commit();}const m=source.metadata();
 const context={device_id:name('device'),binding_id:name('binding'),binding_epoch:n,boot_id:name('boot'),session_id:name('session'),controller_id:name('controller'),service_instance_id:name('service')};
 const control={controller_id:context.controller_id,service_instance_id:context.service_instance_id,control_epoch:n,lease_id:name('lease')};
 const packageRef={namespace_scope:m.identity.namespace_scope,namespace:m.identity.namespace,firmware_package_sha256:m.identity.firmware_package_sha256,hub_manifest_sha256:m.identity.hub_manifest_sha256};
 const target=(action=0)=>({command_id:name('command'),revision:n,character_id:m.manifest.character_id,variant_id:m.manifest.variant_id,manifest_sha256:packageRef.hub_manifest_sha256,action_id:action,asset_sha256:m.manifest.actions[action].sha256});
 const descriptor=(action=0)=>{const a=m.manifest.actions[action],t=m.package.content.timing[action];return {bytes:a.bytes,width:400,height:400,fps:24,frames:t.frames,codec_flag:1,key_interval:12,tile_rows:20,index_sha256:t.index_sha256,rgb565_sha256:t.rgb565_sha256,extra_keyframes:t.extra_keyframes};};
 const proof=(action=0)=>{const d=descriptor(action);return {evidence:'whole_file_and_media',file_sha256:target(action).asset_sha256,index_sha256:d.index_sha256,rgb565_sha256:d.rgb565_sha256,frames:d.frames,extra_keyframes:d.extra_keyframes};};
 const message=(type,payload,ctx=context)=>({protocol:'hub-device/1',profile:NATIVE400_WIRE_PROFILE,schema_version:1,type,request_id:name('request'),request_seq:n,context:ctx,payload});
 const exchange=(record=null,dispatch_id=null)=>message('exchange.request',{observation:record?{dispatch_id,record}:null});
 const response=(job=null,permit=null)=>message('exchange.response',{control:job,read_permit:permit,poll_after_ms:job||permit?0:500});
 const command=(kind,payload)=>({dispatch_id:name('dispatch'),kind,payload});
 const playback=(phase='accepted',action=0)=>({type:'playback.report',report_seq:n,control,package_ref:packageRef,target:target(action),asset_descriptor:descriptor(action),phase,verification_seq:phase==='verified'?n:null,integrity:phase==='verified'?'verified':phase==='failed'?'failed':'pending',admission:phase==='accepted'?'ready':null,verification:phase==='verified'?proof(action):null,failure_code:phase==='failed'?'integrity_failed':null});
 const actual=(action=0)=>({origin:'remote',source_context:context,control,source_target:target(action),asset_ref:{action_id:action,asset_sha256:target(action).asset_sha256},frame_index:0,first_frame_commit_seq:n,commit_seq:n,verification_seq:n,first_frame_committed:true,display_integrity:'verified',historical:false});
 const display=(action=0)=>({type:'display.report',display_seq:n,kind:'event',query_id:null,package_ref:packageRef,desired:target(action),display_state:'playing',maintenance:'none',actual:actual(action)});
 const page=(offset=0,limit=4)=>native400ManifestPage(m,{request_id:name('request'),request_seq:n,context,package_ref:packageRef,permit_id:name('permit'),offset,limit});
 const manifestPermit={kind:'manifest',permit_id:name('permit'),control,package_ref:packageRef,offset:0,limit:4,remaining_ms:30000};
 const assetPermit={kind:'asset',permit_id:name('permit'),control,package_ref:packageRef,target:target(),range_start:0,range_end:32767,total_bytes:descriptor().bytes,remaining_ms:30000};
 const headers=(p=assetPermit)=>[['Content-Length',String(p.range_end-p.range_start+1)],['Content-Range',`bytes ${p.range_start}-${p.range_end}/${p.total_bytes}`],['ETag',`"${p.target.asset_sha256}"`],['X-Pet-Hub-Read',p.permit_id],['X-Pet-Hub-Request-Id',name('request')],['X-Pet-Hub-Request-Seq',n]];
 return {metadata:m,context,control,packageRef,target,descriptor,proof,message,exchange,response,command,playback,actual,display,page,manifestPermit,assetPermit,headers,name,n,versions:table.defs.versions.const,capabilities:table.defs.capabilities.const};
}
export function native400PositiveExamples(){
 const f=native400WireFixture(),v={};const add=(name,value)=>v[name]=structuredClone(value);
 add('hello_begin',f.message('hello.begin',{boot_id:f.context.boot_id,capabilities:f.capabilities,versions:f.versions,package_ref:f.packageRef,integrity_policy:'verified-replay'},null));
 for(const type of ['challenge','confirm','ready']){const p={versions:f.versions,package_ref:f.packageRef,integrity_policy:'verified-replay'};if(type!=='ready')p.challenge_id='challenge';if(type!=='confirm')p.execution_profile='native400-full-offline-review/1';add('hello_'+type,f.message('hello.'+type,p));}
 add('exchange_empty',f.exchange());add('response_empty',f.response());
 add('control_lease_acquire',f.response(f.command('lease.acquire',{request_id:'leaseRequest',request_seq:'1',expected_epoch:'0',lease_id:null,lease_ms:15000})));
 add('control_lease_renew',f.response(f.command('lease.renew',{request_id:'leaseRequest',request_seq:'1',expected_epoch:'1',lease_id:'lease',lease_ms:15000})));
 for(const [name,action,mode] of [['base0',0,'base_loop'],['base11',11,'base_loop'],['once42',42,'once_hold'],['once77',77,'once_hold']])add('control_'+name,f.response(f.command('playback.set',{control:f.control,target:f.target(action),package_ref:f.packageRef,asset_descriptor:f.descriptor(action),mode,integrity_policy:'verified-replay'})));
 add('control_cancel',f.response(f.command('playback.cancel',{operation_id:'cancel',control:f.control,target:f.target(),package_ref:f.packageRef})));
 for(const kind of ['display','storage'])add('control_query_'+kind,f.response(f.command('query.'+kind,{query_id:'query'})));
 add('control_revoke',f.response(f.command('binding.revoke',{operation_id:'revoke'})));
 for(const phase of ['accepted','verifying','verified','failed','cancelled'])add('playback_'+phase,f.exchange(f.playback(phase),'dispatch'));
 const deferred=f.playback();deferred.admission='deferred_local';add('playback_deferred_local',f.exchange(deferred,'dispatch'));add('verified42',f.exchange(f.playback('verified',42)));
 add('local4_verified',f.exchange({type:'asset.verified',verification_seq:f.n,package_ref:f.packageRef,asset_ref:{action_id:4,asset_sha256:f.target(4).asset_sha256},asset_descriptor:f.descriptor(4),verification:f.proof(4)}));
 add('display_first_frame',f.exchange(f.display()));const short=f.display(42);short.actual.frame_index=117;add('display_short42_tail',f.exchange(short));const full=f.display(77);full.actual.frame_index=240;add('display_full_tail',f.exchange(full));
 for(const maintenance of ['verifying','priming','buffering','failed','none']){const d=f.display();d.display_state='held';d.maintenance=maintenance;add('display_held_'+maintenance,f.exchange(d));}
 const historical=f.display();historical.display_state='held';historical.actual.historical=true;historical.actual.source_context={...f.context,session_id:'old_session'};historical.desired=f.target(11);add('display_historical',f.exchange(historical));
 for(const action of [0,4]){const d=f.display(action);d.actual.origin='local';d.actual.control=d.actual.source_target=null;d.desired=f.target(11);add('display_local_'+action,f.exchange(d));}
 const unknown=f.display();unknown.display_state='unknown';unknown.actual=null;unknown.maintenance='priming';add('display_unknown',f.exchange(unknown));const snap=f.display();snap.kind='snapshot';snap.query_id='query';add('display_query',f.exchange(snap,'dispatch'));
 add('storage_unsupported',f.exchange({type:'storage.status',storage_seq:'1',query_id:'query',package_ref:f.packageRef,capability:'unsupported',inventory_known:false,saved:null,offline_available:null},'dispatch'));
 for(const io of [false,true])add('cancel_io_'+io,f.exchange({type:'cancel.report',cancel_seq:'1',operation_id:'cancel',control:f.control,target:f.target(),package_ref:f.packageRef,outcome:'cancelled',execution_invalidated:true,io_exited:io},'dispatch'));
 for(const stage of ['started','ended'])add('touch_'+stage,f.exchange({type:'touch.event',event_seq:'1',action_id:4,stage,base_target:f.target(11)}));
 add('revoke_receipt',f.exchange({type:'control.receipt',receipt_seq:'1',operation_id:'revoke',result:'revoked_local'},'dispatch'));
 for(const kind of ['acquire','renew'])add('lease_'+kind,f.exchange({protocol:'hub-device/1',profile:'native400-review-lease/1',type:'lease.granted',request_id:'leaseRequest',request_seq:'1',context:f.context,kind,control:f.control,lease_ms:15000},'dispatch'));
 add('permit_manifest',f.response(null,f.manifestPermit));add('permit_asset',f.response(null,f.assetPermit));
 const last={...f.assetPermit,range_start:f.assetPermit.total_bytes-1,range_end:f.assetPermit.total_bytes-1,remaining_ms:1};add('permit_last_byte',f.response(null,last));
 for(let offset=0;offset<78;offset+=4)add('page_'+offset,f.page(offset));
 const maximum=native400WireFixture({maximum:true});add('maximum_page',maximum.page());add('maximum_command',maximum.response(maximum.command('playback.set',{control:maximum.control,target:maximum.target(77),package_ref:maximum.packageRef,asset_descriptor:maximum.descriptor(77),mode:'once_hold',integrity_policy:'verified-replay'})));add('maximum_display',maximum.exchange(maximum.display(42)));
 for(const code of Object.keys(native400WireContract().errors))add('error_'+code,f.message('error',{code}));const raw=f.message('error',{code:'invalid_message'},null);raw.request_id=raw.request_seq=null;add('error_unparseable',raw);
 return v;
}
