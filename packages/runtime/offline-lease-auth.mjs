import {parseCertificate,createCertificateProfile} from './certificate-profile.mjs';
import {createHash,randomBytes,verify} from 'node:crypto';
import {clone,same,id,uint64,bounded,keys,requireThat} from '../core/protocol.mjs';import {canonicalLeaseJSON,decodeLeaseV5} from '../core/lease-wire.mjs';
const fp=c=>createHash('sha256').update(c.raw).digest('hex');
/** Offline certificate/possession validator, NOT a TLS listener/handshake or a general PKIX validator.
 * lookupBinding is trusted and re-read for each message; now returns trusted wall ms or null.
 * Challenges/session signatures are experimental offline fixtures, never a deployed application protocol. */
export function createOfflineLeaseAuth({rootDER,lookupBinding,now,clock}){
 const profile=createCertificateProfile({rootDER,now});
 const pending=new Map(),sessions=new Set();let live=new WeakMap(),proofs=new WeakMap(),closed=false;
 const active=()=>requireThat(!closed,'closed');const mono=()=>{const n=clock.now();bounded(n,0,Number.MAX_SAFE_INTEGER);return n;};
 function check(cert,context){profile.client(cert.raw);
  const b=lookupBinding(context.device_id);requireThat(b&&b.state==='bound'&&b.certificate_sha256===fp(cert)&&b.binding_id===context.binding_id&&b.binding_epoch===context.binding_epoch&&b.controller_id===context.controller_id,'unbound_certificate');uint64(b.credential_epoch);return b;
 }
 function session(s){active();const e=live.get(s);requireThat(e&&sessions.has(s),'stale_session');const b=check(e.cert,e.context);requireThat(b.credential_epoch===e.credential_epoch,'stale_credential');return e;}
 return {
  verifyServer(certificateDER,expectedName){active();profile.server(certificateDER,expectedName);return true;},
  challenge(context){active();keys(context,['device_id','binding_id','binding_epoch','boot_id','session_id','controller_id','service_instance_id']);for(const k of ['device_id','binding_id','boot_id','session_id','controller_id','service_instance_id'])id(context[k]);uint64(context.binding_epoch);const t=mono();for(const [k,p] of pending)if(t-p.at>=5000)pending.delete(k);requireThat(pending.size<32,'capacity_exceeded');
   const challenge_id=randomBytes(32).toString('hex'),bytes=Buffer.from('hub-offline-lease/1\0'+canonicalLeaseJSON({context,challenge_id}));pending.set(challenge_id,{context:clone(context),bytes,at:t});return {challenge_id,bytes:new Uint8Array(bytes)};
  },
  authenticate(challenge_id,certificateDER,signature){active();const p=pending.get(challenge_id);requireThat(p&&mono()-p.at>=0&&mono()-p.at<5000,'challenge_expired');requireThat(certificateDER instanceof Uint8Array&&certificateDER.length<=4096,'certificate_size');const cert=parseCertificate(certificateDER),b=check(cert,p.context);requireThat(signature instanceof Uint8Array&&signature.length<=80&&verify('sha256',p.bytes,cert.publicKey,Buffer.from(signature)),'possession_failed');requireThat(sessions.size<16,'capacity_exceeded');
   const s=Object.freeze({offline_lease_session:true});live.set(s,{cert,context:p.context,credential_epoch:b.credential_epoch,prefix:p.bytes});sessions.add(s);pending.delete(challenge_id);return s;
  },
  attest(s,bytes,signature){const e=session(s);requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=4096,'wire_size');const raw=Buffer.from(bytes);requireThat(signature instanceof Uint8Array&&signature.length<=80&&verify('sha256',Buffer.concat([e.prefix,raw]),e.cert.publicKey,Buffer.from(signature)),'message_signature');const packet=decodeLeaseV5(raw);requireThat(same(packet.context,e.context),'stale_session');const proof=Object.freeze({offline_verified_receipt:true});proofs.set(proof,{session:s,packet:clone(packet)});return {packet,proof};},
  verifyResponse(proof,packet,context){const e=proofs.get(proof);if(!e)return false;const liveSession=session(e.session);return same(packet,e.packet)&&same(context,liveSession.context);},
  disconnect(s){sessions.delete(s);live.delete(s);},
  resources(){return {pending:pending.size,sessions:sessions.size,closed};},
  close(){closed=true;pending.clear();sessions.clear();live=new WeakMap();proofs=new WeakMap();}
 };
}
