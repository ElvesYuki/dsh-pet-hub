import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {sha256,readRegular} from '../packages/runtime/material-import.mjs';

// Offline static authoring only. Renderer path is explicit and never a package dependency.
const {values:v}=parseArgs({options:{master:{type:'string'},source:{type:'string'},prompt:{type:'string'},output:{type:'string'},'renderer-module':{type:'string'}}});
if(!['master','source','prompt','output','renderer-module'].every(k=>v[k]))throw new Error('explicit_authoring_inputs_required');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(v.output),segments=relative(root,out).split('/');
if(segments[0]!=='.cache'||segments.length<2||segments.some(s=>!s||s==='.'||s==='..'))throw new Error('output_must_be_new_cache_directory');
let ancestor=root;for(const s of segments){ancestor=join(ancestor,s);if(existsSync(ancestor)&&(lstatSync(ancestor).isSymbolicLink()||!lstatSync(ancestor).isDirectory()))throw new Error('unsafe_output');}
if(existsSync(out))throw new Error('output_exists');
const read=p=>readRegular(realpathSync(dirname(resolve(p))),resolve(p).split('/').at(-1),12582912);
const master=realpathSync(v.master),manifest=JSON.parse(readRegular(master,'manifest.json',131072)),layout=JSON.parse(readRegular(master,'layout.json',131072));
const source=read(v.source),prompt=read(v.prompt).toString('utf8');
const sharp=createRequire(import.meta.url)(resolve(v['renderer-module']));
const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let minX=raw.info.width,minY=raw.info.height,maxX=-1,maxY=-1;
for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>1){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
if(maxX<minX||minX===0&&minY===0&&maxX===raw.info.width-1&&maxY===raw.info.height-1)throw new Error('isolated_alpha_sprite_required');
// Ignore alpha=1 isolated speckles for registration, retain original alpha within the crop.
const crop={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
const width=50,height=Math.round(crop.height*width/crop.width),left=193,top=181;
const arm=await sharp(source).extract(crop).resize(width,height).png().toBuffer();
const stage=()=>sharp({create:{width:360,height:360,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
const armCanvas=await stage().composite([{input:arm,left,top}]).png().toBuffer();
const files=new Map();
for(const p of manifest.parts){const bytes=readRegular(master,p.file,4194304);if(sha256(bytes)!==p.sha256)throw new Error('master_part_changed');files.set(p.id,bytes);}
const layers=layout.draw_order.map(id=>({input:files.get(id),left:0,top:0}));
const original=await stage().composite(layers).png().toBuffer();
const without=await stage().composite(layout.draw_order.filter(id=>id!=='arm_right').map(id=>({input:files.get(id),left:0,top:0}))).png().toBuffer();
// Pose-specific foreground arm, after side hair. Original master order remains untouched.
const raised=await stage().composite([...layout.draw_order.filter(id=>id!=='arm_right').map(id=>({input:files.get(id),left:0,top:0})),{input:armCanvas,left:0,top:0}]).png().toBuffer();
const oldPixels=await sharp(original).ensureAlpha().raw().toBuffer(),newPixels=await sharp(raised).ensureAlpha().raw().toBuffer();
let changed=0,outsideCircle=0;const bbox=[360,360,-1,-1];
for(let y=0;y<360;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4;if(newPixels[i+3]>16&&Math.hypot(x+.5-180,y+.5-180)>166.5)outsideCircle++;if(oldPixels.subarray(i,i+4).equals(newPixels.subarray(i,i+4)))continue;changed++;bbox[0]=Math.min(bbox[0],x);bbox[1]=Math.min(bbox[1],y);bbox[2]=Math.max(bbox[2],x);bbox[3]=Math.max(bbox[3],y);}
const embed=b=>'data:image/png;base64,'+b.toString('base64');
const comparisonSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="756" height="414"><rect width="756" height="414" fill="#152334"/><g font-family="sans-serif" font-size="16" fill="white"><text x="12" y="25">原姿态 · 固定360画布</text><text x="390" y="25">单侧抬手 · 静态候选</text></g><image href="${embed(original)}" x="12" y="42" width="360" height="360"/><image href="${embed(raised)}" x="390" y="42" width="360" height="360"/></svg>`;
const comparison=await sharp(Buffer.from(comparisonSvg)).png().toBuffer();
const proof={status:'static_raised_arm_candidate_visual_review_pending',canvas:[360,360],root_transform:[1,0,0,1,0,0],original_master_manifest_sha256:sha256(readRegular(master,'manifest.json',131072)),source_sha256:sha256(source),prompt,source_crop:crop,registered_bounds:[left,top,left+width,top+height],registration:{scale_xy:[width/crop.width,height/crop.height],translation:[left-minX*width/crop.width,top-minY*height/crop.height],crop_alpha_threshold:1,resized_height:height},replaced_part:'arm_right',pivot_canvas_px:[195,216],draw_order:'original layers except arm_right, then raised_arm foreground',original_parts:manifest.parts.map(p=>({id:p.id,sha256:p.sha256})),changed_pixels:changed,changed_bbox:bbox,outside_safe_circle_alpha16:outsideCircle,hidden_body_repaint:false,animation_verified:false,device_verified:false,credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet'],license_ref:'dsh-pet-nc-86181ce'};
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>单侧抬手静态候选</title><style>body{background:#152334;color:#fff;font:16px system-ui;margin:24px}img{width:360px;height:360px;background:#000}button{padding:10px;margin:8px}section{display:flex;gap:18px;flex-wrap:wrap}figure{margin:0}figcaption{max-width:360px}</style><h1>单侧抬手 · 静态候选</h1><p>360尺寸/原点固定；只替换画面右侧手臂。尚未制作挥手动画或验收动态遮挡。</p><button id="toggle">切换原姿态/抬手</button><button id="bg">切换背景</button><section><figure><img src="${embed(original)}"><figcaption>原姿态</figcaption></figure><figure><img id="pose" src="${embed(raised)}"><figcaption>抬手：检查肩/袖/掌/头发交叠</figcaption></figure><figure><img src="${embed(armCanvas)}"><figcaption>独立手臂；肩部支点(195,216)暂定</figcaption></figure></section><p>仅本地非商业改编；上善无形 / ZipZipPipe / PC2005-cloud/dsh-pet。素材不属代码MIT。</p><script>let raised=true;document.querySelector('#toggle').onclick=()=>{raised=!raised;document.querySelector('#pose').src=raised?'${embed(raised)}':'${embed(original)}'};let light=false;document.querySelector('#bg').onclick=()=>{light=!light;document.querySelectorAll('img').forEach(i=>i.style.background=light?'#eaedf1':'#000')};</script></html>`;
mkdirSync(dirname(out),{recursive:true});mkdirSync(out,{mode:0o700});
for(const [name,data] of [['arm-raised.png',armCanvas],['original.png',original],['without-arm.png',without],['raised.png',raised],['comparison.png',comparison],['index.html',html],['manifest.json',JSON.stringify(proof,null,2)+'\n']])writeFileSync(join(out,name),data,{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:relative(root,out),changed_pixels:changed,changed_bbox:bbox,outside_safe_circle:outsideCircle,source_crop:crop,registered_size:[width,height]}));
