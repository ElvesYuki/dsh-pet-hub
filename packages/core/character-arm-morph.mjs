import {resolveCharacterBehavior} from './layered-character-profiles.mjs';
// Pure local RGBA contour interpolation. No DOM, assets, runtime or device dependencies.
function armNearest(mask,width,height,inside,rounds){
 const nearest=new Int32Array(mask.length).fill(-1);
 for(let i=0;i<mask.length;i++)if(Boolean(mask[i])===inside)nearest[i]=i;
 const relax=(x,y,nx,ny)=>{if(nx<0||nx>=width||ny<0||ny>=height)return;const i=y*width+x,n=nearest[ny*width+nx];if(n<0)return;const old=nearest[i],d=(n%width-x)**2+(Math.floor(n/width)-y)**2;if(old<0||d<(old%width-x)**2+(Math.floor(old/width)-y)**2)nearest[i]=n;};
 // Vector-distance propagation; two round trips handle diagonal concavities in small arm sprites.
 for(let pass=0;pass<rounds;pass++){
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){relax(x,y,x-1,y);relax(x,y,x,y-1);relax(x,y,x-1,y-1);relax(x,y,x+1,y-1);}
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){relax(x,y,x+1,y);relax(x,y,x,y+1);relax(x,y,x+1,y+1);relax(x,y,x-1,y+1);}
 }
 return nearest;
}
function armField(rgba,width,height,p){
 const mask=Uint8Array.from({length:width*height},(_,i)=>rgba[i*4+3]>=p.mask_alpha?1:0);
 if(!mask.includes(1)||!mask.includes(0))throw new Error('arm_morph_requires_shape_and_margin');
 const fill=armNearest(mask,width,height,true,p.propagation_round_trips),empty=armNearest(mask,width,height,false,p.propagation_round_trips),distance=new Float32Array(mask.length);
 for(let i=0;i<mask.length;i++){const n=mask[i]?empty[i]:fill[i];distance[i]=(mask[i]?-1:1)*Math.hypot(i%width-n%width,Math.floor(i/width)-Math.floor(n/width));}
 return {fill,distance};
}
/** Interpolate one silhouette after shoulder/wrist registration. Endpoints preserve exact RGBA.
 * Inputs are equally sized local crops with a transparent margin and nonempty opaque interiors. */
export function morphArmRgba(oldArm,newArm,width,height,amount,behavior){
 const b=resolveCharacterBehavior(behavior),p=b.profiles.arm_contour_distance_v1,texture=b.profiles.rgba_png_v1;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>texture.width||height>texture.height||oldArm?.length!==width*height*4||newArm?.length!==oldArm.length||!Number.isFinite(amount)||amount<0||amount>1)throw new Error('invalid_arm_morph');
 if(amount===0)return Uint8ClampedArray.from(oldArm);if(amount===1)return Uint8ClampedArray.from(newArm);
 const a=armField(oldArm,width,height,p),next=armField(newArm,width,height,p),out=new Uint8ClampedArray(oldArm.length);
 for(let i=0;i<width*height;i++){
  const distance=a.distance[i]*(1-amount)+next.distance[i]*amount,alpha=Math.max(0,Math.min(1,p.edge_offset-distance*p.edge_slope));if(alpha===0)continue;
  const ai=a.fill[i]*4,bi=next.fill[i]*4;
  for(let c=0;c<3;c++)out[i*4+c]=oldArm[ai+c]*(1-amount)+newArm[bi+c]*amount;
  out[i*4+3]=alpha*255;
 }
 return out;
}
