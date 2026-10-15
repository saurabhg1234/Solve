/** Local-only automatic intake fixture. Run with the development Graph fixture preloaded; all senders and messages are synthetic. */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
async function main(){
 const env=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
 assert.equal(new URL(env.DATABASE_URL).hostname,'127.0.0.1');assert.equal(env.MS_ZORA_MAILBOX,'local-fixture');
 Object.assign(process.env,{MS_TENANT_ID:'00000000-0000-0000-0000-000000000000',MS_CLIENT_ID:'00000000-0000-0000-0000-000000000001',MS_CLIENT_SECRET:'synthetic-local-only',...env,ZORA_SUBJECT_TAG:'[ZORA]'});
 const {database}=await import('../lib/db');const {autoIntake}=await import('../lib/triage');
 const db=database(),inbox:string[]=[];
 async function mail(subject:string,sender:string,body:string,conversation=randomUUID(),triage:unknown=null){
  const id=randomUUID();inbox.push(id);
  await db.query('INSERT INTO zora_inbox(id,mailbox,message_id,subject,sender,body_text,received_at,conversation_id,triage) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8)',[id,'local-fixture','fixture-auto-'+id,subject,sender,body,conversation,triage===null?null:JSON.stringify(triage)]);return {id,conversation};
 }
 const state=async(id:string)=>(await db.query('SELECT triage,case_id FROM zora_inbox WHERE id=$1',[id])).rows[0];
 try{
  // Leave unrelated untriaged rows from earlier fixtures alone.
  await db.query("UPDATE zora_inbox SET triage='{\"state\":\"preexisting\"}' WHERE triage IS NULL");
  const old=await mail('[ZORA] W4 Earlier pilot inputs','advait.mahajan@mindmapdigital.ai','Earlier message received before automatic intake.',undefined,{state:'preexisting'});
  const rfp=await mail('[ZORA] W4 - Synthetic Acme portal RFP','tester@mindmapdigital.ai','<p>Please prepare our response to the attached synthetic RFP.</p>');
  const email=await mail('[ZORA] Acme follow-up','tester@mindmapdigital.ai','<p>Please draft an email to the synthetic client thanking them for the workshop.</p>');
  const pricing=await mail('[ZORA] Re: pricing inputs','pricing-tester@mindmapdigital.ai','Synthetic pricing owner reply with rates to follow.');
  const stranger=await mail('[ZORA] W4 RFP from a stranger','someone@example.test','Please respond to the attached RFP.');
  const ambiguous=await mail('[ZORA] W3 or W4 for Acme?','tester@mindmapdigital.ai','Not sure which applies.');
  const own=await mail('[ZORA] Your Zora access','local-fixture','Sent by Zora itself.');
  // Each run is bounded to five messages; the next notification or maintenance run continues.
  const first=await autoIntake();assert.equal(first.length,5);const processed=[...first,...await autoIntake()];
  assert.equal(processed.length,6);
  let s=await state(rfp.id);assert.equal(s.triage.state,'pursuit_created',JSON.stringify(s.triage));assert.equal(s.triage.workflow,'W4');
  const c=(await db.query('SELECT * FROM zora_cases WHERE id=$1',[s.case_id])).rows[0];
  assert.equal(c.status,'awaiting_confirmation');assert.equal(c.requested_by,'tester@mindmapdigital.ai');assert.equal(c.source,'email');assert.equal(c.title,'Synthetic Acme portal RFP');assert.equal(c.briefing,'Please prepare our response to the attached synthetic RFP.');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM zora_sources WHERE case_id=$1 AND filename='request-email.txt'",[c.id])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM zora_events WHERE case_id=$1 AND type='intake.auto_created'",[c.id])).rows[0].n,1);
  s=await state(email.id);assert.equal(s.triage.state,'pursuit_created');assert.equal(s.triage.workflow,'W8');assert.equal(s.triage.routingConfirmed,true);
  assert.equal((await db.query('SELECT status FROM zora_cases WHERE id=$1',[s.case_id])).rows[0].status,'queued');
  for(const m of [pricing,stranger,ambiguous]){s=await state(m.id);assert.equal(s.triage.state,'needs_triage');assert.equal(s.case_id,null);}
  assert.equal((await state(stranger.id)).triage.proposal.workflow,'W4','suggestion retained for the consultant');
  assert.equal((await state(own.id)).triage.state,'ignored');
  assert.equal((await state(old.id)).triage.state,'preexisting');assert.equal((await state(old.id)).case_id,null);
  // Replies in a pursuit thread are related correspondence, not new pursuits.
  const reply=await mail('RE: [ZORA] W4 - Synthetic Acme portal RFP','tester@mindmapdigital.ai','Synthetic reply adding detail to the RFP request.',rfp.conversation);
  await autoIntake();s=await state(reply.id);assert.equal(s.triage.state,'related');assert.equal(s.triage.relatedCaseId,c.id);assert.equal(s.case_id,null);
  // Overlapping runs claim each message once.
  const twice=await mail('[ZORA] W1 Synthetic intro deck for Beta','tester@mindmapdigital.ai','Please prepare an intro deck for Beta.');
  const runs=await Promise.all([autoIntake(),autoIntake(),autoIntake()]);assert.equal(runs.flat().filter(r=>r.inboxId===twice.id).length,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM zora_cases WHERE title='Synthetic intro deck for Beta'")).rows[0].n,1);
  console.log('Local automatic intake passed: explicit/keyword routing, retained routing confirmation (W2/W8 queue), approved-sender roles, suggestions for manual triage, Zora-sent and pre-existing mail skipped, thread replies related to their pursuit, and single claim under overlapping runs. Synthetic mail only.');
 }finally{
  const cases=(await db.query('SELECT case_id FROM zora_inbox WHERE id=ANY($1::uuid[]) AND case_id IS NOT NULL',[inbox])).rows.map(r=>r.case_id);
  await db.query('DELETE FROM zora_inbox WHERE id=ANY($1::uuid[])',[inbox]);
  for(const id of cases){for(const table of ['zora_mail_receipts','zora_jobs','zora_sources','zora_events'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}
  await db.end();
 }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:'Local automatic intake checks failed');process.exitCode=1;});
