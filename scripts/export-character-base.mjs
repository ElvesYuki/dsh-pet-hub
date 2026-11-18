import {existsSync,lstatSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {parseArgs} from 'node:util';
import {inflateSync} from 'node:zlib';
import {crc32} from '../packages/core/pet4.mjs';
import {readRegular,sha256} from '../packages/runtime/material-import.mjs';
import {registerCharacter,registrationSvg} from './character-registration.mjs';

const check=(ok,message)=>{if(!ok)throw new Error(message);};
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const target=[70,50,281,315];

/** Validate a bounded RGBA8 360 PNG and measure actual alpha bounds without changing pixels.
 * Supports standard PNG row filters 0–4; rejects interlacing, malformed chunks and bad registration.
 */
export function inspectCharacterBase(bytes){
 check(Buffer.isBuffer(bytes)&&bytes.length<4194304&&bytes.subarray(0,8).equals(signature),'invalid_base_png');
 let p=8,header=false,end=false,idat=false;const compressed=[];
 while(p<bytes.length){
  check(p+12<=bytes.length,'invalid_base_png');const n=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8);
  check(n<=bytes.length-p-12,'invalid_base_png');const data=bytes.subarray(p+8,p+8+n);
  check(crc32(bytes.subarray(p+4,p+8+n))===bytes.readUInt32BE(p+8+n),'base_png_crc');
  if(!header){check(type==='IHDR'&&n===13,'invalid_base_png');header=true;check(data.readUInt32BE(0)===360&&data.readUInt32BE(4)===360,'base_png_size');check(data[8]===8&&data[9]===6&&data[10]===0&&data[11]===0&&data[12]===0,'base_png_format');}
  else if(type==='IDAT'){check(!end,'invalid_base_png');compressed.push(data);idat=true;}
  else if(type==='IEND'){check(idat&&n===0&&p+12===bytes.length,'invalid_base_png');end=true;}
  else check(type!=='IHDR'&&type!=='PLTE'&&type[0]===type[0].toLowerCase(),'unsupported_base_png_chunk');
  p+=n+12;
 }
 check(header&&idat&&end,'invalid_base_png');
 const raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:518760});check(raw.length===518760,'base_png_pixels');
 let previous=new Uint8Array(1440),minAlpha=255,maxAlpha=0,x1=360,y1=360,x2=0,y2=0;
 const paeth=(a,b,c)=>{const value=a+b-c,da=Math.abs(value-a),db=Math.abs(value-b),dc=Math.abs(value-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<360;y++){
  const filter=raw[y*1441];check(filter<=4,'base_png_filter');const row=new Uint8Array(1440);
  for(let i=0;i<1440;i++){const left=i>=4?row[i-4]:0,up=previous[i],corner=i>=4?previous[i-4]:0,predict=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner);row[i]=(raw[y*1441+i+1]+predict)&255;}
  for(let x=0;x<360;x++){const alpha=row[x*4+3];minAlpha=Math.min(minAlpha,alpha);maxAlpha=Math.max(maxAlpha,alpha);if(alpha>=16){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x+1);y2=Math.max(y2,y+1);}}
  previous=row;
 }
 // Fractional SVG sampling can round fully covered pixels to 254 rather than 255.
 check(minAlpha===0&&maxAlpha>=250&&x2>x1&&y2>y1,'base_png_transparency');
 const bounds=[x1,y1,x2,y2],error=Math.max(...bounds.map((v,i)=>Math.abs(v-target[i])));
 check(error<=1,'base_png_registration');
 return {width:360,height:360,format:'RGBA8',alpha_range:[minAlpha,maxAlpha],alpha16_bounds:bounds,max_pixel_edge_error:error,pixel_edge_tolerance:1};
}

/** Offline export. renderSvg is an explicit trusted tool callback, not a project runtime dependency.
 * Checks source SHA and the exact canonical SVG/matrix before rendering; validates all output before
 * creating a new repo .cache directory. Refuses overwrite; renderer/I/O errors propagate.
 */
