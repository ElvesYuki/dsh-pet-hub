import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { startOrAttach } from '../packages/runtime/service.mjs';
import {createMaterialStore} from '../packages/runtime/material-store.mjs';
import {roleDirectory} from '../packages/simulator/role-fixture.mjs';
import { materialDirectory } from '../packages/simulator/material-fixture.mjs';
import { createSimulation } from '../packages/simulator/session.mjs';
import { createHostPlugin } from '../apps/dsh-plugin/index.mjs';
const {values}=parseArgs({options:{'react-seed':{type:'string'},'demo-materials':{type:'boolean'},streaming:{type:'boolean'},'demo-versions':{type:'boolean'},'demo-roles':{type:'boolean'},'demo-pixels':{type:'boolean'},'candidate-catalog':{type:'string'},'candidate-index-sha256':{type:'string'}}});
if((!!values['candidate-catalog'])!==(!!values['candidate-index-sha256'])||values['candidate-catalog']&&Object.keys(values).some(k=>k.startsWith('demo-')&&values[k]))throw new Error('candidate requires trusted index SHA and cannot mix demo assets');
if(!values['react-seed'])throw new Error('Supply a locally prepared React/ReactDOM seed; never downloads dependencies.');
const seed=readFileSync(resolve(values['react-seed']));
const directory=realpathSync(mkdtempSync(join(tmpdir(),'s2-ui-')));
const demo=values['demo-materials']?(values['demo-roles']?roleDirectory:materialDirectory)(join(directory,'demo-assets'),{pet4:!!values['demo-pixels']}):null;
let materialImport=values['candidate-catalog']?{mode:'streaming',directory:resolve(values['candidate-catalog']),indexSha256:values['candidate-index-sha256'],approvedLicenses:['dsh-pet-nc-86181ce'],approvedPet4Profiles:['native400-candidate-v1']}:demo?{...demo.options,...(values.streaming?{mode:'streaming'}:{})}:undefined;
if(values['demo-versions']){
  if(!demo||!values.streaming)throw new Error('demo versions requires streaming demo materials');
  demo.index.variants.forEach(v=>{v.manifest.character_id='archived_demo';});const archived=createMaterialStore(directory,demo.commit());await archived.ready;await archived.close();
  demo.index.variants.forEach(v=>{v.manifest.character_id='imported';});materialImport={...demo.commit(),mode:'streaming'};
  const orphan=join(directory,'material-store','.staging-11111111-1111-1111-1111-111111111111');mkdirSync(orphan,{mode:0o700});writeFileSync(join(orphan,'partial'),'original demo only',{mode:0o600});
}
const hub=await startOrAttach({directory,deviceMode:'simulation',simulationFactory:createSimulation,materialImport});
let route,dispose;
createHostPlugin(hub.client)({effect(fn){dispose=fn();},webServer:{register(value){route=value;return()=>{route=null;};}}});
const bootstrap=`const root=ReactDOM.createRoot(document.getElementById('app'));let Panel;
window.__ModuleLoader__={load({factory}){const mod=factory(name=>{if(name==='react')return React;throw new Error('unknown external');});mod.apply({get:()=>undefined,slots:{inject(_name,gen){[...gen()];},register(_meta,Component){Panel=Component;root.render(React.createElement(Panel));return()=>root.render(null);}}});}};
window.simTest={unmount(){root.render(null);},mount(){root.render(React.createElement(Panel));}};`;
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pet Hub S2 · 隔离模拟</title><body style="margin:0;background:#fafafa"><div id="app"></div><script src="/react-seed.js"></script><script src="/bootstrap.js"></script><script src="/client.js"></script></body></html>';
const server=http.createServer((req,res)=>{
  if(req.url?.startsWith('/dsh-pet-hub/')) { void route.handler(req,res);return; }
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const content=req.url==='/'?html:req.url==='/react-seed.js'?seed:req.url==='/bootstrap.js'?bootstrap:req.url==='/client.js'?readFileSync('dist/client.js'):null;
  if(content===null){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(content);
});
server.listen(0,'127.0.0.1',()=>console.log(`Simulation preview: http://127.0.0.1:${server.address().port}/`));
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
  if(stopping)return;stopping=true;dispose();server.closeAllConnections();await new Promise(r=>server.close(r));await hub.close();rmSync(directory,{recursive:true,force:true});
});
