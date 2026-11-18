const need=ok=>{if(!ok)throw Error('lan_host_view_invalid');};
/** Reconstruct public candidate status. No endpoint, decision, digest or grant.
 * transport_exited describes only this host's resources, not ESP/STA cleanup. */
export function publicNative400LanHostView(s,r){
 need(s&&s.device_evidence===false&&s.authenticated===false&&['disabled','waiting','hello','opening','open','offline','paused','closed'].includes(s.phase));
 const w=s.window;need(w&&w.profile==='native400-tcp-lan-window/1'&&['loopback-rehearsal','single-device-cached-control'].includes(w.scope)&&w.authenticated===false&&w.device_evidence===false);
 need(typeof w.claimed==='boolean'&&typeof w.invalid==='boolean'&&Number.isSafeInteger(w.remaining_ms)&&w.remaining_ms>=0&&w.remaining_ms<=120000);
 need(r&&typeof r.listening==='boolean');for(const key of ['sockets','sessions','timers','active'])need(Number.isInteger(r[key])&&r[key]>=0&&r[key]<=32);
 need([0,1].includes(r.active)&&r.timers<=1);
 const n=s.network;need(n&&typeof n.ready==='boolean'&&Number.isInteger(n.epoch)&&n.epoch>=0&&n.epoch<=0xffffffff&&n.authenticated===false);
 if(s.observation)need(s.observation.current_display==='unknown'&&s.observation.verified===null&&s.observation.device_evidence===false);
 const frame=s.observation?.last_frame0??s.history;if(frame)need([0,1,11].includes(frame.action));
 return {schema_version:1,profile:'native400-lan-host-view/1',scope:w.scope,phase:s.phase,window:{claimed:w.claimed,invalid:w.invalid,remaining_ms:w.remaining_ms},listener:r.listening,session_active:r.active===1,transport_exited:!r.listening&&['sockets','sessions','timers','active'].every(k=>r[k]===0),network:{epoch:n.epoch,ready:n.ready},frame0_history:frame?{action:frame.action,reported:true}:null,current_display:'unknown',verified:null,source_evidence:'caller-declared-reference',error:s.error?'lan_review_failed':null,device_evidence:false};
}
