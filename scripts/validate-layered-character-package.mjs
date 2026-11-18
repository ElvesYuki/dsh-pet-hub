import {parseArgs} from 'node:util';
import {verifyLayeredDirectory} from '../packages/runtime/layered-character-validator.mjs';
// Explicit read-only L1 audit. Never exports, loads a renderer, starts a service or changes a role.
try{
 const {values:v}=parseArgs({options:{directory:{type:'string'},'manifest-sha256':{type:'string'},'artwork-license-ref':{type:'string'}}});
 if(!v.directory||!v['manifest-sha256']||!v['artwork-license-ref'])throw new Error('explicit_inputs_required');
 console.log(JSON.stringify(verifyLayeredDirectory({directory:v.directory,expectedManifestSha256:v['manifest-sha256'],allowedArtworkLicenses:[v['artwork-license-ref']]})));
}catch(error){
 const codes=['invalid_format','invalid_reference','resource_limit','integrity_failed','invalid_texture','invalid_rig','unsupported_profile','license_unresolved'];
 console.error(JSON.stringify({error:codes.includes(error.code)?error.code:'invalid_format',...(error.resource_id?{resource_id:error.resource_id}:{})}));process.exitCode=1;
}
