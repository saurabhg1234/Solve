import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progressSummary,progressContext,type PursuitProgress} from '../lib/pursuit-progress';
import {sourceContextSchema} from '../lib/source-context';

const now=Date.parse('2026-10-16T10:00:00Z');
const base:PursuitProgress={checkedAt:new Date(now).toISOString(),queuedAt:null,lastDispatcherAt:null,workers:[],reviewQueued:0,reviewCompleted:0,reviewTotal:0};
test('on-request progress does not depend on a stopped dispatcher or count direct work as independent QC',()=>{
  const p={...base,executionMode:'on_request' as const,lastDispatcherAt:new Date(now-6*3600000).toISOString(),reviewQueued:10,reviewTotal:10};
  const status=progressSummary('queued',p,now);assert.equal(status.title,'Independent QC not yet completed');assert.ok(!status.detail.includes('dispatcher'));assert.match(status.detail,/10 formal checks/);assert.equal(status.active.length,0);
  assert.equal(progressSummary('queued',{...p,reviewQueued:0},now).title,'Work runs when requested');
  assert.equal(progressSummary('queued',{...p,workers:[{kind:'review',name:'Real reviewer',checker:'D1',leaseExpiresAt:new Date(now+10000).toISOString()}]},now).title,'Independent review in progress');
});
test('progress distinguishes queued work, expired contact, live reviewers and human gates',()=>{
  assert.match(progressSummary('queued',base,now).detail,/No agent has claimed/);
  assert.match(progressSummary('queued',{...base,lastDispatcherAt:new Date(now-2*60*60*1000).toISOString()},now).title,/overdue/);
  const worker={kind:'stage' as const,name:'zora-worker',leaseExpiresAt:new Date(now-1).toISOString()};
  assert.equal(progressSummary('running',{...base,workers:[worker]},now).active.length,0);
  assert.match(progressSummary('running',{...base,workers:[worker]},now).title,/reconnect/);
  worker.leaseExpiresAt=new Date(now+300000).toISOString();
  assert.equal(progressSummary('running',{...base,workers:[worker]},now).active.length,1);
  assert.equal(progressSummary('blocked',{...base,workers:[worker]},now).active.length,0);
  assert.match(progressSummary('running',{...base,reviewQueued:2},now).title,/independent reviewers/);
  assert.match(progressSummary('awaiting_confirmation',base,now).title,/confirmation/);
  assert.match(progressSummary('released',base,now).detail,/separate human action/);
});
test('source labels are bounded descriptive metadata, never visibility or approval claims',()=>{
  assert.deepEqual(sourceContextSchema.parse({category:'answers',label:'  Buyer Q&A ',notes:'Use the signed answers.'}),{category:'answers',label:'Buyer Q&A',notes:'Use the signed answers.'});
  for(const value of [{category:'invented'},{category:'template',approved:true},{category:'reference',visibility:'client'},{category:'other',notes:'x'.repeat(3001)}])assert.equal(sourceContextSchema.safeParse(value).success,false);
});
test('existing proposal review counts actual checks and does not present a future gate as due',()=>{
  const stages=[{id:'W3-1',title:'Discovery intake',kind:'task',approvers:[]},{id:'W3-G1',title:'Confirm requirements',kind:'gate',approvers:['consultant']}];
  const c={status:'queued' as const,stageIndex:0},p={...base,reviewPurpose:'existing_draft',reviewTotal:10,reviewQueued:7,reviewCompleted:2};
  const actual=progressContext(c,p,stages);assert.equal(actual.position,'2 of 10 independent checks recorded');assert.equal(actual.decision,'No human approval is due');assert.equal(actual.current,'Existing proposal review');
  assert.equal(progressContext(c,base,stages).decisionLabel,'Later human gate');
  const due=progressContext({status:'awaiting_approval',stageIndex:1},base,stages);assert.equal(due.decisionLabel,'Human decision due now');assert.equal(due.decision,'Confirm requirements');
});
