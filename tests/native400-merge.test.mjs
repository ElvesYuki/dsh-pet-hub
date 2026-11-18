import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';
import {planMerge,mergeCandidates,MERGED_RECIPE} from '../scripts/merge-native400-candidates.mjs';
import {sha256} from '../packages/runtime/material-import.mjs';
function fixture(){
 const ids=[5,17,19,20,23,35,40,48,66,67,70,76],colors=[5,20,35,40,48,66,67];
 const base={profile:'native400-candidate-v1',recipe:'native400-rgb8-black-median-cut256-nearest-lz4hc12-v1',license_ref:'dsh-pet-nc-86181ce',catalog_sha256:sha256('catalog'),actions:Array.from({length:78},(_,id)=>({id,name:'action'+id,width:400,height:400,fps:24,frames:id===42?118:241,duration_seconds:(id===42?118:241)/24,source_sha256:sha256('source'+id),sha256:sha256('old'+id),index_sha256:sha256('indices'+id),rgb565_sha256:sha256('pixels'+id),bytes:1000,exceeds_legacy_device_asset_limit:false}))};
 const candidate={schema:'native400-compression-candidates/1',profile:base.profile,license_ref:base.license_ref,source_recipe:base.recipe,source_manifest_sha256:sha256(JSON.stringify(base)),source_catalog_sha256:base.catalog_sha256,legacy_limit_bytes:5865472,actions:ids.map(id=>{const a=base.actions[id],lossless=!colors.includes(id);return {...a,original_sha256:a.sha256,original_rgb565_sha256:a.rgb565_sha256,original_bytes:a.bytes,sha256:sha256('new'+id),rgb565_sha256:lossless?a.rgb565_sha256:sha256('newpixels'+id),lossless_rgb565:lossless,verified_lossless_rgb565:lossless,within_legacy_limit:true,verification:'all_frames_crc_index_rgb_sha_and_size'};})};
 return {base,candidate};
}
function plan(base,candidate,extra={}){const raw=JSON.stringify(candidate);return planMerge(JSON.stringify(base),raw,{approvedCandidateSha256:sha256(raw),approveColorChanges:true,...extra});}
test('merge binds explicit reviewed content and keeps untouched identity and variable frame timing',()=>{
 const {base,candidate}=fixture(),m=plan(base,candidate);
 assert.equal(m.recipe,MERGED_RECIPE);assert.equal(m.actions.length,78);assert.equal(m.actions[42].frames,118);
 for(const a of base.actions)if(!m.replaced_action_ids.includes(a.id))assert.deepEqual(m.actions[a.id],a);
 assert.throws(()=>plan(base,candidate,{approveColorChanges:false}),/color_approval/);
 assert.throws(()=>plan(base,candidate,{approvedCandidateSha256:sha256('other reviewed bytes')}),/approval_sha/);
});
test('merge refuses wrong parent, replacement origin, false lossless, capacity and timing claims',()=>{
 const mutations=[c=>{c.source_manifest_sha256=sha256('other');},c=>{c.actions[0].original_sha256=sha256('other');},c=>{c.actions[0].verified_lossless_rgb565=true;},c=>{c.actions[0].bytes=5865473;},c=>{c.actions[0].frames=118;},c=>{c.actions[0].source_sha256=sha256('other');},c=>{c.actions[1].rgb565_sha256=sha256('changed lossless');}];
 for(const mutate of mutations){const {base,candidate}=fixture();mutate(candidate);assert.throws(()=>plan(base,candidate));}
});
test('merge never overwrites an existing output directory',()=>{
 mkdirSync('.cache',{recursive:true});const root=mkdtempSync(join(process.cwd(),'.cache','native400-merge-test-'));
 try{writeFileSync(join(root,'keep'),'existing');assert.throws(()=>mergeCandidates('missing','missing',root,{}),/output_exists/);assert.equal(readFileSync(join(root,'keep'),'utf8'),'existing');}finally{rmSync(root,{recursive:true,force:true});}
});
