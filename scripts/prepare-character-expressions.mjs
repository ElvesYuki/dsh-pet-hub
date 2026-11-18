import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {splitCharacterPixels} from './character-master.mjs';

const {values:v}=parseArgs({options:{master:{type:'string'},atlas:{type:'string'},provenance:{type:'string'},output:{type:'string'},'renderer-module':{type:'string'}}});
if(!['master','atlas','provenance','output','renderer-module'].every(k=>v[k]))throw new Error('expression_paths_required');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(root,v.output),segments=relative(root,out).split('/');
if(segments[0]!=='.cache'||segments.length<2||segments.some(s=>!s||s==='.'||s==='..'))throw new Error('expression_output_must_be_cache');
let parent=root;for(const s of segments){parent=join(parent,s);if(existsSync(parent)&&(lstatSync(parent).isSymbolicLink()||!lstatSync(parent).isDirectory()))throw new Error('unsafe_expression_output');}if(existsSync(out))throw new Error('expression_output_exists');
const read=p=>{const a=resolve(p);return readRegular(realpathSync(dirname(a)),a.split('/').at(-1),12582912);};
const master=realpathSync(v.master),proofBytes=readRegular(master,'manifest.json',131072),proof=JSON.parse(proofBytes),files=new Map(),assets=[],registrations=[];
const sharp=createRequire(import.meta.url)(resolve(v['renderer-module']));
const raw=async b=>{const r=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(r.info.width!==360||r.info.height!==360)throw new Error('expression_image_profile');return r.data;};
async function get(id){const r=proof.parts.find(r=>r.id===id);if(!r||r.file!==id+'.png')throw new Error('expression_missing_part');const b=readRegular(master,r.file,4194304);if(sha256(b)!==r.sha256)throw new Error('expression_part_changed');return b;}
const encode=b=>sharp(b,{raw:{width:360,height:360,channels:4}}).png().toBuffer();
function add(id,bytes){files.set(id+'.png',bytes);assets.push({id,file:id+'.png',sha256:sha256(bytes),canvas:[360,360],offset:[0,0]});}
const original=readRegular(master,'source.png',4194304);if(sha256(original)!==proof.source_sha256)throw new Error('expression_source_changed');
const layoutBytes=readRegular(master,'layout.json',131072);if(sha256(layoutBytes)!==proof.layout_sha256)throw new Error('expression_layout_changed');
const split=splitCharacterPixels(await raw(original),JSON.parse(layoutBytes));
const eyeBytes=await get('eyes'),eyes=await raw(eyeBytes),brow=await raw(await get('brows')),head=await raw(await get('head'));
const skin=readRegular(master,'skin-underpainting-source.png',12582912);if(sha256(skin)!==proof.paint.skin_sha256)throw new Error('expression_skin_changed');
const skinSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><image width="1254" height="1254" transform="matrix(${proof.paint.skin_matrix.join(' ')})" href="data:image/png;base64,${skin.toString('base64')}"/></svg>`;
const skinField=await raw(await sharp(Buffer.from(skinSvg)).png().toBuffer()),clean=Buffer.from(head);
const sourcePixels=await raw(original),faceOwners=new Set(['head','eyes','brows','mouth']);
const skinInterior=p=>skinField[p+3]>=240&&skinField[p]>=235&&skinField[p+1]>=200&&skinField[p+2]>=180;
const skinAt=(x,y)=>{const p=(y*360+x)*4;if(skinInterior(p))return p;for(let d=1;d<180;d++)for(const a of [x-d,x+d])if(a>=0&&a<360){const q=(y*360+a)*4;if(skinInterior(q))return q;}return null;};
for(let y=0;y<360;y++)for(let x=0;x<360;x++){const p=(y*360+x)*4;if(!clean[p+3])continue;const q=skinAt(x,y);if(q!==null)for(let c=0;c<3;c++)clean[p+c]=skinField[q+c];
 if(y>=190&&split.layers[split.owners[p/4]].id==='head'&&sourcePixels[p+3]&&sourcePixels[p]<140)clean.set(sourcePixels.subarray(p,p+4),p);
}
const eyeCleanup=(x,y)=>y>=156&&y<191&&((x>=118&&x<160)||(x>=173&&x<215));
const eyeEdge=Buffer.alloc(head.length);
for(let y=135;y<198;y++)for(let x=116;x<216;x++){
 const p=(y*360+x)*4,owner=split.layers[split.owners[p/4]].id,edge=eyeCleanup(x,y)&&sourcePixels[p]>=sourcePixels[p+2]*.95;
 if(!sourcePixels[p+3]||(!faceOwners.has(owner)&&!edge))continue;
 if(edge&&!faceOwners.has(owner))eyeEdge.set(sourcePixels.subarray(p,p+4),p);
 const q=skinAt(x,y);if(q===null)continue;
 clean.set([skinField[q],skinField[q+1],skinField[q+2],Math.max(clean[p+3],sourcePixels[p+3])],p);
}
add('head_clean',await encode(clean));add('eyes_open',eyeBytes);add('mouth_closed',await get('mouth'));
add('eyes_open_edge',await encode(eyeEdge));
const cleanBrow=Buffer.from(brow);for(let p=0;p<brow.length;p+=4)if(!(brow[p]<75&&brow[p+1]<90&&brow[p+2]<135))cleanBrow.fill(0,p,p+4);
add('brows_neutral',await encode(cleanBrow));
// Preserve blue fringe corners formerly carried by the eye/brow plates, as actual fringe textures.
for(const id of ['fringe_left','fringe_right','side_left','side_right','hair_cap']){
 const texture=Buffer.from(await raw(await get(id)));let count=0;
 for(let y=135;y<198;y++)for(let x=116;x<216;x++){const p=(y*360+x)*4;if(sourcePixels[p+3]&&(faceOwners.has(split.layers[split.owners[p/4]].id)||(eyeCleanup(x,y)&&sourcePixels[p]>=sourcePixels[p+2]*.95)))texture.fill(0,p,p+4);}
 for(const feature of [eyes,brow])for(let y=135;y<160;y++)for(let x=117;x<216;x++){
  const p=(y*360+x)*4;if(!id.startsWith('fringe_')||(x<166)!==(id==='fringe_left')||!feature[p+3]||feature[p+2]<=feature[p]*1.1||feature[p+2]<=feature[p+1]*1.04)continue;
  if(!texture[p+3]){texture.set(feature.subarray(p,p+4),p);count++;}
 }
 add(id,await encode(texture));registrations.push({id,transferred_original_fringe_pixels:count});
}
const atlas=read(v.atlas),meta=await sharp(atlas).metadata();if(meta.width!==1254||meta.height!==1254||!meta.hasAlpha)throw new Error('expression_atlas_profile');
const atlasRaw=await sharp(atlas).ensureAlpha().raw().toBuffer();
function bounds(region){const b=[1254,1254,0,0];for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++)if(atlasRaw[(y*1254+x)*4+3]>=16){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+1);b[3]=Math.max(b[3],y+1);}if(b[2]<=b[0])throw new Error('expression_empty_component');return b;}
async function feature(id,regions,targets){
 const layers=[];
 for(let i=0;i<regions.length;i++){
  const b=bounds(regions[i]),[x1,y1,x2,y2]=b,t=targets[i],s=t.width/(x2-x1),tx=t.source_anchor_x===undefined?t.center-(x1+x2)*s/2:t.anchor_x-t.source_anchor_x*s,ty=t.bottom-y2*s;
  const crop=await sharp(atlas).extract({left:x1,top:y1,width:x2-x1,height:y2-y1}).png().toBuffer();
  layers.push(`<image width="${x2-x1}" height="${y2-y1}" transform="matrix(${s} 0 0 ${s} ${tx+x1*s} ${ty+y1*s})" href="data:image/png;base64,${crop.toString('base64')}"/>`);
  registrations.push({id,component:i,source_bounds:b,matrix:[s,0,0,s,tx,ty],target:t});
 }
 add(id,await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360">${layers.join('')}</svg>`)).png().toBuffer());
}
await feature('eyes_half',[[0,180,330,490],[330,180,627,490]],[{anchor_x:141.30794,source_anchor_x:211.70599,width:37,bottom:187},{anchor_x:191.15274,source_anchor_x:462.51758,width:37,bottom:187}]);
// Keep original iris/pupil pixels at their original coordinates; lower the new lid over them.
// The generated full half-eye is an ink reference, never a resized substitute for the original iris.
const halfInk=await raw(files.get('eyes_half.png')),half=Buffer.alloc(eyes.length);
for(let y=0;y<360;y++)for(let x=0;x<360;x++){const p=(y*360+x)*4;if(y>=173)half.set(eyes.subarray(p,p+4),p);if(halfInk[p+3]&&halfInk[p]<130&&halfInk[p+1]<120&&halfInk[p+2]<145&&halfInk[p]>=halfInk[p+2]*.7)half.set(halfInk.subarray(p,p+4),p);}
const halfBytes=await encode(half);files.set('eyes_half.png',halfBytes);assets.find(a=>a.id==='eyes_half').sha256=sha256(halfBytes);
registrations.push({id:'eyes_half',method:'original_iris_pixels_clipped_below_native_y173_plus_generated_lid_ink_not_scaled_iris'});
await feature('eyes_closed',[[627,180,930,490],[930,180,1254,490]],[{center:139.5,width:38,bottom:182},{center:190.5,width:38,bottom:182}]);
await feature('eyes_smile',[[0,570,330,840],[330,570,627,840]],[{center:139.5,width:38,bottom:182},{center:190.5,width:38,bottom:182}]);
await feature('brows_relaxed',[[627,570,930,840],[930,570,1254,840]],[{center:139.5,width:13,bottom:147},{center:190.5,width:13,bottom:147}]);
await feature('brows_raised',[[0,910,330,1180],[330,910,627,1180]],[{center:139.5,width:14,bottom:145},{center:190.5,width:14,bottom:145}]);
await feature('mouth_smile',[[627,910,1254,1180]],[{center:164,width:8,bottom:194}]);
const overrides=new Map([['head','head_clean'],['eyes','eyes_open'],['brows','brows_neutral'],['mouth','mouth_closed'],...['fringe_left','fringe_right','side_left','side_right','hair_cap'].map(id=>[id,id])]);
const compose=async(eye='open',happy=false,bare=false)=>{
 const names=new Map(overrides);names.set('eyes','eyes_'+eye);if(happy){names.set('brows','brows_relaxed');names.set('mouth','mouth_smile');}
 const layers=[];for(const id of proof.draw_order){if(bare&&['eyes','brows','mouth'].includes(id))continue;layers.push({input:names.has(id)?files.get(names.get(id)+'.png'):await get(id),left:0,top:0});if(id==='eyes'&&eye==='open')layers.push({input:files.get('eyes_open_edge.png'),left:0,top:0});}
 return sharp({create:{width:360,height:360,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
};
const neutral=await compose(),actual=await raw(neutral),base=await raw(original);let maxRgb=0,different=0,newOuter=0,changedOutsideFace=0;
for(let y=0;y<360;y++)for(let x=0;x<360;x++){const p=(y*360+x)*4;if(!base[p+3]&&actual[p+3])newOuter++;let changed=false;for(let c=0;c<3;c++)if(base[p+3]>=16){const d=Math.abs(base[p+c]-actual[p+c]);maxRgb=Math.max(maxRgb,d);if(d>4)changed=true;}if(changed){different++;if(x<116||x>216||y<135||y>203)changedOutsideFace++;}}
if(newOuter||changedOutsideFace)throw new Error(`expression_changed_outside_face:${newOuter},${changedOutsideFace}`);
const proofEye=proof.parts.find(p=>p.id==='eyes');if(assets.find(a=>a.id==='eyes_open').sha256!==proofEye.sha256)throw new Error('original_eyes_changed');
const manifest={status:'facial_art_candidate_not_user_approved',master_manifest_sha256:sha256(proofBytes),source_sha256:proof.source_sha256,atlas_sha256:sha256(atlas),assets,overrides:Object.fromEntries(overrides),registrations,verification:{original_eye_png_unchanged:true,new_outer_pixels:newOuter,max_neutral_rgb_difference_at_alpha16:maxRgb,visible_pixels_changed_over4:different,changed_over4_outside_face:changedOutsideFace},credits:proof.credits,license_ref:proof.license_ref};
const reviewStates=[['neutral',neutral],['half',await compose('half')],['closed',await compose('closed')],['happy',await compose('smile',true)],['bare',await compose('open',false,true)]];
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>面部状态对照</title><style>body{font:16px system-ui;background:#162334;color:#eef3ff;margin:24px}.row{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0}img{width:360px;height:360px;background:#edf0f5}p{max-width:1000px}</style><h1>面部状态候选</h1><p>原睁眼PNG字节保持；其余表情局部生成、独立配准。360原点/比例不变。清理头部底色后，中性组合不再宣称零误差；形象与表情观感待确认。</p><div class="row"><figure><img src="source.png"><figcaption>冻结底稿</figcaption></figure>${reviewStates.map(([id])=>`<figure><img src="${id}.png"><figcaption>${id}</figcaption></figure>`).join('')}</div><h2>局部素材</h2><div class="row">${assets.map(a=>`<figure><img src="${a.file}"><figcaption>${a.id}</figcaption></figure>`).join('')}</div><p>仅本地非商业；上善无形／ZipZipPipe／PC2005-cloud/dsh-pet。生成提示词见provenance.json。</p></html>`;
mkdirSync(dirname(out),{recursive:true,mode:0o700});mkdirSync(out,{mode:0o700});
for(const [name,bytes] of [...files,...reviewStates.map(([id,png])=>[id+'.png',png]),['source.png',original],['atlas-source.png',atlas],['provenance.json',read(v.provenance)],['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['index.html',html]])writeFileSync(join(out,name),bytes,{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:relative(root,out),verification:manifest.verification,assets:assets.length}));
