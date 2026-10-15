import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchPlan,MAX_WORKER_SESSIONS } from '../lib/dispatch';
import { nativeContext } from '../lib/native-context';
import { contextSchema } from '../lib/review-plan';

const none={stages:0,resets:0,reviews:0,leased:0,needsTriage:0,awaitingConfirmation:0,awaitingApproval:0,blocked:0};

test('dispatcher stays idle when only human work or active leases exist',()=>{
  const plan=dispatchPlan({...none,needsTriage:2,awaitingConfirmation:1,awaitingApproval:1,leased:1});
  assert.equal(plan.action,'idle');assert.equal(plan.workerSessions,0);
  assert.deepEqual(plan.human,{needsTriage:2,awaitingConfirmation:1,awaitingApproval:1,blocked:0});
  assert.match(plan.reason,/already leased/);
});

test('dispatcher starts one fresh worker per claimable item, bounded per wake',()=>{
  assert.deepEqual([dispatchPlan({...none,stages:1}).action,dispatchPlan({...none,stages:1}).workerSessions],['claim',1]);
  assert.equal(dispatchPlan({...none,stages:1,reviews:2}).workerSessions,3);
  assert.equal(dispatchPlan({...none,reviews:40,resets:1}).workerSessions,MAX_WORKER_SESSIONS);
});

test('native context comes from the platform session identity, Codex first',()=>{
  assert.equal(nativeContext({CODEX_THREAD_ID:'thread-123456'}),'thread-123456');
  assert.equal(nativeContext({CODEX_THREAD_ID:'thread-123456',CLAUDE_CODE_REMOTE_SESSION_ID:'cse_01ABCDEFGH'}),'thread-123456');
  const claude=nativeContext({CLAUDE_CODE_REMOTE_SESSION_ID:'cse_01ABCDEFGHJKMNPQRSTVWXYZ'});
  assert.equal(claude,'claude:cse_01ABCDEFGHJKMNPQRSTVWXYZ');assert.ok(contextSchema.safeParse(claude).success);
  assert.equal(nativeContext({}),undefined);
});
