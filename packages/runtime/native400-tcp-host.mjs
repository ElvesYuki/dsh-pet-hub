import {isAbsolute,normalize} from 'node:path';
import {native400TcpBindingDescriptor,createNative400TcpBindingReview} from './native400-tcp-binding.mjs';
import {native400PeerAddress} from '../core/native400-tcp-network.mjs';
import {roundPetCanonical as C} from '../core/round-pet-identity.mjs';
import {sha256} from './material-import.mjs';
import {clone,keys,requireThat as need} from '../core/protocol.mjs';
const options=new WeakMap();
/** Trusted preparation only, no source I/O or listener. File/peer are private
 * sourceKey material; a serialized option cannot create an owner. */
export function prepareNative400TcpHost(input){
 keys(input,['binding','file','peerAddress','timeoutMs','ackMs','tickMs','clock','timers','beforeRead','beforeCheck']);
 const {binding,file,peerAddress,timeoutMs=10000,ackMs=2000,tickMs=25,...hooks}=input;
 const identity=native400TcpBindingDescriptor(binding);
 need(typeof file==='string'&&isAbsolute(file)&&normalize(file)===file&&!file.includes('\0'),'tcp_host_invalid');native400PeerAddress(peerAddress);
 need(Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=30000&&Number.isInteger(ackMs)&&ackMs>=1&&ackMs<=10000&&Number.isInteger(tickMs)&&tickMs>=1&&tickMs<=1000,'tcp_host_invalid');
 for(const k of ['clock','beforeRead','beforeCheck'])need(hooks[k]===undefined||typeof hooks[k]==='function','tcp_host_invalid');
 need(hooks.timers===undefined||typeof hooks.timers.setInterval==='function'&&typeof hooks.timers.clearInterval==='function','tcp_host_invalid');
 const descriptor={schema_version:1,profile:'native400-tcp-host-review/1',scope:'offline-loopback',inputs_sha256:sha256(C({identity,file,peerAddress,timeoutMs,ackMs,tickMs}))};
 const option=Object.freeze({});options.set(option,{binding,file,peerAddress,timeoutMs,ackMs,tickMs,...hooks,descriptor});return option;
}
export function native400TcpHostDescriptor(option){const v=options.get(option);need(v,'tcp_host_invalid');return clone(v.descriptor);}
/** Called only after the existing UDS bind election succeeds. Source review starts
 * asynchronously; no TCP listener until trusted caller explicitly starts it. */
export function createNative400TcpHostOwner(option){const v=options.get(option);need(v,'tcp_host_invalid');const {binding,descriptor,...config}=v;return createNative400TcpBindingReview(binding,{...config,enabled:true});}
