import {requireThat} from './protocol.mjs';
export const NATIVE400='native400-candidate-v1';
export const FRAME_RESPONSE_BYTES=524288;
export const SMALL_RESPONSE_BYTES=65536;
export function validatePet4Profile(m){if(m.pet4_profile!==undefined)requireThat(m.pet4_profile===NATIVE400&&m.codec==='PET4'&&m.display.width===400&&m.display.height===400,'unsupported_pet4_profile');if(m.codec==='PET4'&&m.display.width===400)requireThat(m.pet4_profile===NATIVE400,'pet4_profile_required');}
export function approvedProfile(m,approved=[]){validatePet4Profile(m);requireThat(Array.isArray(approved)&&approved.every(p=>p===NATIVE400),'unsupported_pet4_profile');if(m.pet4_profile!==undefined)requireThat(approved.includes(m.pet4_profile),'pet4_profile_not_approved');return m.pet4_profile??'legacy';}
