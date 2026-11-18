import {readFileSync} from 'node:fs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>(n>=0?'节省 ':'增大 ')+Math.abs(n).toFixed(2)+'%';

/** File-openable, synchronized rendering of real PET4 bytes using the existing independent decoder. */
export function preprocessPage(m){
 const decoder=readFileSync(new URL('../packages/core/pet4.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export \{crc32\};\n/gm,'').replace(/^export /gm,'');
 const crc=readFileSync(new URL('../packages/core/crc32.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
 const total=m.actions.reduce((n,a)=>n+a.baseline.bytes,0),totals=m.tiers.map(t=>({label:t.label,bytes:m.actions.reduce((n,a)=>n+a.variants.find(v=>v.key===t.key).bytes,0)}));
 const data=JSON.stringify(m).replace(/</g,'\\u003c');
 const columns=m.tiers.length+1,title=m.actions.length===78?'400素材：全部78动作压缩优先':`400素材：${m.actions.length}动作，${m.tiers.length}档压缩`;
 const variants=m.actions.flatMap(a=>a.variants),frames=m.actions.reduce((n,a)=>n+a.frames*a.variants.length,0);
 const focus=m.visual_reference?m.actions.filter(a=>a.variants[0].additional_max_channel_error>m.visual_reference.sample_max_channel_error).sort((a,b)=>b.variants[0].additional_max_channel_error-a.variants[0].additional_max_channel_error||a.id-b.id).slice(0,8):[];
 const descriptions={conservative:'仅低梯度区域轻微平滑，阈值8；调色板色数上限不高于当前版。',balanced:'平滑阈值12＋帧间保持阈值3；最多192色，不高于当前版。',compact:'平滑阈值18＋帧间保持阈值5；最多128色，且至多当前色数的75%。'};
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1018;color:#eef3fb;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1600px;margin:auto;padding:28px}h1{font-size:28px;margin:0 0 10px}h2{font-size:20px;margin:25px 0 12px}p{color:#b7c4d7;max-width:1100px}.tag{display:inline-block;color:#8de3c8;border:1px solid #2c6759;background:#102c26;padding:3px 10px;border-radius:20px;font-size:12px}.totals{display:grid;grid-template-columns:repeat(${columns},1fr);gap:12px;margin:22px 0}.total,.panel{background:#141d2a;border:1px solid #2d3a4e;border-radius:12px;padding:15px}.total strong{font-size:23px;display:block;margin-top:4px}.saving{color:#8de3c8}.larger{color:#ffb59b}button,select{background:#223149;color:#edf4ff;border:1px solid #51637d;border-radius:7px;padding:8px 12px;font:inherit}button:hover{background:#304766}button:disabled,select:disabled{opacity:.5}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}input[type=range]{min-width:160px;flex:1;accent-color:#88d7c4}.clock{font-variant-numeric:tabular-nums;min-width:170px}#status{padding:9px 12px;border-radius:6px;background:#172c38;color:#b6e7ec;min-height:42px}.scroller{overflow:auto;padding-bottom:8px;--frame-size:400px}.scroller.screen{--frame-size:466px}.panels{display:grid;grid-template-columns:repeat(${columns},minmax(225px,1fr));gap:12px;min-width:${columns*240}px;max-width:${columns*500}px}.native .panels{grid-template-columns:repeat(${columns},calc(var(--frame-size) + 32px))}.zoom .panels{grid-template-columns:repeat(${columns},calc(var(--frame-size) + var(--frame-size) + 32px))}.panel h3{margin:0 0 6px;font-size:17px}.panel .facts{height:83px;font-size:13px;color:#adbed4}.panel canvas{display:block;width:100%;height:auto;image-rendering:auto;background:#000}.screen .panel canvas{border-radius:50%}.zoom .panel canvas{image-rendering:pixelated}.panel .metric{min-height:65px;font-size:12px;color:#a4b5ce;margin-top:10px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #304055;white-space:nowrap}th{color:#a9bdd6}tbody tr:hover{background:#142034}td small{color:#9bacc1}footer{color:#93a5bf;margin-top:35px;border-top:1px solid #2c3a4f;padding-top:18px}.note{border-left:3px solid #659e92;padding-left:12px}.recipes{display:grid;grid-template-columns:repeat(${m.tiers.length},1fr);gap:12px}.recipes p{background:#121c2a;padding:13px;border-radius:8px;margin:0}a{color:#9fd9ff}@media(max-width:700px){main{padding:15px}.totals{grid-template-columns:repeat(2,1fr)}.recipes{grid-template-columns:1fr}h1{font-size:23px}}
</style></head><body><main><span class="tag">独立实验 · 未合并 · 设备侧验证包保持</span><h1>${esc(title)}</h1><p>左侧为当前已批准合并版，右侧为从原视频同一400裁区重新处理、量化并编码的实验版。全部24fps，保持各动作原帧数（42号118帧，其余241帧），无缩放、无额外安全圆。所有画面使用同一帧号，直接解码真实PET4。</p>
<div class="totals"><div class="total">${m.actions.length}个动作 · 当前合并版<strong>${(total/1048576).toFixed(2)} MiB</strong><small>${m.actions.length===78?'完整78库实际总量':'仅本批样本，不外推全库'}</small></div>${totals.map(t=>`<div class="total">${t.label}<strong>${(t.bytes/1048576).toFixed(2)} MiB</strong><span class="${t.bytes<=total?'saving':'larger'}">${percent(100*(total-t.bytes)/total)}</span></div>`).join('')}</div>
<div class="recipes">${m.tiers.map(t=>`<p><b>${t.label}</b><br>${descriptions[t.key]}</p>`).join('')}</div><p class="note">阈值单位为RGB8通道值。高梯度边缘及黑色邻接不平滑；不代表五官获得语义保护。全部实验版都可能有损，重点看眼睛、发丝、渐变、动作连续性和星光消失过程。</p>
<p>${variants.filter(v=>v.bytes_saved>0).length}个候选变小，${variants.filter(v=>v.bytes_saved<0).length}个变大，${variants.filter(v=>v.bytes_saved===0).length}个大小相同；${variants.filter(v=>!v.within_legacy_limit).length}个超旧单文件上限。全部按实际输出列出，未自动替换原版。</p>${focus.length?`<div class="toolbar"><span>局部颜色差优先检查：</span>${focus.map(a=>`<button class="jump" data-action="${a.id}">${a.id} ${esc(a.name)} · 最大差${a.variants[0].additional_max_channel_error}</button>`).join('')}</div><p>这些动作的最大新增单通道差超过四样本范围${m.visual_reference.sample_max_channel_error}/255；最大差不代表平均观感，建议检查完整动画及“最大通道差帧”。</p>`:''}<h2>同步画面对照</h2><div class="toolbar"><label>动作 <select id="action">${m.actions.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.name)}</option>`).join('')}</select></label><button id="play" disabled>播放</button><button id="prev" disabled>上一帧</button><button id="next" disabled>下一帧</button><select id="mode" aria-label="画布模式"><option value="screen">466物理圆屏 · 居中偏移33</option><option value="square">400原始方形画布</option></select><select id="zoom" aria-label="显示倍率"><option value="fit">适应宽度</option><option value="native">原尺寸1:1</option><option value="zoom">2倍像素检查</option></select></div>
<div class="toolbar"><input id="frame" type="range" min="0" max="${m.actions[0].frames-1}" value="0" aria-label="同步帧号"><span id="clock" class="clock">帧0 / ${m.actions[0].frames-1} · 0.000秒</span>${m.tiers.map(t=>`<button id="worst-${t.key}" disabled>${t.label}平均误差最差帧</button><button id="peak-${t.key}" disabled hidden>最大通道差帧</button>`).join('')}</div><p id="status" role="status">正在加载当前动作的真实PET4…</p>
<div id="comparison" class="scroller screen"><div class="panels">${['当前合并版',...m.tiers.map(t=>t.label)].map((label,i)=>`<section class="panel"><h3>${label}</h3><div id="facts${i}" class="facts"></div><canvas id="canvas${i}" width="466" height="466" aria-label="${label}实际解码画面"></canvas><div id="metric${i}" class="metric"></div></section>`).join('')}</div></div>
<h2>每档实际文件大小</h2><div class="toolbar"><label>筛选体积表 <input id="filter" type="search" placeholder="动作名或ID"></label><span id="filter-count">${m.actions.length}个动作</span><a href="summary.csv">下载CSV</a></div><p>节省比例＝（当前合并PET4字节－实验PET4字节）÷当前字节。包括完整文件头／索引／所有帧；负收益明确显示“增大”。实验同时包含预处理、重新量化和索引重排，不能将全部收益归因于某一个滤镜。</p><div class="scroller"><table><thead><tr><th>查看</th><th>动作</th><th>档位</th><th>当前字节</th><th>实验字节</th><th>减少字节</th><th>压缩变化</th><th>实际颜色数</th><th>旧单文件上限</th><th>最大新增通道差</th><th>新增前景RGB平均误差</th></tr></thead><tbody>${m.actions.map(a=>a.variants.map(v=>`<tr data-action="${a.id}" data-search="${a.id} ${esc(a.name)}"><td><button class="jump" data-action="${a.id}">查看</button></td><td>${a.id} ${esc(a.name)}${a.frames===118?'（118帧）':''}</td><td>${v.label}</td><td>${a.baseline.bytes.toLocaleString('en-US')}</td><td>${v.bytes.toLocaleString('en-US')}</td><td>${v.bytes_saved.toLocaleString('en-US')}</td><td class="${v.saved_percent>=0?'saving':'larger'}">${percent(v.saved_percent)}</td><td>${v.actual_palette_colors}</td><td class="${v.within_legacy_limit?'saving':'larger'}">${v.within_legacy_limit?'限内':'超限实验'}</td><td>${v.additional_max_channel_error??'—'}/255</td><td>${v.additional_foreground_mae_rgb.map(n=>n.toFixed(3)).join(' / ')}</td></tr>`).join('')).join('')}</tbody></table></div>
<footer>误差相对当前合并RGB565，前景取双方非黑像素并集，避免黑底稀释；“相对源400”误差另列于画面下方及manifest。最差帧按单帧前景平均误差选取。所有${variants.length}候选完整${frames}帧经独立JS decoder核验CRC／索引／RGB565 SHA及seek，78个原文件SHA前后保持。<br>400帧缓冲需求不会因文件缩小而降低；桌面播放速度不代表设备性能。此页不连接设备、不写角色指针。上善无形／ZipZipPipe／PC2005-cloud/dsh-pet，素材沿用非商业许可，工具代码MIT。<br><a href="manifest.json">实验参数与完整摘要</a></footer></main>
<script>'use strict';
function requireThat(ok,code='invalid_message'){if(!ok)throw new Error(code);}
function bounded(n,min,max){requireThat(Number.isSafeInteger(n)&&n>=min&&n<=max);return n;}
${crc}\n${decoder}
const REVIEW=${data};
${browserCode}
</script></body></html>`;
}

const browserCode=String.raw`
const el=id=>document.getElementById(id),pending=new Map(),controlIds=['play','prev','next',...REVIEW.tiers.flatMap(t=>['worst-'+t.key,'peak-'+t.key])];
window.__n400Register=(key,data)=>{const resolve=pending.get(key);if(resolve){pending.delete(key);resolve(data);}};
const colors=new Uint32Array(65536);for(let c=0;c<65536;c++)colors[c]=(255<<24)|(Math.round((c&31)*255/31)<<16)|(Math.round(((c>>>5)&63)*255/63)<<8)|Math.round((c>>>11)*255/31);
let active=null,players=[],frame=0,playing=false,start=0,startFrame=0,last=-1,mode='screen',loading=false;
function status(message){el('status').textContent=message;}
function pause(){playing=false;el('play').textContent='播放';}
async function loadAsset(key,expected){
 let script;
 const data=await new Promise((ok,no)=>{script=document.createElement('script');const timer=setTimeout(()=>{pending.delete(key);script.remove();no(new Error('素材加载超时 '+key));},30000);pending.set(key,value=>{clearTimeout(timer);ok(value);});script.src='media/'+key+'.js';script.onerror=()=>{clearTimeout(timer);pending.delete(key);script.remove();no(new Error('素材加载失败 '+key));};document.head.appendChild(script);});
 script.remove();const binary=atob(data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 requireThat(bytes.length===expected.bytes,'preview_size');
 if(!crypto.subtle)throw new Error('此浏览器未提供SHA256校验，请用Chrome/Edge打开本地文件');
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');requireThat(sha===expected.sha256,'preview_sha');
 return {decoder:new Pet4Decoder(bytes,{profile:'native400-candidate-v1'}),pixels:new Uint8Array(320000),image:new ImageData(400,400)};
}
async function loadAction(id){
 if(loading)return;loading=true;pause();el('action').disabled=true;for(const id of controlIds)el(id).disabled=true;
 const a=REVIEW.actions.find(a=>a.id===Number(id));status('正在校验并加载 '+a.name+' 的'+(REVIEW.tiers.length+1)+'个真实PET4文件…');
 try{
  const items=[{key:'base',...a.baseline},...a.variants],results=await Promise.allSettled(items.map(item=>loadAsset(a.id+'-'+item.key,item)));
  const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  players=results.map(r=>r.value);active=a;frame=0;last=-1;el('action').value=String(a.id);el('frame').max=String(a.frames-1);for(const t of REVIEW.tiers)el('peak-'+t.key).hidden=!Number.isInteger(a.variants.find(v=>v.key===t.key).peak_error_frame);
  items.forEach((v,i)=>{el('facts'+i).innerHTML=(v.bytes/1048576).toFixed(3)+' MiB · '+v.bytes.toLocaleString()+' B<br>'+(i?((v.saved_percent>=0?'节省 ':'增大 ')+Math.abs(v.saved_percent).toFixed(2)+'% · '+v.actual_palette_colors+'色'+(v.within_legacy_limit?'':' · 超旧上限实验')):'当前已批准合并版本 · '+v.palette_colors+'色');
   el('metric'+i).textContent=i?'新增前景RGB误差 '+v.additional_foreground_mae_rgb.map(n=>n.toFixed(3)).join(' / ')+'；最大差 '+v.additional_max_channel_error+'/255。相对源400前景误差 '+v.source_foreground_mae_rgb.map(n=>n.toFixed(3)).join(' / '):'相对源400前景误差 '+a.variants[0].base_source_foreground_mae_rgb.map(n=>n.toFixed(3)).join(' / ')+'。与右侧使用同一帧号。';});
  render();for(const id of controlIds)el(id).disabled=false;status('已核对'+players.length+'个文件SHA256；'+a.frames+'帧／24fps。暂停可逐帧检查；播放时同步，不连接设备。');
 }catch(e){status('加载失败：'+e.message+'；已有画面保持。');if(active){el('action').value=String(active.id);for(const id of controlIds)el(id).disabled=false;}}finally{loading=false;el('action').disabled=false;}
}
function render(){
 if(!players.length)return;
 for(let i=0;i<players.length;i++){
  const p=players[i];p.decoder.decodeInto(frame,{rgb565:p.pixels});const rgba=new Uint32Array(p.image.data.buffer);
  for(let n=0;n<160000;n++)rgba[n]=colors[p.pixels[2*n]|p.pixels[2*n+1]<<8];
  const c=el('canvas'+i),size=mode==='screen'?466:400;if(c.width!==size){c.width=size;c.height=size;}
  const ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);ctx.putImageData(p.image,mode==='screen'?33:0,mode==='screen'?33:0);
 }
 last=frame;el('frame').value=String(frame);el('clock').textContent='帧'+frame+' / '+(active.frames-1)+' · '+(frame/24).toFixed(3)+'秒';
}
el('action').addEventListener('change',()=>loadAction(el('action').value));
el('filter').addEventListener('input',()=>{const q=el('filter').value.trim().toLowerCase(),ids=new Set();for(const row of document.querySelectorAll('tbody tr')){row.hidden=!row.dataset.search.toLowerCase().includes(q);if(!row.hidden)ids.add(row.dataset.action);}el('filter-count').textContent=ids.size+'个动作';});
for(const button of document.querySelectorAll('.jump'))button.addEventListener('click',async()=>{if(loading)return;await loadAction(button.dataset.action);el('action').scrollIntoView({block:'center',behavior:'smooth'});});
el('play').addEventListener('click',()=>{if(playing){pause();return;}playing=true;start=performance.now();startFrame=frame;el('play').textContent='暂停';});
el('prev').addEventListener('click',()=>{pause();frame=(frame+active.frames-1)%active.frames;render();});el('next').addEventListener('click',()=>{pause();frame=(frame+1)%active.frames;render();});
el('frame').addEventListener('input',()=>{pause();frame=Number(el('frame').value);render();});
for(const tier of REVIEW.tiers){el('worst-'+tier.key).addEventListener('click',()=>{pause();frame=active.variants.find(v=>v.key===tier.key).worst_error_frame;render();});el('peak-'+tier.key).addEventListener('click',()=>{pause();frame=active.variants.find(v=>v.key===tier.key).peak_error_frame;render();});}
el('mode').addEventListener('change',()=>{mode=el('mode').value;el('comparison').classList.toggle('screen',mode==='screen');render();});
el('zoom').addEventListener('change',()=>{el('comparison').classList.toggle('native',el('zoom').value==='native');el('comparison').classList.toggle('zoom',el('zoom').value==='zoom');});
function tick(now){if(playing&&!loading){frame=(startFrame+Math.floor((now-start)*24/1000))%active.frames;if(frame!==last){try{render();}catch(e){pause();status('解码错误：'+e.message);}}}requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.__native400Review={manifest:REVIEW,loadAction,renderAt(n){pause();frame=n;render();},get frame(){return frame;},get playing(){return playing;},get actionId(){return active?.id;},get players(){return players;}};
loadAction(REVIEW.actions[0].id);
`;
