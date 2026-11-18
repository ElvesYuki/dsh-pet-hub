import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {sha256,readRegular} from '../packages/runtime/material-import.mjs';
import {splitHairPixels,reconstructHairPixels,validateHairLayout} from './hair-static-master.mjs';

// Explicit offline authoring CLI; the renderer belongs to the preinstalled tool environment.
const {values:v}=parseArgs({options:{source:{type:'string'},output:{type:'string'},'renderer-module':{type:'string'}}});
if(!v.source||!v.output||!v['renderer-module'])throw new Error('explicit_hair_paths_required');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(root,v.output),parts=relative(root,out).split('/');
if(parts[0]!=='.cache'||parts.length<2||parts.some(p=>!p||p==='.'||p==='..'))throw new Error('hair_output_must_be_in_repo_cache');
let parent=root;for(const p of parts){parent=join(parent,p);if(existsSync(parent)&&(lstatSync(parent).isSymbolicLink()||!lstatSync(parent).isDirectory()))throw new Error('unsafe_hair_output');}
if(existsSync(out))throw new Error('hair_output_exists');
const layoutRaw=readFileSync(join(root,'docs/art/hair-layout-v1.json')),layout=JSON.parse(layoutRaw);validateHairLayout(layout);
const sourcePath=resolve(v.source),source=readRegular(realpathSync(dirname(sourcePath)),sourcePath.split('/').at(-1),4194304);
if(sha256(source)!==layout.source_sha256)throw new Error('hair_source_changed');
const sharp=createRequire(import.meta.url)(resolve(v['renderer-module']));
const {data:rgba,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==360||info.height!==360||info.channels!==4)throw new Error('hair_source_profile');
const split=splitHairPixels(rgba,layout),files=[],records=[],decoded=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const layer of split.layers){
 if(layer.id!=='rest'&&!layer.count)throw new Error(`empty_hair_part:${layer.id}`);
 const bytes=await sharp(Buffer.from(layer.rgba),{raw:{width:360,height:360,channels:4}}).png({palette:false}).toBuffer();
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();decoded.push({id:layer.id,rgba:raw});
 let x1=360,y1=360,x2=0,y2=0;for(let y=0;y<360;y++)for(let x=0;x<360;x++)if(raw[(y*360+x)*4+3]>=16){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x+1);y2=Math.max(y2,y+1);}
 files.push([`${layer.id}.png`,bytes]);records.push({id:layer.id,label:layer.label,file:`${layer.id}.png`,size:[360,360],offset:[0,0],parent:layer.parent??null,pivot:layer.pivot??null,pivot_status:'manually_proposed_not_motion_validated',visible_pixel_count:layer.count,alpha16_bounds:[x1,y1,x2,y2],sha256:sha256(bytes),hidden_completion:'pending_separate_artwork'});
}
const restored=reconstructHairPixels(decoded);let mismatch=0,max=0;
for(let p=0;p<rgba.length;p+=4)if(rgba[p+3]||restored[p+3])for(let c=0;c<4;c++){const diff=Math.abs(rgba[p+c]-restored[p+c]);if(diff)mismatch++;max=Math.max(max,diff);}
if(mismatch)throw new Error('visible_hair_reconstruction_changed');
const composite=await sharp(Buffer.from(restored),{raw:{width:360,height:360,channels:4}}).png({palette:false}).toBuffer();files.push(['composite.png',composite]);
const colors=['#e879f9','#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#2dd4bf','#38bdf8','#818cf8','#c084fc','#f472b6','#a8a29e'];
const annotations=[];
for(let y=0;y<360;y++)for(let x=0;x<360;){const owner=split.owners[y*360+x];let end=x+1;while(end<360&&split.owners[y*360+end]===owner)end++;if(owner)annotations.push(`<path d="M${x} ${y+.5}H${end}" stroke="${colors[owner-1]}" stroke-opacity=".5"/>`);x=end;}
const baseUri=`data:image/png;base64,${source.toString('base64')}`;
const svgStart='<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="360" height="360" viewBox="0 0 360 360">';
const layeredSvg=svgStart+records.map((r,i)=>`<g id="${r.id}" inkscape:groupmode="layer" inkscape:label="${esc(r.label)}"><image width="360" height="360" href="data:image/png;base64,${files[i][1].toString('base64')}"/></g>`).join('')+'</svg>';
const annotation=`<svg xmlns="http://www.w3.org/2000/svg" width="850" height="400" viewBox="0 0 850 400"><rect width="850" height="400" fill="#131923"/><g transform="translate(10 20)"><image width="360" height="360" href="${baseUri}"/>${annotations.join('')}${layout.parts.map((p,i)=>`<circle cx="${p.pivot[0]}" cy="${p.pivot[1]}" r="2" fill="${colors[i]}"/>`).join('')}</g><g fill="#ecf2f8" font-family="sans-serif" font-size="13">${layout.parts.map((p,i)=>`<text x="390" y="${32+i*26}" fill="${colors[i]}">${i+1}. ${esc(p.id)} · ${esc(p.label)}</text>`).join('')}<text x="390" y="365">色块为实际像素归属，圆点为试标支点。</text><text x="390" y="387">只分可见面；遮挡补画与动态尚未验收。</text></g></svg>`;
const manifest={status:'visible_hair_static_master_draft_hidden_completion_pending',canvas:[360,360],source_sha256:sha256(source),layout_sha256:sha256(layoutRaw),renderer:`sharp ${sharp.versions.sharp}`,parts:records,verification:{visible_rgba_component_mismatches:mismatch,max_visible_component_error:max,ownership:'disjoint_and_complete_with_residual',semantic_segmentation:'manual_heuristic_requires_review',pivots_motion_verified:false,hidden_completion_verified:false,device_verified:false},license_ref:'dsh-pet-nc-86181ce',credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet']};
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>12层头发静态母版首稿</title><style>body{font:16px/1.65 system-ui;background:#131923;color:#e9f0f7;margin:24px}p{max-width:1120px}.row{display:flex;gap:20px;flex-wrap:wrap}figure{margin:0}.stage{width:360px;height:360px;position:relative;background:#000}.stage img{position:absolute;inset:0;width:360px;height:360px}.part{width:180px;height:180px;background:#273247}.part img{width:180px;height:180px;display:block}figcaption{max-width:360px}.controls{max-width:1150px}.controls label{display:inline-block;margin:4px 12px 4px 0}.annotation{width:850px;max-width:100%;height:auto}button{margin:8px}</style><h1>12层头发 · 原像素静态母版首稿</h1><p>360坐标原位拆分，无缩放居中；完整静态合成经独立PNG解码后与标准底稿可见RGBA逐值一致。像素还原不代表分割语义和运动已通过：仍需检查发束混入配件、静态残留头发、遮挡补画和根部支点。</p><div class="row"><figure><div class="stage"><img src="../authoring-base-v1/neutral-360.png" alt="标准底稿"></div><figcaption>标准底稿</figcaption></figure><figure><div class="stage">${records.map(r=>`<img data-layer="${r.id}" src="${r.file}" alt="${esc(r.label)}">`).join('')}</div><figcaption>真实图层叠放（可开关）</figcaption></figure><figure><div class="stage"><img src="composite.png" alt="实际合成PNG"></div><figcaption>导出合成PNG · 可见误差0</figcaption></figure></div><div class="controls">${records.map(r=>`<label><input type="checkbox" data-id="${r.id}" checked>${esc(r.label)}</label>`).join('')}</div><button id="hair-only">仅看头发</button><button id="all">全部显示</button><h2>实际归属与试标支点</h2><img class="annotation" src="annotation.svg" alt="分层标注"><h2>独立层检查</h2><div class="row">${records.map(r=>`<figure><div class="part"><img src="${r.file}" alt="${esc(r.label)}"></div><figcaption>${esc(r.id)} · ${r.visible_pixel_count}px</figcaption></figure>`).join('')}</div><p>母版SVG含真实独立栅格层，可编辑显隐；不是完整骨骼或已补齐隐藏面的动画包。源及许可沿用角色参考，素材不属代码MIT，仅本地非商业。</p><script>const sync=()=>document.querySelectorAll('[data-id]').forEach(c=>{document.querySelector('[data-layer="'+c.dataset.id+'"]').style.display=c.checked?'block':'none';});document.querySelectorAll('[data-id]').forEach(c=>c.addEventListener('change',sync));document.querySelector('#hair-only').onclick=()=>{document.querySelectorAll('[data-id]').forEach(c=>c.checked=c.dataset.id!=='rest');sync();};document.querySelector('#all').onclick=()=>{document.querySelectorAll('[data-id]').forEach(c=>c.checked=true);sync();};</script></html>`;
if(sha256(readFileSync(sourcePath))!==layout.source_sha256)throw new Error('hair_source_changed');
mkdirSync(dirname(out),{recursive:true,mode:0o700});mkdirSync(out,{mode:0o700});
for(const [name,data] of [...files,['layout.json',layoutRaw],['annotation.svg',annotation],['master.svg',layeredSvg],['index.html',html],['manifest.json',JSON.stringify(manifest,null,2)+'\n']])writeFileSync(join(out,name),data,{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:relative(root,out),layers:records.map(r=>({id:r.id,pixels:r.visible_pixel_count,bounds:r.alpha16_bounds})),max_visible_error:max}));
