import {requireThat} from '../packages/core/protocol.mjs';

export const PREPROCESS_TIERS=Object.freeze([
 {key:'conservative',label:'保守',spatial:8,temporal:0,colorCap:256,colorRatio:1},
 {key:'balanced',label:'均衡',spatial:12,temporal:3,colorCap:192,colorRatio:1},
 {key:'compact',label:'压缩优先',spatial:18,temporal:5,colorCap:128,colorRatio:0.75}
]);

/** Summarize actual complete PET4 lengths; weight total savings by bytes, never by mean percentages. */
export function summarizePreprocess(manifest){
 const baselineBytes=manifest.actions.reduce((n,a)=>n+a.baseline.bytes,0);
 return {actions:manifest.actions.length,baseline_bytes:baselineBytes,tiers:manifest.tiers.map(t=>{
  const records=manifest.actions.map(a=>({action:a,candidate:a.variants.find(v=>v.key===t.key)}));
  const bytes=records.reduce((n,r)=>n+r.candidate.bytes,0);
  return {key:t.key,bytes,bytes_saved:baselineBytes-bytes,saved_percent:100*(baselineBytes-bytes)/baselineBytes,
   smaller_ids:records.filter(r=>r.candidate.bytes<r.action.baseline.bytes).map(r=>r.action.id),
   larger_ids:records.filter(r=>r.candidate.bytes>r.action.baseline.bytes).map(r=>r.action.id),
   unchanged_size_ids:records.filter(r=>r.candidate.bytes===r.action.baseline.bytes).map(r=>r.action.id),
   exceeds_legacy_limit_ids:records.filter(r=>r.candidate.bytes>5865472).map(r=>r.action.id),
   frames:records.reduce((n,r)=>n+r.action.frames,0)};
 })};
}

/** Original weak flat-region smoothing and bounded temporal hold. Returns new RGB24; input/previous are never mutated. */
export function preprocessFrame(source,{width=400,height=400,spatial=8,temporal=0}={},previous=null){
 requireThat(source instanceof Uint8Array&&source.length===width*height*3&&Number.isInteger(width)&&width>=3&&Number.isInteger(height)&&height>=3,'preprocess_frame');
 requireThat(Number.isInteger(spatial)&&spatial>=0&&spatial<=32&&Number.isInteger(temporal)&&temporal>=0&&temporal<=8,'preprocess_strength');
 requireThat(previous===null||previous instanceof Uint8Array&&previous.length===source.length,'preprocess_history');
 const out=Uint8Array.from(source),stride=width*3;
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const p=(y*width+x)*3;if((source[p]|source[p+1]|source[p+2])===0)continue;
  let flat=true;
  for(const d of [-3,3,-stride,stride]){if((source[p+d]|source[p+d+1]|source[p+d+2])===0){flat=false;break;}for(let c=0;c<3;c++)if(Math.abs(source[p+c]-source[p+d+c])>spatial){flat=false;break;}if(!flat)break;}
  if(!flat)continue;
  for(let c=0;c<3;c++)out[p+c]=Math.round((4*source[p+c]+source[p-3+c]+source[p+3+c]+source[p-stride+c]+source[p+stride+c])/8);
  if(previous&&temporal&&(previous[p]|previous[p+1]|previous[p+2])!==0){
   let stable=true;for(let c=0;c<3;c++)if(Math.abs(previous[p+c]-source[p+c])>temporal||Math.abs(previous[p+c]-out[p+c])>temporal)stable=false;
   if(stable)for(let c=0;c<3;c++)out[p+c]=previous[p+c];
  }
 }
 return out;
}
