import {existsSync,lstatSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {deflateSync} from 'node:zlib';
import {Pet4Decoder,crc32} from '../packages/core/pet4.mjs';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {unpackPreview} from '../packages/ui/frame-preview.mjs';

// Local art reference only; no upstream imports, rendering service or device access.
export const referenceGeometry=Object.freeze({content_size:360,display_size:466,display_offset:53,content_center:180,display_center:233,safe_diameter:333});
const actionIds=[0,1,4,55,58];
const check=(value,message)=>{if(!value)throw new Error(message);};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Encode a 360 RGB565LE frame as opaque RGBA PNG; throws on invalid byte length. */
export function referencePng(rgb565){
 check(rgb565 instanceof Uint8Array&&rgb565.length===360*360*2,'invalid_reference_pixels');
 const rgba=unpackPreview({format:'RGB565LE',width:360,height:360,pixels_base64:Buffer.from(rgb565).toString('base64')});
 const rows=Buffer.alloc(360*(1+360*4));
 for(let y=0;y<360;y++)rows.set(rgba.subarray(y*1440,(y+1)*1440),y*1441+1);
 const chunk=(name,data)=>{const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);Buffer.from(data).copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(360);header.writeUInt32BE(360,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

/** Build a static local sheet from generated records; labels are escaped, paths generated internally. */
export function referenceHtml(records){
 const guides='<svg class="guides" width="466" height="466" viewBox="0 0 466 466" aria-label="屏幕圆、360画布、安全圆与中心线"><circle cx="233" cy="233" r="232.5" stroke="#94a3b8"/><rect x="53" y="53" width="360" height="360" stroke="#60a5fa"/><circle cx="233" cy="233" r="166.5" stroke="#fbbf24"/><path d="M233 0V466M0 233H466" stroke="#f472b6" stroke-dasharray="4 6"/></svg>';
 const lead=records.find(r=>r.action_id===0&&r.frame_index===0);
 const groups=actionIds.map(id=>{const frames=records.filter(r=>r.action_id===id);return `<section><h2>${id} · ${escape(frames[0]?.name??'')}</h2><div class="frames">${frames.map(r=>`<figure><img src="${r.file}" width="360" height="360" alt="${escape(r.name)} 帧${r.frame_index}"><figcaption>frame ${r.frame_index} · ${(r.frame_index/24).toFixed(2)}s</figcaption></figure>`).join('')}</div></section>`;}).join('');
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>360角色制作参考</title><style>body{background:#10141e;color:#e5e7eb;font:16px/1.7 system-ui;margin:24px}h1,h2{line-height:1.3}p{max-width:960px}.screen{position:relative;width:466px;height:466px;background:#000}.screen img{position:absolute;left:53px;top:53px;width:360px;height:360px}.guides{position:absolute;inset:0;fill:none;pointer-events:none}#guide-toggle:not(:checked)~.screen .guides{display:none}.frames{display:flex;gap:16px;overflow-x:auto}figure{margin:0;flex:0 0 360px}figure img{display:block;width:360px;height:360px}figcaption{color:#94a3b8}section{margin:32px 0}</style><h1>原生360 · 角色制作参考</h1><p>本地非商业参考，未生成新角色或拆层。形象：上善无形／ZipZipPipe；动画：PC2005-cloud/dsh-pet。素材不属MIT，沿用来源许可。采样不是全帧边界审计，也不是设备实测。</p><p>保持当前人物大小和原中心。蓝框360画布；黄圆直径333安全区；灰圆466屏幕；粉线中心。图片按原生像素显示；浏览器缩放会影响视觉大小。黑色为PET4像素，不能自动当作透明遮罩。</p><input id="guide-toggle" type="checkbox" checked><label for="guide-toggle">显示辅助线</label><div class="screen"><img src="${lead?.file??''}" width="360" height="360" alt="现有待机首帧">${guides}</div>${groups}<p>实际支点、触摸区域、拆层轮廓和精确色板须在分层制作时标定并确认；本参考不替代源视频和原作者设定。</p></html>`;
}

/** Synchronous offline export. Requires explicit source, digest and license; returns sample metadata.
 * Refuses existing/output-symlink paths and destinations outside repoRoot/.cache.
 * Validates/encodes all input before writing. I/O failures throw; no runtime/device lifecycle is started.
 */
export function prepareCharacterReference({sourceDir,manifestSha256,licenseRef,output,repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')}){
 check(licenseRef==='dsh-pet-nc-86181ce','unapproved_reference_license');
 check(typeof manifestSha256==='string'&&/^[a-f0-9]{64}$/.test(manifestSha256),'invalid_manifest_digest');
 const root=realpathSync(repoRoot),destination=resolve(root,output??''),rel=relative(root,destination),parts=rel.split('/');
 check(parts[0]==='.cache'&&parts.length>=2&&parts.every(p=>p&&p!=='.'&&p!=='..'),'reference_output_must_be_in_repo_cache');
 let parent=root;for(const part of parts){parent=join(parent,part);if(existsSync(parent))check(!lstatSync(parent).isSymbolicLink()&&lstatSync(parent).isDirectory(),'unsafe_reference_output');}
 check(!existsSync(destination),'reference_output_exists');
 const source=realpathSync(sourceDir),raw=readRegular(source,'manifest.json',1048576);
 check(sha256(raw)===manifestSha256,'source_manifest_changed');
 const manifest=JSON.parse(raw);
 check(manifest.width===360&&manifest.height===360&&manifest.fps===24&&manifest.safe_diameter===333&&Array.isArray(manifest.actions),'unsupported_reference_profile');
 const records=[],images=[];
 for(const id of actionIds){
  const matches=manifest.actions.filter(a=>a.id===id);check(matches.length===1,'reference_action_missing_or_duplicate');
  const action=matches[0],bytes=readRegular(source,`${id}.pet`,5865472);
  check(bytes.length===action.bytes&&sha256(bytes)===action.sha256,'source_asset_changed');
  const decoder=new Pet4Decoder(bytes);
  check(decoder.width===360&&decoder.height===360&&decoder.fps===24&&decoder.frames===action.frames&&action.fps===24,'reference_timing_mismatch');
  const frames=[...new Set([0,1,2,3,4].map(q=>Math.floor((decoder.frames-1)*q/4)))];
  for(const f of frames){const pixels=decoder.decode(f).rgb565,file=`action-${id}-frame-${f}.png`;records.push({action_id:id,name:String(action.name??id),frame_index:f,time_ms:f/24*1000,file,width:360,height:360,asset_sha256:action.sha256,rgb565_sha256:sha256(pixels)});images.push([file,referencePng(pixels)]);}
 }
 check(sha256(readRegular(source,'manifest.json',1048576))===manifestSha256,'source_manifest_changed');
 const result={status:'local_sampled_reference_only',source_manifest_sha256:manifestSha256,license_ref:licenseRef,credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet'],geometry:referenceGeometry,limitations:['No alpha inferred from black','No automatic layer or pivot extraction','Sampled CRC decode, not full-frame boundary audit','No device or performance validation'],records};
 mkdirSync(dirname(destination),{recursive:true,mode:0o700});mkdirSync(destination,{mode:0o700});
 for(const [file,bytes] of images)writeFileSync(join(destination,file),bytes,{mode:0o600,flag:'wx'});
 writeFileSync(join(destination,'reference.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 writeFileSync(join(destination,'index.html'),referenceHtml(records),{mode:0o600,flag:'wx'});
 return result;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const {values:v}=parseArgs({options:{'source-dir':{type:'string'},'manifest-sha256':{type:'string'},'license-ref':{type:'string'},output:{type:'string'}}});
 check(v['source-dir']&&v.output,'explicit_source_and_output_required');
 const result=prepareCharacterReference({sourceDir:v['source-dir'],manifestSha256:v['manifest-sha256'],licenseRef:v['license-ref'],output:v.output});
 console.log(`Prepared ${result.records.length} native-size reference frames; no new artwork or device access.`);
}
