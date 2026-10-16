import test from 'node:test';
import assert from 'node:assert/strict';
import {stagesFor,taskInstructions} from '../lib/engine';
import {reviewPlan} from '../lib/review-plan';

test('meeting-note intake preserves the BRD stage order, downstream reviews and human decisions',()=>{
 const pilot=stagesFor('W3','mindmap-pilot'),original=stagesFor('W3','brd');
 assert.deepEqual(pilot.map(s=>s.id),original.map(s=>s.id));
 for(const id of ['W3-G1','W3-G3','S1-G2','W3-G4']){
  const a=pilot.find(s=>s.id===id)!,b=original.find(s=>s.id===id)!;assert.equal(a.kind,'gate');assert.deepEqual(a.approvers,b.approvers);
 }
 assert.ok(original[0].instruction.includes('recording'));
 assert.ok(pilot[0].instruction.includes('notes in the request description'));
 for(const id of ['W3-2','W3-3'])assert.ok(pilot.find(s=>s.id===id)!.instruction.includes('not applicable'));
 assert.ok(pilot.find(s=>s.id==='W3-5')!.guard.includes('Never invent a timestamp'));
 assert.ok(taskInstructions('W3',pilot[0]).includes('A diagnostic review is not a fresh independent QC pass'));
 assert.deepEqual(reviewPlan('W3-16')!.passes.map(p=>p.checker),['D1','D1','D2','D3','D3','D4','D5','D8']);
});
