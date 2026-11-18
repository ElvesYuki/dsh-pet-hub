import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {layeredRigParts,layeredDrawOrder} from '../../packages/core/layered-character-profiles.mjs';
import {syntheticLayeredPng,layeredJsonBytes} from '../../packages/simulator/layered-character-fixture.mjs';
export const authoringSha=b=>createHash('sha256').update(b).digest('hex');
export function makeAuthoringFixture(root){
 const master=join(root,'master'),face=join(root,'face'),arm=join(root,'arm');for(const p of [master,face,arm,join(root,'.cache')])mkdirSync(p);
 const base=syntheticLayeredPng().png,clean=syntheticLayeredPng({filter:1}).png,raised=syntheticLayeredPng({filter:2}).png,credits=['Original synthetic authoring fixture'],license_ref='synthetic-mit';
 const layout={version:1,canvas:[360,360],source_sha256:authoringSha(base),parts:layeredRigParts.map(([id,parent,pivot])=>({id,parent,pivot:[...pivot]})),draw_order:[...layeredDrawOrder]};
 const layoutBytes=layeredJsonBytes(layout);writeFileSync(join(master,'layout.json'),layoutBytes);writeFileSync(join(master,'source.png'),base);
 const parts=layeredRigParts.map(([id,parent,pivot])=>{const png=id==='eyes'?clean:base;writeFileSync(join(master,id+'.png'),png);return {id,parent,pivot:[...pivot],file:id+'.png',sha256:authoringSha(png),canvas:[360,360],offset:[0,0]};});
 const m={source_sha256:authoringSha(base),layout_sha256:authoringSha(layoutBytes),parts,draw_order:[...layeredDrawOrder],credits,license_ref};
 writeFileSync(join(master,'manifest.json'),layeredJsonBytes(m));const masterManifestSha256=authoringSha(layeredJsonBytes(m));
 const ids=['head_clean','eyes_open','mouth_closed','eyes_open_edge','brows_neutral','fringe_left','fringe_right','side_left','side_right','hair_cap','eyes_half','eyes_closed','eyes_smile','brows_relaxed','brows_raised','mouth_smile','mouth_small','mouth_open','mouth_round'];
 const assets=ids.map(id=>{writeFileSync(join(face,id+'.png'),clean);return {id,file:id+'.png',sha256:authoringSha(clean),canvas:[360,360],offset:[0,0]};});
 const f={master_manifest_sha256:masterManifestSha256,source_sha256:authoringSha(base),assets,overrides:{head:'head_clean',eyes:'eyes_open',brows:'brows_neutral',mouth:'mouth_closed',fringe_left:'fringe_left',fringe_right:'fringe_right',side_left:'side_left',side_right:'side_right',hair_cap:'hair_cap'},verification:{original_eye_png_unchanged:true},credits,license_ref};
 writeFileSync(join(face,'manifest.json'),layeredJsonBytes(f));writeFileSync(join(arm,'arm-raised.png'),raised);
 const w={original_master_manifest_sha256:masterManifestSha256,canvas:[360,360],root_transform:[1,0,0,1,0,0],pivot_canvas_px:[195,216],replaced_part:'arm_right',credits,license_ref,prompt:'PRIVATE_PROMPT_SENTINEL /Users/private-user/secret.png'};writeFileSync(join(arm,'manifest.json'),layeredJsonBytes(w));
 const options={repoRoot:root,masterDirectory:master,masterManifestSha256,expressionDirectory:face,expressionManifestSha256:authoringSha(layeredJsonBytes(f)),raisedArmDirectory:arm,raisedArmManifestSha256:authoringSha(layeredJsonBytes(w)),raisedArmSha256:authoringSha(raised),characterId:'synthetic',variantId:'native360',version:'v1',licenseRef:license_ref,method:'synthetic',output:'.cache/export-one'};
 return {options,master,face,arm,base,clean,raised,m,f,w,layout};
}
export function rewriteAuthoringManifest(fixture,name,mutate){const directory=fixture[name],file=join(directory,'manifest.json'),m=JSON.parse(readFileSync(file));mutate(m);const bytes=layeredJsonBytes(m);writeFileSync(file,bytes);fixture.options[name==='master'?'masterManifestSha256':name==='face'?'expressionManifestSha256':'raisedArmManifestSha256']=authoringSha(bytes);return m;}
