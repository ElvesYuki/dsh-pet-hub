// Original host-only QA observer. Excluded from production dist with other simulator fixtures.
export const layeredL3Scenes=Object.freeze(['idle','thinking','working','success','latest_base','rapid_states','success_latest','repeated_success','state_speech','state_stop','wave','wave_cancel','wave_latest','wave_speech']);
/** Exact RGBA comparison, including invisible RGB. No perceptual tolerance or digest shortcut. */
export function compareLayeredPixels(a,b){
 if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)||a.BYTES_PER_ELEMENT!==1||b.BYTES_PER_ELEMENT!==1||a.length!==b.length||!a.length||a.length%4||a.length>518400)throw new Error('invalid_pixels');
 let changed=0,components=0,max=0;for(let i=0;i<a.length;i+=4){let different=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);if(delta){different=true;components++;max=Math.max(max,delta);}}if(different)changed++;}
 return {equal:changed===0,changed_pixels:changed,changed_components:components,max_channel_delta:max};
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
/** One frame per side. A deadline/abort rejects both waiters, never retains a frame history. */
export function createLayeredFrameComparison({deadlineMs=15000,scenes=layeredL3Scenes,framesPerScene=289,pixelBytes=518400}={}){
 let pending=new Map(),failure=null,count=0,changedFrames=0,changedPixels=0,maxDelta=0,poseDifferences=0,recordDifferences=0;const examples=[];
 function abort(error=new Error('comparison_aborted')){failure??=error;for(const p of pending.values()){clearTimeout(p.timer);p.reject(failure);}pending.clear();}
 function frame(side,value){
  if(failure)return Promise.reject(failure);if(value?.pixels?.length!==pixelBytes){abort(new Error('invalid_pixels'));return Promise.reject(failure);}if(!['candidate','baseline'].includes(side)||pending.has(side)){abort(new Error('invalid_frame_side'));return Promise.reject(failure);}
  if(value.scene!==scenes[Math.floor(count/framesPerScene)]||value.frame!==count%framesPerScene){abort(new Error('unexpected_frame'));return Promise.reject(failure);}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>abort(new Error('comparison_deadline')),deadlineMs);pending.set(side,{value,resolve,reject,timer});
   if(pending.size!==2)return;const a=pending.get('candidate'),b=pending.get('baseline');
   try{const diff=compareLayeredPixels(a.value.pixels,b.value.pixels),poseEqual=JSON.stringify(canonical(a.value.pose))===JSON.stringify(canonical(b.value.pose)),recordEqual=JSON.stringify(canonical(a.value.record))===JSON.stringify(canonical(b.value.record));
    if(!diff.equal){changedFrames++;changedPixels+=diff.changed_pixels;maxDelta=Math.max(maxDelta,diff.max_channel_delta);}if(!poseEqual)poseDifferences++;if(!recordEqual)recordDifferences++;
    if((!diff.equal||!poseEqual||!recordEqual)&&examples.length<10)examples.push({scene:value.scene,frame:value.frame,...diff,pose_equal:poseEqual,record_equal:recordEqual});count++;pending.clear();clearTimeout(a.timer);clearTimeout(b.timer);a.resolve();b.resolve();
   }catch(error){abort(error);}
  });
 }
 function status(){return {frames:count,expected_frames:scenes.length*framesPerScene,changed_frames:changedFrames,changed_pixels:changedPixels,max_channel_delta:maxDelta,pose_differences:poseDifferences,record_differences:recordDifferences,pending_frames:pending.size,examples:[...examples],...(failure?{error:failure.message}: {})};}
 return {frame,abort,status,finish(){const result=status();if(failure||pending.size||count!==result.expected_frames)throw new Error('comparison_incomplete');return {...result,passed:changedFrames===0&&poseDifferences===0&&recordDifferences===0};}};
}
