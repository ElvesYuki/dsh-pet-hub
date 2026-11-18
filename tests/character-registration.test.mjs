import test from 'node:test';
import assert from 'node:assert/strict';
import {registerCharacter,registrationSvg} from '../scripts/character-registration.mjs';

test('registration: equal scale preserves reference placement, including off-center subject',()=>{
 const r=registerCharacter([240,142,1021,1123],[70,50,281,315]);
 assert.ok(r.max_edge_error<0.02);assert.equal(r.matrix[0],r.matrix[3]);assert.equal(r.matrix[1],0);assert.equal(r.matrix[2],0);
 assert.deepEqual(r.reference_subject_center,[175.5,182.5]);
 assert.equal((r.mapped_bounds[0]+r.mapped_bounds[2])/2,175.5);
 assert.equal((r.mapped_bounds[1]+r.mapped_bounds[3])/2,182.5);
 assert.deepEqual(r.display_offset,[53,53]);assert.equal(r.canvas[0]+2*r.display_offset[0],r.display[0]);
 assert.equal(r.reference_subject_center[0]+r.display_offset[0],228.5);
 assert.deepEqual(registerCharacter([70,50,281,315],[70,50,281,315]).matrix,[1,0,0,1,0,0]);
});

test('registration: refuses incompatible redraw instead of stretching, bad bounds and tolerance',()=>{
 assert.throws(()=>registerCharacter([292,205,986,1081],[70,50,281,315]),/aspect_mismatch/);
 for(const box of [[0,0,0,10],[0,0,10,0],[-1,0,2,2],[0,0,Infinity,10],[0,0,2]])assert.throws(()=>registerCharacter(box,[70,50,281,315]),/bounds/);
 for(const tolerance of [-1,Infinity,2])assert.throws(()=>registerCharacter([0,0,1,1],[0,0,1,1],{tolerance}),/tolerance/);
});

test('registration: SVG has explicit native canvas and embedded source, never executable image URL',()=>{
 const r=registerCharacter([240,142,1021,1123],[70,50,281,315]),s=registrationSvg('iVBORw==',[1254,1254],r);
 assert.ok(s.includes('viewBox="0 0 360 360"'));assert.ok(s.includes('href="data:image/png;base64,iVBORw=="'));assert.ok(s.includes(`matrix(${r.matrix.join(' ')})`));
 assert.throws(()=>registrationSvg('javascript:bad',[1254,1254],r),/image/);
 assert.throws(()=>registrationSvg('iVBORw==',[0,1254],r),/image_size/);
});
