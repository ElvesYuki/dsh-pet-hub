import {X509Certificate,createHash} from 'node:crypto';import {requireThat,bounded} from '../core/protocol.mjs';
function tlv(bytes,offset=0){requireThat(offset+2<=bytes.length,'certificate_encoding');const tag=bytes[offset++];let n=bytes[offset++];if(n&128){const count=n&127;requireThat(count>0&&count<=3&&offset+count<=bytes.length,'certificate_encoding');n=0;for(let i=0;i<count;i++)n=n*256+bytes[offset++];}requireThat(offset+n<=bytes.length,'certificate_encoding');return {tag,value:bytes.subarray(offset,offset+n),end:offset+n};}
function children(bytes){const out=[];for(let p=0;p<bytes.length;){const v=tlv(bytes,p);out.push(v);p=v.end;requireThat(out.length<=64,'certificate_encoding');}return out;}
/** Restricted direct-root DER profile, not a generic ASN.1/PKIX validator. */
export function checkLeafExtensions(raw){
 const top=tlv(raw);requireThat(top.tag===0x30&&top.end===raw.length,'certificate_encoding');const tbs=children(top.value)[0];requireThat(tbs.tag===0x30,'certificate_encoding');const ext=children(tbs.value).find(v=>v.tag===0xa3);requireThat(ext,'certificate_profile');const seq=tlv(ext.value);requireThat(seq.tag===0x30&&seq.end===ext.value.length,'certificate_encoding');let usage=false;const seen=new Set(),known=new Set(['551d13','551d0f','551d25','551d11','551d0e','551d23']);
 for(const item of children(seq.value)){requireThat(item.tag===0x30,'certificate_encoding');const c=children(item.value);requireThat(c[0]?.tag===6&&c.at(-1)?.tag===4&&[2,3].includes(c.length),'certificate_encoding');const oid=Buffer.from(c[0].value).toString('hex');requireThat(!seen.has(oid),'certificate_encoding');seen.add(oid);const critical=c.length===3;requireThat(!critical||(c[1].tag===1&&c[1].value.length===1&&c[1].value[0]===255),'certificate_encoding');requireThat(!critical||known.has(oid),'unknown_critical_extension');
  if(oid==='551d13'){const b=tlv(c.at(-1).value);requireThat(b.tag===0x30&&b.end===c.at(-1).value.length,'certificate_encoding');const v=children(b.value);requireThat(v.length===0||(v.length===1&&v[0].tag===1&&v[0].value.length===1&&v[0].value[0]===0),'untrusted_certificate');}
  if(oid==='551d0f'){const bits=tlv(c.at(-1).value);requireThat(bits.tag===3&&bits.end===c.at(-1).value.length&&bits.value.length===2&&bits.value[0]===7&&bits.value[1]===128,'certificate_key_usage');usage=true;}
 }requireThat(usage,'certificate_key_usage');requireThat(seen.has('551d13'),'certificate_profile');
}
export function parseCertificate(der){requireThat(der instanceof Uint8Array&&der.length>0&&der.length<=4096,'certificate_size');const raw=Buffer.from(der);let cert;try{cert=new X509Certificate(raw);}catch(cause){throw Object.assign(new Error('invalid certificate',{cause}),{code:'invalid_certificate'});}requireThat(cert.raw.equals(raw),'certificate_encoding');return cert;}
/** Pinned direct-root P256 profile, with explicit trusted wall time. No path building or OS trust lookup.
 * client/server return isolated X509Certificate objects; clientFingerprint returns a validated SHA256.
 * Optional cacheEntries (0..64) retains static approval only; wall validity is checked on every call.
 * close clears retained approval and denies future use; resources exposes counts only. */
export function createCertificateProfile({rootDER,now,metrics,cacheEntries=0}){
 requireThat(typeof now==='function','untrusted_time');
 bounded(cacheEntries,0,64);const cache=new Map();let closed=false;
 const root=parseCertificate(rootDER);
 const p256=c=>requireThat(c.publicKey.asymmetricKeyType==='ec'&&c.publicKey.asymmetricKeyDetails?.namedCurve==='prime256v1'&&c.signatureAlgorithmOid==='1.2.840.10045.4.3.2','certificate_profile');
 requireThat(root.ca&&root.verify(root.publicKey)&&(!root.keyUsage||root.keyUsage.length===0),'untrusted_ca');p256(root);
 function dates(c){const t=now();requireThat(Number.isSafeInteger(t)&&t>=0,'untrusted_time');requireThat(t>=c.validFromDate.getTime()&&t<=c.validToDate.getTime(),'certificate_time');}
 function leafWork(der,purpose){requireThat(!closed,'closed');requireThat(der instanceof Uint8Array&&der.length>0&&der.length<=4096,'certificate_size');const raw=Buffer.from(der),fingerprint=createHash('sha256').update(raw).digest('hex'),key=purpose+':'+fingerprint,old=cache.get(key),hit=old&&old.raw.equals(raw),c=hit?old.cert:parseCertificate(raw);
  const validity=()=>{dates(root);dates(c);};if(metrics)metrics.measure('certificate_validity',validity);else validity();
  if(!hit){const verify=()=>{p256(c);requireThat(!c.ca&&c.checkIssued(root)&&c.verify(root.publicKey),'untrusted_certificate');checkLeafExtensions(c.raw);requireThat(c.keyUsage?.length===1&&c.keyUsage[0]===purpose,'certificate_purpose');};if(metrics)metrics.measure('certificate_static',verify);else verify();if(cacheEntries){if(cache.size===cacheEntries)cache.delete(cache.keys().next().value);cache.set(key,{raw,cert:c});}}
  return {cert:c,fingerprint};}
 const leaf=(der,purpose)=>metrics?metrics.measure('certificate_leaf',()=>leafWork(der,purpose)):leafWork(der,purpose);
 const exported=c=>cacheEntries?new X509Certificate(c.raw):c;
 return {client:der=>exported(leaf(der,'1.3.6.1.5.5.7.3.2').cert),clientFingerprint:der=>leaf(der,'1.3.6.1.5.5.7.3.2').fingerprint,server(der,name){requireThat(typeof name==='string'&&name.length>0&&name.length<=253,'invalid_message');const c=leaf(der,'1.3.6.1.5.5.7.3.1').cert;requireThat(c.checkHost(name,{subject:'never',wildcards:false})===name,'certificate_name');return exported(c);},resources:()=>({cached_certificates:cache.size,closed}),close(){closed=true;cache.clear();}};
}
