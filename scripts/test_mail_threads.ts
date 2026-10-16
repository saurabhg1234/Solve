/** Local synthetic correspondence-monitor tests; no Graph calls or real messages/sends. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';import {SignJWT} from 'jose';
async function main(){
 const config=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));assert.equal(new URL(config.DATABASE_URL).hostname,'127.0.0.1');Object.assign(process.env,config);
 const {database}=await import('../lib/db'),{syncRegisteredThread,isThreadReply}=await import('../lib/mail-threads'),{microsoftConfig}=await import('../lib/config');const db=database(),ms=microsoftConfig(),caseId=randomUUID(),conversation='local-thread-'+randomUUID(),baseId=randomUUID(),seen:string[]=[];
 function mail(id=baseId,patch:Record<string,unknown>={}){return {id,subject:'Re: Zora project update',conversationId:conversation,isDraft:false,from:{emailAddress:{address:'tester@mindmapdigital.ai'}},receivedDateTime:new Date(Date.now()-1000).toISOString(),body:{content:'Synthetic feedback only; this must not approve or alter a pursuit.'},...patch};}
 try{
  await db.query("INSERT INTO zora_cases(id,title,client,workflow,status,source,requested_by,briefing) VALUES($1,'LOCAL mail thread fixture','Synthetic','W3','blocked','manual','tester@mindmapdigital.ai','Synthetic correspondence fixture only')",[caseId]);
  assert.equal(isThreadReply(mail(),conversation,ms.mailbox),true);
  for(const patch of [{conversationId:'different'},{subject:'[JARVIS] Other request'},{categories:['Jarvis']},{isDraft:true},{from:{emailAddress:{address:ms.mailbox}}},{'@removed':{}},{id:''}])assert.equal(isThreadReply(mail(baseId,patch),conversation,ms.mailbox),false);
  assert.deepEqual(await syncRegisteredThread({graph:async()=>{throw Error('Unregistered mailbox must not be read');}}),{synced:0,checked:0});
  await db.query('INSERT INTO zora_mail_threads(mailbox,conversation_id,case_id,registered_by,scan_from) VALUES($1,$2,$3,$4,$5)',[ms.mailbox,conversation,caseId,'local-fixture',new Date(Date.now()-60000)]);
  await db.query("INSERT INTO zora_mail_receipts(mailbox,message_id,disposition) VALUES($1,$2,'ignored')",[ms.mailbox,baseId]);
  const continuation='https://graph.microsoft.com/v1.0/users/test/messages?$skiptoken=synthetic';
  const first=await syncRegisteredThread({graph:async path=>{seen.push(path);const parsed=new URL(path,'https://graph.microsoft.com/v1.0/');assert.ok(parsed.searchParams.get('$filter')?.includes(conversation));return {value:[mail(),mail(randomUUID(),{subject:'[JARVIS] Leave alone'}),mail(randomUUID(),{conversationId:'unrelated'}),mail(randomUUID(),{from:{emailAddress:{address:ms.mailbox}}})],'@odata.nextLink':continuation};}});
  assert.deepEqual(first,{synced:1,checked:1,more:true});
  const saved=(await db.query('SELECT id,case_id,triage,body_text FROM zora_inbox WHERE mailbox=$1 AND message_id=$2',[ms.mailbox,baseId])).rows[0];assert.equal(saved.case_id,caseId);assert.equal(saved.triage.state,'related');assert.ok(saved.body_text.includes('Synthetic feedback'));
  const origin=new URL(process.env.ZORA_LOCAL_TEST_ORIGIN||config.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');
  for(const email of ['tester@mindmapdigital.ai','outsider@mindmapdigital.ai']){
    const token=await new SignJWT({name:'Synthetic thread permissions test'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(config.ZORA_SESSION_SECRET));
    const headers={Cookie:`zora_session=${token}`},list=await fetch(new URL('/api/inbox',origin),{headers});assert.equal(list.status,200);assert.equal((await list.json()).messages.some((m:any)=>m.id===saved.id),email.startsWith('tester@'));
    const detail=await fetch(new URL(`/api/inbox/${saved.id}`,origin),{headers});assert.equal(detail.status,email.startsWith('tester@')?200:403);
  }
  const cursor=(await db.query('SELECT next_link,scan_started_at,scan_from FROM zora_mail_threads WHERE conversation_id=$1',[conversation])).rows[0];assert.equal(cursor.next_link,continuation);assert.ok(cursor.scan_started_at);
  const secondId=randomUUID();const next=await syncRegisteredThread({graph:async path=>{assert.equal(path,continuation);return {value:[mail(),mail(secondId,{hasAttachments:true})]};}});assert.deepEqual(next,{synced:1,checked:1,more:false});
  const finalCursor=(await db.query('SELECT next_link,scan_started_at,scan_from FROM zora_mail_threads WHERE conversation_id=$1',[conversation])).rows[0];assert.equal(finalCursor.next_link,null);assert.equal(finalCursor.scan_started_at,null);assert.ok(new Date(finalCursor.scan_from)>=new Date(cursor.scan_from));
  assert.ok((await db.query('SELECT attachment_notice FROM zora_inbox WHERE message_id=$1',[secondId])).rows[0].attachment_notice.includes('review them'));
  const duplicate=await syncRegisteredThread({graph:async()=>({value:[mail(),mail(secondId)]})});assert.equal(duplicate.synced,0);
  let resolveFetch!:(value:any)=>void;let began!:(value?:unknown)=>void;const started=new Promise(done=>{began=done;});const held=syncRegisteredThread({graph:async()=>{began();return new Promise(done=>{resolveFetch=done;});}});await started;
  assert.deepEqual(await syncRegisteredThread({graph:async()=>{throw Error('Concurrent scan should skip lease');}}),{synced:0,checked:0});resolveFetch({value:[]});await held;
  const beforeFailure=(await db.query('SELECT scan_from FROM zora_mail_threads WHERE conversation_id=$1',[conversation])).rows[0].scan_from;
  await assert.rejects(syncRegisteredThread({graph:async()=>{throw Error('Synthetic Graph failure');}}));
  let failed=(await db.query('SELECT scan_from,sync_lease FROM zora_mail_threads WHERE conversation_id=$1',[conversation])).rows[0];assert.deepEqual(failed.scan_from,beforeFailure);assert.equal(failed.sync_lease,null);
  await assert.rejects(syncRegisteredThread({graph:async()=>({value:[mail(randomUUID())],'@odata.nextLink':'https://untrusted.example/steal'})}));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_inbox WHERE case_id=$1',[caseId])).rows[0].n,2);
  const unchanged=(await db.query('SELECT status,version,source_revision,stage_index FROM zora_cases WHERE id=$1',[caseId])).rows[0];assert.deepEqual(unchanged,{status:'blocked',version:1,source_revision:1,stage_index:0});
  for(const table of ['zora_jobs','zora_sources','zora_approvals'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE case_id=$1`,[caseId])).rows[0].n,0);
  await db.query('UPDATE zora_mail_threads SET enabled=false WHERE conversation_id=$1',[conversation]);assert.deepEqual(await syncRegisteredThread({graph:async()=>{throw Error('Disabled thread must not be read');}}),{synced:0,checked:0});
  console.log('Local registered-thread checks passed: explicit scope, untagged reply recovery, Jarvis/own/draft/unrelated exclusion, duplicate protection, pagination, concurrent lease, retry without lost cursor, safe URLs, disabled watch, no pursuit/source/job/approval mutation.');
 }finally{for(const table of ['zora_mail_threads','zora_mail_receipts','zora_inbox','zora_events'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[caseId]);await db.query('DELETE FROM zora_mail_receipts WHERE mailbox=$1 AND message_id=$2',[ms.mailbox,baseId]);await db.query('DELETE FROM zora_cases WHERE id=$1',[caseId]);await db.end();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
