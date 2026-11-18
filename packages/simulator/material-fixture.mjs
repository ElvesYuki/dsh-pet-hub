import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from '../runtime/material-import.mjs';
/** Generated tiny original synthetic bytes; never copies animation assets. */
export function materialDirectory(root) {
 mkdirSync(root,{recursive:true,mode:0o700});const variants=[];
 for(const size of [240,360]) {
  const actions=[],files=[];
  for(const action of [0,1,11,43,58,7,55,4]){
   const bytes=Buffer.alloc(18);bytes.write('SIM2');bytes.writeUInt16BE(size,4);bytes.writeUInt16BE(size,6);bytes.writeUInt32BE(action,8);bytes.writeUInt32BE(1,12);
   const path=`${size}_${action}.sim`;writeFileSync(join(root,path),bytes);actions.push({id:action,bytes:bytes.length,sha256:sha256(bytes)});files.push({action_id:action,path});
  }
  variants.push({manifest:{character_id:'imported',variant_id:`native_${size}`,codec:'SIM2',license_ref:'synthetic-test',display:{width:size,height:size,shape:'circle',pixel_format:'RGB565'},actions},files});
 }
 const index={schemaVersion:1,variants};const commit=()=>{const raw=JSON.stringify(index);writeFileSync(join(root,'index.json'),raw);return {directory:root,indexSha256:sha256(raw),approvedLicenses:['synthetic-test']};};
 return {index,commit,options:commit()};
}
