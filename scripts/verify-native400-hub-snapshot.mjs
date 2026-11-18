import {parseArgs} from 'node:util';import {mkdtempSync,realpathSync,readFileSync,lstatSync,readdirSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {resolve,join,sep} from 'node:path';import {createHash} from 'node:crypto';
import {createNative400ExecutionSnapshot} from '../packages/runtime/native400-execution-snapshot.mjs';
// Fixed local code-only inventory. No arbitrary source tree, runtime config,
// firmware tool, material, credentials, module import from copies or device I/O.
const {values}=parseArgs({options:{output:{type:'string'}}}),output=values.output&&resolve(values.output),repo=realpathSync('.');
if(!output?.startsWith(join(repo,'.cache')+sep))throw Error('explicit ignored .cache output required');
const digest=b=>createHash('sha256').update(b).digest('hex'),paths=[];
function codeTree(base){for(const name of readdirSync(base).sort()){const file=join(base,name),s=lstatSync(file);if(s.isSymbolicLink())throw Error('code symlink refused');if(s.isDirectory())codeTree(file);else if(file.endsWith('.mjs'))paths.push(file);}}
codeTree('packages');codeTree('apps/service');
paths.push('packages/core/native400-wire-contract.json','packages/core/round-pet-wire-contract.json','package.json','package-lock.json','LICENSE','THIRD_PARTY.md','scripts/verify-native400-hub-snapshot.mjs');paths.sort();
const files=paths.map(path=>({path,sha256:digest(readFileSync(path))})),executable=realpathSync(process.execPath),pin=digest(readFileSync(executable)),root=realpathSync(mkdtempSync(join(tmpdir(),'hub-current-snapshot-')));let snapshot,report;
try{snapshot=createNative400ExecutionSnapshot({enabled:true,directory:root,roots:[{label:'hub',directory:repo,files}],entries:[{role:'manager',root:'hub',path:'packages/runtime/service.mjs'}],runtime:{kind:'node',executable,sha256:pin}});snapshot.verify();report={schema_version:1,passed:true,node_version:process.version,scope:'fixed local hub code-only conservative inventory; copied module not imported or executed',manifest:snapshot.manifest(),view:snapshot.snapshot(),actual_manager_module_executed:false,actual_consumer_or_Python_executed:false,complete_runtime_closure_proven:false,device_evidence:false};}
finally{await snapshot?.close();rmSync(root,{recursive:true,force:true});}
report.cleanup={temporary_environment_removed:!existsSync(root),snapshot_removed:snapshot.snapshot().removed};mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({passed:report.passed,files:files.length,temporary_environment_removed:report.cleanup.temporary_environment_removed}));
