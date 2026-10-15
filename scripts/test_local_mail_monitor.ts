/** Local integration only. Run with the isolated ZORA_LOCAL_MONITOR fixture enabled. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SignJWT} from 'jose';
import {Pool} from 'pg';
async function main(){
 const env=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
 const origin=new URL(env.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(env.MS_ZORA_MAILBOX,'local-fixture');
 const db=new Pool({connectionString:env.DATABASE_URL});const mailbox=env.MS_ZORA_MAILBOX;
 const before=(await db.query('SELECT * FROM zora_mail_state WHERE mailbox=$1',[mailbox])).rows[0];
 assert.equal(before,undefined,'Use a clean local monitoring fixture');
 const token=async(email:string)=>new SignJWT({name:'Synthetic Monitor Tester'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(env.ZORA_SESSION_SECRET));
 try{
  await db.query("INSERT INTO zora_mail_state(mailbox,folder_id,subscription_id,subscription_expires_at) VALUES($1,'fixture-folder','fixture-subscription',now()+interval '2 days')",[mailbox]);
  async function run(method:string,auth=true,cron=false){return fetch(new URL('/api/microsoft/maintenance',origin),{method,headers:{...(auth?{Authorization:`Bearer ${env.CRON_SECRET}`}:{Authorization:'Bearer incorrect'}),...(cron?{'User-Agent':'vercel-cron/1.0'}:{})}});}
  for(const method of ['GET','POST'])assert.equal((await run(method,false)).status,401);
  assert.equal((await db.query("SELECT 1 FROM zora_events WHERE type='mailbox.maintenance' AND data->>'mailbox'=$1",[mailbox])).rows.length,0);
  const manual=await run('POST');assert.equal(manual.status,200);assert.equal((await manual.json()).sync.synced,1);
  const scheduled=await run('GET',true,true);assert.equal(scheduled.status,200);assert.equal((await scheduled.json()).sync.synced,0);
  assert.equal((await db.query('SELECT 1 FROM zora_inbox WHERE mailbox=$1',[mailbox])).rows.length,1);
  const ignored=(await db.query("SELECT disposition FROM zora_mail_receipts WHERE mailbox=$1 AND message_id='fixture-monitor-jarvis'",[mailbox])).rows[0];assert.equal(ignored.disposition,'ignored');
  const events=(await db.query("SELECT actor,data FROM zora_events WHERE type='mailbox.maintenance' AND data->>'mailbox'=$1 ORDER BY id",[mailbox])).rows;assert.deepEqual(events.map(e=>e.actor),['manual','vercel-cron']);assert.ok(events.every(e=>e.data.ok));
  assert.equal((await fetch(new URL('/api/mailbox/status',origin))).status,401);
  assert.equal((await fetch(new URL('/api/mailbox/status',origin),{headers:{Cookie:`zora_session=${await token('demo-tester@mindmapdigital.ai')}`}})).status,403);
  const status=await fetch(new URL('/api/mailbox/status',origin),{headers:{Cookie:`zora_session=${await token('tester@mindmapdigital.ai')}`}});assert.equal(status.status,200);const body=await status.json();assert.equal(body.scheduledOk,true);assert.equal(body.pendingMessages,1);assert.ok(body.lastSyncAt&&body.lastScheduledAt);assert.equal(body.intervalMinutes,5);
  console.log('Mailbox monitor integration passed: authenticated cron/manual runs, durable heartbeat, idempotent intake, Jarvis exclusion, private status and roles.');
 }finally{
  await db.query('DELETE FROM zora_inbox WHERE mailbox=$1',[mailbox]);await db.query('DELETE FROM zora_mail_receipts WHERE mailbox=$1',[mailbox]);await db.query('DELETE FROM zora_mail_state WHERE mailbox=$1',[mailbox]);await db.query("DELETE FROM zora_events WHERE type='mailbox.maintenance' AND data->>'mailbox'=$1",[mailbox]);await db.end();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
