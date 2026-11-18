import {mkdirSync,readdirSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,linkSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireThat as need,digest,clone} from '../core/protocol.mjs';
import {ROUND_PET_PROFILE,parseRoundPetJson} from '../core/round-pet-identity.mjs';
import {NATIVE400_IDENTITY_PROFILE} from '../core/native400-identity.mjs';
import {readRegular} from './material-import.mjs';
import {privatePath} from './paths.mjs';
import {layeredDirectoryRoot} from './layered-character-validator.mjs';
import {createMaterialStore} from './material-store.mjs';
import {roundPetMaterialProfile} from './round-pet-material-profiles.mjs';

function ledgerRoot(directory,create=true){const root=join(directory,'round-pet-provenance');if(create)try{mkdirSync(root,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}privatePath(root,'directory');return root;}
function checkEntries(root){const names=readdirSync(root);need(names.length<=32&&names.every(n=>/^[a-f0-9]{64}\.json$/.test(n)),'round_pet_provenance_limit');for(const n of names){const path=join(root,n);privatePath(path,'file');need(lstatSync(path).size<=262144,'round_pet_provenance_limit');}return names;}
function publishRecord(directory,metadata){
 const root=ledgerRoot(directory),names=checkEntries(root),name=metadata.indexSha256+'.json',text=roundPetMaterialProfile(metadata.identity.profile).recordText(metadata);need(Buffer.byteLength(text)<=262144,'round_pet_provenance_limit');
 if(names.includes(name)){need(readRegular(root,name,262144).equals(Buffer.from(text)),'round_pet_provenance_conflict');return;}
 need(names.length<32,'round_pet_provenance_limit');const temp=join(root,`.pending-${randomUUID()}`),fd=openSync(temp,'wx',0o600);
 try{try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}
  try{linkSync(temp,join(root,name));}catch(e){if(e.code!=='EEXIST')throw e;privatePath(join(root,name),'file');need(readRegular(root,name,262144).equals(Buffer.from(text)),'round_pet_provenance_conflict');}}
 finally{unlinkSync(temp);}
}
/** Explicit offline streaming adapter. No IPC/CLI/service activation. Approval is independent of files.
 * ready succeeds only after full worker validation, CAS publication and non-overwriting provenance.
 * close is async/idempotent, terminates the worker and releases its catalog pin; durable data remains.
 * CAS and ledger are two commits: ledger failure may leave a valid unapproved ordinary CAS version.
 * Internal dependency hooks are for isolated faults, never accepted from untrusted configuration. */
export function createRoundPetImport(directory,{sourceDirectory,approval,indexSha256,cachedOnly=false,profile=ROUND_PET_PROFILE}={}, {lifecycle,storeOptions={},publish=publishRecord}={}){
 directory=layeredDirectoryRoot(directory);privatePath(directory,'directory');const material=roundPetMaterialProfile(profile);approval=material.validateApproval(approval);
 let metadata,source;
 if(cachedOnly){
  digest(indexSha256);const root=ledgerRoot(directory,false),name=indexSha256+'.json';checkEntries(root);privatePath(join(root,name),'file');
  metadata=material.fromRecord(parseRoundPetJson(readRegular(root,name,262144)),approval);need(metadata.indexSha256===indexSha256,'index_integrity_failed');source=join(directory,'material-store',indexSha256);
 }else{
  need(indexSha256===undefined,'invalid_round_pet_metadata');metadata=material.readSource(sourceDirectory,approval);source=sourceDirectory;
 }
 const options={directory:source,indexSha256:metadata.indexSha256,approvedLicenses:[approval.license_ref],approvedPet4Profiles:material.approvedPet4Profiles,cachedOnly,roundPet:{profile,record:material.record(metadata),approval:clone(approval)}};
 const store=createMaterialStore(directory,options,lifecycle,storeOptions);let closed=false,failure=null,closing=null,published=false;
 const close=()=>{closed=true;return closing??=store.close();};
 const ready=(async()=>{try{
  const bundle=await store.ready;need(!closed,'store_closed');publish(directory,metadata);need(!closed,'store_closed');published=true;
  return {...bundle,identity:clone(metadata.identity),provenance:clone(material.record(metadata))};
 }catch(cause){failure=cause.code??'round_pet_import_failed';await close();throw cause;}})();ready.catch(()=>{});
 return {ready,close,snapshot(){const s=store.snapshot();return {...s,phase:failure?'failed':closed?'closed':published?'ready':s.phase==='ready'?'publishing':s.phase,...(failure?{error:failure}:{}),profile:metadata.identity.profile,provenance_published:published,identity:clone(metadata.identity)};}};
}
/** Main 400-01 offline entry. Does not enable devices/transport; 360 entry remains a backup. */
export function createNative400Import(directory,options={},dependencies){need(options.profile===undefined||options.profile===NATIVE400_IDENTITY_PROFILE,'unsupported_round_pet_profile');return createRoundPetImport(directory,{...options,profile:NATIVE400_IDENTITY_PROFILE},dependencies);}
