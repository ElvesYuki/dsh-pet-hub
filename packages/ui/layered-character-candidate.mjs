/** Decode distinct resources once, map declared slots and prepare the first frame offscreen. */
export async function prepareLayeredCandidate(snapshot,{signal,createRoot,startPreview,decode=bytes=>createImageBitmap(new Blob([bytes],{type:'image/png'}))}){
 const bitmaps=new Map();let root,api,closed=false;
 const close=()=>{if(closed)return;closed=true;try{api?.close();}finally{for(const image of bitmaps.values())image.close();bitmaps.clear();root?.remove();}};
 try{
  for(const [id,bytes] of snapshot.pngs){signal?.throwIfAborted();const image=await decode(bytes);bitmaps.set(id,image);signal?.throwIfAborted();if(image.width!==360||image.height!==360)throw new Error('invalid_texture');}
  const {rig,behavior}=snapshot,face={assets:{}};for(const [group,slots] of Object.entries(rig.face_slots))for(const [state,id] of Object.entries(slots))face.assets[group+'_'+state]={image:bitmaps.get(id)};
  root=createRoot();const config={parts:rig.parts.map(p=>({...p,image:bitmaps.get(p.texture_id)})),draw_order:rig.draw_order,source:bitmaps.get(rig.reference_texture),face,speech:true,states:true,wave:{image:bitmaps.get(rig.pose_overrides.wave.up_texture_id)},behavior};
  api=await startPreview(config,{root,publishGlobal:false,autoPlay:false});signal?.throwIfAborted();
  return {root,api,summary:{...snapshot.summary,bitmap_count:bitmaps.size},close};
 }catch(error){close();throw error;}
}
