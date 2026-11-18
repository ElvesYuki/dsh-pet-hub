/** Native-size visible-pixel separation for the authoring SVG/texture pipeline; no generative edits. */
const expected=['hair_cap','fringe_left','fringe_center','fringe_right','side_left','side_right','back_left','back_center','back_right','ahoge','back_left_tip','back_right_tip'];
const check=(ok,message)=>{if(!ok)throw new Error(message);};

export function validateHairLayout(layout){
 check(layout?.version===1&&JSON.stringify(layout.canvas)==='[360,360]'&&/^[a-f0-9]{64}$/.test(layout.source_sha256??''),'invalid_hair_layout');
 check(Array.isArray(layout.parts)&&layout.parts.length===12&&new Set(layout.parts.map(p=>p.id)).size===12&&expected.every(id=>layout.parts.some(p=>p.id===id)),'hair_parts_required');
 const polygon=p=>Array.isArray(p)&&p.length>=3&&p.every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=360));
 for(const part of layout.parts)check(typeof part.label==='string'&&polygon(part.polygon)&&Array.isArray(part.pivot)&&part.pivot.length===2&&part.pivot.every(n=>Number.isFinite(n)&&n>=0&&n<=360)&&(part.parent==='head'||layout.parts.some(p=>p.id===part.parent)),'invalid_hair_part');
 for(const part of layout.parts){const seen=new Set();let current=part;while(current.parent!=='head'){check(!seen.has(current.id),'hair_parent_cycle');seen.add(current.id);current=layout.parts.find(p=>p.id===current.parent);}}
 check(Array.isArray(layout.exclusions)&&layout.exclusions.every(e=>polygon(e.polygon)),'invalid_hair_exclusions');
 check(Number.isFinite(layout.blue_gate?.blue_over_red)&&layout.blue_gate.blue_over_red>=1&&layout.blue_gate.blue_over_red<=2&&Number.isFinite(layout.blue_gate?.blue_over_green)&&layout.blue_gate.blue_over_green>=1&&layout.blue_gate.blue_over_green<=2,'invalid_hair_color_gate');
}

/** Pixel-center inclusion in an authoring polygon; no source resampling or bounding-box fitting. */
export function insideHairPolygon(x,y,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}

/** Split decoded 360 RGBA into disjoint original-pixel layers, preserving a residual layer.
 * Layout order is ownership priority, separate from future draw order. Explicit color/exclusion
 * rules are authoring heuristics and require visual review, not automatic semantic ground truth.
 */
export function splitHairPixels(rgba,layout){
 validateHairLayout(layout);check(rgba instanceof Uint8Array&&rgba.length===360*360*4,'invalid_hair_pixels');
 const layers=[{id:'rest',label:'其余原像素',rgba:new Uint8Array(rgba.length),count:0},...layout.parts.map(p=>({...p,rgba:new Uint8Array(rgba.length),count:0}))],owners=new Uint8Array(360*360);
 for(let y=0;y<360;y++)for(let x=0;x<360;x++){
  const pixel=y*360+x,p=pixel*4;if(!rgba[p+3])continue;
  let owner=0;
  const blue=rgba[p+2]>rgba[p]*layout.blue_gate.blue_over_red&&rgba[p+2]>rgba[p+1]*layout.blue_gate.blue_over_green;
  if(blue&&!layout.exclusions.some(e=>insideHairPolygon(x+.5,y+.5,e.polygon))){const i=layout.parts.findIndex(part=>insideHairPolygon(x+.5,y+.5,part.polygon));if(i>=0)owner=i+1;}
  layers[owner].rgba.set(rgba.subarray(p,p+4),p);layers[owner].count++;owners[pixel]=owner;
 }
 return {layers,owners};
}

/** Reconstruct disjoint visible textures; reject duplicate ownership instead of hiding overlap.
 * This is only the visible split check. Future overlapping completion layers need alpha compositing.
 */
export function reconstructHairPixels(layers){
 check(Array.isArray(layers)&&layers.length===13,'invalid_hair_layers');const out=new Uint8Array(360*360*4);
 for(const layer of layers){check(layer.rgba instanceof Uint8Array&&layer.rgba.length===out.length,'invalid_hair_pixels');for(let p=0;p<out.length;p+=4)if(layer.rgba[p+3]){check(!out[p+3],'hair_ownership_overlap');out.set(layer.rgba.subarray(p,p+4),p);}}
 return out;
}

/** Fill occluded draft interiors from a registered AI paint field while preserving each layer's
 * original visible pixels. Only dense original-character coverage can receive completion paint.
 * This creates a static art candidate, not verified moving contours or a runtime skeleton.
 */
export function completeHiddenHairPixels(rgba,layout,layers,paint){
 validateHairLayout(layout);
 check(rgba instanceof Uint8Array&&rgba.length===360*360*4&&paint instanceof Uint8Array&&paint.length===rgba.length,'invalid_hair_pixels');
 check(layers.length===13&&layers[0].id==='rest'&&layout.parts.every((p,i)=>layers[i+1].id===p.id),'invalid_hair_layers');
 return layers.map((layer,i)=>{
  const pixels=new Uint8Array(layer.rgba);let completionCount=0;
  if(i)for(let y=0;y<360;y++)for(let x=0;x<360;x++){
   const p=(y*360+x)*4;
   if(pixels[p+3]||rgba[p+3]<252||paint[p+3]<200||!insideHairPolygon(x+.5,y+.5,layout.parts[i-1].polygon))continue;
   pixels.set([paint[p],paint[p+1],paint[p+2],255],p);completionCount++;
  }
  return {...layer,rgba:pixels,completion_pixel_count:completionCount};
 });
}
