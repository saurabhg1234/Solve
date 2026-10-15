import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { checklistEntriesSchema,rerunCheckers,rulesFor,validateChecklist } from '../lib/checklist';
import { reviewResultSchema } from '../lib/review-plan';
import { noteReadsSchema,rerunRequestSchema } from '../lib/escalation-rerun';

test('ESC-4 checklist rules may only target checkers that run again between the return point and the escalated gate',()=>{
  assert.deepEqual(rerunCheckers('W3','W3-17','W3-G3'),['D1','D2','D3','D4','D5','D6']);
  assert.deepEqual(rerunCheckers('W4','W4-18','W4-G3'),['D1','D2','D3','D4','D5','D6']);
  assert.deepEqual(rerunCheckers('W3','W3-20','W3-G4'),['D3','D6','D7']);
  assert.deepEqual(rerunCheckers('W4','W4-23','W4-G4'),['D3','D6','D7']);
  // A document escalation at the release gate re-runs everything from the first-draft QC, including S1.
  for(const checker of ['D1','D7','EFFORT','COST'])assert.ok(rerunCheckers('W3','W3-17','W3-G4').includes(checker),checker);
  assert.deepEqual(rerunCheckers('W3','W3-G3','W3-17'),[]);assert.deepEqual(rerunCheckers('W3','invented','W3-G3'),[]);
});
test('every escalated finding needs exactly one checklist rule aimed at a re-run checker',()=>{
  const allowed=rerunCheckers('W3','W3-17','W3-G3'),rule='Confirm every buyer-mandated integration appears in scope and architecture.';
  assert.equal(validateChecklist([{findingIndex:0,checkers:['D1'],rule},{findingIndex:1,checkers:['D3','D4'],rule}],2,allowed),null);
  for(const entries of [[{findingIndex:0,checkers:['D1'],rule}],[{findingIndex:0,checkers:['D1'],rule},{findingIndex:0,checkers:['D2'],rule}],[{findingIndex:0,checkers:['D1'],rule},{findingIndex:2,checkers:['D2'],rule}],[{findingIndex:0,checkers:['D7'],rule},{findingIndex:1,checkers:['D1'],rule}],[{findingIndex:0,checkers:['D1','D1'],rule},{findingIndex:1,checkers:['D1'],rule}]])
    assert.notEqual(validateChecklist(entries,2,allowed),null);
  assert.equal(checklistEntriesSchema.safeParse([{findingIndex:0,checkers:['D1'],rule:'too short'}]).success,false);
  assert.equal(checklistEntriesSchema.safeParse([{findingIndex:0,checkers:['d1'],rule}]).success,false);
  assert.equal(checklistEntriesSchema.safeParse([]).success,false);
  assert.equal(rerunRequestSchema.safeParse({version:3,feedbackId:randomUUID(),checklist:[{findingIndex:0,checkers:['D1'],rule}],extra:true}).success,false);
});
test('reviewers report every applicable checklist rule; gate approvals acknowledge exact note hashes',()=>{
  const a=randomUUID(),b=randomUUID(),packet={checklist:[{id:a,checkers:['D1','D3'],rule:'x'},{id:b,checkers:['D6'],rule:'y'}]};
  assert.deepEqual(rulesFor(packet,'D3'),[a]);assert.deepEqual(rulesFor(packet,'D6'),[b]);assert.deepEqual(rulesFor(packet,'D2'),[]);assert.deepEqual(rulesFor({},'D1'),[]);
  const base={packetHash:'a'.repeat(64),checkedElementIds:['e1'],summary:'Synthetic review summary.',findings:[],missingInputs:[]};
  assert.deepEqual(reviewResultSchema.parse(base).checkedRuleIds,[]);
  assert.equal(reviewResultSchema.safeParse({...base,checkedRuleIds:['not-a-rule']}).success,false);
  assert.equal(noteReadsSchema.safeParse([{feedbackId:randomUUID(),reportHash:'f'.repeat(64)}]).success,true);
  assert.equal(noteReadsSchema.safeParse([{feedbackId:randomUUID(),reportHash:'short'}]).success,false);
});
