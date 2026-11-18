import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
const {values:v}=parseArgs({options:{master:{type:'string'},expressions:{type:'string'},atlas:{type:'string'},provenance:{type:'string'},output:{type:'string'},'renderer-module':{type:'string'}}});
if(!['master','expressions','atlas','provenance','output','renderer-module'].every(k=>v[k]))throw new Error('speech_asset_paths_required');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(root,v.output),segments=relative(root,out).split('/');
if(segments[0]!=='.cache'||segments.length<2||segments.some(p=>!p||p==='.'||p==='..'))throw new Error('speech_assets_output_must_be_cache');let parent=root;for(const p of segments){parent=join(parent,p);if(existsSync(parent)&&(lstatSync(parent).isSymbolicLink()||!lstatSync(parent).isDirectory()))throw new Error('unsafe_speech_assets_output');}if(existsSync(out))throw new Error('speech_assets_output_exists');
const read=p=>{const a=resolve(p);return readRegular(realpathSync(dirname(a)),a.split('/').at(-1),12582912);};
const base=realpathSync(v.expressions),baseBytes=readRegular(base,'manifest.json',131072),original=JSON.parse(baseBytes),master=realpathSync(v.master),masterBytes=readRegular(master,'manifest.json',131072),proof=JSON.parse(masterBytes);
if(original.master_manifest_sha256!==sha256(masterBytes))throw new Error('speech_asset_master_changed');
const files=new Map(),assets=original.assets.map(a=>({...a}));for(const a of assets){if(!/^[a-z_]+$/.test(a.id)||a.file!==a.id+'.png')throw new Error('invalid_speech_base_asset');const b=readRegular(base,a.file,4194304);if(sha256(b)!==a.sha256)throw new Error('speech_base_asset_changed');files.set(a.file,b);}
const sharp=createRequire(import.meta.url)(resolve(v['renderer-module'])),atlas=read(v.atlas),metadata=await sharp(atlas).metadata();if(metadata.width!==1254||metadata.height!==1254||!metadata.hasAlpha)throw new Error('speech_atlas_profile');
const raw=await sharp(atlas).ensureAlpha().raw().toBuffer(),registrations=[];
for(const [i,id,width] of [[0,'mouth_small',7],[1,'mouth_open',10],[2,'mouth_round',5.5]]){
 const bounds=[1254,1254,0,0];for(let y=0;y<1254;y++)for(let x=i*418;x<(i+1)*418;x++)if(raw[(y*1254+x)*4+3]>=16){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x+1);bounds[3]=Math.max(bounds[3],y+1);}
 const[x1,y1,x2,y2]=bounds;if(x2<=x1||y2<=y1)throw new Error('empty_speech_mouth');const s=width/(x2-x1),tx=164-(x1+x2)*s/2,ty=193-(y1+y2)*s/2;
 const crop=await sharp(atlas).extract({left:x1,top:y1,width:x2-x1,height:y2-y1}).png().toBuffer();const png=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><image width="${x2-x1}" height="${y2-y1}" transform="matrix(${s} 0 0 ${s} ${tx+x1*s} ${ty+y1*s})" href="data:image/png;base64,${crop.toString('base64')}"/></svg>`)).png().toBuffer();
 files.set(id+'.png',png);assets.push({id,file:id+'.png',sha256:sha256(png),canvas:[360,360],offset:[0,0]});registrations.push({id,source_bounds:bounds,target_center:[164,193],target_width:width,matrix:[s,0,0,s,tx,ty]});
}
const composites=[];for(const state of ['closed','smile','small','open','round']){
 const layers=[];for(const id of proof.draw_order){const key=id==='mouth'?'mouth_'+state:original.overrides[id];let bytes;if(key)bytes=files.get(key+'.png');else{const r=proof.parts.find(p=>p.id===id);bytes=readRegular(master,r.file,4194304);if(sha256(bytes)!==r.sha256)throw new Error('speech_master_part_changed');}layers.push({input:bytes,left:0,top:0});if(id==='eyes')layers.push({input:files.get('eyes_open_edge.png'),left:0,top:0});}
 composites.push([state,await sharp({create:{width:360,height:360,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer()]);
}
const manifest={...original,status:'silent_speech_mouth_art_candidate_not_user_approved',base_expression_manifest_sha256:sha256(baseBytes),assets,speech_mouths:['closed','smile','small','open','round'],speech_atlas_sha256:sha256(atlas),speech_registrations:registrations};
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>五种嘴型对照</title><style>body{font:16px system-ui;background:#152232;color:#edf3ff;margin:24px}.row{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0}img{width:360px;height:360px;background:#edf0f5}</style><h1>五种嘴型 · 静态候选</h1><p>嘴部锚点统一(164,193)，角色360大小/原点不变。原闭口、微笑保持，新微张/张口/圆口来自局部生成，仅用于无音频制作预览。</p><div class="row">${composites.map(([s])=>`<figure><img src="review-${s}.png"><figcaption>${s}</figcaption></figure>`).join('')}</div><p>素材仍为非商业改编候选；原提示词在speech-provenance.json。</p></html>`;
mkdirSync(dirname(out),{recursive:true,mode:0o700});mkdirSync(out,{mode:0o700});for(const[name,b]of[...files,...composites.map(([s,b])=>['review-'+s+'.png',b]),['index.html',html],['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['speech-atlas-source.png',atlas],['speech-provenance.json',read(v.provenance)],['expression-provenance.json',readRegular(base,'provenance.json',131072)]])writeFileSync(join(out,name),b,{flag:'wx',mode:0o600});console.log(JSON.stringify({output:relative(root,out),assets:assets.length,registrations}));
