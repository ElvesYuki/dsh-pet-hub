import {ROUND_PET_PROFILE,validateRoundPetApproval} from '../core/round-pet-identity.mjs';
import {NATIVE400_IDENTITY_PROFILE,validateNative400Approval} from '../core/native400-identity.mjs';
import {requireThat as need} from '../core/protocol.mjs';
import {roundPetRecord,roundPetRecordText,roundPetFromRecord,readRoundPetSource,verifyRoundPetAsset,matchRoundPetTiming} from './round-pet-material.mjs';
import {native400Record,native400RecordText,native400FromRecord,readNative400Source,verifyNative400Asset,matchNative400Timing} from './native400-material.mjs';
const legacy=Object.freeze({validateApproval:validateRoundPetApproval,record:roundPetRecord,recordText:roundPetRecordText,fromRecord:roundPetFromRecord,readSource:readRoundPetSource,verifyAsset:verifyRoundPetAsset,matchTiming:matchRoundPetTiming,approvedPet4Profiles:Object.freeze([])});
const native400=Object.freeze({validateApproval:validateNative400Approval,record:native400Record,recordText:native400RecordText,fromRecord:native400FromRecord,readSource:readNative400Source,verifyAsset:verifyNative400Asset,matchTiming:matchNative400Timing,approvedPet4Profiles:Object.freeze(['native400-candidate-v1'])});
/** Trusted explicit import profile, never selected from an untrusted package/ledger. */
export function roundPetMaterialProfile(profile=ROUND_PET_PROFILE){need([ROUND_PET_PROFILE,NATIVE400_IDENTITY_PROFILE].includes(profile),'unsupported_round_pet_profile');return profile===NATIVE400_IDENTITY_PROFILE?native400:legacy;}
