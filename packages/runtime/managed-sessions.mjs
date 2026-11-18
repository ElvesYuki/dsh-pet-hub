import {bindingRootAuthority} from './binding-root-authority.mjs';
import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {id,keys,requireThat,clone} from '../core/protocol.mjs';
import {canonicalLeaseJSON} from '../core/lease-wire.mjs';
import {openBindingStore} from './binding-store.mjs';import {createSessionRuntime} from './session-runtime.mjs';

/** Public-data-only assembly identity; functions/secret material are never serialized into a descriptor. */
export function managedSessionDescriptor(options){
 keys(options,['profile','bindingDirectory','controller_id','rootDER','manifest','policy','clock','now','powerSource','rootState']);requireThat(options.profile==='review'&&typeof options.bindingDirectory==='string','invalid_session_profile');id(options.controller_id);requireThat(options.rootDER instanceof Uint8Array&&options.rootDER.length>0&&options.rootDER.length<=4096,'certificate_size');const p=options.powerSource;requireThat(p&&typeof p.start==='function','power_source_required');keys(p.descriptor,['kind','identity']);requireThat(['fixture','macos-iokit'].includes(p.descriptor.kind)&&typeof p.descriptor.identity==='string'&&p.descriptor.identity.length>0&&p.descriptor.identity.length<=128,'invalid_power_source');
 return JSON.parse(canonicalLeaseJSON({profile:'review',bindingDirectory:resolve(options.bindingDirectory),controller_id:options.controller_id,root_sha256:createHash('sha256').update(options.rootDER).digest('hex'),manifest:clone(options.manifest),policy:clone(options.policy),power:clone(p.descriptor),...(options.rootState?{rootState:true}:{})}));
}
/** Called only by the UDS winner. Opens existing metadata, owns sessions/power, never opens device listener. */
export async function createManagedSessions(options,{instanceId}){
 const store=openBindingStore({directory:options.bindingDirectory,rootState:options.rootState??false}),clock=options.clock??{now:()=>Math.floor(performance.now())},now=options.now??Date.now;
 let runtime,power,closed=false,closing,phase='starting',error=null,sourceClosed=false,sourceFailed=false;
 try{
  runtime=createSessionRuntime({store,rootDER:options.rootDER,manifest:options.manifest,policy:options.policy,clock,now,controller_id:options.controller_id,service_instance_id:instanceId});runtime.suspend();
  power=await options.powerSource.start({onEvent(type){if(closed||sourceFailed)return;if(type==='suspend'){runtime.suspend();phase='suspended';error=null;}else{try{if(runtime.resources().mode==='suspended')runtime.resume();phase='ready';error=null;}catch(e){runtime.suspend();phase='blocked';error=e.code??'power_resume_failed';}}},onFailure(code){if(closed)return;sourceFailed=true;runtime.suspend();phase='blocked';error=code;}});
 }catch(cause){closed=true;await power?.close();runtime?.close();store.close();throw cause;}
 return {runtime,rootAuthority:options.rootState?bindingRootAuthority(store):null,withReadView:work=>store.withReadView(work),close(){if(closing)return closing;closed=true;closing=(async()=>{runtime.suspend();try{await power.close();sourceClosed=true;}finally{runtime.close();store.close();}})();return closing;},snapshot(){return {enabled:true,profile:'review',phase,error,power_kind:options.powerSource.descriptor.kind,counts:runtime.resources(),source:power.resources(),device_listener:false};},resources(){return {closed,sourceClosed,store:store.resources(),sessions:runtime.resources(),source:power.resources()};}};
}
