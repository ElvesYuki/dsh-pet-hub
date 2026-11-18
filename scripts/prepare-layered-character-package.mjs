import {parseArgs} from 'node:util';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {exportLayeredCharacterPackage} from '../packages/runtime/layered-character-export.mjs';
// Offline explicit authoring only. No service/role activation, network or source code execution.
try{
 const names=['master','master-sha256','expressions','expressions-sha256','raised-arm','raised-arm-manifest-sha256','raised-arm-sha256','character-id','variant-id','version','license-ref','method','output'];
 const {values:v}=parseArgs({options:Object.fromEntries(names.map(n=>[n,{type:'string'}]))});if(names.some(n=>!v[n]))throw new Error('explicit_inputs_required');
 const result=exportLayeredCharacterPackage({repoRoot:resolve(dirname(fileURLToPath(import.meta.url)),'..'),masterDirectory:v.master,masterManifestSha256:v['master-sha256'],expressionDirectory:v.expressions,expressionManifestSha256:v['expressions-sha256'],raisedArmDirectory:v['raised-arm'],raisedArmManifestSha256:v['raised-arm-manifest-sha256'],raisedArmSha256:v['raised-arm-sha256'],characterId:v['character-id'],variantId:v['variant-id'],version:v.version,licenseRef:v['license-ref'],method:v.method,output:v.output});console.log(JSON.stringify(result));
}catch(error){
 const known=['invalid_format','invalid_reference','resource_limit','integrity_failed','invalid_texture','invalid_rig','unsupported_profile','license_unresolved','output_exists'];
 console.error(JSON.stringify({error:known.includes(error.code)?error.code:error.message==='export_cleanup_failed'?'export_cleanup_failed':error.code&&!error.code.startsWith('ERR_PARSE_ARGS')?'export_io_failed':'invalid_format',...(error.resource_id?{resource_id:error.resource_id}:{})}));process.exitCode=1;
}
