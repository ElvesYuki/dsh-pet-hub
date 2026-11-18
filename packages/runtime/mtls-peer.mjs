import {TLSSocket} from 'node:tls';
import {constants} from 'node:crypto';
import {createCertificateProfile} from './certificate-profile.mjs';
import {decodeLeaseV5,validateLeaseContext} from '../core/lease-wire.mjs';
import {clone,id,uint64,requireThat,same} from '../core/protocol.mjs';

export const MTLS_OPTIONS=Object.freeze({minVersion:'TLSv1.2',maxVersion:'TLSv1.2',ciphers:'ECDHE-ECDSA-AES128-GCM-SHA256',ecdhCurve:'prime256v1',secureOptions:constants.SSL_OP_NO_TICKET,ALPNProtocols:['http/1.1']});
/** Actual TLS peer boundary; no listener. Only a trusted HTTP owner may supply its request socket.
 * lookupByFingerprint returns an approved binding with device_id and credential_epoch, never wire data.
 * cacheCertificates defaults true (64 static approvals); dynamic time and binding always rechecked.
 * Optional verifySessionAdmission consumes a trusted one-use owner ticket; then no lifetime history is retained.
 * establish returns Registry peer proof; attest returns guard packet/proof. Both throw stable errors.
 * revoke/close invalidate authority and destroy owned authenticated sockets; close is idempotent.
 * onInvalidate(context) must synchronously fence the current guard/Registry and must not throw. */
export function createMTLSPeerAuth({rootDER,lookupByFingerprint,now,controller_id,service_instance_id,onInvalidate,verifySessionAdmission,metrics,cacheCertificates=true,decodeReceipt=decodeLeaseV5}){
 requireThat(typeof lookupByFingerprint==='function'&&typeof onInvalidate==='function','invalid_auth_owner');id(controller_id);id(service_instance_id);requireThat(verifySessionAdmission===undefined||typeof verifySessionAdmission==='function','invalid_auth_owner');
 requireThat(typeof cacheCertificates==='boolean'&&typeof decodeReceipt==='function','invalid_auth_owner');const profile=createCertificateProfile({rootDER,now,metrics,cacheEntries:cacheCertificates?64:0}),sessions=new Map(),seenSessions=new Set();let peers=new WeakMap(),receipts=new WeakMap(),closed=false;
 const active=()=>requireThat(!closed,'closed');
 function bindingWork(socket){active();requireThat(socket instanceof TLSSocket&&socket.encrypted&&socket.authorized&&!socket.destroyed&&!socket.isSessionReused(),'untrusted_peer');requireThat(socket.getProtocol()==='TLSv1.2'&&socket.getCipher()?.standardName==='TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256','tls_profile');
  const cert=socket.getPeerX509Certificate();requireThat(cert,'untrusted_peer');const fingerprint=profile.clientFingerprint(cert.raw),b=lookupByFingerprint(fingerprint);
  requireThat(b&&b.state==='bound'&&b.certificate_sha256===fingerprint,'unbound_certificate');for(const k of ['device_id','binding_id','controller_id'])id(b[k]);uint64(b.binding_epoch);uint64(b.credential_epoch);return b;
 }
 function binding(socket){return metrics?metrics.measure('peer_binding',()=>bindingWork(socket)):bindingWork(socket);}
 function drop(socket){const e=sessions.get(socket);if(!e)return;sessions.delete(socket);try{onInvalidate(clone(e.context));}finally{socket.destroy();}}
 function current(socket){active();const e=sessions.get(socket);requireThat(e,'stale_session');try{const b=binding(socket);requireThat(['device_id','binding_id','binding_epoch','controller_id','credential_epoch','certificate_sha256'].every(k=>b[k]===e.binding[k]),'stale_credential');return e;}catch(error){drop(socket);throw error;}}
 return {
  identify(socket){return clone(binding(socket));},
  establish(socket,context,admission){active();validateLeaseContext(context);requireThat(context.controller_id===controller_id&&context.service_instance_id===service_instance_id,'stale_service');const b=binding(socket);requireThat(['device_id','binding_id','binding_epoch','controller_id'].every(k=>context[k]===b[k]),'stale_binding');const old=sessions.get(socket);if(old){current(socket);requireThat(same(old.context,context),'stale_session');return old.proof;}
   const key=context.device_id+':'+context.session_id;if(!verifySessionAdmission)requireThat(!seenSessions.has(key),'stale_session');requireThat(sessions.size<16&&(verifySessionAdmission||seenSessions.size<256),'capacity_exceeded');requireThat(![...sessions.values()].some(e=>e.context.device_id===context.device_id),'identity_conflict');if(verifySessionAdmission)requireThat(verifySessionAdmission(admission,socket,context)===true,'untrusted_session_admission');socket.disableRenegotiation();const proof=Object.freeze({verified_tls_peer:true}),entry={socket,context:clone(context),binding:clone(b),proof};sessions.set(socket,entry);if(!verifySessionAdmission)seenSessions.add(key);peers.set(proof,entry);socket.once('close',()=>drop(socket));return proof;
  },
  verifyPeer(proof,b,hello){const e=peers.get(proof);if(!e)return false;current(e.socket);return ['device_id','binding_id','binding_epoch','controller_id'].every(k=>b[k]===e.binding[k])&&(!hello||['device_id','binding_id','binding_epoch','boot_id','session_id'].every(k=>hello[k]===e.context[k]));},
  assertCurrent(socket){return clone(current(socket).context);},
  attest(socket,bytes){const e=current(socket),packet=decodeReceipt(bytes);requireThat(same(packet.context,e.context),'stale_session');const proof=Object.freeze({verified_tls_receipt:true});receipts.set(proof,{socket,packet:clone(packet)});return {packet,proof};},
  verifyResponse(proof,packet,context){const e=receipts.get(proof);if(!e)return false;const s=current(e.socket);return same(packet,e.packet)&&same(context,s.context);},
  revoke(deviceId){active();id(deviceId);for(const [socket,e] of sessions)if(e.context.device_id===deviceId)drop(socket);},
  resources(){return {sessions:sessions.size,remembered_sessions:seenSessions.size,cached_certificates:profile.resources().cached_certificates,closed};},
  close(){if(closed)return;for(const socket of sessions.keys())drop(socket);closed=true;profile.close();seenSessions.clear();peers=new WeakMap();receipts=new WeakMap();}
 };
}
