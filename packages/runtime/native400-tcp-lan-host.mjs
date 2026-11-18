import {native400LanProfileDescriptor} from './native400-tcp-lan-profile.mjs';
import {createNative400LanOwner} from './native400-tcp-lan-owner.mjs';
import {keys,clone,requireThat as need} from '../core/protocol.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';import {sha256} from './material-import.mjs';
const prepared=new WeakMap(),owners=new WeakMap();
/** Trusted local host preparation; no profile acquisition or listener. It does
 * not produce real identities, material approvals, credentials or device config. */
export function prepareNative400LanHost(input){
 keys(input,['profile','ackMs','tickMs','timers']);const {profile,ackMs=2000,tickMs=25,timers}=input,identity=native400LanProfileDescriptor(profile);
 need(Number.isInteger(ackMs)&&ackMs>0&&ackMs<=10000&&Number.isInteger(tickMs)&&tickMs>0&&tickMs<=1000,'lan_host_invalid');
 need(timers===undefined||typeof timers?.setInterval==='function'&&typeof timers?.clearInterval==='function','lan_host_invalid');
 const descriptor={schema_version:1,profile:'native400-lan-host-review/1',scope:identity.scope,inputs_sha256:sha256(C({identity,ackMs,tickMs}))},option=Object.freeze({});
 prepared.set(option,{profile,ackMs,tickMs,timers,descriptor});return option;
}
export function native400LanHostDescriptor(option){const v=prepared.get(option);need(v,'lan_host_invalid');return clone(v.descriptor);}
/** Elected UDS owner only. fence starts transport close synchronously and prevents
 * all later operations; close awaits the same exit promise. Resource failures are
 * never converted into successful cleanup or a new window. */
export function createNative400LanHostOwner(option){
 const v=prepared.get(option);need(v,'lan_host_invalid');const inner=createNative400LanOwner(v.profile,v);let fenced=false,exit;
 const live=()=>need(!fenced,'lan_host_closed');
 function fence(){if(!fenced){fenced=true;exit=inner.close();exit.catch(()=>{});}}
 const owner={fence,close(){fence();return exit;},snapshot:()=>inner.snapshot(),resources:()=>inner.resources(),
  start(options){live();return inner.start(options);},address(){live();return inner.address();},networkLink(epoch,ready){live();return inner.networkLink(epoch,ready);},base(action,ttl){live();return inner.base(action,ttl);},reapply(){live();return inner.reapply();},cancel(){live();return inner.cancel();},pause(){live();return inner.pause();},resume(){live();return inner.resume();},tick(){live();return inner.tick();}};
 owners.set(owner,{option,inner,live,fence,close:owner.close});return owner;
}

/** Trusted local handoff only, never IPC. Verify this exact elected owner/option
 * and live LAN window before reading its real bound endpoint. Public methods are
 * not used as evidence and cannot be replaced to forge listener readiness. */
export function native400LanHostEndpoint(option,owner){
 const v=owners.get(owner);need(v&&v.option===option,'lan_handoff_unavailable');v.live();
 const s=v.inner.snapshot(),r=v.inner.resources();
 need(s.window?.scope==='single-device-cached-control'&&s.window.claimed&&!s.window.invalid&&s.window.remaining_ms>0&&s.network?.ready&&r.listening&&!['disabled','paused','closed'].includes(s.phase),'lan_handoff_unavailable');
 const address=v.inner.address();need(address.family==='IPv4'&&Number.isInteger(address.port)&&address.port>0&&address.port<=65535,'lan_handoff_unavailable');return {ipv4:address.address,port:address.port};
}

/** Trusted async handoff guard: keep the exact owner endpoint and link epoch,
 * in addition to the original window/listener gates. No new lifetime or I/O. */
export function native400LanHostHandoffGuard(option,owner){
 const endpoint=native400LanHostEndpoint(option,owner),v=owners.get(owner),epoch=v.inner.snapshot().network.epoch;
 const check=()=>{const now=native400LanHostEndpoint(option,owner);need(now.ipv4===endpoint.ipv4&&now.port===endpoint.port&&v.inner.snapshot().network.epoch===epoch,'lan_handoff_unavailable');return true;};
 check();return check;
}

/** Internal service-only control loan; binds the exact elected owner/option. */
export function native400LanHostControlContext(option,owner){const v=owners.get(owner);need(v&&v.option===option&&!v.controlClaimed,'lan_handoff_unavailable');v.controlClaimed=true;return {snapshot:()=>v.inner.snapshot(),resources:()=>v.inner.resources(),base:(a,t)=>{v.live();v.inner.base(a,t);return v.inner.captureRecovery();},cancel:()=>{v.live();return v.inner.cancel();},fence:v.fence,close:v.close};}
