import {openSync,closeSync,readSync,fstatSync,lstatSync,constants} from 'node:fs';
import {roundPetCanonical as C,parseRoundPetJson} from '../core/round-pet-identity.mjs';
import {native400PeerAddress} from '../core/native400-tcp-network.mjs';
import {native400LanIdentity,prepareNative400LanProfile} from './native400-tcp-lan-profile.mjs';
import {prepareNative400LanHost,native400LanHostEndpoint} from './native400-tcp-lan-host.mjs';
const LIMIT=16384,fail=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const need=(ok,code='lan_request_invalid')=>{if(!ok)throw fail(code);};
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)));

/** Pure JSON adapter for the upstream device RAM importer. No approval, USB,
 * persistence or connectivity proof. Caller owns the returned sensitive object;
 * JavaScript strings/OS buffers are not guaranteed erasable. */
export function native400DeviceRamConfig(input){
 try{
  exact(input,['identity','endpoint','wifi']);const {identity,endpoint,wifi}=input;
  const i=native400LanIdentity(identity);exact(endpoint,['ipv4','port']);native400PeerAddress(endpoint.ipv4);
  need(!endpoint.ipv4.startsWith('127.')&&Number.isInteger(endpoint.port)&&endpoint.port>=1&&endpoint.port<=65535);
  exact(wifi,['ssid','password']);C(wifi);need(typeof wifi.ssid==='string'&&typeof wifi.password==='string');
  const ssid=Buffer.byteLength(wifi.ssid,'utf8');need(ssid>=1&&ssid<=32&&!wifi.ssid.includes('\0')&&(wifi.password===''||wifi.password.length>=8&&wifi.password.length<=63&&!/[^\x20-\x7e]/.test(wifi.password)));
  return {schema_version:1,profile:'native400-device-lan-ram/1',identity:{namespace_sha256:i.namespace_sha256,source_manifest_sha256:i.source_manifest_sha256,role_index_sha256:i.hub_index_sha256,records:i.records},endpoint:{...endpoint},wifi:{...wifi}};
 }catch(cause){throw fail('lan_device_config_invalid',cause);}
}

/** Trusted local preparation with a separate fresh LAN decision (not read from
 * the request). No network/file/USB I/O or automatic approval. deviceConfig only
 * hands off once from this option's live elected LAN owner. close fences this
 * request, not the service: its owner must still be explicitly closed/awaited. */
export function prepareNative400LanRequest({request,decision,clock,interfaces,ackMs,tickMs,timers}){
 try{
  const v=structuredClone(request);C(v);exact(v,['schema_version','profile','identity','endpoint','window_ms']);
  need(v.schema_version===1&&v.profile==='native400-hub-lan-request/1'&&['single-device-cached-control','loopback-rehearsal'].includes(decision?.usage));
  let identity=native400LanIdentity(v.identity);const profile=prepareNative400LanProfile({identity,decision,endpoint:v.endpoint,windowMs:v.window_ms,...(clock===undefined?{}:{clock}),...(interfaces===undefined?{}:{interfaces})});
  const lanReview=prepareNative400LanHost({profile,...(ackMs===undefined?{}:{ackMs}),...(tickMs===undefined?{}:{tickMs}),...(timers===undefined?{}:{timers})});let closed=false,handedOff=false;
  return Object.freeze({lanReview,
   snapshot:()=>({schema_version:1,profile:'native400-hub-lan-request-view/1',closed,handed_off:handedOff,source_evidence:'caller-declared-reference',device_evidence:false,authenticated:false}),
   deviceConfig({owner,wifi}){
    need(!closed&&!handedOff,'lan_handoff_unavailable');const endpoint=native400LanHostEndpoint(lanReview,owner),config=native400DeviceRamConfig({identity,endpoint,wifi});handedOff=true;return config;
   },close(){closed=true;identity=null;}
  });
 }catch(cause){throw fail('lan_request_invalid',cause);}
}

/** Read one explicit current-user private regular JSON file (1..16KiB). Duplicate
 * keys, unknown fields, symlinks/hardlinks and observed fd/path changes fail
 * closed. No credentials/decision are read or written. beforeCheck is a trusted
 * synchronous race-test hook; nothing from file content supplies dependencies. */
export function readNative400LanRequest({file,beforeCheck=()=>{},...options}){
 let fd,buffer;
 try{
  need(typeof file==='string'&&file.length>0&&typeof beforeCheck==='function');fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const s=fstatSync(fd,{bigint:true});need(s.isFile()&&s.uid===BigInt(process.getuid())&&(s.mode&0o077n)===0n&&s.nlink===1n&&s.size>0n&&s.size<=BigInt(LIMIT));
  buffer=Buffer.alloc(Number(s.size)+1);let n=0;while(n<buffer.length){const got=readSync(fd,buffer,n,buffer.length-n,n);if(!got)break;n+=got;}need(n===Number(s.size));
  const hook=beforeCheck();if(hook&&typeof hook.then==='function'){Promise.resolve(hook).catch(()=>{});need(false);}
  const end=fstatSync(fd,{bigint:true}),path=lstatSync(file,{bigint:true});need(['dev','ino','size','uid','mode','nlink','mtimeNs','ctimeNs'].every(k=>s[k]===end[k]&&s[k]===path[k]));
  return prepareNative400LanRequest({...options,request:parseRoundPetJson(buffer.subarray(0,n))});
 }catch(cause){throw fail('lan_request_file_invalid',cause);}finally{buffer?.fill(0);if(fd!==undefined)closeSync(fd);}
}
