import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {sha256,readRegular} from '../packages/runtime/material-import.mjs';
import {splitCharacterPixels,completeCharacterPixels,padCharacterEdges,verifyCharacterComposite} from './character-master.mjs';
import {insideHairPolygon} from './hair-static-master.mjs';

// Explicit offline authoring inputs. Never loads firmware, pet, runtime configuration or devices.
const {values:v}=parseArgs({options:{source:{type:'string'},'hair-master':{type:'string'},'skin-paint':{type:'string'},'skin-provenance':{type:'string'},output:{type:'string'},'renderer-module':{type:'string'},'edge-bleed':{type:'boolean',default:false}}});
if(!['source','hair-master','skin-paint','skin-provenance','output','renderer-module'].every(k=>v[k]))throw new Error('explicit_character_paths_required');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(root,v.output),segments=relative(root,out).split('/');
if(segments[0]!=='.cache'||segments.length<2||segments.some(p=>!p||p==='.'||p==='..'))throw new Error('character_output_must_be_in_cache');
let parent=root;for(const p of segments){parent=join(parent,p);if(existsSync(parent)&&(lstatSync(parent).isSymbolicLink()||!lstatSync(parent).isDirectory()))throw new Error('unsafe_character_output');}
if(existsSync(out))throw new Error('character_output_exists');
const read=(path,limit=12582912)=>{const p=resolve(path);return readRegular(realpathSync(dirname(p)),p.split('/').at(-1),limit);};
const layoutBytes=readFileSync(join(root,'docs/art/character-layout-v1.json')),layout=JSON.parse(layoutBytes),source=read(v.source,4194304);
if(sha256(source)!==layout.source_sha256)throw new Error('character_source_changed');
const hairRoot=realpathSync(v['hair-master']),hairProof=JSON.parse(readRegular(hairRoot,'manifest.json',131072));
if(hairProof.source_sha256!==layout.source_sha256)throw new Error('character_hair_source_changed');
const rear=readRegular(hairRoot,hairProof.rear_paint.file,12582912),skin=read(v['skin-paint']),skinProvenance=read(v['skin-provenance'],131072);
if(sha256(rear)!==hairProof.rear_paint.sha256)throw new Error('character_rear_paint_changed');
const skinProof=JSON.parse(skinProvenance);if(skinProof.output_sha256!==sha256(skin)||typeof skinProof.prompt!=='string')throw new Error('character_skin_provenance_changed');
const sharp=createRequire(import.meta.url)(resolve(v['renderer-module']));
const raw=async bytes=>{const r=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(r.info.width!==360||r.info.height!==360||r.info.channels!==4)throw new Error('character_image_profile');return r.data;};
const field=async(bytes,matrix)=>{
 const meta=await sharp(bytes).metadata();if(meta.width!==1254||meta.height!==1254||!meta.hasAlpha)throw new Error('character_paint_profile');
 return raw(await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><image width="1254" height="1254" transform="matrix(${matrix.join(' ')})" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`)).png().toBuffer());
};
const skinMatrix=hairProof.head_underpainting.registration.matrix,rearField=await field(rear,hairProof.rear_paint.registration.matrix),skinField=await field(skin,skinMatrix),rgba=await raw(source),split=splitCharacterPixels(rgba,layout);
const fields=new Map();
for(const part of layout.parts){
 if(!['head',...hairProof.parts.filter(p=>p.id!=='rest').map(p=>p.id)].includes(part.id))continue;
 const paint=part.id==='head'?skinField:rearField,support=Buffer.alloc(rgba.length);
 const polygons=part.id==='head'?[[[119,104],[220,104],[220,202],[119,202]]]:layout.rules.filter(r=>r.id===part.id).map(r=>r.polygon);
 // A small inward root sleeve is hidden beneath the parent/upper owner. Never extends the outer silhouette.
 if(part.id.endsWith('_tip')){const [x,y]=part.pivot;polygons.push([[x-12,y-12],[x+12,y-12],[x+14,y+14],[x-14,y+14]]);}
 else if(['fringe_left','fringe_center','fringe_right','side_left','side_right'].includes(part.id)){const [x,y]=part.pivot;polygons.push([[x-10,y-10],[x+10,y-10],[x+12,y+14],[x-12,y+14]]);}
 for(let y=0;y<360;y++)for(let x=0;x<360;x++)if(polygons.some(p=>insideHairPolygon(x+.5,y+.5,p))){const i=(y*360+x)*4;support.set(paint.subarray(i,i+4),i);}
 fields.set(part.id,support);
}
const painted=completeCharacterPixels(rgba,layout,split,fields),completed=v['edge-bleed']?padCharacterEdges(rgba,layout,split,painted):painted,files=new Map(),records=[];
let partitionCount=0;const restored=Buffer.alloc(rgba.length);
for(const layer of split.layers)for(let p=0;p<rgba.length;p+=4)if(layer.rgba[p+3]){if(restored[p+3])throw new Error('character_visible_overlap');restored.set(layer.rgba.subarray(p,p+4),p);partitionCount++;}
for(let p=0;p<rgba.length;p+=4)if(rgba[p+3]&&!restored.subarray(p,p+4).equals(rgba.subarray(p,p+4)))throw new Error('character_visible_partition_changed');
for(const layer of completed){
 if(!layer.visible_pixel_count)throw new Error(`character_empty_visible_part:${layer.id}`);
 const bytes=await sharp(Buffer.from(layer.rgba),{raw:{width:360,height:360,channels:4}}).png().toBuffer();
 if(!(await raw(bytes)).equals(Buffer.from(layer.rgba)))throw new Error('character_png_roundtrip_changed');
 files.set(`${layer.id}.png`,bytes);
 const {rgba:unused,...record}=layer;records.push({...record,file:`${layer.id}.png`,sha256:sha256(bytes),canvas:[360,360],offset:[0,0],pivot_status:'manually_proposed_not_motion_verified'});
}
const composite=await sharp({create:{width:360,height:360,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layout.draw_order.map(id=>({input:files.get(`${id}.png`),left:0,top:0}))).png().toBuffer();
const verification={...verifyCharacterComposite(rgba,await raw(composite)),visible_partition_exact:true,visible_pixels:partitionCount,fallback_pixel_count:split.fallbackCount,png_roundtrip_exact:true,motion_verified:false,device_verified:false};
const manifest={status:'static_character_master_candidate_not_animation_ready',source_sha256:sha256(source),layout_sha256:sha256(layoutBytes),canvas:[360,360],parts:records,draw_order:layout.draw_order,verification,edge_bleed_radius:v['edge-bleed']?3:0,paint:{rear_sha256:sha256(rear),rear_matrix:hairProof.rear_paint.registration.matrix,skin_sha256:sha256(skin),skin_matrix:skinMatrix},license_ref:'dsh-pet-nc-86181ce',credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet']};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=id=>layout.parts.find(p=>p.id===id).label;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="360" height="360" viewBox="0 0 360 360">${layout.draw_order.map(id=>`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${esc(label(id))}"><image width="360" height="360" href="data:image/png;base64,${files.get(`${id}.png`).toString('base64')}"/></g>`).join('')}</svg>`;
const annotation=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 360 360"><rect width="360" height="360" fill="#152334"/><image width="360" height="360" href="data:image/png;base64,${composite.toString('base64')}" opacity=".7"/><g font-family="sans-serif" font-size="5" fill="#fff">${layout.parts.map((p,i)=>{const [x,y]=p.pivot,parent=layout.parts.find(a=>a.id===p.parent),color=p.id==='head'||p.id==='body'?'#ffdf65':'#73f7dd';return `${parent?`<path d="M${x},${y} L${parent.pivot.join(',')}" fill="none" stroke="${color}" stroke-width=".4" stroke-dasharray="2 2"/>`:''}<circle cx="${x}" cy="${y}" r="2" fill="none" stroke="${color}" stroke-width=".7"/><text x="${x+3}" y="${y+(i%2?-3:5)}">${i+1}</text>`;}).join('')}</g></svg>`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>角色静态母版21层</title><style>body{font:16px/1.6 system-ui;background:#142030;color:#edf4ff;margin:24px}p{max-width:1050px}.row{display:flex;gap:18px;flex-wrap:wrap}figure{margin:0}.stage{position:relative;width:360px;height:360px;background:#000}.stage img{position:absolute;inset:0;width:360px;height:360px}.part{width:240px;background:#2c3949}.part img{width:240px;height:240px}label{display:inline-block;margin:5px 12px 5px 0}button{margin:8px;padding:6px}figcaption{max-width:360px}</style><h1>角色静态母版 · 21层候选</h1><p>360画布、共享原点，人物大小位置不变；12发束＋头部/身体/左右臂/头饰耳鳍/眼/眉/嘴/尾巴。原可见像素独占分配；补画只放在原可见所属层的下方。RGB最大差${verification.max_rgb_difference_at_alpha16}/255，alpha最大差${verification.max_alpha_difference}/255，外透明覆盖不变。支点为试标，尚未运动或设备验收。</p><div class="row"><figure><div class="stage"><img src="../authoring-base-v1/neutral-360.png" alt="冻结标准底稿"></div><figcaption>冻结底稿</figcaption></figure><figure><div class="stage" id="layers">${layout.draw_order.map(id=>`<img data-layer="${id}" src="${id}.png" alt="${esc(label(id))}">`).join('')}</div><figcaption>真实21层叠放</figcaption></figure><figure><div class="stage"><img src="annotation.png" alt="支点和父子连接"></div><figcaption>试标支点；图中编号见下面列表</figcaption></figure></div><div>${layout.parts.map((p,i)=>`<label><input type="checkbox" data-id="${p.id}" checked>${i+1}. ${esc(p.label)}</label>`).join('')}</div><button id="all">全部显示</button><button id="hair">仅头发</button><button id="face">隐藏眼眉嘴</button><button id="skin">仅头部底色</button><button id="background">切换浅色背景</button><h2>每层独立检查</h2><div class="row">${layout.parts.map((p,i)=>`<figure><div class="part"><img src="${p.id}.png" alt="${esc(p.label)}"></div><figcaption>${i+1}. ${esc(p.label)} (${p.id})<br>支点 ${p.pivot.join(', ')}；父级 ${p.parent??'根'}<br>原像素 ${records.find(r=>r.id===p.id).visible_pixel_count}；补画 ${records.find(r=>r.id===p.id).completion_pixel_count}</figcaption></figure>`).join('')}</div><p>来源：上善无形／ZipZipPipe／PC2005-cloud/dsh-pet；仅本地非商业。完整合成不能证明切口在运动时不露缝。眼口下方已有无五官皮肤补画，但替换表情和口型尚未实现。</p><script>const boxes=[...document.querySelectorAll('[data-id]')];function set(f){boxes.forEach(c=>{c.checked=f(c.dataset.id);document.querySelector('[data-layer="'+c.dataset.id+'"]').style.display=c.checked?'block':'none';});}boxes.forEach(c=>c.onchange=()=>document.querySelector('[data-layer="'+c.dataset.id+'"]').style.display=c.checked?'block':'none');document.querySelector('#all').onclick=()=>set(()=>true);document.querySelector('#hair').onclick=()=>set(id=>${JSON.stringify(layout.parts.slice(0,12).map(p=>p.id))}.includes(id));document.querySelector('#face').onclick=()=>set(id=>!['eyes','brows','mouth'].includes(id));document.querySelector('#skin').onclick=()=>set(id=>id==='head');document.querySelector('#background').onclick=()=>document.querySelectorAll('.stage').forEach(s=>s.style.background=s.style.background==='rgb(234, 237, 241)'?'#000':'#eaedf1');</script></html>`;
mkdirSync(dirname(out),{recursive:true,mode:0o700});mkdirSync(out,{mode:0o700});
for(const [name,bytes] of [...files,['composite.png',composite],['source.png',source],['master.svg',svg],['annotation.svg',annotation],['annotation.png',await sharp(Buffer.from(annotation)).png().toBuffer()],['index.html',html],['layout.json',layoutBytes],['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['skin-underpainting-source.png',skin],['skin-provenance.json',skinProvenance],['rear-underpainting-source.png',rear],['rear-provenance.json',readRegular(hairRoot,'provenance.json',131072)]])writeFileSync(join(out,name),bytes,{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:relative(root,out),verification,parts:records.map(r=>({id:r.id,visible:r.visible_pixel_count,hidden:r.completion_pixel_count}))}));
