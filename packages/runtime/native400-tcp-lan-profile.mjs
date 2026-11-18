import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {sha256} from './material-import.mjs';
import {networkInterfaces} from 'node:os';
import {native400PeerAddress} from '../core/native400-tcp-network.mjs';
import {NATIVE400_BOOT_NAMESPACE} from '../core/native400-bootstrap.mjs';
import {native400TcpMapping} from './native400-tcp.mjs';
const profiles=new WeakMap(),need=(ok)=>{if(!ok)throw Object.assign(Error('tcp_lan_profile_invalid'),{code:'tcp_lan_profile_invalid'});};
const exact=(v,keys)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
const text=v=>need(typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v));
const digest=v=>need(typeof v==='string'&&v.length===64&&/^[a-f0-9]{64}$/.test(v)&&v!=='0'.repeat(64));
const value=fn=>{const v=fn();if(v&&typeof v.then==='function'){Promise.resolve(v).catch(()=>{});need(false);}return v;};
/** Closed N_boot/raw-index/four-cache identity. Shape and recipe only, never
 * license/source approval or fresh device inventory. Returns a sorted copy. */
export function native400LanIdentity(identity){
 const i=structuredClone(identity);
 exact(i,['namespace_sha256','source_manifest_sha256','hub_index_sha256','records']);
 need(i.namespace_sha256===NATIVE400_BOOT_NAMESPACE);for(const k of ['source_manifest_sha256','hub_index_sha256'])digest(i[k]);
 need(Array.isArray(i.records)&&i.records.length===4);i.records.sort((a,b)=>a.action-b.action);
 for(const r of i.records){exact(r,['action','bytes','frames','asset_sha256']);need(Number.isInteger(r.action)&&[0,1,4,11].includes(r.action)&&Number.isInteger(r.bytes)&&r.bytes>=544&&r.bytes<=5865472&&r.frames===241);digest(r.asset_sha256);}
 native400TcpMapping(i);return i;
}
/** Trusted local independent window decision. No I/O or automatic approval.
 * References bind identity/purpose; this module does not verify ownership/license,
 * fresh device inventory, PC source payloads, or turn old offline grants into LAN.
 * Endpoints stay in RAM. Optional dependencies are trusted rehearsal hooks. */
export function prepareNative400LanProfile({identity,decision,endpoint,windowMs,clock=()=>Math.floor(performance.now()),interfaces=networkInterfaces}){
 const i=native400LanIdentity(identity),d=structuredClone(decision),e=structuredClone(endpoint);
 const mapping=native400TcpMapping(i);
 exact(d,['schema_version','profile','usage','mapping_sha256','source_review_sha256','approval_id','material_approval_id','license_ref','credits','integrity_policy','presentation_policy']);
 need(d.schema_version===1&&d.profile==='native400-tcp-lan-window/1'&&['single-device-cached-control','loopback-rehearsal'].includes(d.usage));
 digest(d.mapping_sha256);digest(d.source_review_sha256);need(d.mapping_sha256===mapping);for(const k of ['approval_id','material_approval_id','license_ref'])text(d[k]);
 need(Array.isArray(d.credits)&&d.credits.length>0&&d.credits.length<=16);d.credits.forEach(text);need(new Set(d.credits).size===d.credits.length);
 need(d.integrity_policy==='file-sha-metadata-frame0-crc'&&d.presentation_policy==='first-frame-history-only');
 exact(e,['interface_name','listen_address','peer_address']);text(e.interface_name);native400PeerAddress(e.listen_address);native400PeerAddress(e.peer_address);
 if(d.usage==='loopback-rehearsal')need(e.listen_address==='127.0.0.1'&&e.peer_address==='127.0.0.1');
 else need(!e.listen_address.startsWith('127.')&&!e.peer_address.startsWith('127.')&&e.listen_address!==e.peer_address);
 need(Number.isInteger(windowMs)&&windowMs>=1&&windowMs<=120000&&typeof clock==='function'&&typeof interfaces==='function');
 const started=value(clock);need(Number.isSafeInteger(started)&&started>=0&&started<=Number.MAX_SAFE_INTEGER-windowMs);
 const option=Object.freeze({});profiles.set(option,{identity:i,decision:d,endpoint:e,mapping,clock,interfaces,end:started+windowMs,last:started,allocated:false,claimed:false,invalid:false,descriptor:{schema_version:1,profile:'native400-tcp-lan-window/1',scope:d.usage,inputs_sha256:sha256(C({identity:i,decision:d,endpoint:e,windowMs}))}});return option;
}
/** Owner-internal acquire, once per prepared window; no wire/UI deserialization.
 * check/claim fail permanently on expiry, clock or selected interface changes. */
export function acquireNative400LanProfile(option){
 const p=profiles.get(option);need(p&&!p.allocated&&!p.invalid);p.allocated=true;
 const check=()=>{try{need(!p.invalid);const now=value(p.clock);need(Number.isSafeInteger(now)&&now>=p.last&&now<p.end);p.last=now;const inventory=value(p.interfaces);const rows=inventory?.[p.endpoint.interface_name];need(Array.isArray(rows)&&rows.filter(r=>r.address===p.endpoint.listen_address&&(r.family==='IPv4'||r.family===4)&&r.internal===(p.decision.usage==='loopback-rehearsal')).length===1);return true;}catch(cause){p.invalid=true;throw cause;}};
 return {mapping:p.mapping,records:structuredClone(p.identity.records),peerAddress:p.endpoint.peer_address,host:p.endpoint.listen_address,clock:p.clock,
  claim(){need(!p.claimed);check();p.claimed=true;},check,revoke(){p.invalid=true;},
  snapshot(){return {profile:'native400-tcp-lan-window/1',scope:p.decision.usage,claimed:p.claimed,invalid:p.invalid,remaining_ms:p.invalid?0:Math.max(0,p.end-p.last),authenticated:false,device_evidence:false};}};
}

/** Stable host identity only: no acquire, clock/NIC reads or endpoint plaintext. */
export function native400LanProfileDescriptor(option){const p=profiles.get(option);need(p);return structuredClone(p.descriptor);}
