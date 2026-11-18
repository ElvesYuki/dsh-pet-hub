/** RGB565LE from the bounded IPC frame response, never a filesystem/media URL. */
export function unpackPreview(frame){
 const valid=frame?.format==='RGB565LE'&&[240,360,400].includes(frame.width)&&frame.height===frame.width;
 if(!valid||typeof frame.pixels_base64!=='string'||frame.pixels_base64.length!==Math.ceil(frame.width*frame.height*2/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(frame.pixels_base64))throw new Error('invalid_preview');
 const raw=atob(frame.pixels_base64);if(raw.length!==frame.width*frame.height*2)throw new Error('invalid_preview');
 const rgba=new Uint8ClampedArray(frame.width*frame.height*4);
 for(let p=0,q=0;p<raw.length;p+=2,q+=4){const c=raw.charCodeAt(p)|(raw.charCodeAt(p+1)<<8),r=c>>>11,g=(c>>>5)&63,b=c&31;rgba[q]=(r<<3)|(r>>>2);rgba[q+1]=(g<<2)|(g>>>4);rgba[q+2]=(b<<3)|(b>>>2);rgba[q+3]=255;}
 return rgba;
}
export function paintPreview(canvas,frame,display){
 if(!Number.isInteger(display.width)||!Number.isInteger(display.height)||display.width>1024||display.height>1024||display.width<frame.width||display.height<frame.height||!['circle','rectangle'].includes(display.shape))throw new Error('unsupported_preview_display');
 const rgba=unpackPreview(frame),asset=canvas.ownerDocument.createElement('canvas');asset.width=frame.width;asset.height=frame.height;
 const pixels=asset.getContext('2d'),image=pixels.createImageData(frame.width,frame.height);image.data.set(rgba);pixels.putImageData(image,0,0);
 canvas.width=display.width;canvas.height=display.height;const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.save();
 if(display.shape==='circle'){context.beginPath();context.arc(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)/2,0,Math.PI*2);context.clip();}
 context.fillStyle='#111827';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=false;
 context.drawImage(asset,Math.floor((canvas.width-frame.width)/2),Math.floor((canvas.height-frame.height)/2));context.restore();
}
export function makeFramePreview(React,transport){
 const {createElement:h,useState,useEffect,useRef}=React;
 return function FramePreview({device,serviceInstanceId}){
  const [enabled,setEnabled]=useState(false),[message,setMessage]=useState(''),canvas=useRef(null);
  const actual=device.actual,decoded=actual?.decoded_frame;
  const key=JSON.stringify([serviceInstanceId,device.activation.revision,device.intent_revision,device.online,device.phase,actual?.action_id,decoded?.frame_index,decoded?.rgb565_sha256]);
  useEffect(()=>{
   const controller=new AbortController();const clear=()=>{const c=canvas.current;if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);};clear();
   if(!enabled||!device.online||!decoded?.rgb565_sha256||device.phase==='failed'){setMessage(enabled?'当前没有可预览的PET4帧。':'');return ()=>{controller.abort();clear();};}
   setMessage('读取当前虚拟帧…');
   const body={service_instance_id:serviceInstanceId,device_id:device.device_id,expected_revision:device.activation.revision,expected_intent_revision:device.intent_revision,action_id:actual.action_id,frame_index:decoded.frame_index,rgb565_sha256:decoded.rgb565_sha256};
   void transport.frame(body,controller.signal).then(({frame})=>{
    if(controller.signal.aborted)return;
    if(frame.device_id!==body.device_id||frame.activation_revision!==body.expected_revision||frame.intent_revision!==body.expected_intent_revision||frame.action_id!==body.action_id||frame.frame_index!==body.frame_index||frame.rgb565_sha256!==body.rgb565_sha256)throw new Error('preview_stale');
    if(canvas.current)paintPreview(canvas.current,frame,device.display);setMessage(`当前虚拟帧 ${frame.frame_index} · ${frame.width}×${frame.height}`);
   }).catch(e=>{if(!controller.signal.aborted){clear();setMessage(e.status===409?'帧已变化或读取正忙；下次状态变化后刷新。':'预览不可用，请检查角色运行状态。');}});
   return ()=>{controller.abort();clear();};
  },[enabled,key]);
  return h('div',null,h('label',null,h('input',{type:'checkbox',checked:enabled,onChange:e=>setEnabled(e.target.checked)}),'显示离线帧预览'),
   enabled?h('figure',null,h('canvas',{ref:canvas,'aria-label':`${device.device_id} 离线帧画布`,style:{width:'min(240px, 100%)',height:'auto',display:'block',border:'1px solid #8885'}}),h('figcaption',{'aria-live':'polite'},message),h('p',null,'仅随虚拟时间/动作变化更新；不是实时设备画面。')):null);
 };
}
