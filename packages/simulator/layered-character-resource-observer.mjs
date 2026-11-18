// QA-only browser observer, installed before the trusted loader. Counts ownership, not GPU/RSS.
export function installLayeredResourceObserver(){
 const originalBitmap=window.createImageBitmap,request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 let created=0,released=0,peak=0;const live=new Set(),rafs=new Set(),listeners=new Set();
 window.createImageBitmap=async(...args)=>{const image=await originalBitmap(...args),close=image.close.bind(image);created++;live.add(image);peak=Math.max(peak,live.size);image.close=()=>{if(live.delete(image))released++;close();};return image;};
 window.requestAnimationFrame=callback=>{const id=request.call(window,time=>{rafs.delete(id);callback(time);});rafs.add(id);return id;};window.cancelAnimationFrame=id=>{rafs.delete(id);cancel.call(window,id);};
 EventTarget.prototype.addEventListener=function(type,listener,options){
  const tracked=(this===window||this===document||this instanceof HTMLCanvasElement)&&(['pointerdown','visibilitychange','pagehide'].includes(type))&&(!!options?.signal||(type==='pagehide'&&options?.once===true)),capture=typeof options==='boolean'?options:!!options?.capture;
  if(!tracked||!listener||options?.signal?.aborted)return add.call(this,type,listener,options);
  const existing=[...listeners].find(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture);if(existing)return add.call(this,type,existing.wrapper,options);
  const record={target:this,type,listener,capture,wrapper:listener};if(options?.once)record.wrapper=function(event){listeners.delete(record);return typeof listener==='function'?listener.call(this,event):listener.handleEvent(event);};listeners.add(record);
  if(options?.signal)add.call(options.signal,'abort',()=>listeners.delete(record),{once:true});return add.call(this,type,record.wrapper,options);
 };
 EventTarget.prototype.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture,record=[...listeners].find(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture);if(record)listeners.delete(record);return remove.call(this,type,record?.wrapper??listener,options);};
 return {sample:()=>({created_bitmaps:created,closed_bitmaps:released,live_bitmaps:live.size,peak_bitmaps:peak,pending_raf:rafs.size,listeners:listeners.size,dom_canvases:document.querySelectorAll('canvas').length,js_heap_bytes:performance.memory?.usedJSHeapSize??null}),restore(){window.createImageBitmap=originalBitmap;window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;EventTarget.prototype.addEventListener=add;EventTarget.prototype.removeEventListener=remove;}};
}
