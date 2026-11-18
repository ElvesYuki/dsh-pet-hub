import {insideHairPolygon} from './hair-static-master.mjs';

const length=360*360*4;
const check=(ok,message)=>{if(!ok)throw new Error(message);};
export function validateCharacterLayout(layout){
 check(layout?.version===1&&JSON.stringify(layout.canvas)==='[360,360]'&&/^[a-f0-9]{64}$/.test(layout.source_sha256??''),'invalid_character_layout');
 const ids=layout.parts?.map(p=>p.id);
 check(ids?.length===21&&new Set(ids).size===21&&ids.includes('head')&&ids.includes('body'),'invalid_character_parts');
 for(const part of layout.parts){
  check(/^[a-z_]+$/.test(part.id)&&typeof part.label==='string'&&(part.parent===null||ids.includes(part.parent))&&Array.isArray(part.pivot)&&part.pivot.length===2&&part.pivot.every(n=>Number.isFinite(n)&&n>=0&&n<=360),'invalid_character_part');
  const seen=new Set();let current=part;
  while(current){check(!seen.has(current.id),'character_parent_cycle');seen.add(current.id);current=layout.parts.find(p=>p.id===current.parent);}
 }
 check(layout.draw_order?.length===21&&new Set(layout.draw_order).size===21&&layout.draw_order.every(id=>ids.includes(id)),'invalid_character_order');
 check(Array.isArray(layout.rules)&&layout.rules.length>0,'invalid_character_rules');
 for(const rule of layout.rules)check(ids.includes(rule.id)&&['any','skin','feature','ink'].includes(rule.gate)&&Array.isArray(rule.polygon)&&rule.polygon.length>=3&&rule.polygon.every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=360)),'invalid_character_rule');
 check(ids.includes(layout.fallback),'invalid_character_fallback');
}

/** Native texture ownership, not semantic segmentation ground truth. Rules are reviewed art paths.
 * Every nontransparent source pixel has exactly one owner; all layers retain the same 360 origin.
 */
export function splitCharacterPixels(rgba,layout){
 validateCharacterLayout(layout);check(rgba instanceof Uint8Array&&rgba.length===length,'invalid_character_pixels');
 const layers=layout.parts.map(p=>({...p,rgba:new Uint8Array(length),visible_pixel_count:0}));
 const owners=new Uint8Array(360*360);let fallbackCount=0;
 for(let y=0;y<360;y++)for(let x=0;x<360;x++){
  const pixel=y*360+x,p=pixel*4;if(!rgba[p+3])continue;
  const [r,g,b]=rgba.subarray(p,p+3),skin=r>g+3&&r>b+3;
  const rule=layout.rules.find(rule=>(rule.gate==='any'||(rule.gate==='skin'?skin:rule.gate==='ink'?r<100&&g<115&&b<150:!skin||Math.max(r,g,b)<140))&&insideHairPolygon(x+.5,y+.5,rule.polygon));
  if(!rule)fallbackCount++;
  const i=layers.findIndex(layer=>layer.id===(rule?.id??layout.fallback));
  layers[i].rgba.set(rgba.subarray(p,p+4),p);layers[i].visible_pixel_count++;owners[pixel]=i;
 }
 return {layers,owners,fallbackCount};
}

/** Hidden paint can only sit below the ORIGINAL visible owner in the actual draw order.
 * This prevents an upper hair patch from painting over a lower part's original visible pixels.
 * Paint fields and support masks are prepared separately by the offline authoring CLI.
 */
export function completeCharacterPixels(rgba,layout,split,fields){
 const ranks=new Map(layout.draw_order.map((id,i)=>[id,i]));
 return split.layers.map(layer=>{
  const pixels=new Uint8Array(layer.rgba),field=fields.get(layer.id);let completionCount=0;
  if(field){check(field instanceof Uint8Array&&field.length===length,'invalid_character_paint');
   for(let p=0;p<length;p+=4){
    if(pixels[p+3]||rgba[p+3]<251||field[p+3]<200)continue;
    const owner=split.layers[split.owners[p/4]].id;
    if(ranks.get(owner)<=ranks.get(layer.id))continue;
    pixels.set([field[p],field[p+1],field[p+2],255],p);completionCount++;
   }
  }
  return {...layer,rgba:pixels,completion_pixel_count:completionCount};
 });
}

/** Native texture-edge padding, not new painted artwork. Extend an existing edge only into
 * dense original coverage owned by a HIGHER layer, so affine filtering has hidden overlap.
 * Read from a frozen pre-padding buffer: never flood-fill or expand the outer silhouette.
 */
export function padCharacterEdges(source,layout,split,completed,radius=3){
 check(source instanceof Uint8Array&&source.length===length&&Number.isInteger(radius)&&radius>=1&&radius<=4,'invalid_character_padding');
 const ranks=new Map(layout.draw_order.map((id,i)=>[id,i])),offsets=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx*dx+dy*dy>0&&dx*dx+dy*dy<=radius*radius)offsets.push([dx,dy]);
 offsets.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
 return completed.map(layer=>{
  const pixels=new Uint8Array(layer.rgba);let count=0;
  for(let y=0;y<360;y++)for(let x=0;x<360;x++){
   const p=(y*360+x)*4;if(pixels[p+3]||source[p+3]<251||ranks.get(split.layers[split.owners[p/4]].id)<=ranks.get(layer.id))continue;
   for(const [dx,dy] of offsets){
    const a=x+dx,b=y+dy;if(a<0||a>=360||b<0||b>=360)continue;const q=(b*360+a)*4;
    if(layer.rgba[q+3]<200)continue;pixels.set([layer.rgba[q],layer.rgba[q+1],layer.rgba[q+2],255],p);count++;break;
   }
  }
  return {...layer,rgba:pixels,edge_bleed_pixel_count:count};
 });
}

export function verifyCharacterComposite(source,actual){
 check(source instanceof Uint8Array&&actual instanceof Uint8Array&&source.length===length&&actual.length===length,'invalid_character_pixels');
 let maxRgb=0,maxAlpha=0,maxPremultiplied=0;
 for(let p=0;p<length;p+=4){
  check(source[p+3]||!actual[p+3],'character_outer_footprint_changed');
  maxAlpha=Math.max(maxAlpha,Math.abs(source[p+3]-actual[p+3]));
  for(let c=0;c<3;c++){
   if(source[p+3]>=16)maxRgb=Math.max(maxRgb,Math.abs(source[p+c]-actual[p+c]));
   maxPremultiplied=Math.max(maxPremultiplied,Math.abs(source[p+c]*source[p+3]/255-actual[p+c]*actual[p+3]/255));
  }
 }
 check(maxRgb<=4&&maxAlpha<=4&&maxPremultiplied<=4,'character_visible_art_changed');
 return {max_rgb_difference_at_alpha16:maxRgb,max_alpha_difference:maxAlpha,max_premultiplied_rgb_difference:maxPremultiplied,outer_footprint_unchanged:true};
}
