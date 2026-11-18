import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {validateCharacterLayout} from './character-master.mjs';
import {createMotionProbe} from './character-motion-probe.mjs';
import {layeredBehaviorDefaults} from '../packages/core/layered-character-profiles.mjs';
import {naturalPreviewHtml} from './character-natural-preview-page.mjs';

const {values:v}=parseArgs({options:{master:{type:'string'},output:{type:'string'},natural:{type:'boolean',default:false},expressions:{type:'string'},speech:{type:'boolean',default:false},states:{type:'boolean',default:false},wave:{type:'string'}}});
if(!v.master||!v.output)throw new Error('explicit_probe_paths_required');
if(v.expressions&&!v.natural)throw new Error('expressions_require_natural_mode');
if(v.speech&&(!v.natural||!v.expressions))throw new Error('speech_requires_natural_expressions');
if(v.states&&(!v.natural||!v.expressions))throw new Error('states_require_natural_expressions');
if(v.wave&&!v.states)throw new Error('wave_requires_states');
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')),out=resolve(root,v.output),segments=relative(root,out).split('/');
if(segments[0]!=='.cache'||segments.length<2||segments.some(p=>!p||p==='.'||p==='..'))throw new Error('probe_output_must_be_in_cache');
let parent=root;for(const p of segments){parent=join(parent,p);if(existsSync(parent)&&(lstatSync(parent).isSymbolicLink()||!lstatSync(parent).isDirectory()))throw new Error('unsafe_probe_output');}if(existsSync(out))throw new Error('probe_output_exists');
const master=realpathSync(v.master),proofBytes=readRegular(master,'manifest.json',131072),proof=JSON.parse(proofBytes),layoutBytes=readRegular(master,'layout.json',131072),layout=JSON.parse(layoutBytes);validateCharacterLayout(layout);createMotionProbe(layout.parts);
if(sha256(layoutBytes)!==proof.layout_sha256||layout.source_sha256!==proof.source_sha256||JSON.stringify(layout.draw_order)!==JSON.stringify(proof.draw_order))throw new Error('probe_master_proof_changed');
const source=readRegular(master,'source.png',4194304);if(sha256(source)!==proof.source_sha256)throw new Error('probe_source_changed');
const parts=layout.parts.map(p=>{const r=proof.parts.find(r=>r.id===p.id);if(!r||r.file!==`${p.id}.png`)throw new Error('probe_part_missing');const bytes=readRegular(master,r.file,4194304);if(sha256(bytes)!==r.sha256)throw new Error('probe_part_changed');return {...p,sha256:r.sha256,image:`data:image/png;base64,${bytes.toString('base64')}`};});
const config={parts,draw_order:layout.draw_order,source:`data:image/png;base64,${source.toString('base64')}`,states:v.states,...(v.natural?{behavior:layeredBehaviorDefaults()}: {})};
if(v.wave){
 const waveRoot=realpathSync(v.wave),waveProof=JSON.parse(readRegular(waveRoot,'manifest.json',131072));
 if(waveProof.original_master_manifest_sha256!==sha256(proofBytes)||waveProof.replaced_part!=='arm_right')throw new Error('wave_master_changed');
 const arm=readRegular(waveRoot,'arm-raised.png',4194304);
 config.wave={image:'data:image/png;base64,'+arm.toString('base64'),sha256:sha256(arm),contour:'distance_field_v1',source_manifest_sha256:sha256(readRegular(waveRoot,'manifest.json',131072))};
}
let expressionSha=null;
if(v.expressions){
 const directory=realpathSync(v.expressions),bytes=readRegular(directory,'manifest.json',131072),face=JSON.parse(bytes);expressionSha=sha256(bytes);
 if(face.master_manifest_sha256!==sha256(proofBytes)||!face.verification?.original_eye_png_unchanged)throw new Error('expression_master_changed');
 const assets={};for(const a of face.assets){if(!/^[a-z_]+$/.test(a.id)||a.file!==a.id+'.png')throw new Error('invalid_expression_asset');const b=readRegular(directory,a.file,4194304);if(sha256(b)!==a.sha256)throw new Error('expression_asset_changed');assets[a.id]={sha256:a.sha256,image:`data:image/png;base64,${b.toString('base64')}`};}
 if(assets.eyes_open?.sha256!==proof.parts.find(p=>p.id==='eyes').sha256)throw new Error('expression_original_eyes_changed');
 for(const [id,key] of Object.entries(face.overrides)){const p=parts.find(p=>p.id===id),a=assets[key];if(!p||!a)throw new Error('invalid_expression_override');p.source_part_sha256=p.sha256;p.sha256=a.sha256;p.image=a.image;}
 config.face={assets};
 if(v.speech){if(!['closed','smile','small','open','round'].every(s=>assets['mouth_'+s]))throw new Error('speech_mouth_assets_required');config.speech=true;}
}
// Audited dependency order, never bundle executable files supplied by a character package.
const coreFiles=['layered-character-json','layered-character-profiles','character-motion-probe',...(v.states?['character-states']:[]),...(v.natural?['character-natural-motion']:[]),...(v.expressions?['character-expression']:[]),...(v.speech?['character-speech']:[]),...(v.wave?['character-wave','character-arm-morph']:[])];
const math=coreFiles.map(name=>readFileSync(join(root,'packages/core',name+'.mjs'),'utf8').replace(/^import .*;\n/gm,'')).join('\n'),ui=(v.natural?['packages/ui/character-display.mjs','packages/ui/character-natural-preview.mjs']:['scripts/character-motion-preview.mjs']).map(name=>readFileSync(join(root,name),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
const html=v.natural?naturalPreviewHtml(config,math.replace(/^export /gm,''),ui):`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="icon" href="data:,"><title>360角色 · 小角度运动检查</title><style>body{font:16px/1.65 system-ui;background:#152232;color:#edf2f8;margin:24px}h1{font-size:25px}.row{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0}.stage{width:360px;height:360px;position:relative;background:#000}.stage canvas{width:100%;height:100%;position:absolute;inset:0}.light .stage{background:#e9edf3}.zoom .stage{width:720px;height:720px}label{display:inline-block;margin:8px 14px 8px 0}button,select{font:inherit;padding:5px;margin:4px}p{max-width:1020px}pre{white-space:pre-wrap;font-size:13px}input[type=range]{vertical-align:middle}</style><h1>360角色 · 小角度运动检查</h1><p>固定360原点、大小与基准位置。11处发束全部开放，头饰/发帽随头，末梢跟随对应长发。本页用于查关节切口与发际边色；错相曲线是诊断动作，尚非完整自然待机或设备播放器。</p><p id="loading">加载贴图…</p><div class="row"><figure><div class="stage"><canvas id="baseline" width="360" height="360"></canvas></div><figcaption>冻结标准底稿</figcaption></figure><figure><div class="stage"><canvas id="motion" width="360" height="360"></canvas><canvas id="overlay" width="360" height="360"></canvas></div><figcaption>真实21层父子变换（目标采样24fps，非设备实测）</figcaption></figure></div><p id="info"></p><div><button id="play">暂停</button><button id="reset">静态回零</button><button id="background">黑/浅底</button><button id="zoom">原尺寸/2倍检查</button></div><div><label>模式 <select id="mode"><option value="combined">整组错相</option><option value="single">单关节</option><option value="neutral">静态</option></select></label><label>关节 <select id="part"></select></label><label>单关节角度 <input id="angle" type="range" min="-2" max="2" step=".05" value="2"></label><label>幅度 <input id="strength" type="range" min="0" max="1" step=".05" value="1"></label><label>时间0–8s <input id="time" type="range" min="0" max="8" step="0.0416666666667" value="0"></label><label><input id="markers" type="checkbox">支点</label><label><input id="holes" type="checkbox" checked>低覆盖候选</label></div><button id="scan">扫描24个单关节极限＋192帧整组动作</button><pre id="scan-result"></pre><p>红色只标记固定底稿密实内区中的低alpha候选，不代表每个点都是真实露缝；正常边缘移动也可能触发，烘焙边色可能不会触发。请结合黑/浅底及逐帧放大。此处头部旋转是平面轻摆，不是新侧视图。无DSH、pet或设备连接。</p><p>形象来源：上善无形／ZipZipPipe／PC2005-cloud/dsh-pet，仅本地非商业制作。新代码MIT，素材许可独立。</p><script>${math.replace(/^export /gm,'')}\n${ui}\nstartCharacterPreview(${JSON.stringify(config)}).catch(error=>{document.querySelector('#loading').textContent='加载失败：'+error.message;console.error(error);});</script></html>`;
const manifest={behavior_sha256:config.behavior?sha256(Buffer.from(JSON.stringify(config.behavior))):null,wave:config.wave?{sha256:config.wave.sha256,contour:config.wave.contour,source_manifest_sha256:config.wave.source_manifest_sha256}:null,state_profiles_enabled:v.states,expression_manifest_sha256:expressionSha,status:v.states?'desktop_character_states_candidate_not_user_or_device_accepted':v.expressions?'desktop_expression_candidate_not_user_or_device_accepted':v.natural?'desktop_natural_motion_candidate_not_device_or_visual_acceptance':'desktop_small_angle_probe_not_animation_or_device_acceptance',master_manifest_sha256:sha256(proofBytes),layout_sha256:sha256(layoutBytes),source_sha256:proof.source_sha256,parts:parts.map(({image,...p})=>p),canvas:[360,360],draw_order:layout.draw_order,target_sample_fps:24,period_seconds:v.natural?null:8,integration_hz:v.natural?120:null,root_translation:[0,0],root_scale:[1,1],core_sha256:sha256(Buffer.from(math)),ui_sha256:sha256(Buffer.from(ui)),html_sha256:sha256(Buffer.from(html))};
mkdirSync(dirname(out),{recursive:true,mode:0o700});mkdirSync(out,{mode:0o700});for(const [file,bytes] of [['index.html',html],['manifest.json',JSON.stringify(manifest,null,2)+'\n']])writeFileSync(join(out,file),bytes,{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:relative(root,out),layers:parts.length,standalone:true}));
