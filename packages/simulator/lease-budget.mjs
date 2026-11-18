import {createDualClockLab} from './dual-clock.mjs';import {createLeaseGuard} from '../core/lease-budget.mjs';import {clone,same} from '../core/protocol.mjs';
export const EXAMPLE_LEASE_POLICY={host_ppm:500,device_ppm:500,command_delay_ms:1000,margin_ms:10,max_round_trip_ms:2000,max_lease_ms:15000};
/** Synthetic proof binds a snapshot of packet/context; serialized or mutated proofs cannot authorize.
 * Policy numbers are mathematical examples, not measured oscillator/network values. No socket/TLS. */
export function createLeaseBudgetLab(options={}){
 const lab=createDualClockLab(options),proofs=new WeakMap();let guard;
 const sign=(packet,context)=>{const proof=Object.freeze({synthetic:true});proofs.set(proof,clone({packet,context}));return proof;};
 guard=createLeaseGuard({registry:lab.registry,clock:lab.host,policy:EXAMPLE_LEASE_POLICY,verifyResponse:(proof,packet,context)=>same(proofs.get(proof),{packet,context})});
 function receipt(context,request,grant){const packet={schemaVersion:1,request_id:request.request_id,request_seq:request.request_seq,context:clone(context),kind:request.kind,grant:clone(grant),lease_ms:grant.expires_at-lab.device.now()};return {packet,proof:sign(packet,context)};}
 return {lab,guard,receipt,sign,close(){guard.close();lab.close();}};
}
