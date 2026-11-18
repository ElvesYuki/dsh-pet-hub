import {readFileSync,writeFileSync,mkdirSync,copyFileSync,lstatSync,existsSync,realpathSync,rmSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {reviewPage} from './native400-review-page.mjs';
const need=(v,m)=>{if(!v)throw new Error(m);};
export const geometry=Object.freeze({source:[640,360],crop:[124,-6,400,400],display:466,offset:33,sourceOnScreen:[-91,39],extraMask:false});
export const hash=b=>createHash('sha256').update(b).digest('hex');
function regular(p,max){const s=lstatSync(p);need(s.isFile()&&!s.isSymbolicLink()&&s.size<=max,'unsafe_input');return readFileSync(p);}
export function outputPath(repoRoot,output){const root=realpathSync(repoRoot),dest=resolve(root,output),parts=relative(root,dest).split('/');need(parts[0]==='.cache'&&parts.length>1&&parts.every(x=>x&&x!=='.'&&x!=='..'),'output_outside_cache');let at=root;for(const x of parts){at=join(at,x);if(existsSync(at))need(!lstatSync(at).isSymbolicLink()&&lstatSync(at).isDirectory(),'unsafe_output');}need(!existsSync(dest),'output_exists');return dest;}
export function validateSources({sourceDir,catalog,catalogSha256,licenseRef}){
 need(licenseRef==='dsh-pet-nc-86181ce','unapproved_license');const raw=regular(catalog,1048576);need(hash(raw)===catalogSha256,'catalog_hash');const m=JSON.parse(raw);need(m.upstream==='86181ce1660a57ab27336630bab5b344de71b28c'&&m.actions?.length===78,'catalog_profile');const dir=realpathSync(sourceDir),seen=new Set();const actions=m.actions.map(a=>{need(Number.isInteger(a.id)&&a.id>=0&&a.id<78&&!seen.has(a.id),'action_id');seen.add(a.id);need(typeof a.name==='string'&&a.name.length>0&&a.name.length<150&&!/[\/\\\x00-\x1f]/.test(a.name),'action_name');const file=join(dir,a.name+'.webm'),bytes=regular(file,67108864);need(hash(bytes)===a.source_sha256,'source_hash');return {id:a.id,name:a.name,source_sha256:a.source_sha256,bytes:bytes.length,file};});return actions.sort((a,b)=>a.id-b.id);
}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:2097152});need(!r.error&&r.status===0,`${cmd}_failed: ${r.stderr?.slice(-400)??r.error?.message}`);return r.stdout;}
export function prepareReview({sourceDir,catalog,catalogSha256,licenseRef,output,repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),retained=[]}){
 const dest=outputPath(repoRoot,output),actions=validateSources({sourceDir,catalog,catalogSha256,licenseRef});
 for(const a of actions){const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,r_frame_rate,nb_read_frames:stream_tags:format=duration','-of','json',a.file]));const v=probe.streams?.[0];need(v?.width===640&&v.height===360,'source_geometry');a.frame_count=Number(v.nb_read_frames);need(Number.isInteger(a.frame_count)&&a.frame_count>0,'source_frames');a.alpha_mode=v.tags?.ALPHA_MODE??v.tags?.alpha_mode??null;a.fps=v.avg_frame_rate||v.r_frame_rate;a.duration=Number(probe.format.duration);need(Number.isFinite(a.duration)&&a.duration>0,'source_duration');a.kept=retained.includes(a.id);}
 mkdirSync(dirname(dest),{recursive:true,mode:0o700});mkdirSync(dest,{mode:0o700});
 try{mkdirSync(join(dest,'media'));mkdirSync(join(dest,'thumbs'));
 for(const a of actions){const media=join(dest,'media',a.id+'.webm');copyFileSync(a.file,media);need(hash(regular(media,67108864))===a.source_sha256,'copied_source_hash');run('ffmpeg',['-v','error','-c:v','libvpx-vp9','-i',media,'-vf',`select=eq(n\\,${Math.floor(a.duration*12)}),format=rgba,pad=640:400:0:6:color=black,crop=400:400:124:0`,'-frames:v','1',join(dest,'thumbs',a.id+'.png')]);need(existsSync(join(dest,'thumbs',a.id+'.png')),'thumbnail_missing');}
 const records=actions.map(({file,...a})=>({...a,src:`media/${a.id}.webm`,thumbnail:`thumbs/${a.id}.png`}));const manifest={status:'manual_visual_review_pending',catalog_sha256:catalogSha256,license_ref:licenseRef,geometry,actions:records,credits:['上善无形','ZipZipPipe','PC2005-cloud/dsh-pet']};
 writeFileSync(join(dest,'review-data.json'),JSON.stringify(manifest,null,2));writeFileSync(join(dest,'index.html'),reviewPage(manifest));return {directory:dest,actions:records.length,bytes:records.reduce((s,a)=>s+a.bytes,0)};
 }catch(e){rmSync(dest,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values:v}=parseArgs({options:{'source-dir':{type:'string'},catalog:{type:'string'},'catalog-sha256':{type:'string'},'license-ref':{type:'string'},output:{type:'string'},'retained-catalog':{type:'string'}}});need(v.output&&v.catalog&&v['source-dir']&&v['catalog-sha256'],'explicit_inputs_required');const retained=v['retained-catalog']?JSON.parse(regular(v['retained-catalog'],1048576)).actions.map(a=>a.id):[];console.log(JSON.stringify(prepareReview({sourceDir:v['source-dir'],catalog:v.catalog,catalogSha256:v['catalog-sha256'],licenseRef:v['license-ref'],output:v.output,retained})));
}
