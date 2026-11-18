import {openSync,closeSync,readSync,writeFileSync,fstatSync,fsyncSync,renameSync,unlinkSync,lstatSync,realpathSync,constants} from 'node:fs';
import {join} from 'node:path';import {randomBytes} from 'node:crypto';
import {roundPetCanonical as C,parseRoundPetJson} from '../core/round-pet-identity.mjs';
import {uint64,increment,clone,requireThat as need} from '../core/protocol.mjs';
import {native400ReviewSourceName} from '../core/native400-source-review-view.mjs';
import {sha256} from './material-import.mjs';import {privatePath} from './paths.mjs';
const fail=(code,cause)=>Object.assign(new Error(code,{cause}),{code}),LIMIT=65536,PROTOCOL='native400-source-review-journal/1';
const exact=(v,fields)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k)),'review_journal_invalid');
const exists=p=>{try{lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
/** Explicit private directory; one historical record, no approval lookup or source access.
 * Synchronous CAS/wx lock/file+directory fsync. After-rename errors freeze this owner;
 * stale locks/bad files are preserved. Revision high water is instance-local only.
 * validateMap is the inspector bound to freshly supplied independent approvals.
 * fault(stage) and commit's valid() are synchronous test/lifecycle hooks. */
export function openNative400ReviewJournal({directory,create=false,validateMap,fault=()=>{}}){
 need(typeof directory==='string'&&typeof validateMap==='function'&&typeof fault==='function','review_journal_invalid');
 try{privatePath(directory,'directory');}catch(cause){throw fail('review_journal_invalid',cause);}const dir=realpathSync(directory),file=join(dir,'source-review.json'),lock=join(dir,'source-review.write.lock'),origin=lstatSync(dir);
 let closed=false,uncertain=false,seen=null;
 const active=()=>{need(!closed,'review_closed');need(!uncertain,'review_commit_unknown');};
 function directoryCheck(){try{privatePath(dir,'directory');const s=lstatSync(dir);need(s.dev===origin.dev&&s.ino===origin.ino,'review_journal_invalid');}catch(cause){throw fail('review_journal_invalid',cause);}}
 function recordCheck(input){exact(input,['source_name','map']);native400ReviewSourceName(input.source_name);return {source_name:input.source_name,map:validateMap(input.map)};}
 function encode(data){exact(data,['schema_version','revision','record']);need(data.schema_version===1,'review_journal_invalid');uint64(data.revision);need((data.revision==='0')===(data.record===null),'review_journal_invalid');if(data.record!==null)recordCheck(data.record);const sha=sha256(C(data)),raw=C({protocol:PROTOCOL,content:data,sha256:sha});need(Buffer.byteLength(raw)<=LIMIT,'review_journal_capacity');return {raw,sha};}
 function remember(data,sha){need(!seen||uint64(data.revision)>uint64(seen.revision)||(data.revision===seen.revision&&sha===seen.sha),'review_journal_rollback');seen={revision:data.revision,sha};return clone(data);}
 function load(){let fd;try{
  directoryCheck();fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const s=fstatSync(fd,{bigint:true});
  need(s.isFile()&&s.uid===BigInt(process.getuid())&&(s.mode&0o077n)===0n&&s.nlink===1n&&s.size>0n&&s.size<=BigInt(LIMIT),'review_journal_invalid');
  const buffer=Buffer.alloc(Number(s.size)+1);let n=0;while(n<buffer.length){const got=readSync(fd,buffer,n,buffer.length-n,n);if(!got)break;n+=got;}need(n===Number(s.size),'review_journal_invalid');
  const end=fstatSync(fd,{bigint:true}),path=lstatSync(file,{bigint:true});need(['dev','ino','size','uid','mode','nlink','mtimeNs','ctimeNs'].every(k=>s[k]===end[k]&&s[k]===path[k]),'review_journal_invalid');
  const envelope=parseRoundPetJson(buffer.subarray(0,n));exact(envelope,['protocol','content','sha256']);const encoded=encode(envelope.content);need(envelope.protocol===PROTOCOL&&envelope.sha256===encoded.sha,'review_journal_invalid');return remember(envelope.content,encoded.sha);
 }catch(cause){if(cause.code==='review_journal_rollback')throw cause;throw fail('review_journal_invalid',cause);}finally{if(fd!==undefined)closeSync(fd);}}
 function persist(expected,next,initial=false,valid=()=>true){active();directoryCheck();uint64(next.revision);const encoded=encode(next);let owner,fd,temp,renamed=false;
  try{
   try{owner=openSync(lock,'wx',0o600);}catch(cause){throw fail('review_journal_locked',cause);}
   if(initial)need(!exists(file),'revision_conflict');else need(load().revision===expected,'revision_conflict');
   need(valid(),'review_cancelled');fault('before_write');need(valid(),'review_cancelled');temp=join(dir,'.source-review-'+randomBytes(16).toString('hex')+'.tmp');fd=openSync(temp,'wx',0o600);writeFileSync(fd,encoded.raw);fsyncSync(fd);closeSync(fd);fd=undefined;
   fault('before_rename');need(valid(),'review_cancelled');directoryCheck();renameSync(temp,file);renamed=true;fault('after_rename');
   const dfd=openSync(dir,constants.O_RDONLY);try{fsyncSync(dfd);}finally{closeSync(dfd);}fault('after_sync');return remember(next,encoded.sha);
  }catch(cause){if(renamed){uncertain=true;throw fail('review_commit_unknown',cause);}if(['revision_conflict','review_journal_locked','review_journal_invalid','review_journal_rollback','review_cancelled'].includes(cause.code))throw cause;throw fail('review_storage_failed',cause);
  }finally{
   let cleanupError=null;const cleanup=work=>{try{work();}catch(cause){cleanupError??=cause;}};
   if(fd!==undefined)cleanup(()=>closeSync(fd));if(temp)cleanup(()=>{if(exists(temp))unlinkSync(temp);});
   if(owner!==undefined){cleanup(()=>fault('before_unlock'));cleanup(()=>closeSync(owner));cleanup(()=>unlinkSync(lock));}
   if(cleanupError){if(renamed)uncertain=true;throw fail(renamed?'review_commit_unknown':'review_storage_failed',cleanupError);}
  }
 }
 need(!exists(lock),'review_journal_locked');if(!exists(file)){need(create,'review_journal_missing');persist(null,{schema_version:1,revision:'0',record:null},true);}else load();
 return {
  read(){active();need(!exists(lock),'review_journal_locked');return load();},
  commit(expected,record,{valid=()=>true}={}){uint64(expected);need(typeof valid==='function','review_journal_invalid');return persist(expected,{schema_version:1,revision:increment(expected),record:recordCheck(record)},false,valid);},
  resources:()=>({closed,uncertain}),close(){closed=true;}
 };
}
