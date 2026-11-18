import {execFileSync} from 'node:child_process';import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPrivateKey,X509Certificate} from 'node:crypto';
/** Generates disposable offline PKI. Never uses OS trust or network; no private material returned in logs. */
export function offlinePKI({parent=tmpdir()}={}){
 const root=mkdtempSync(join(parent,'hub-pki-'));const run=args=>execFileSync('openssl',args,{cwd:root,stdio:['ignore','pipe','pipe'],timeout:10000});
 const text=(n,s)=>writeFileSync(join(root,n),s,{mode:0o600});
 try{
  for(const n of ['root','other']){run(['ecparam','-name','prime256v1','-genkey','-noout','-out',n+'.key']);text(n+'.cnf',`[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=${n}\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n`);run(['req','-new','-x509','-sha256','-key',n+'.key','-days','3','-config',n+'.cnf','-out',n+'.crt']);}
  const certs={};let serial=1;
  for(const [name,issuer,eku,ca,usage,extra] of [['client','root','clientAuth',false,'digitalSignature',''],['server','root','serverAuth',false,'digitalSignature',''],['unknown','root','clientAuth',false,'digitalSignature',''],['wrong_ca','other','clientAuth',false,'digitalSignature',''],['ca_leaf','root','clientAuth',true,'digitalSignature',''],['bad_ku','root','clientAuth',false,'keyEncipherment',''],['critical','root','clientAuth',false,'digitalSignature','1.2.3.4=critical,DER:05:00\n']]){
   run(['ecparam','-name','prime256v1','-genkey','-noout','-out',name+'.key']);run(['req','-new','-sha256','-key',name+'.key','-subj','/CN=same-untrusted-name','-out',name+'.csr']);text(name+'.ext',`basicConstraints=critical,CA:${ca?'TRUE':'FALSE'}\nkeyUsage=critical,${usage}\nextendedKeyUsage=${eku}\nsubjectAltName=DNS:hub.test.invalid\n${extra}`);run(['x509','-req','-sha256','-in',name+'.csr','-CA',issuer+'.crt','-CAkey',issuer+'.key','-set_serial',String(++serial),'-days','1','-extfile',name+'.ext','-out',name+'.crt']);certs[name]={der:new X509Certificate(readFileSync(join(root,name+'.crt'))).raw,key:createPrivateKey(readFileSync(join(root,name+'.key')))};
  }
  return {rootDER:new X509Certificate(readFileSync(join(root,'root.crt'))).raw,otherRootDER:new X509Certificate(readFileSync(join(root,'other.crt'))).raw,certs,verify(name,purpose){try{run(['verify','-CAfile','root.crt','-purpose',purpose,name+'.crt']);return true;}catch(e){if(e.status!==null)return false;throw e;}},resources(){return {exists:existsSync(root)};},close(){rmSync(root,{recursive:true,force:true});}};
 }catch(e){rmSync(root,{recursive:true,force:true});throw new Error('offline PKI generation failed',{cause:e});}
}
