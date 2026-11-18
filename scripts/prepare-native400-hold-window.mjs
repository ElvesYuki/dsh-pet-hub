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
const baselinePins=Object.fromEntries([...Object.entries(baseline.host_core_pins.files),...Object.entries(baseline.unchanged_from_tcp25),...Object.entries(baseline.source_hashes).filter(([p])=>p.startsWith('packages/')),...Object.entries(baseline.candidate_artifacts)]);
// Each reviewed VP8 client must be paired with the pinned VP8 host. The
// other TCP26 pins and the import-only boundary continue to apply.
const vp8PluginPins={
 'dist-dsh022/client.js':'48a08bb9d92c02e50b8da700cac0f3215dac26c30c24e6200a4a046c52dbfa87',
 'dist-dsh022/apps/dsh-plugin/host-022.mjs':'df97c4470389b1bac4698cb2763fd07fcb225c9120f3c14f36c016250ddfa772',
};
function readPin(p){const f=join(repo,p),s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||realpathSync(f)!==f)throw Error('hold_prepare_pin_mismatch');return hash(readFileSync(f));}
const media2Pins={...vp8PluginPins,'dist-dsh022/client.js':'fdc855e7ea9969d6db050ef2443e5cd97d3712eaf9b0302461e821866aae37b7'};
const ota14Pins={...vp8PluginPins,'dist-dsh022/client.js':'79c609581ffb7a9eebad99e603012da14a765baa672630ca173c2004500cda61'};
const dailyOtaPins={...vp8PluginPins,'dist-dsh022/client.js':'b8e36fabd70d789e3f0d4591cf65a847ef139413f83e4c3faa794540ab0ee96e'};
const desktopQueryPins={'dist-dsh022/client.js':'8455fdb5cf81b3f1feef324547d65e071629c4a0fde65020c3eaf231cf1bff1c',
 'dist-dsh022/apps/dsh-plugin/host-022.mjs':'d3dd32cf4c57bc455a3d78b24dedf01db30885463e680002b3b97e3a0d33455f'};
const desktopWavePins={...desktopQueryPins,'dist-dsh022/client.js':'ce6a66d395938261911e3a7a0daab78aeac2fc1cb55165fdbae2d63e6ef8b9a9'};
const desktopManagedPins={...desktopWavePins,'dist-dsh022/apps/dsh-plugin/host-022.mjs':'b990481608f12012b455968026ed2ad4305f6259bb05d4f789bba1d4db7b5d2e'};
const desktopNoCodePins={'dist-dsh022/client.js':'ab0f8b17130b8df2c6eda404a8d419ed8240c1bf15d2f0b5c9dc0eb5ba9e4a80',
 'dist-dsh022/apps/dsh-plugin/host-022.mjs':'731004056e88bd4be8d78082bf8ac1983ffc6106c302c8a542396a988c2e489e'};
const matchingVp8Pins=[desktopNoCodePins,desktopManagedPins,desktopWavePins,desktopQueryPins,dailyOtaPins,ota14Pins,media2Pins,vp8PluginPins].find(group=>Object.entries(group).every(([p,expected])=>readPin(p)===expected));
const pins=matchingVp8Pins?{...baselinePins,...matchingVp8Pins}:baselinePins;
function checkPins(){for(const [p,expected]of Object.entries(pins))if(readPin(p)!==expected)throw Error('hold_prepare_pin_mismatch');}
checkPins();
const candidate=join(repo,'dist-dsh022'),paths=[];
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
