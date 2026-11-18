import {leaseSendBudget} from '../core/lease-budget.mjs';import {requireThat} from '../core/protocol.mjs';
/** Exact rational worst-rate comparison, independent of budget rounding implementation. */
export function verifyLeaseMatrix(){let accepted=0,rejected=0,arrivalChecks=0;const S=1000000n;
 for(const h of [0,50,500,100000])for(const d of [0,50,500,100000])for(const L of [100,2000,15000,30000])for(const B of [0,10,1000,10000])for(const M of [2,10,200]){
  let t;try{t=leaseSendBudget(L,{host_ppm:h,device_ppm:d,command_delay_ms:B,margin_ms:M,max_round_trip_ms:2000,max_lease_ms:30000});}catch(e){requireThat(e.code==='insufficient_lease_budget');rejected++;continue;}accepted++;
  for(const hr of [1000000-h,1000000+h])for(const dr of [1000000-d,1000000+d]){requireThat((BigInt(t)*S+BigInt(B)*BigInt(hr))*BigInt(dr)<BigInt(L)*S*BigInt(hr),'unsafe_arrival');arrivalChecks++;}
 }
 const p={host_ppm:500,device_ppm:500,command_delay_ms:1000,margin_ms:10,max_round_trip_ms:2000,max_lease_ms:15000},t=leaseSendBudget(15000,p);
 requireThat(t/0.9995+2000>15000/1.0005,'counterexample_missing');requireThat(t/0.5+1000>15000/1.0005,'counterexample_missing');
 return {accepted,rejected,arrival_checks:arrivalChecks,example_send_horizon_ms:t,violated_assumption_counterexamples:2,scope:'Exact rate/delay assumptions only; not physical measurements or clock synchronization.'};
}
