import {randomBytes,timingSafeEqual} from 'node:crypto';
import {NATIVE400_CONTROL_ERRORS} from '../core/native400-review-controls-view.mjs';
import {native400ReviewEnvelope,native400StartAck,native400CancelAck} from '../core/native400-review-access.mjs';
const channelFail=code=>Object.assign(new Error(code),{code});
export function native400ReviewError(e){const code=NATIVE400_CONTROL_ERRORS.includes(e?.code)||['controls_invalid_response','controls_body_too_large'].includes(e?.code)?e.code:'controls_operation_failed';return {status:code==='controls_body_too_large'?413:['controls_unauthorized','controls_session_expired'].includes(code)?401:code==='controls_invalid_request'?400:code==='controls_invalid_response'||code==='controls_operation_failed'?503:409,error:code};}
/** Only an elected owner receives trusted authorize/choose/revoke. The separate
 * random credential lives in memory, never in a descriptor or global status.
 * close fences immediately and waits for the controller's actual I/O exit. */
export function createNative400ReviewChannel(controller,instanceId){
 let current=null,grant=null,closed=false;
 function auth(token){if(closed)throw channelFail('controls_closed');if(!current||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(current.token)))throw channelFail('controls_unauthorized');controller.status(current.handle);return current;}
 function revoke(credential){const s=auth(credential?.token);current=null;grant=null;controller.revokeSession(s.handle);}
 const channel={
  authorize(){if(closed)throw channelFail('controls_closed');const s=controller.authorize();current={...s,token:randomBytes(32).toString('hex')};grant=null;return {token:current.token,service_instance_id:instanceId,reviewer_session_id:s.reviewer_session_id};},
  async choose(credential,options){const s=auth(credential?.token),chosen=await controller.choose(s.handle,options);if(auth(credential.token)!==s)throw channelFail('controls_unauthorized');grant=chosen;return structuredClone(chosen);},
  revoke,
  request(token,method,path,body){const s=auth(token);
   if(method==='GET'&&path==='/v1/source-review/controls'){const controls=controller.status(s.handle);if(!controls.selection||controls.selection.sequence!==grant?.selection_seq)grant=null;return native400ReviewEnvelope({controls,selection:grant,sourceReview:controller.sourceSnapshot()});}
   if(method==='POST'&&path==='/v1/source-review/start'){const ack=native400StartAck(controller.start(s.handle,body),body);if(grant?.selection_id===body.selection_id)grant=null;return ack;}
   if(method==='POST'&&path==='/v1/source-review/cancel')return native400CancelAck(controller.cancel(s.handle,body),body);
   throw channelFail('controls_invalid_request');
  },
  close(){closed=true;current=null;grant=null;return controller.close();},
 };
 return {snapshot:()=>controller.sourceSnapshot(),resources:()=>controller.resources(),idle:()=>controller.idle(),close:()=>channel.close(),reviewChannel:channel};
}
/** Server-side only scoped client; old credentials are never sent to a replacement instance. */
export function createNative400ReviewClient(client,credential){
 const {token,service_instance_id:expectedInstanceId}=credential;
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof expectedInstanceId!=='string')throw channelFail('controls_unauthorized');
 return {request:(method,path,body,{signal}={})=>client.request(method,path,body,{signal,reviewToken:token,expectedInstanceId})};
}
