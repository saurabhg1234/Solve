/** Isolated reusable-knowledge fixtures; never exercise hosted data or real approvals. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import { knowledgeHolds } from '../lib/knowledge';

async function main(){
  const local=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));if(process.env.ZORA_LOCAL_TEST_ORIGIN)local.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin=new URL(local.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(local.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:local.DATABASE_URL});const cases:string[]=[];const entries:string[]=[];const cookies:Record<string,string>={};
  for(const email of ['tester@mindmapdigital.ai','admin-tester@mindmapdigital.ai','outsider@mindmapdigital.ai','demo-tester@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic knowledge fixture'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(local.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,email='tester@mindmapdigital.ai',worker=false){const response=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${local.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
  async function create(title:string){const response=await call('/api/cases',{title,client:'Mindmap local fixture only',workflow:'W1',briefing:'Verify versioned reusable knowledge and source withdrawal only. This fixture is not company research, a real customer pursuit or pilot acceptance.'});assert.equal(response.status,201);cases.push(response.body.case.id);return response.body.case;}
  async function source(c:any,filename:string,bytes:Buffer,mimeType='text/plain'){
    const hash=createHash('sha256').update(bytes).digest('hex');const initial=await call(`/api/cases/${c.id}/uploads`,{filename,mimeType,totalBytes:bytes.length,sha256:hash,version:(await call(`/api/cases/${c.id}`)).body.case.version});assert.equal(initial.status,201);
    for(let offset=0;offset<bytes.length;offset+=2*1024*1024)assert.equal((await fetch(new URL(`/api/cases/${c.id}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,Cookie:`zora_session=${cookies['tester@mindmapdigital.ai']}`,'x-zora-offset':String(offset)},body:new Uint8Array(bytes.subarray(offset,offset+2*1024*1024))})).status,200);
    assert.equal((await call(`/api/cases/${c.id}/uploads/${initial.body.id}`,{})).status,200);return initial.body.id;
  }
  async function approve(v:any){return call(`/api/knowledge/${v.id}`,{version:v.version,action:'approve',note:'Synthetic local source review and explicit team reuse only.',sourceChecked:true,reuseAuthorised:true},'admin-tester@mindmapdigital.ai');}
  try{
    assert.equal((await fetch(new URL('/api/knowledge',origin))).status,401);
    const supplied=(await db.query("SELECT id,version FROM zora_knowledge_versions WHERE owner_email='system:zora' AND status='draft' AND ingestion_complete ORDER BY id LIMIT 1")).rows[0];
    if(supplied){
      await db.query('UPDATE zora_knowledge_versions SET ingestion_complete=false WHERE id=$1',[supplied.id]);
      try{assert.equal((await approve(supplied)).status,409,'An incomplete supplied-file import cannot gain human approval even when its current bytes hash correctly');assert.equal((await fetch(new URL(`/api/knowledge/${supplied.id}/file`,origin),{headers:{Cookie:`zora_session=${cookies['admin-tester@mindmapdigital.ai']}`}})).status,409);}finally{await db.query('UPDATE zora_knowledge_versions SET ingestion_complete=true WHERE id=$1',[supplied.id]);}
    }
    const originCase=await create('LOCAL KNOWLEDGE SOURCE — not a client');const bytes=Buffer.from('Synthetic source: no client metrics are approved.\nThis fixture supports storage and access tests only.');const sourceId=await source(originCase,'synthetic-company.txt',bytes);
    const input={caseId:originCase.id,sourceId,kind:'company_profile',title:'LOCAL COMPANY CLAIM — not approved business content',notes:'Synthetic fixture only. No company marketing claim is being approved.',claim:{statement:'No client metrics are approved in this fixture.',location:'Line 1',quote:'Synthetic source: no client metrics are approved.'}};
    assert.equal((await call('/api/knowledge',{...input,claim:undefined})).status,400);
    assert.equal((await call('/api/knowledge',input,'outsider@mindmapdigital.ai')).status,403);
    assert.equal((await call('/api/knowledge',input,'demo-tester@mindmapdigital.ai')).status,403);
    const proposed=await call('/api/knowledge',input);assert.equal(proposed.status,201);const v1=proposed.body.version;entries.push(v1.entry_id);assert.equal(v1.status,'draft');assert.equal(v1.approved_by,null);
    assert.equal((await call('/api/knowledge',undefined,'outsider@mindmapdigital.ai')).body.versions.length,0);
    assert.equal((await fetch(new URL(`/api/knowledge/${v1.id}/file`,origin),{headers:{Cookie:`zora_session=${cookies['outsider@mindmapdigital.ai']}`}})).status,403);
    assert.equal((await call(`/api/knowledge/${v1.id}`,{version:1,action:'approve',note:'Synthetic non-admin approval must fail.',sourceChecked:true,reuseAuthorised:true})).status,403);
    assert.equal((await call(`/api/knowledge/${v1.id}`,{version:1,action:'approve',note:'Service tokens cannot approve sources.',sourceChecked:true,reuseAuthorised:true},'tester@mindmapdigital.ai',true)).status,401);
    assert.equal((await call(`/api/knowledge/${v1.id}`,{version:1,action:'approve',note:'Source reuse consent is deliberately absent.',sourceChecked:true},'admin-tester@mindmapdigital.ai')).status,409);
    const target=await create('LOCAL KNOWLEDGE TARGET — not a client');
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:target.version,versionIds:[v1.id]})).status,409);
    const firstApproval=await approve(v1);assert.equal(firstApproval.status,200);assert.equal(firstApproval.body.version.approved_by,'admin-tester@mindmapdigital.ai');
    const download=await fetch(new URL(`/api/knowledge/${v1.id}/file`,origin),{headers:{Cookie:`zora_session=${cookies['outsider@mindmapdigital.ai']}`,Range:`bytes=0-${bytes.length-1}`}});assert.equal(download.status,206);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:target.version,versionIds:[v1.id]})).status,200);
    const snapshot=(await call(`/api/cases/${target.id}`)).body;assert.equal(snapshot.sources.length,2);assert.ok(snapshot.sources.every((s:any)=>s.active));assert.equal(snapshot.case.sourceRevision,2);
    const sourceRows=(await db.query('SELECT * FROM zora_sources WHERE case_id=$1',[target.id])).rows;assert.ok(sourceRows.some(r=>r.data.equals(bytes)));const pinned=sourceRows.find(r=>r.filename.endsWith('.json'));assert.equal(JSON.parse(pinned.data.toString()).knowledge.versionId,v1.id);assert.equal(JSON.parse(pinned.data.toString()).approval.actor,'admin-tester@mindmapdigital.ai');
    await db.query("UPDATE zora_sources SET provenance=jsonb_set(provenance,'{knowledge,versionId}',to_jsonb($2::text)) WHERE id=$1",[pinned.id,randomUUID()]);assert.ok((await knowledgeHolds(db,target.id))[0].includes('missing'));
    await db.query('UPDATE zora_sources SET provenance=$2 WHERE id=$1',[pinned.id,JSON.stringify(pinned.provenance)]);
    await db.query("UPDATE zora_sources SET provenance=jsonb_set(provenance,'{knowledge,sha256}',to_jsonb($2::text)) WHERE id=$1",[pinned.id,'0'.repeat(64)]);assert.ok((await knowledgeHolds(db,target.id))[0].includes('integrity'));
    await db.query('UPDATE zora_sources SET provenance=$2 WHERE id=$1',[pinned.id,JSON.stringify(pinned.provenance)]);
    const v2Response=await call('/api/knowledge',{...input,entryId:v1.entry_id,expectedVersion:1,notes:'Synthetic revised note; original file bytes remain unchanged.'});assert.equal(v2Response.status,201);const v2=v2Response.body.version;
    assert.equal((await call('/api/knowledge',{...input,entryId:v1.entry_id,expectedVersion:1})).status,409);
    assert.equal((await approve(v1)).status,409);assert.equal((await approve(v2)).status,200);
    assert.equal((await db.query('SELECT status FROM zora_knowledge_versions WHERE id=$1',[v1.id])).rows[0].status,'superseded');assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_knowledge_versions WHERE entry_id=$1 AND status=$2',[v1.entry_id,'approved'])).rows[0].n,1);
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:snapshot.case.version,versionIds:[v1.id]})).status,409);
    assert.equal((await call(`/api/cases/${target.id}/decision`,{version:snapshot.case.version,action:'confirm'})).status,200);
    const job=(await call('/api/worker/claim',{workerId:'local-knowledge-fixture',contextId:'synthetic-knowledge-'+randomUUID()},'tester@mindmapdigital.ai',true)).body.job;assert.equal(job.case.id,target.id);assert.equal(job.sources.length,2);assert.ok(job.sources.some((s:any)=>s.provenance?.knowledge?.versionId===v1.id));
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:snapshot.case.version,retireEntryIds:[v1.entry_id],note:'Retirement while running must be rejected.'})).status,409);
    assert.equal((await call(`/api/knowledge/${v1.id}`,{version:1,action:'revoke',note:'Synthetic source withdrawal during a leased task.'},'admin-tester@mindmapdigital.ai')).status,200);
    const done=await call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result:{status:'completed',summary:'Synthetic stage fixture. This is not actual company research.',missingInputs:[],outputFiles:[],citations:[],reviewReports:[]}},'tester@mindmapdigital.ai',true);assert.equal(done.status,200);assert.equal(done.body.resultStatus,'blocked','A model-supplied completion cannot override source withdrawal');
    const withdrawn=(await call(`/api/cases/${target.id}`)).body;assert.equal(withdrawn.sourceNotices.length,1);assert.ok(withdrawn.blockedTask.missing_inputs.some((s:string)=>s.includes('withdrawn')));
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:snapshot.case.version,versionIds:[v2.id]})).status,409);
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:withdrawn.case.version,versionIds:[v2.id]})).status,200);
    const updated=(await call(`/api/cases/${target.id}`)).body;assert.equal(updated.sourceNotices.length,0);assert.equal(updated.sources.filter((s:any)=>s.active).length,2);assert.equal(updated.sources.length,3);assert.equal(updated.sources.find((s:any)=>s.id===pinned.id).active,false);assert.deepEqual((await db.query('SELECT data FROM zora_sources WHERE id=$1',[pinned.id])).rows[0].data,pinned.data);
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:updated.case.version,retireEntryIds:[v1.entry_id]})).status,400,'Retirement requires a reason');
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:updated.case.version,retireEntryIds:[v1.entry_id],note:'Unassigned retirement must fail.'},'outsider@mindmapdigital.ai')).status,403);
    assert.equal((await call(`/api/cases/${target.id}/knowledge`,{version:updated.case.version,retireEntryIds:[v1.entry_id],note:'Synthetic retirement preserves all earlier source bytes.'})).status,200);
    const retired=(await call(`/api/cases/${target.id}`)).body;assert.equal(retired.sources.filter((s:any)=>s.active).length,0);assert.equal(retired.sources.length,3);assert.equal((await call(`/api/cases/${target.id}/pack`)).body.sources.length,0);
    const {glob}=await import('node:fs/promises');let originalBrd='';for await(const path of glob('AI_Solutioning_Agent_BRD_v1.0/01_BRD/*.docx'))originalBrd=path;
    assert.ok(originalBrd);const brdId=await source(originCase,'BRD.docx',await readFile(originalBrd),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.equal((await call('/api/knowledge',{...input,kind:'proposal_template',claim:undefined,sourceId:brdId})).status,400);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=ANY($1::uuid[])',[cases])).rows[0].n,0);
    const third=await call('/api/knowledge',{...input,entryId:v1.entry_id,expectedVersion:2,notes:'Synthetic browser source-review fixture only.'});assert.equal(third.status,201);const v3=third.body.version;
    if(process.env.ZORA_UI_VERIFY==='1'){
      const browserModule='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(browserModule);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
      try{
        const errors:string[]=[];const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1100}});await context.addCookies([{name:'zora_session',value:cookies['admin-tester@mindmapdigital.ai'],url:origin.origin}]);const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(origin.origin);await page.getByRole('button',{name:'Knowledge',exact:true}).click();await page.getByRole('button',{name:/LOCAL COMPANY CLAIM/}).click();await page.getByRole('button',{name:'Check source file',exact:true}).waitFor();await page.getByText('Synthetic browser source-review fixture only.',{exact:true}).waitFor();
        const approval=page.getByRole('button',{name:'Approve source reuse'});assert.equal(await approval.isDisabled(),true);const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Check source file',exact:true}).click();assert.equal((await downloaded).suggestedFilename(),'synthetic-company.txt');await page.getByLabel('Decision note').fill('Synthetic local UI source review and explicit team reuse only.');assert.equal(await approval.isDisabled(),true);await page.getByRole('checkbox',{name:/I checked the actual file/}).check();await page.getByRole('checkbox',{name:/I authorise this source/}).check();await approval.click();await page.getByRole('button',{name:'Withdraw this version'}).waitFor();await page.screenshot({path:'/workspace/solve-environment/zora-knowledge-library.png',fullPage:true});
        const mobile=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});await mobile.addCookies([{name:'zora_session',value:cookies['tester@mindmapdigital.ai'],url:origin.origin}]);const mobilePage=await mobile.newPage();mobilePage.on('pageerror',(e:Error)=>errors.push(e.message));await mobilePage.goto(origin.origin);await mobilePage.getByRole('button',{name:'Knowledge',exact:true}).click();await mobilePage.getByRole('button',{name:/LOCAL COMPANY CLAIM/}).click();await mobilePage.getByRole('button',{name:'Check source file',exact:true}).waitFor();assert.equal(await mobilePage.getByRole('button',{name:'Approve source reuse'}).count(),0);assert.ok(await mobilePage.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
        console.log('Compiled library browser passed: source/version/quote display, hash-checked file download, mandatory consent controls, real role-gated synthetic UI approval, mobile width/role privacy and zero page errors. Local fixture only.');
      }finally{await browser.close();}
    }else assert.equal((await approve(v3)).status,200);
    const own=(await call(`/api/cases/${originCase.id}`)).body.case;assert.equal((await call(`/api/cases/${originCase.id}/knowledge`,{version:own.version,versionIds:[v3.id]})).status,200);
    // Hold the originating pursuit while withdrawal begins. The source row lock must
    // precede the knowledge write, so a gate's source check cannot form a lock cycle.
    const locked=await db.connect();let revoke:ReturnType<typeof call>|undefined;
    try{
      await locked.query('BEGIN');await locked.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[originCase.id]);
      revoke=call(`/api/knowledge/${v3.id}`,{version:3,action:'revoke',note:'Synthetic concurrent withdrawal verifies source/gate lock order.'},'admin-tester@mindmapdigital.ai');
      let waiting=false;for(let n=0;n<30;n++){waiting=!!(await db.query("SELECT 1 FROM pg_stat_activity WHERE state='active' AND wait_event_type='Lock' AND query LIKE '%FOR KEY SHARE%' LIMIT 1")).rowCount;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,100));}assert.equal(waiting,true,'Withdrawal must wait on its originating source pursuit before writing knowledge');
      assert.deepEqual(await knowledgeHolds(locked,originCase.id),[]);await locked.query('COMMIT');assert.equal((await revoke).status,200);
    }finally{await locked.query('ROLLBACK');locked.release();if(revoke)await revoke;}
    const withdrawnOwn=(await call(`/api/cases/${originCase.id}`)).body;assert.equal((await call(`/api/cases/${originCase.id}/decision`,{version:withdrawnOwn.case.version,action:'confirm'})).status,409);
    console.log('Concurrent withdrawal/source-check lock ordering passed; withdrawn source also prevents workflow confirmation.');
    console.log('Reusable knowledge checks passed: private drafts, real role-gated source consent, no runner/self approvals, immutable versions/hashes, one current approval, byte-exact team reuse, pinned pursuit snapshots, mid-lease withdrawal hold, guarded retirement/replacement and retained history. Local fixtures only; no real company claim or pilot accepted.');
  }finally{
    for(const entry of entries)await db.query('DELETE FROM zora_knowledge_versions WHERE entry_id=$1',[entry]);
    for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local knowledge fixture failed');process.exitCode=1;});
