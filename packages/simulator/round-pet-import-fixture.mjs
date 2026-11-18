import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {makeNative360Pet4,native360Manifest} from './native360-fixture.mjs';
import {NATIVE360} from '../core/native360-profile.mjs';
import {ROUND_PET_PROFILE,ROUND_PET_RECIPE,roundPetCanonical} from '../core/round-pet-identity.mjs';
import {sha256} from '../runtime/material-import.mjs';
/** Original constant-index media, 46 synthetic IDs; never a real character/package approval. */
export function roundPetImportFixture(directory,{frames=241}={}){
 mkdirSync(directory,{mode:0o700});const bytes=makeNative360Pet4(frames),F=sha256(bytes),ids=native360Manifest().actions.map(a=>a.id);
 const ih=createHash('sha256'),indices=new Uint8Array(360*360);for(let i=0;i<frames;i++)ih.update(indices);const indexSha=ih.digest('hex');
 const actions=ids.map(id=>({id,bytes:bytes.length,sha256:F})),semantics={idle:0,touch:4,thinking:1,working:11,result:43,success:58,waiting:7,error:55};
 const source=Buffer.from(JSON.stringify({protocol:5,width:360,height:360,actions:actions.map(a=>({...a,frames,fps:24})),semantic_actions:semantics})+'\n');
 const content={schema_version:1,catalog:{character_id:'original_test',variant_id:'native360_test',codec:'PET4',display:{width:360,height:360,shape:'circle',pixel_format:'RGB565'},actions,license_ref:'original-test-MIT'},media_profile:{container:'PET4',codec_flag:1,key_interval:12,tile_rows:20,fps:24,frame_limit:360},timing:ids.map(id=>({id,width:360,height:360,fps:24,frames:241,index_sha256:indexSha})),semantics,source_manifest_sha256:sha256(source)};
 const pkg={hash_recipe:ROUND_PET_RECIPE,sha256:'',content};let catalog;
 const approval={schema_version:1,profile:ROUND_PET_PROFILE,namespace:NATIVE360.namespace,firmware_package_sha256:'',hub_manifest_sha256:'',source_manifest_sha256:sha256(source),action_ids:ids,license_ref:'original-test-MIT',approval_id:'original-vector-v1',credits:['dsh-pet-hub original MIT test vector'],source_kind:'original-test',usage:'offline-validation'};
 function commit(){pkg.sha256=sha256(roundPetCanonical(content));catalog={...structuredClone(content.catalog),sha256:pkg.sha256};approval.firmware_package_sha256=pkg.sha256;approval.hub_manifest_sha256=sha256(roundPetCanonical(content.catalog));approval.source_manifest_sha256=content.source_manifest_sha256;
  writeFileSync(join(directory,'package.json'),JSON.stringify(pkg,null,2)+'\n',{mode:0o600});writeFileSync(join(directory,'catalog.json'),JSON.stringify(catalog,null,2)+'\n',{mode:0o600});return {pkg,catalog,approval};}
 writeFileSync(join(directory,'manifest.json'),source,{mode:0o600});for(const a of actions)writeFileSync(join(directory,`${a.id}.pet`),bytes,{mode:0o600});commit();
 return {directory,bytes,F,pkg,content,source,approval,get catalog(){return catalog;},commit};
}
