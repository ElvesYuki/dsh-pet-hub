import {createCharacterDisplay,presentCharacterFrame} from './character-display.mjs';
import {resolveCharacterBehavior,layeredTouch} from '../core/layered-character-profiles.mjs';
import {movingHair,posePoint} from '../core/character-motion-probe.mjs';
import {createNaturalMotion,replayNaturalMotion} from '../core/character-natural-motion.mjs';
import {composeCharacterStateFace} from '../core/character-states.mjs';
import {sampleExpression} from '../core/character-expression.mjs';
import {replaySpeech,composeSpeechMouth} from '../core/character-speech.mjs';
import {createCharacterWave,replayCharacterWave,waveArmMatrix} from '../core/character-wave.mjs';
import {morphArmRgba} from '../core/character-arm-morph.mjs';
// DOM/input adapter for the isolated natural-motion authoring page. Never talks to pet or devices.
export async function startNaturalPreview(config,{root=document,publishGlobal=true,autoPlay=true}={}){
 let closed=false,display=null;const workCanvases=[];const makeCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=360;workCanvases.push(c);return c;};const lifetime=new AbortController(),themeRoot=root===document?document.body:root;
 try{
 const behavior=resolveCharacterBehavior(config.behavior),rules=behavior.rules,waveProfile=behavior.profiles.wave_v1,contourProfile=behavior.profiles.arm_contour_distance_v1;
 const canvas=root.querySelector('#motion'),displayCtx=canvas.getContext('2d'),frameCanvas=makeCanvas(),ctx=frameCanvas.getContext('2d',{willReadFrequently:true}),overlay=root.querySelector('#overlay'),octx=overlay.getContext('2d'),baseline=root.querySelector('#baseline'),reference=makeCanvas(),baseCtx=reference.getContext('2d');
 const load=src=>typeof src!=='string'?Promise.resolve(src):new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('natural_image_load_failed'));img.src=src;});
 const images=new Map(await Promise.all(config.parts.map(async p=>[p.id,await load(p.image)]))),source=await load(config.source);
 const faceImages=new Map(config.face?await Promise.all(Object.entries(config.face.assets).map(async([id,a])=>[id,await load(a.image)])):[]);
 const raisedArm=config.wave?await load(config.wave.image):null,armGroup=makeCanvas();const armCtx=armGroup.getContext('2d',{willReadFrequently:true}),armPair=makeCanvas();const pairCtx=armPair.getContext('2d',{willReadFrequently:true});
 baseCtx.drawImage(source,0,0);const base=baseCtx.getImageData(0,0,360,360).data,interior=[];const coverage=makeCanvas();const coverageCtx=coverage.getContext('2d');coverageCtx.drawImage(config.wave?images.get('body'):source,0,0);const coverageBase=coverageCtx.getImageData(0,0,360,360).data;
 for(let y=4;y<356;y++)for(let x=4;x<356;x++){let dense=true;for(let dy=-4;dy<=4&&dense;dy++)for(let dx=-4;dx<=4;dx++)if(coverageBase[((y+dy)*360+x+dx)*4+3]<240){dense=false;break;}if(dense)interior.push(y*360+x);}
 const controls={scene:root.querySelector('#scene'),time:root.querySelector('#time'),breathing:root.querySelector('#breathing'),holes:root.querySelector('#holes'),markers:root.querySelector('#markers'),face:root.querySelector('#face'),mouth:root.querySelector('#mouth')};
 const eventSets={idle:[],head:[{type:'touch',time:3,x:210,y:120}],body:[{type:'touch',time:3,x:175,y:245}],burst:[...Array.from({length:20},(_,i)=>({type:'touch',time:2+i*.075,x:i%2?130:220,y:120})),{type:'idle',time:5,enabled:false}],stop:[{type:'touch',time:2,x:210,y:120},{type:'idle',time:2.35,enabled:false}],interrupt:[{type:'touch',time:2,x:210,y:120},{type:'idle',time:2.4,enabled:false},{type:'touch',time:4.4,x:155,y:245},{type:'idle',time:7,enabled:true}]};
 const speechScripts=config.speech?{speech:[{type:'start',time:1,id:'A',duration:6},{type:'pause',time:2.1,generation:1,paused:true},{type:'pause',time:2.7,generation:1,paused:false},{type:'start',time:3.8,id:'B',duration:4},{type:'stop',time:4.6,generation:1},{type:'stop',time:5.7,generation:2},{type:'start',time:7,id:'C',duration:2}],speech_touch:[{type:'start',time:1,id:'A',duration:6},{type:'pause',time:2.5,generation:1,paused:true},{type:'pause',time:3,generation:1,paused:false},{type:'start',time:4,id:'B',duration:3},{type:'stop',time:5.5,generation:2}]}:{};
 if(config.speech){eventSets.speech=[];eventSets.speech_touch=[{type:'touch',time:2.3,x:205,y:120},{type:'touch',time:4.4,x:175,y:245},{type:'touch',time:5.1,x:205,y:120}];controls.scene.add(new Option('无音频说话/换句','speech'));controls.scene.add(new Option('说话期间摸头','speech_touch'));}
 if(config.states){
  for(const key of Object.keys(eventSets))delete eventSets[key];
  Object.assign(eventSets,{idle:[],thinking:[{type:'state',time:0,state:'thinking'}],working:[{type:'state',time:0,state:'working'}],success:[{type:'success',time:2,id:'done'}],latest_base:[{type:'state',time:0,state:'working'},{type:'touch',time:2,x:205,y:120},{type:'state',time:2.3,state:'thinking'}],rapid_states:Array.from({length:20},(_,i)=>({type:'state',time:i*.2,state:['working','thinking','idle'][i%3]})),success_latest:[{type:'state',time:0,state:'working'},{type:'success',time:2,id:'done'},{type:'state',time:2.3,state:'thinking'}],repeated_success:[{type:'success',time:1,id:'a'},{type:'success',time:1.1,id:'b'},{type:'success',time:1.2,id:'a'},{type:'success',time:2.5,id:'a'},{type:'success',time:3.5,id:'c'}],state_speech:[{type:'state',time:0,state:'working'},{type:'touch',time:2.3,x:205,y:120},{type:'success',time:3.5,id:'done'},{type:'state',time:4,state:'thinking'},{type:'touch',time:5.1,x:205,y:120}],state_stop:[{type:'state',time:0,state:'thinking'},{type:'state',time:3,state:'idle'},{type:'idle',time:3.6,enabled:false}]});
  if(config.speech)speechScripts.state_speech=speechScripts.speech_touch;
  controls.scene.replaceChildren();const labels={idle:'待机',thinking:'思考',working:'工作',success:'一次完成反馈',latest_base:'工作→摸头→思考',rapid_states:'连续切换状态',success_latest:'完成期间改变基础态',repeated_success:'重复完成不叠加',state_speech:'状态/触摸/无音频说话组合',state_stop:'回到待机后停止呼吸'};for(const key of Object.keys(eventSets))controls.scene.add(new Option(labels[key],key));
 }
 const waveScripts=config.wave?{wave:[{type:'start',time:1}],wave_cancel:[{type:'start',time:1},{type:'cancel',time:1.8,generation:1}],wave_latest:[{type:'start',time:1}],wave_speech:[{type:'start',time:1},{type:'start',time:1.2}]}:{};
 if(config.wave){Object.assign(eventSets,{wave:[],wave_cancel:[],wave_latest:[{type:'state',time:0,state:'working'},{type:'touch',time:1.6,x:205,y:120},{type:'state',time:2,state:'thinking'}],wave_speech:[{type:'state',time:0,state:'working'},{type:'success',time:1.8,id:'wave-done'},{type:'touch',time:2.2,x:175,y:245}]});if(config.speech)speechScripts.wave_speech=speechScripts.speech_touch;for(const [id,label] of Object.entries({wave:'挥手一次',wave_cancel:'挥手中途打断',wave_latest:'挥手/摸头期间改变基础态',wave_speech:'挥手/完成/无音频说话'}))controls.scene.add(new Option(label,id));}
 let waveEvents=[];
 const waveAt=(t,script=waveEvents)=>config.wave?replayCharacterWave(t,script,behavior):null;
 const motionOptions={states:!!config.states,behavior};
 let engine=createNaturalMotion(config.parts,motionOptions),events=[],speechEvents=[],time=0,playing=autoPlay,lastWall=performance.now(),lastDraw=-1,raf=0,last={},scanBusy=false,notice=null,completionSequence=0;
 const speechAt=(t,script=speechEvents)=>config.speech?replaySpeech(t,script,behavior).status():null;
 const copyEvents=items=>items.map(e=>({...e}));
 function apply(target,e){if(e.type==='touch')return target.touch(e.time,e.x,e.y);if(e.type==='state')return target.setBase(e.time,e.state);if(e.type==='success')return target.complete(e.time,e.id);return target.setIdle(e.time,e.enabled);}
 function expression(pose,mode=controls.face?.value??'auto'){
  if(!config.face)return null;const face=sampleExpression(pose.time,pose.head_expression,behavior);
  if(mode==='auto')return config.states?composeCharacterStateFace(face,pose.character_state,behavior):face;
  return {eye:['open','half','closed','smile'].includes(mode)?mode:'open',brows:{neutral:mode==='smile'||mode==='raised'?0:1,relaxed:mode==='smile'?1:0,raised:mode==='raised'?1:0},mouth:{closed:mode==='smile'?0:1,smile:mode==='smile'?1:0},owner:mode==='bare'?'bare':'manual'};
 }
 let armCache=null;
 function render(pose,target=ctx,mode,speechScript=null,waveScript=null,scale=1){
  const transform=matrix=>target.setTransform(...matrix.map(v=>v*scale));
  const wave=waveAt(pose.time,waveScript??waveEvents);
  let face=expression(pose,mode);const speech=speechAt(pose.time,speechScript??speechEvents);
  if(face&&speech&&face.owner!=='bare'){
   if(speechScript===null&&controls.mouth?.value!=='auto')face={...face,mouth:{[controls.mouth.value]:1},mouth_owner:'manual'};else face=composeSpeechMouth(face,speech,behavior);
   face.speech_stage=speech.stage;
  }
  target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,target.canvas.width,target.canvas.height);target.imageSmoothingEnabled=true;target.imageSmoothingQuality='low';
  for(const id of config.draw_order){if(id==='arm_right'&&wave?.active&&wave.lift>0)continue;transform(pose.world[id]);
   if(face&&['eyes','brows','mouth'].includes(id)){
    if(face.owner==='bare')continue;
    if(id==='eyes'){target.drawImage(faceImages.get('eyes_'+face.eye),0,0);if(face.eye==='open')target.drawImage(faceImages.get('eyes_open_edge'),0,0);}
    else for(const [state,opacity] of Object.entries(face[id==='brows'?'brows':'mouth']))if(opacity>0){target.globalAlpha=opacity;target.drawImage(faceImages.get((id==='brows'?'brows_':'mouth_')+state),0,0);target.globalAlpha=1;}
   }else target.drawImage(images.get(id),0,0);
  }
  if(wave?.active&&wave.lift>0){
   if(!armCache||armCache.pose!==pose||armCache.lift!==wave.lift||armCache.angle!==wave.angle){
   const old=[waveProfile.shoulder,waveProfile.wrist_down],raised=[waveProfile.shoulder,waveProfile.wrist_up],u=wave.lift;
   const common=old.map((p,i)=>p.map((v,j)=>v*(1-u)+raised[i][j]*u));
   const angle=(wave.angle+(1-u)*(pose.angles.arm_right??0))*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),shoulder=common[0];
   for(let i=1;i<2;i++){const dx=common[i][0]-shoulder[0],dy=common[i][1]-shoulder[1];common[i]=[shoulder[0]+dx*c-dy*s,shoulder[1]+dx*s+dy*c];}
   armCtx.setTransform(1,0,0,1,0,0);armCtx.clearRect(0,0,360,360);
   if(u===1){armCtx.setTransform(...waveArmMatrix(raised,common));armCtx.drawImage(raisedArm,0,0);}
   else{
    const samples=[];
    for(const [image,anchors] of [[images.get('arm_right'),old],[raisedArm,raised]]){
     pairCtx.setTransform(1,0,0,1,0,0);pairCtx.clearRect(0,0,360,360);pairCtx.setTransform(...waveArmMatrix(anchors,common));pairCtx.drawImage(image,0,0);samples.push(pairCtx.getImageData(0,0,360,360));
    }
    const box=[360,360,0,0];for(const sample of samples)for(let i=0;i<360*360;i++)if(sample.data[i*4+3]>contourProfile.roi_alpha){const x=i%360,y=Math.floor(i/360);box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x+1);box[3]=Math.max(box[3],y+1);}
    const left=Math.max(0,box[0]-contourProfile.margin_px),top=Math.max(0,box[1]-contourProfile.margin_px),width=Math.min(360,box[2]+contourProfile.margin_px)-left,height=Math.min(360,box[3]+contourProfile.margin_px)-top;
    const crops=samples.map(sample=>{const crop=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)crop.set(sample.data.subarray(((top+y)*360+left)*4,((top+y)*360+left+width)*4),y*width*4);return crop;});
    const pixels=morphArmRgba(crops[0],crops[1],width,height,u,behavior);armCtx.putImageData(new ImageData(pixels,width,height),left,top);
   }
   armCache={pose,lift:wave.lift,angle:wave.angle};
   }
   transform(pose.world.body);target.drawImage(armGroup,0,0);
  }
  target.setTransform(1,0,0,1,0,0);return face;
 }
 const candidates=data=>interior.filter(p=>data[p*4+3]<200);
 function draw(){
  if(closed)return;
  const pose=engine.pose(),face=render(pose);const holes=candidates(ctx.getImageData(0,0,360,360).data),view=display?.status();if(view){if(view.mode==='pixels'||view.scale===1)presentCharacterFrame(displayCtx,frameCanvas,view.scale,{pixels:true});else render(pose,displayCtx,undefined,null,null,view.scale);octx.setTransform(view.scale,0,0,view.scale,0,0);}octx.clearRect(0,0,360,360);
  if(controls.holes.checked){octx.fillStyle='#ff4466';for(const p of holes)octx.fillRect(p%360,Math.floor(p/360),1,1);}
  if(controls.markers.checked)for(const p of config.parts.filter(p=>p.id==='head'||movingHair.includes(p.id))){const point=posePoint(pose.world[p.id],p.pivot);octx.strokeStyle='#73f7dd';octx.beginPath();octx.arc(...point,2,0,Math.PI*2);octx.stroke();}
  controls.time.value=String(time);controls.breathing.checked=pose.idle;
  last={...engine.status(),wave:waveAt(pose.time),playing,scene:controls.scene.value,character_state:pose.character_state??null,head_y:pose.head_y,angles:pose.angles,face,speech:speechAt(pose.time),interior_low_coverage_candidates:holes.length};
  root.querySelector('#info').textContent=`${time.toFixed(2)}s · ${pose.idle?'自然呼吸':'阻尼回稳'} · 接受触摸 ${last.accepted_touches} / 限频或拒绝 ${last.rejected_touches} · 内区低覆盖候选 ${holes.length}px`;
  root.querySelector('#feedback').textContent=notice&&performance.now()<notice.until?notice.text:pose.feedback?(pose.feedback.region==='head'?'摸头：头发轻摆后回稳':'身体：双臂和尾巴轻微回应'):'可点击人物；150ms内的重复点击会限频。';
  if(config.wave)root.querySelector('#wave-status').textContent=last.wave.active?'挥手 '+last.wave.stage+' · 代数 '+last.wave.generation:'挥手通道空闲';
  if(config.speech){const s=last.speech;root.querySelector('#speech-status').textContent=s.active?`无音频片段 ${s.id} · ${s.stage} · 嘴型 ${s.mouth}`:'说话通道空闲，嘴部跟随当前表情';}
  if(config.states){const s=pose.character_state,names={idle:'待机',thinking:'思考',working:'工作'};root.querySelector('#state-info').textContent=`当前基础：${names[s.base]}${s.transitioning?'（过渡中）':''}${s.success?' · 完成反馈进行中':''}`;root.querySelectorAll('[data-base]').forEach(b=>{const on=b.dataset.base===s.base;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
 }
 function pause(){playing=false;cancelAnimationFrame(raf);raf=0;root.querySelector('#play').textContent='播放';}
 function play(){if(closed)return;playing=time<rules.max_replay_seconds;lastWall=performance.now();root.querySelector('#play').textContent=playing?'暂停':'重播';if(playing&&!raf)raf=requestAnimationFrame(loop);}
 function seek(t){if(closed)return;pause();notice=null;time=t;engine=replayNaturalMotion(config.parts,time,events,motionOptions);lastDraw=-1;draw();}
 function scene(id){if(closed)return;if(!Object.hasOwn(eventSets,id))throw new Error('unknown_natural_scene');pause();notice=null;controls.scene.value=id;events=copyEvents(eventSets[id]);waveEvents=copyEvents(waveScripts[id]??[]);speechEvents=copyEvents(speechScripts[id]??[]);if(controls.mouth)controls.mouth.value='auto';time=0;engine=replayNaturalMotion(config.parts,0,events,motionOptions);draw();}
 function input(e){
  if(closed||scanBusy)return {accepted:false,reason:'scan_busy'};
  if(events.filter(a=>a.time<=time).length>=rules.events_per_channel)return {accepted:false,reason:'authoring_history_limit'};
  const history=events.filter(a=>a.time<=time),result=apply(engine,e);events=[...history,e];play();draw();return result;
 }
 function touchAt(x,y){if(closed)return {accepted:false,reason:'closed'};
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=360||y>=360||base[(Math.floor(y)*360+Math.floor(x))*4+3]<layeredTouch.reference_alpha_min){notice={text:'点到了透明背景，未触发反馈',until:performance.now()+800};draw();return {accepted:false,reason:'transparent'};}
  notice=null;const r=input({type:'touch',time,x,y});if(!r.accepted){notice={text:r.reason==='cooldown'?'点击太快，本次已限频':r.reason,until:performance.now()+800};draw();}return r;
 }
 canvas.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;const r=canvas.getBoundingClientRect();touchAt((event.clientX-r.left)*360/r.width,(event.clientY-r.top)*360/r.height);},{signal:lifetime.signal});
 controls.scene.onchange=()=>{scene(controls.scene.value);play();};controls.time.oninput=()=>seek(+controls.time.value);
 controls.breathing.onchange=()=>input({type:'idle',time,enabled:controls.breathing.checked});controls.holes.onchange=draw;controls.markers.onchange=draw;
 if(controls.face)controls.face.onchange=draw;
 function baseState(id){return input({type:'state',time,state:id});}
 function completion(id='complete-'+(++completionSequence)){return input({type:'success',time,id});}
 if(config.states){root.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>baseState(b.dataset.base));root.querySelector('#state-success').onclick=()=>completion();}
 function waveCommand(type,generation){
  if(closed||!config.wave||scanBusy)return {accepted:false,reason:'unavailable'};
  const history=waveEvents.filter(e=>e.time<=time);if(history.length>=rules.events_per_channel)return {accepted:false,reason:'authoring_history_limit'};
  const core=createCharacterWave(behavior);for(const e of history)if(e.type==='start')core.start(e.time);else core.cancel(e.time,e.generation);
  const current=core.sample(time),e={type,time};let result;
  if(type==='start')result=core.start(time);else if(type==='cancel'){if(!current.active)return {accepted:false,reason:'inactive'};e.generation=generation??current.generation;result=core.cancel(time,e.generation);}else throw new Error('invalid_wave_command');
  if(result.accepted){waveEvents=[...history,e];play();draw();}return result;
 }
 if(config.wave){root.querySelector('#wave-start').onclick=()=>waveCommand('start');root.querySelector('#wave-cancel').onclick=()=>waveCommand('cancel');}
 function speechCommand(command){
  if(closed||!config.speech||scanBusy)return {accepted:false,reason:'unavailable'};
  const history=speechEvents.filter(e=>e.time<=time);if(history.length>=rules.events_per_channel)return {accepted:false,reason:'authoring_history_limit'};
  const core=replaySpeech(time,history,behavior),current=core.status(),e={...command,time};let result;
  if(e.type==='start'){e.id=e.id??'片段'+(current.generation+1);e.duration=e.duration??behavior.profiles.silent_speech_v1.duration_default;result={accepted:true,...core.start(time,{id:e.id,duration:e.duration})};}
  else if(e.type==='pause')result=core.pause(time,e.generation??current.generation,e.paused);
  else if(e.type==='stop')result=core.stop(time,e.generation??current.generation);
  else throw new Error('invalid_preview_speech_command');
  if(!result.accepted)return result;if(e.type!=='start')e.generation=e.generation??current.generation;
  speechEvents=[...history,e];controls.mouth.value='auto';play();draw();return result;
 }
 if(config.speech){controls.mouth.onchange=()=>{pause();draw();};root.querySelector('#speech-start').onclick=()=>speechCommand({type:'start'});root.querySelector('#speech-next').onclick=()=>speechCommand({type:'start'});root.querySelector('#speech-pause').onclick=()=>{const s=speechAt(time);if(s.active)speechCommand({type:'pause',paused:!s.paused,generation:s.generation});};root.querySelector('#speech-stop').onclick=()=>{const s=speechAt(time);if(s.active)speechCommand({type:'stop',generation:s.generation});};}
 root.querySelector('#play').onclick=()=>{if(playing)pause();else if(time>=rules.max_replay_seconds){scene(controls.scene.value);play();}else play();draw();};
 root.querySelector('#restart').onclick=()=>{scene(controls.scene.value);play();};
 root.querySelector('#head-touch').onclick=()=>touchAt(205,120);root.querySelector('#body-touch').onclick=()=>touchAt(175,245);
 root.querySelector('#background').onclick=()=>themeRoot.classList.toggle('light');root.querySelector('#zoom').onclick=()=>setDisplay({zoom:display.status().zoom===1?2:1});
 const displayMode=root.querySelector('#display-mode');if(displayMode)displayMode.onchange=()=>setDisplay({mode:displayMode.value});
 function loop(now){
  raf=0;if(closed)return;
  if(playing&&!scanBusy){const next=Math.min(rules.max_replay_seconds,time+Math.min(.1,Math.max(0,(now-lastWall)/1000)));
   for(const e of events)if(e.time>time&&e.time<=next)apply(engine,e);engine.advance(next);time=next;
   const frame=Math.floor(time*24);if(frame!==lastDraw){lastDraw=frame;draw();}if(time>=rules.max_replay_seconds){pause();draw();}
  }
  lastWall=now;if(playing)raf=requestAnimationFrame(loop);
 }
 async function scan(){
  if(closed)throw new Error('natural_preview_closed');if(scanBusy)throw new Error('natural_scan_busy');scanBusy=true;pause();
  try{
   const off=document.createElement('canvas');off.width=off.height=360;const target=off.getContext('2d',{willReadFrequently:true}),results=[];
   for(const [name,script] of Object.entries(eventSets)){
    const solver=createNaturalMotion(config.parts,motionOptions);let eventIndex=0;const frames=[];let worst={candidates:-1};let outsideCircle=0;const bounds=[360,360,0,0];
    for(let f=0;f<=288;f++){
     if(closed)throw new Error('natural_preview_closed');const t=f/24;while(eventIndex<script.length&&script[eventIndex].time<=t)apply(solver,script[eventIndex++]);const pose=solver.advance(t),face=render(pose,target,'auto',speechScripts[name]??[],waveScripts[name]??[]);
     const data=target.getImageData(0,0,360,360).data,holes=candidates(data);const record={time:t,candidates:holes.length,...(pose.character_state?{base:pose.character_state.base,weights:pose.character_state.weights,success:pose.character_state.success?.id??null}:{}),...(face?{eye:face.eye,face_owner:face.owner,mouth:Object.entries(face.mouth).sort((a,b)=>b[1]-a[1])[0][0],mouth_owner:face.mouth_owner??'expression',speech_stage:face.speech_stage??null}:{})};frames.push(record);
     if(holes.length>worst.candidates)worst={...record,sample_coordinates:holes.slice(0,20).map(p=>[p%360,Math.floor(p/360)])};
     for(let y=0;y<360;y++)for(let x=0;x<360;x++)if(data[(y*360+x)*4+3]>=16){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x+1);bounds[3]=Math.max(bounds[3],y+1);if((x+.5-180)**2+(y+.5-180)**2>166.5**2)outsideCircle++;}
     if(f%48===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    results.push({scene:name,frames,worst,visible_union_bounds:bounds,outside_safe_circle_pixel_samples:outsideCircle,end_status:solver.status(),end_character_state:solver.pose().character_state??null});
   }
   const result={status:'desktop_natural_motion_candidate_not_device_or_visual_acceptance',fps:24,sampled_seconds:12,samples:results.reduce((n,r)=>n+r.frames.length,0),static_interior_pixels:interior.length,coverage_mask:config.wave?'body_alpha240_eroded4':'source_alpha240_eroded4',scenes:results};
   root.querySelector('#scan-result').textContent=JSON.stringify(results.map(r=>({scene:r.scene,worst:r.worst.candidates,bounds:r.visible_union_bounds,outside:r.outside_safe_circle_pixel_samples})),null,2);return result;
  }finally{scanBusy=false;draw();}
 }
 root.querySelector('#scan').onclick=async()=>{const b=root.querySelector('#scan');b.disabled=true;try{await scan();}catch(error){if(!closed||error.message!=='natural_preview_closed')throw error;}finally{b.disabled=false;}};
 const api={play,pause,close(){if(closed)return;pause();closed=true;lifetime.abort();display?.close();for(const c of [...root.querySelectorAll('canvas'),...workCanvases])c.width=c.height=0;},status:()=>({...last,playing,closed}),scene,seek,touch:touchAt,setBase:baseState,complete:completion,events:()=>copyEvents(events),speechEvents:()=>copyEvents(speechEvents),speech:speechCommand,wave:waveCommand,waveEvents:()=>copyEvents(waveEvents),scan,display:()=>display?.status(),setDisplay,snapshot:()=>frameCanvas.toDataURL('image/png'),stop:()=>input({type:'idle',time,enabled:false}),resume:()=>input({type:'idle',time,enabled:true})};
 const comparisonFrames=new Map();
 if(config.states)for(const id of ['idle','thinking','working','success']){const comparison=createNaturalMotion(config.parts,motionOptions);if(id==='success')comparison.complete(1.8,'comparison');else comparison.setBase(0,id);const pose=comparison.advance(2.4),native=makeCanvas();render(pose,native.getContext('2d'),'auto',[],[]);comparisonFrames.set(id,{pose,native});}
 function paintDisplay(view){if(closed)return;presentCharacterFrame(baseline.getContext('2d'),reference,view.scale,{pixels:view.mode==='pixels'});for(const [id,{pose,native}] of comparisonFrames){const target=root.querySelector('#state-card-'+id).getContext('2d');if(view.mode==='pixels'||view.scale===1)presentCharacterFrame(target,native,view.scale,{pixels:true});else render(pose,target,'auto',[],[],view.scale);}draw();}
 function setDisplay(next){if(closed)return;const previous=display.status();const zoom=next.zoom??previous.zoom,mode=next.mode??previous.mode;if(![1,2].includes(zoom)||!['smooth','pixels'].includes(mode))throw new Error('invalid_character_display');themeRoot.classList.toggle('zoom',zoom===2);themeRoot.classList.toggle('pixel-check',mode==='pixels');if(displayMode)displayMode.value=mode;root.querySelector('#zoom').textContent=zoom===1?'2倍查看':'恢复原尺寸';display.set({zoom,mode});}
 display=createCharacterDisplay({canvases:[canvas,overlay,baseline,...(config.states?['idle','thinking','working','success'].map(id=>root.querySelector('#state-card-'+id)):[])],onChange:paintDisplay,signal:lifetime.signal});display.refresh();
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();draw();}},{signal:lifetime.signal});
 addEventListener('pagehide',()=>api.close(),{once:true,signal:lifetime.signal});
 draw();if(autoPlay)play();root.querySelector('#loading').textContent=`21层已加载，11处头发全部参与；可直接点击右侧人物。`;if(publishGlobal)window.naturalCharacter=api;return api;
 }catch(error){lifetime.abort();display?.close();for(const c of [...root.querySelectorAll('canvas'),...workCanvases])c.width=c.height=0;throw error;}
}
