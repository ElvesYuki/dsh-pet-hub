/** Offline source-art registration, not a runtime capability or image resampler. */
function bounds(value){
 if(!Array.isArray(value)||value.length!==4||!value.every(n=>Number.isFinite(n)&&n>=0&&n<=16384)||value[2]<=value[0]||value[3]<=value[1])throw new Error('invalid_registration_bounds');
 return {x:value[0],y:value[1],w:value[2]-value[0],h:value[3]-value[1]};
}

/** Fit with one positive scale and translation; reject shape mismatch beyond tolerance.
 * Inputs are edge coordinates; result preserves the reference subject center, not canvas center.
 * Throws for invalid bounds/tolerance or incompatible aspect ratios. No I/O or raster mutation.
 */
export function registerCharacter(sourceBounds,targetBounds,{tolerance=0.5}={}){
 const source=bounds(sourceBounds),target=bounds(targetBounds);
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>1)throw new Error('invalid_registration_tolerance');
 const scale=Math.min(target.w/source.w,target.h/source.h);
 const x=target.x+target.w/2-(source.x+source.w/2)*scale;
 const y=target.y+target.h/2-(source.y+source.h/2)*scale;
 const mapped=[source.x*scale+x,source.y*scale+y,(source.x+source.w)*scale+x,(source.y+source.h)*scale+y];
 const errors=mapped.map((n,i)=>n-targetBounds[i]),maxError=Math.max(...errors.map(Math.abs));
 if(maxError>tolerance+1e-9)throw new Error('registration_aspect_mismatch');
 return {scale,translation:[x,y],matrix:[scale,0,0,scale,x,y],mapped_bounds:mapped,edge_errors:errors,max_edge_error:maxError,tolerance,target_bounds:[...targetBounds],canvas:[360,360],display:[466,466],display_offset:[53,53],reference_subject_center:[target.x+target.w/2,target.y+target.h/2]};
}

/** Produce a self-contained 360 SVG wrapper; embedded pixels are unchanged.
 * The source PNG must be supplied as base64 (no external or script URLs).
 */
export function registrationSvg(pngBase64,sourceSize,registration){
 if(typeof pngBase64!=='string'||!pngBase64.length||pngBase64.length>16777216||!/^[A-Za-z0-9+/]+={0,2}$/.test(pngBase64))throw new Error('invalid_registration_image');
 if(!Array.isArray(sourceSize)||sourceSize.length!==2||!sourceSize.every(n=>Number.isInteger(n)&&n>0&&n<=4096))throw new Error('invalid_registration_image_size');
 if(!Array.isArray(registration?.matrix)||registration.matrix.length!==6||!registration.matrix.every(Number.isFinite))throw new Error('invalid_registration_matrix');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><title>360角色等比注册稿：外框校准，内部形象仍待核验</title><image width="${sourceSize[0]}" height="${sourceSize[1]}" transform="matrix(${registration.matrix.join(' ')})" href="data:image/png;base64,${pngBase64}"/></svg>`;
}
