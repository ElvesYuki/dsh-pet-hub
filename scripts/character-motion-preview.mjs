// Browser-only authoring viewer. Bundled after character-motion-probe.mjs by the offline exporter.
async function startCharacterPreview(config){
 const canvas=document.querySelector('#motion'),ctx=canvas.getContext('2d',{willReadFrequently:true}),baseline=document.querySelector('#baseline'),baseCtx=baseline.getContext('2d');
 const overlay=document.querySelector('#overlay'),octx=overlay.getContext('2d'),info=document.querySelector('#info');
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('preview_image_load_failed'));image.src=src;});
 const images=new Map(await Promise.all(config.parts.map(async p=>[p.id,await load(p.image)]))),source=await load(config.source),probe=createMotionProbe(config.parts);
 baseCtx.drawImage(source,0,0);const base=baseCtx.getImageData(0,0,360,360).data,interior=[];
 // Conservative fixed-reference interior. Counts are candidates, not semantic proof of a hole.
 for(let y=4;y<356;y++)for(let x=4;x<356;x++){
  let dense=true;for(let dy=-4;dy<=4&&dense;dy++)for(let dx=-4;dx<=4;dx++)if(base[((y+dy)*360+x+dx)*4+3]<240){dense=false;break;}
  if(dense)interior.push(y*360+x);
 }
 const controls={mode:document.querySelector('#mode'),part:document.querySelector('#part'),angle:document.querySelector('#angle'),time:document.querySelector('#time'),strength:document.querySelector('#strength'),markers:document.querySelector('#markers'),holes:document.querySelector('#holes')};
 config.parts.filter(p=>p.id==='head'||movingHair.includes(p.id)).forEach(p=>controls.part.add(new Option(p.label,p.id)));
 let playing=true,time=0,origin=performance.now(),frame=-1,raf=0,last={};
 const render=(pose,target=ctx)=>{target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,360,360);for(const id of config.draw_order){target.setTransform(...pose.world[id]);target.drawImage(images.get(id),0,0);}target.setTransform(1,0,0,1,0,0);};
 function candidates(data){return interior.filter(p=>data[p*4+3]<200);}
 function options(){return {mode:controls.mode.value,selected:controls.part.value,angle:+controls.angle.value,strength:+controls.strength.value};}
 function draw(){
  const pose=probe.sample(time,options());render(pose);const holes=candidates(ctx.getImageData(0,0,360,360).data);octx.clearRect(0,0,360,360);
  if(controls.holes.checked){octx.fillStyle='#ff4466';for(const p of holes)octx.fillRect(p%360,Math.floor(p/360),1,1);}
  if(controls.markers.checked)for(const p of config.parts.filter(p=>p.id==='head'||movingHair.includes(p.id))){const point=posePoint(pose.world[p.id],p.pivot);octx.strokeStyle='#73f7dd';octx.beginPath();octx.arc(...point,2,0,Math.PI*2);octx.stroke();}
  controls.time.value=String(time);last={time,mode:controls.mode.value,selected:controls.part.value,angles:pose.angles,interior_low_coverage_candidates:holes.length,static_interior_pixels:interior.length,playing};
  info.textContent=`${time.toFixed(3)}s · ${Object.values(pose.angles).filter(a=>Math.abs(a)>1e-6).length}处非零角度 · 密实内区低覆盖候选 ${holes.length} px（辅助定位）`;
 }
 function pause(){playing=false;document.querySelector('#play').textContent='播放';}
 function loop(now){if(playing){const next=Math.floor((now-origin)/1000*24);if(next!==frame){frame=next;time=(next/24)%probePeriod;draw();}}raf=requestAnimationFrame(loop);}
 for(const [key,control] of Object.entries(controls))control.addEventListener('input',()=>{pause();if(key==='time')time=+control.value;draw();});
 document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停':'播放';origin=performance.now()-time*1000;frame=-1;draw();};
 document.querySelector('#reset').onclick=()=>{pause();time=0;controls.mode.value='neutral';draw();};
 document.querySelector('#background').onclick=()=>{document.body.classList.toggle('light');};
 document.querySelector('#zoom').onclick=()=>{document.body.classList.toggle('zoom');};
 async function scan(){
  pause();const off=document.createElement('canvas');off.width=off.height=360;const target=off.getContext('2d',{willReadFrequently:true}),cases=[];
  const assess=(label,t,opts)=>{const pose=probe.sample(t,opts);render(pose,target);const holes=candidates(target.getImageData(0,0,360,360).data);return {label,time:t,...opts,candidates:holes.length,sample_coordinates:holes.filter((_,i)=>i%Math.max(1,Math.floor(holes.length/12))===0).slice(0,12).map(p=>[p%360,Math.floor(p/360)])};};
  cases.push(assess('neutral',0,{mode:'neutral'}));
  for(const selected of ['head',...movingHair])for(const sign of [-1,1])cases.push(assess(`${selected}:${sign>0?'+':'-'}${selected==='head'?1.25:2}`,0,{mode:'single',selected,angle:sign*(selected==='head'?1.25:2),strength:1}));
  for(let i=0;i<192;i++){cases.push(assess(`combined:${i}`,i/24,{mode:'combined',strength:1}));if(i%24===0)await new Promise(resolve=>requestAnimationFrame(resolve));}
  const result={status:'desktop_diagnostic_not_visual_acceptance',target_sample_fps:24,period_seconds:probePeriod,static_interior_pixels:interior.length,metric:'alpha_below_200_in_static_alpha240_square_eroded_radius4',cases,worst:cases.reduce((a,b)=>a.candidates>=b.candidates?a:b)};
  document.querySelector('#scan-result').textContent=JSON.stringify({cases:cases.length,baseline:cases[0].candidates,worst:result.worst},null,2);draw();return result;
 }
 document.querySelector('#scan').onclick=async()=>{const b=document.querySelector('#scan');b.disabled=true;try{await scan();}finally{b.disabled=false;}};
 window.characterProbe={status:()=>({...last}),scan,set:(opts,t=0)=>{pause();for(const [key,value] of Object.entries(opts))if(controls[key])controls[key].value=String(value);time=t;draw();return {...last};},matrices:(angles)=>probe.matrices(angles),snapshot:()=>canvas.toDataURL('image/png')};
 addEventListener('pagehide',()=>{cancelAnimationFrame(raf);pause();},{once:true});draw();raf=requestAnimationFrame(loop);
 document.querySelector('#loading').textContent=`已加载${images.size}层；所有贴图和脚本内嵌，可离线打开。`;
}
