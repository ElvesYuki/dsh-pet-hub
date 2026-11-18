import {bounded,keys,requireThat} from '../core/protocol.mjs';
import {leaseSendBudget} from '../core/lease-budget.mjs';
/** Conditional arithmetic only. R is an explicit hypothetical bound, NEVER a measured sample max. */
export function rootPersistenceBudget(input){
 keys(input,['root_service_ms']);bounded(input.root_service_ms,0,10000);const command_delay_ms=1900+input.root_service_ms,rtt_ms=Math.ceil(2*command_delay_ms*1.0005),send_horizon_ms=leaseSendBudget(15000,{host_ppm:500,device_ppm:500,command_delay_ms,margin_ms:10,max_round_trip_ms:30000,max_lease_ms:15000});
 const request_fits=input.root_service_ms<2000,client_fits=input.root_service_ms<1500,ack_fits=rtt_ms<=4000,lease_fits=rtt_ms<send_horizon_ms;
 return {root_service_ms:input.root_service_ms,command_delay_ms,rtt_ms,send_horizon_ms,request_ms:2000,client_ms:1500,ack_ms:4000,lease_ms:15000,request_fits,client_fits,ack_fits,lease_fits,conditional_fit:request_fits&&client_fits&&ack_fits&&lease_fits};
}
export const ROOT_BOUNDS=[0,50,100,1000,5000,10000];
