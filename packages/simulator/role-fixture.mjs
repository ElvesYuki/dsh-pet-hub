import {makePet4Sample} from './pet4-sample.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {sha256} from '../runtime/material-import.mjs';
/** Original contract package: SIM2 by default, optional geometric PET4 test animation. */
export function roleDirectory(root,{pet4=false}={}){
 mkdirSync(root,{recursive:true,mode:0o700});const variants=[];
 for(const size of [240,360]){
  const actions=[],files=[];for(const [action,loop] of [[100,'loop'],[200,'once_idle'],[300,'once_hold']]){
   let bytes=Buffer.alloc(18);bytes.write('SIM2');bytes.writeUInt16BE(size,4);bytes.writeUInt16BE(size,6);bytes.writeUInt32BE(action,8);bytes.writeUInt32BE(1,12);
   if(pet4)bytes=makePet4Sample(size,(action/100-1));
   const path=`${size}_${action}.${pet4?'pet':'sim'}`;writeFileSync(join(root,path),bytes);files.push({action_id:action,path});actions.push({id:action,bytes:bytes.length,sha256:sha256(bytes),fps:24,frames:pet4?13:1,loop});
  }
  variants.push({manifest:{package_schema:2,character_id:'original_role',variant_id:`role_${size}`,codec:pet4?'PET4':'SIM2',license_ref:'original-test-MIT',display:{width:size,height:size,shape:'circle',pixel_format:'RGB565'},semantics:{idle:100,thinking:200,working:200,result:200,success:200,waiting:100,error:300,touch:300},actions},files});
 }
 const index={schemaVersion:1,variants};const commit=()=>{const raw=JSON.stringify(index);writeFileSync(join(root,'index.json'),raw);return {directory:root,indexSha256:sha256(raw),approvedLicenses:['original-test-MIT']};};return {index,commit,options:commit()};
}
