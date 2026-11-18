import {native400WindowCapabilities} from './native400-window.mjs';
import {validateNative400Wire,NATIVE400_WIRE_PROFILE} from './native400-wire.mjs';
import {parseRoundPetJson,roundPetCanonical as C} from './round-pet-identity.mjs';
import {keys,id,uint64,bounded,digest,clone,requireThat as need} from './protocol.mjs';
/** Trusted code-only session dependencies. No wire/IPC configuration selects this profile. */
export function native400SessionProfile(){return Object.freeze({
 capabilities:native400WindowCapabilities,
 target(value,manifest,caps){native400WindowCapabilities(caps);keys(value,['command_id','revision','character_id','variant_id','manifest_sha256','action_id','asset_sha256']);need(Object.keys(value).length===7,'incompatible_asset');id(value.command_id);need(uint64(value.revision)>0n,'stale_revision');bounded(value.action_id,0,77);const a=manifest.actions[value.action_id];need(a?.id===value.action_id&&value.character_id===manifest.character_id&&value.variant_id===manifest.variant_id&&digest(value.manifest_sha256)===manifest.sha256&&digest(value.asset_sha256)===a.sha256&&a.bytes<=caps.max_asset_bytes,'incompatible_asset');return clone(a);},
 decodeLease(bytes){need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=4096,'wire_size');const r=parseRoundPetJson(bytes);need(new TextDecoder().decode(bytes)===C(r)&&r.type==='lease.granted','invalid_wire');validateNative400Wire({protocol:'hub-device/1',profile:NATIVE400_WIRE_PROFILE,schema_version:1,type:'exchange.request',request_id:r.request_id,request_seq:r.request_seq,context:r.context,payload:{observation:{dispatch_id:null,record:r}}});return {schemaVersion:1,request_id:r.request_id,request_seq:r.request_seq,context:r.context,kind:r.kind,grant:r.control,lease_ms:r.lease_ms};}
});}
