const need=ok=>{if(!ok)throw Error('tcp_host_view_invalid');};
/** Public read-only status projection, not an operation grant or device proof.
 * Reject incompatible integrity/display claims; reconstruct fields, never spread
 * task internals, paths, approvals, socket endpoints or wire identities. */
export function publicNative400TcpHostView(snapshot,resources){
 need(snapshot&&snapshot.device_evidence===false&&['reading','bound','failed','closed'].includes(snapshot.phase));
 const b=snapshot.binding,o=snapshot.owner,r=resources.owner;
 if(snapshot.phase==='bound')need(b&&o);if(snapshot.phase==='reading')need(!b&&!o);
 if(b)need(b.profile==='native400-tcp-offline-binding/1'&&b.scope==='offline-loopback'&&b.device_evidence===false&&b.whole_media===false);
 if(o){need(o.authenticated===false&&o.device_evidence===false);if(o.observation)need(o.observation.current_display==='unknown'&&o.observation.verified===null);}
 need(r&&typeof r.listening==='boolean'&&[0,1].includes(r.active));
 const network=o?.network;if(network)need(typeof network.ready==='boolean'&&Number.isInteger(network.epoch)&&network.epoch>=0&&network.epoch<=0xffffffff);
 const frame=o?.observation?.last_frame0??o?.history;
 if(frame)need([0,1,11].includes(frame.action));
 return {schema_version:1,profile:'native400-tcp-host-view/1',scope:'offline-loopback',phase:snapshot.phase,source_reviewed:!!b,listener:r.listening,session_active:r.active===1,network:network?{epoch:network.epoch,ready:network.ready}:null,frame0_history:frame?{action:frame.action,reported:true}:null,current_display:'unknown',verified:null,error:(snapshot.error||o?.error)?'tcp_review_failed':null,device_evidence:false};
}
