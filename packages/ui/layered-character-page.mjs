import {readLayeredFiles} from './layered-character-files.mjs';
import {prepareLayeredCandidate} from './layered-character-candidate.mjs';
import {createLayeredCharacterLoader} from '../runtime/layered-character-loader.mjs';
import {startNaturalPreview} from './character-natural-preview.mjs';
export function startLayeredPackagePage(){
 const input=document.querySelector('#package-files'),digest=document.querySelector('#package-digest'),license=document.querySelector('#package-license'),status=document.querySelector('#package-status'),host=document.querySelector('#package-host'),template=document.querySelector('#player-template');
 const labels={empty:'尚未加载角色',reading:'正在校验文件',preparing:'正在准备首帧',ready:'角色已加载',closed:'已关闭'};
 const loader=createLayeredCharacterLoader({readSnapshot:readLayeredFiles,prepare:(snapshot,signal)=>prepareLayeredCandidate(snapshot,{signal,createRoot:()=>{const root=document.createElement('section');root.append(template.content.cloneNode(true));return root;},startPreview:startNaturalPreview}),commit:candidate=>{candidate.api.play();host.replaceChildren(candidate.root);},onStatus:s=>{status.textContent=labels[s.phase]+(s.error?' · 本次加载失败：'+s.error:'')+(s.has_current?'（当前角色保留）':'');}});
 let selected=[];
 function loadFiles(files=selected,options={}){selected=Array.from(files);return loader.load({files:[...selected],expectedManifestSha256:options.expectedManifestSha256??digest.value.trim(),allowedArtworkLicenses:options.allowedArtworkLicenses??[license.value.trim()]}).then(result=>{if(result.status==='ready'&&result.generation===loader.status().generation){const s=loader.current().summary;status.textContent=`已独立加载 ${s.character_id} · ${s.parts}层 / ${s.texture_count}张贴图 · ${s.total_bytes}字节。`; }return result;});}
 input.onchange=()=>{selected=Array.from(input.files);loadFiles();};document.querySelector('#package-reload').onclick=()=>loadFiles();document.querySelector('#package-cancel').onclick=()=>loader.cancel();
 addEventListener('pagehide',()=>{selected=[];input.value='';void loader.close();},{once:true});
 const api={loadFiles,cancel:()=>loader.cancel(),close:()=>loader.close(),status:()=>loader.status(),current:()=>loader.current()};window.layeredPackagePreview=api;return api;
}