export async function exportCharacterBase({sourceDir,registrationDir,sourceSha256,output,renderSvg,rendererVersion,repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')}){
 check(typeof sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(sourceSha256),'invalid_source_digest');
 check(typeof renderSvg==='function'&&typeof rendererVersion==='string'&&rendererVersion.length<=100,'explicit_renderer_required');
 const root=realpathSync(repoRoot),destination=resolve(root,output??''),parts=relative(root,destination).split('/');
 check(parts[0]==='.cache'&&parts.length>=2&&parts.every(p=>p&&p!=='.'&&p!=='..'),'base_output_must_be_in_repo_cache');
 let parent=root;for(const part of parts){parent=join(parent,part);if(existsSync(parent))check(!lstatSync(parent).isSymbolicLink()&&lstatSync(parent).isDirectory(),'unsafe_base_output');}
 check(!existsSync(destination),'base_output_exists');
 const sourceRoot=realpathSync(sourceDir),registrationRoot=realpathSync(registrationDir),source=readRegular(sourceRoot,'neutral-v1.png',12582912);
 check(sha256(source)===sourceSha256,'source_image_changed');
 check(source.subarray(0,8).equals(signature)&&source.readUInt32BE(16)===1254&&source.readUInt32BE(20)===1254,'source_image_profile');
 const proof=JSON.parse(readRegular(registrationRoot,'registration.json',65536)),registration=registerCharacter([240,142,1021,1123],target);
 check(JSON.stringify(proof.registration?.matrix)===JSON.stringify(registration.matrix)&&JSON.stringify(proof.registration?.canvas)==='[360,360]'&&JSON.stringify(proof.registration?.display_offset)==='[53,53]','registration_changed');
 const svg=readRegular(registrationRoot,'registered.svg',16777216),expectedSvg=registrationSvg(source.toString('base64'),[1254,1254],registration);
 check(svg.toString()===expectedSvg,'registration_svg_or_embedded_source_changed');
 const png=Buffer.from(await renderSvg(svg)),pixels=inspectCharacterBase(png);
 check(sha256(readRegular(sourceRoot,'neutral-v1.png',12582912))===sourceSha256&&sha256(readRegular(registrationRoot,'registered.svg',16777216))===sha256(svg),'export_input_changed');
 const manifest={status:'static_360_authoring_base_not_layered_or_device_ready',file:'neutral-360.png',source_file:'neutral-v1.png',source_sha256:sourceSha256,registration_svg_sha256:sha256(svg),output_sha256:sha256(png),renderer_version:rendererVersion,registration,pixels,license_ref:'dsh-pet-nc-86181ce',credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet'],review:{overall_visual_direction:true,canvas_and_outer_bounds_verified:true,internal_landmarks_verified:false,layers_verified:false,device_verified:false}};
 mkdirSync(dirname(destination),{recursive:true,mode:0o700});mkdirSync(destination,{mode:0o700});
 writeFileSync(join(destination,'neutral-360.png'),png,{flag:'wx',mode:0o600});writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
 return manifest;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const {values:v}=parseArgs({options:{'source-dir':{type:'string'},'registration-dir':{type:'string'},'source-sha256':{type:'string'},output:{type:'string'},'renderer-module':{type:'string'}}});
 check(v['source-dir']&&v['registration-dir']&&v.output&&v['renderer-module'],'explicit_export_paths_required');
 const sharp=createRequire(import.meta.url)(resolve(v['renderer-module']));
 const result=await exportCharacterBase({sourceDir:v['source-dir'],registrationDir:v['registration-dir'],sourceSha256:v['source-sha256'],output:v.output,renderSvg:svg=>sharp(svg,{density:72}).ensureAlpha().png({palette:false}).toBuffer(),rendererVersion:`sharp ${sharp.versions.sharp}; SVG ${sharp.versions.rsvg}`});
 console.log(`Exported ${result.pixels.width}x${result.pixels.height} RGBA base; alpha bounds ${result.pixels.alpha16_bounds.join(',')}; no device changes.`);
}
