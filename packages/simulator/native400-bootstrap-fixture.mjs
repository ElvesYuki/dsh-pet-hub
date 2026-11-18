import {mkdtempSync,realpathSync,openSync,closeSync,ftruncateSync,writeSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {native400IdentityFixture} from './native400-identity-fixture.mjs';import {NATIVE400_BOOT_NAMESPACE,NATIVE400_BOOT_LAYOUT as L} from '../core/native400-bootstrap.mjs';import {crc32} from '../core/pet4.mjs';
/** MIT original sparse test data only. Never a real role/install image. No CLI writer. */
export function native400BootstrapFixture(){
 const root=realpathSync(mkdtempSync(join(process.env.HUB_TEST_TMPDIR??tmpdir(),'n408-'))),file=join(root,'original.fixture'),source=native400IdentityFixture(),metadata=source.metadata(),fd=openSync(file,'wx+',0o600),roots=[],objects=[];let closed=false;
 const seal=b=>{b.writeUInt32LE(crc32(b.subarray(0,248)),248);b.writeUInt32LE(0x36434d54,252);return b;};
 function header(magic,generation){const b=Buffer.alloc(256);b.write(magic);b.writeBigUInt64LE(BigInt(generation),8);Buffer.from(NATIVE400_BOOT_NAMESPACE,'hex').copy(b,24);[2,400,24,20,12,1].forEach((x,i)=>b.writeUInt32LE(x,112+4*i));return b;}
 ftruncateSync(fd,L.bytes);
 [0,4,1,11].forEach((action,slot)=>{const bytes=source.bytes(action),b=header('PET4OBJ2',slot+1);b.writeUInt32LE(action,16);b.writeUInt32LE(bytes.length,20);Buffer.from(metadata.manifest.actions[action].sha256,'hex').copy(b,56);objects.push(seal(b));writeSync(fd,bytes,0,bytes.length,8192+slot*L.stride+4096);});objects.push(Buffer.alloc(256));
 for(let i=0;i<2;i++){const b=header('PET4ROT2',i+1);b.writeUInt32LE(2,16);b.writeUInt32LE(0,56);b.writeUInt32LE(4,60);for(let j=0;j<4;j++){b.writeUInt32LE(j,64+12*j);b.writeBigUInt64LE(BigInt(j+1),68+12*j);}roots.push(seal(b));}
 const a=metadata.approval,mappingApproval={schema_version:1,profile:'native400-bootstrap-source-review/1',usage:'offline-source-review',namespace_boot:NATIVE400_BOOT_NAMESPACE,namespace_offline:metadata.identity.namespace,firmware_package_sha256:a.firmware_package_sha256,hub_manifest_sha256:a.hub_manifest_sha256,source_manifest_sha256:a.source_manifest_sha256,source_index_sha256:a.source_index_sha256,action_ids:[0,4,1,11],approval_id:'original-bootstrap-review',candidate_approval_id:a.approval_id,license_ref:a.license_ref,credits:a.credits,source_kind:a.source_kind};
 function sync(){roots.forEach((b,i)=>writeSync(fd,b,0,256,i*4096));objects.forEach((b,i)=>writeSync(fd,b,0,256,8192+i*L.stride));}sync();
 return {root,file,roots,objects,metadata,mappingApproval,assetBytes:source.bytes,seal,sync,inputs:()=>({package:metadata.package,catalog:metadata.catalog,approval:metadata.approval,mappingApproval}),header,write:(offset,b)=>writeSync(fd,b,0,b.length,offset),close(){if(closed)return;closed=true;closeSync(fd);rmSync(root,{recursive:true,force:true});}};
}
