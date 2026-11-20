import {parseArgs} from 'node:util';
import {readFileSync,readdirSync,lstatSync,realpathSync,mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createNative400ExecutionSnapshot} from '../packages/runtime/native400-execution-snapshot.mjs';
import {createNative400NodeLoadAudit} from '../packages/runtime/native400-node-load-audit.mjs';
// Import-only preparation. No LAN, control-window, bridge or authority constructor
// is called. The output is a review packet, never permission to run a device.
const {values}=parseArgs({options:{output:{type:'string'}}}),repo=realpathSync(fileURLToPath(new URL('..',import.meta.url))),output=values.output&&resolve(values.output);
if(!output?.startsWith(join(repo,'.cache')+sep)||existsSync(output))throw Error('new ignored .cache output required');
const hash=b=>createHash('sha256').update(b).digest('hex'),baseline=JSON.parse(readFileSync(join(repo,'docs/protocol/vectors/native400-tcp26-results.json'),'utf8'));
const candidatePins=JSON.parse(readFileSync(join(repo,'docs/protocol/vectors/desktop-connection-artifacts.json'),'utf8'));
const pins=Object.fromEntries([...Object.entries(baseline.host_core_pins.files),...Object.entries(baseline.unchanged_from_tcp25),...Object.entries(baseline.source_hashes).filter(([p])=>p.startsWith('packages/')),...Object.entries(candidatePins)]);
function readPin(p){const f=join(repo,p),s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||realpathSync(f)!==f)throw Error('hold_prepare_pin_mismatch');return hash(readFileSync(f));}
function checkPins(){for(const [p,expected]of Object.entries(pins))if(readPin(p)!==expected)throw Error('hold_prepare_pin_mismatch');}
checkPins();
const candidate=join(repo,'dist-connection'),paths=[];
function walk(base,prefix=''){for(const e of readdirSync(base,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=prefix+e.name,f=join(base,e.name);if(e.isSymbolicLink())throw Error('hold_prepare_unsafe_code');if(e.isDirectory())walk(f,p+'/');else if(e.isFile()&&p.endsWith('.mjs'))paths.push(p);}}
walk(join(candidate,'packages'),'packages/');paths.push('packages/core/native400-wire-contract.json','packages/core/round-pet-wire-contract.json','package.json');paths.sort();
const files=paths.map(path=>({path,sha256:hash(readFileSync(join(candidate,path)))})),parent=process.env.HUB_TEST_TMPDIR??tmpdir(),root=realpathSync(mkdtempSync(join(parent,'hold-window-prepare-'))),executable=realpathSync(process.execPath);
let snapshot,audit,receipt,resources,removed=false;
try{
 snapshot=createNative400ExecutionSnapshot({enabled:true,directory:root,roots:[{label:'candidate',directory:candidate,files}],entries:[{role:'manager',root:'candidate',path:'packages/runtime/native400-pet-bridge.mjs'}],runtime:{kind:'node',executable,sha256:hash(readFileSync(executable))}});
 audit=createNative400NodeLoadAudit({enabled:true,snapshot});receipt=await audit.ready;if(!receipt.exports.includes('createNative400PetBridge'))throw Error('hold_prepare_export_missing');checkPins();snapshot.verify();
}finally{await audit?.close();resources=audit?.resources();await snapshot?.close();rmSync(root,{recursive:true,force:true});removed=!existsSync(root);}
const report={schema_version:1,profile:'native400-hold-window-preparation/1',prepared:true,device_admission:false,contract:baseline.contract,pinned_source_and_candidate_files:pins,declared_inventory:files,actual_import:receipt,snapshot_sha256:snapshot.snapshot().sha256,runtime:snapshot.manifest().runtime,scope:'fresh private candidate bridge import only; exported constructor not invoked',full_runtime_closure_proven:false,service_started:false,bridge_started:false,device_evidence:false,pending:['fresh_material_and_window_approval','actual_pet_loaded_identity','natural_pet_transition','actual_firmware_load_and_cache_identity','fresh_peer_and_link','device_dynamic_resources_and_display','device_cleanup_and_exact_restore'],cleanup:{audit:resources,snapshot_removed:snapshot.snapshot().removed,temporary_environment_removed:removed}};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({prepared:true,device_admission:false,loaded_files:receipt.loaded.length,temporary_environment_removed:removed}));
