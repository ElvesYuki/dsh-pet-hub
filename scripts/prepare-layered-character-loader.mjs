import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {layeredDirectoryRoot} from '../packages/runtime/layered-character-validator.mjs';
import {naturalPreviewHtml} from './character-natural-preview-page.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function layeredLoaderHtml({expectedManifestSha256='',artworkLicenseRef=''}={}){
 if(expectedManifestSha256!==''&&!/^[a-f0-9]{64}$/.test(expectedManifestSha256))throw new Error('invalid_digest');
 if(artworkLicenseRef!==''&&!/^[A-Za-z0-9_-]{1,64}$/.test(artworkLicenseRef))throw new Error('invalid_license_ref');
 const modules={},entry='packages/ui/layered-character-page.mjs';
 function bundle(path){const id='layered/'+path;if(Object.hasOwn(modules,id))return id;modules[id]='';let source=readFileSync(join(root,path),'utf8');source=source.replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,quote,spec)=>{const target=relative(root,resolve(root,dirname(path),spec));if(!/^(packages\/(core|runtime|ui)\/|scripts\/character-natural-preview\.mjs$)/.test(target))throw new Error('unexpected_module');return 'from '+JSON.stringify(bundle(target));});modules[id]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');return id;}
 const entryId=bundle(entry),legacy=naturalPreviewHtml({face:{assets:{}},speech:true,states:true,wave:true},'','');
 const style=legacy.slice(legacy.indexOf('<style>'),legacy.indexOf('</style>')+8),markup=legacy.slice(legacy.indexOf('</style>')+8,legacy.indexOf('<script>'));
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>分层角色包 · 独立加载</title>${style}<style>input[type=text]{width:min(640px,90vw);font:14px monospace}#package-status{min-height:2em}#package-controls{padding:16px;border:1px solid #61728a}#package-host:empty{padding:24px}</style><h1>分层角色包 · 独立加载</h1><p>选择导出的 package 文件夹，核对制作回执的 SHA-256 和素材许可标识后加载。新包校验、解码和首帧准备完成后才替换当前角色；失败或取消会保留当前角色。</p><section id="package-controls"><label>期望 manifest SHA-256<br><input id="package-digest" type="text" maxlength="64" value="${expectedManifestSha256}"></label><br><label>允许的素材许可标识<br><input id="package-license" type="text" maxlength="64" value="${artworkLicenseRef}"></label><br><label>选择 package 文件夹 <input id="package-files" type="file" webkitdirectory multiple></label><button id="package-reload">重新加载所选包</button><button id="package-cancel">取消本次加载</button><p id="package-status" role="status">尚未加载角色</p></section><main id="package-host"></main><template id="player-template">${markup}</template><script type="importmap">${JSON.stringify({imports:modules})}</script><script type="module">import {startLayeredPackagePage} from '${entryId}';startLayeredPackagePage();</script></html>`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--out','--expected-manifest-sha256','--artwork-license-ref'].includes(args[i])||!args[i+1])throw new Error('invalid_arguments');options[args[i]]=args[i+1];}
 const out=resolve(root,options['--out']??'.cache/layered-character/package-loader-v1');if(!out.startsWith(join(root,'.cache')+'/')||existsSync(out))throw new Error('new_cache_output_required');
 let ancestor=dirname(out);while(!existsSync(ancestor))ancestor=dirname(ancestor);layeredDirectoryRoot(ancestor);
 const html=layeredLoaderHtml({expectedManifestSha256:options['--expected-manifest-sha256'],artworkLicenseRef:options['--artwork-license-ref']});mkdirSync(dirname(out),{recursive:true});layeredDirectoryRoot(dirname(out));mkdirSync(out,{mode:0o700});writeFileSync(join(out,'index.html'),html,{flag:'wx'});console.log(JSON.stringify({status:'offline_loader_generated_not_activated',file:join(out,'index.html'),bytes:Buffer.byteLength(html)}));
}
