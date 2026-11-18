import {createNative400ReviewClient} from './native400-review-channel.mjs';
import {isAbsolute,normalize} from 'node:path';
import {startOrAttach} from './service.mjs';import {native400LanHostDescriptor} from './native400-tcp-lan-host.mjs';import {publicNative400LanHostView} from '../core/native400-tcp-lan-host-view.mjs';
const runWindows=new WeakMap();
const fail=c=>Object.assign(Error(c),{code:c}),need=(v,c='node_control_invalid')=>{if(!v)throw fail(c);};
/** Explicit pure-Node control-window assembly, default off. A trusted caller
 * supplies the genuine reviewed LAN option; this does not grant source/material
 * approval or configure devices. Only the UDS winner starts TCP. No USB consumer,
 * credentials, Python, process spawning or automatic network-ready event.
 * ready means host startup/attachment, never device online or playback.
 * close fences immediately, waits startup and real service exit; failure retains
 * ownership for explicit close retry. Attached callers cannot control the owner. */
export function createNative400NodeControlWindow(input){
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['enabled','directory','lanReview','signal','controlAccess'].includes(k)));
 const {enabled=false,directory,lanReview,signal,controlAccess}=input;need(enabled===true&&typeof directory==='string'&&isAbsolute(directory)&&normalize(directory)===directory&&!/[\u0000-\u001f\u007f]/.test(directory));
 need(signal===undefined||typeof signal?.addEventListener==='function'&&typeof signal?.removeEventListener==='function');try{native400LanHostDescriptor(lanReview);}catch{throw fail('node_control_invalid');}
 let service=null,transport=null,phase='starting',error=null,closed=false,settled=false,released=false,ownershipUnknown=false,releasing=null,closing=null;
 function release(){if(released)return Promise.resolve();if(!service){if(ownershipUnknown)return Promise.reject(fail('node_control_cleanup_unknown'));return Promise.resolve();}if(releasing)return releasing;
  try{releasing=Promise.resolve(service.close());}catch{releasing=Promise.reject(fail('node_control_cleanup_unknown'));}
  releasing=releasing.then(()=>{released=true;},()=>{phase='cleanup_unknown';error='node_control_cleanup_unknown';throw fail(error);});releasing.catch(()=>{});return releasing;
 }
 function fence(code){closed=true;error??=code;if(phase!=='closed')phase='closing';if(service)void release().catch(()=>{});}
 const abort=()=>{fence('node_control_aborted');releasing?.then(()=>{if(settled)phase='closed';},()=>{});};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const ready=Promise.resolve().then(async()=>{try{
  need(!closed,error??'node_control_closed');service=await startOrAttach({directory,lanReview,...(controlAccess?{nodeControl:controlAccess}:{})});need(!closed,error??'node_control_closed');
  if(service.role==='owner'){transport=service.lanReview;need(transport,'node_control_start_failed');await transport.start({enabled:true});}
  need(!closed,error??'node_control_closed');phase='ready';return Object.freeze({role:service.role,instance_id:service.instanceId,transport_started:service.role==='owner',device_evidence:false});
 }catch(cause){error??=/^node_control_/.test(cause.code??'')?cause.code:'node_control_start_failed';closed=true;if(!service&&cause instanceof AggregateError)ownershipUnknown=true;
  try{await release();phase='failed';}catch{phase='cleanup_unknown';error='node_control_cleanup_unknown';}signal?.removeEventListener('abort',abort);throw fail(error);
 }finally{settled=true;}});ready.catch(()=>{});
 function call(method,args){need(!closed&&phase==='ready','node_control_closed');need(service?.role==='owner'&&transport,'node_control_not_owner');try{return transport[method](...args);}catch{throw fail('node_control_operation_failed');}}
 const control=()=>{need(!closed&&phase==='ready','node_control_closed');need(service?.role==='owner'&&service.nodeControl,'node_control_not_owner');return service.nodeControl;};
 const result=Object.freeze({ready,authorizeControls:()=>control().authorize(),revokeControls:c=>control().revoke(c),detachControls:c=>{const channel=control();need(typeof channel.detach==='function','node_control_operation_failed');return channel.detach(c);},endControls:()=>{const channel=control();need(typeof channel.endSession==='function','node_control_operation_failed');return channel.endSession();},controlClient:c=>{control();return createNative400ReviewClient(service.client,c);},address:()=>call('address',[]),networkLink:(epoch,up)=>call('networkLink',[epoch,up]),base:(action,ttl)=>call('base',[action,ttl]),reapply:()=>call('reapply',[]),cancel:()=>call('cancel',[]),pause:()=>call('pause',[]),resume:()=>call('resume',[]),tick:()=>call('tick',[]),
  snapshot(){return {schema_version:1,profile:'native400-node-control-window-view/1',phase,role:service?.role??null,closed,error,python_required:false,device_evidence:false,transport:transport?publicNative400LanHostView(transport.snapshot(),transport.resources()):null};},
  resources:()=>({startup_pending:!settled,service_owned:service?.role==='owner'&&!released,ownership_unknown:ownershipUnknown,transport:transport?{...transport.resources()}:null}),
  close(){if(closing)return closing;if(phase==='cleanup_unknown')releasing=null;fence(error);signal?.removeEventListener('abort',abort);closing=(async()=>{await ready.catch(()=>{});await release();phase='closed';})();closing=closing.catch(e=>{closing=null;throw e;});return closing;}
 });
 let borrowed=false;
 runWindows.set(result,{check(){need(!borrowed,'node_control_run_busy');need(typeof control().detach==='function','node_control_not_shared');},take(){need(!borrowed,'node_control_run_busy');const channel=control();need(typeof channel.detach==='function','node_control_not_shared');const credential=channel.authorize();const client=createNative400ReviewClient(service.client,credential);borrowed=true;let released=false,releaseResult=null;
  return Object.freeze({request(...args){need(!released,'node_control_closed');return client.request(...args);},release(){if(released)return releaseResult;released=true;borrowed=false;try{channel.detach(credential);releaseResult={released:true,detached:true};}catch{releaseResult={released:true,detached:false};}return releaseResult;}});
 }});return result;
}
/** Internal trusted host-only loan. No JSON/clone or other module instance can
 * turn a window-shaped value into original request/channel authority. */
export function acquireNative400NodeControlRunClient(window){const c=runWindows.get(window);need(c,'node_control_not_owner');return c.take();}

export function checkNative400NodeControlRunWindow(window){const c=runWindows.get(window);need(c,'node_control_not_owner');c.check();}
