import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progressSummary,type PursuitProgress} from '../lib/pursuit-progress';
import {sourceContextSchema} from '../lib/source-context';

const now=Date.parse('2026-10-16T10:00:00Z');
const base:PursuitProgress={checkedAt:new Date(now).toISOString(),queuedAt:null,lastDispatcherAt:null,workers:[],reviewQueued:0,reviewCompleted:0,reviewTotal:0};
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
