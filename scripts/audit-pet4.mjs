import {parseArgs} from 'node:util';
import {realpathSync,writeFileSync} from 'node:fs';
import {inspectPet4,readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {id,requireThat,digest} from '../packages/core/protocol.mjs';
const {values:v}=parseArgs({options:{'source-dir':{type:'string'},'manifest-sha256':{type:'string'},'license-ref':{type:'string'},output:{type:'string'}}});
requireThat(v['source-dir']&&v.output&&v['license-ref']==='dsh-pet-nc-86181ce');digest(v['manifest-sha256']);
const root=realpathSync(v['source-dir']),raw=readRegular(root,'manifest.json',1048576);requireThat(sha256(raw)===v['manifest-sha256'],'source_manifest_changed');
const m=JSON.parse(raw);requireThat([4,5].includes(m.protocol)&&Array.isArray(m.actions)&&m.actions.length>0&&m.actions.length<=256);const seen=new Set(),records=[];
for(const a of m.actions){requireThat(Number.isSafeInteger(a.id)&&a.id>=0&&a.id<=2**32-1&&!seen.has(a.id));seen.add(a.id);id(String(a.id));digest(a.sha256);digest(a.index_sha256);
 const bytes=readRegular(root,`${a.id}.pet`,8388608);requireThat(bytes.length===a.bytes&&sha256(bytes)===a.sha256,'source_asset_changed');
 const detail=inspectPet4(bytes,{player:false});requireThat(detail.frames===a.frames&&detail.fps===a.fps&&detail.index_sha256===a.index_sha256,'reference_mismatch');
 records.push({action_id:a.id,bytes:bytes.length,sha256:a.sha256,...detail});if(records.length%10===0)console.log(`Validated ${records.length}/${m.actions.length}`);
}
requireThat(sha256(readRegular(root,'manifest.json',1048576))===v['manifest-sha256'],'source_manifest_changed');
writeFileSync(v.output,JSON.stringify({status:'all_frames_validated_offline',license_ref:v['license-ref'],source_manifest_sha256:v['manifest-sha256'],actions:records.length,frames:records.reduce((s,a)=>s+a.frames,0),records},null,2)+'\n',{mode:0o600});console.log(`Validated ${records.length} actions / ${records.reduce((s,a)=>s+a.frames,0)} frames`);
