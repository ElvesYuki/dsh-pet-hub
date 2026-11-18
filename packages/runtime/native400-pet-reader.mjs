import {readPetState,readPetPageState} from '../source-pet/index.mjs';
/** Explicit public read adapters only. No discovery, session listening or writes.
 * Page capability wins; HTTP fallback requires a separately supplied loopback base.
 * This does not attest that a real installed pet implements getState. */
export function createNative400PetReader({context,base}={}){
 return async({signal}={})=>{if(context){const value=readPetPageState(context);if(value.status!=='unsupported'||base===undefined)return value;}if(base!==undefined)return {status:'ready',...await readPetState(base,{signal})};return {status:'unsupported'};};
}
