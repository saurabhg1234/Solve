/** Local-only ESC-3 isolation fixture; all approvals and task identities are synthetic. */
import { readFile,writeFile,rm,mkdir } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { stagesFor } from '../lib/engine';
async function main(){
 const env=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));if(process.env.ZORA_LOCAL_TEST_ORIGIN)env.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
 const origin=new URL(env.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(env.DATABASE_URL).hostname,'127.0.0.1');
 const db=new Pool({connectionString:env.DATABASE_URL}),cases:string[]=[],cookies:Record<string,string>={},root='/workspace/solve-environment/trust-reset-fixture-'+randomUUID();
 for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic trust reset test'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(env.ZORA_SESSION_SECRET));
 async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
  const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};
 }
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 async function seed(){
  const r=await call('/api/cases',{workflow:'W3',title:'LOCAL FRESH DRAFTER VERIFICATION — synthetic',client:'Synthetic only',briefing:'OLD_BRIEF_CANARY: this must not appear in the isolated packet.'});assert.equal(r.status,201);const id=r.body.case.id;cases.push(id);
  await db.query("UPDATE zora_cases SET status='awaiting_approval',stage_index=$2 WHERE id=$1",[id,stagesFor('W3').findIndex(s=>s.id==='W3-G3')]);
  const source=randomUUID(),sourceBytes=Buffer.from('Synthetic source requires a complete response.');await db.query("INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,'source.txt','text/plain',$3,$4)",[source,id,sourceBytes,hash(sourceBytes)]);
  const job=randomUUID(),lease=randomUUID(),context='original-'+randomUUID(),artifact=randomUUID(),bytes=Buffer.from('OLD_DRAFT_CANARY: synthetic draft.');
  await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id,result) VALUES($1,$2,'W3-14',1,1,'completed',$3,$4,'{\"summary\":\"OLD_REASONING_CANARY\"}')",[job,id,lease,context]);
  await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path) VALUES($1,$2,$3,'draft.txt','text/plain','client',$4,$5,$6,1,1,'draft','outputs/client/draft.txt')",[artifact,id,job,bytes,hash(bytes),lease]);
  assert.equal((await call(`/api/cases/${id}/decision`,{action:'reject',version:1,note:'Synthetic omitted requirement needs a trust reset.',findings:[{artifactId:artifact,location:'Line 1',severity:'major',scope:'document',description:'Synthetic source requirement omitted.',evidence:'Source requires a complete response.'}]})).status,200);
  const feedback=(await call(`/api/cases/${id}`)).body.gateFeedback[0];return {id,source,sourceBytes,job,lease,context,artifact,sha256:hash(bytes),feedback};
 }
 async function baseline(f:any){
  const job=randomUUID(),lease=randomUUID(),id=randomUUID(),bytes=Buffer.from('Locked baseline: all required sections and traceable source coverage.');
  await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id) VALUES($1,$2,'W3-6',1,1,'completed',$3,$4)",[job,f.id,lease,'baseline-'+randomUUID()]);
  await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path) VALUES($1,$2,$3,'baseline.txt','text/plain','internal',$4,$5,$6,1,1,'reference','outputs/internal/baseline.txt')",[id,f.id,job,bytes,hash(bytes),lease]);return {id,bytes};
 }
 async function explanation(f:any){assert.equal((await call(`/api/worker/${f.job}/escalations`,{action:'explain',leaseId:f.lease,contextId:f.context,explanations:[{feedbackId:f.feedback.id,findingIndex:0,artifactId:f.artifact,sha256:f.sha256,cause:'missed',rootCause:'The synthetic requirement was absent from the draft.',whyChecksMissedIt:'The synthetic source coverage check did not detect the omission.',correctionPlan:'Re-evaluate all required sections from the locked baseline.'}]},true)).status,200);}
 const claim=async(contextId?:string)=>call('/api/worker/claim',{workerId:'local-reset-fixture',...(contextId?{contextId}:{})},true);
 const detail=async(id:string,email?:string)=>(await call(`/api/cases/${id}`,undefined,false,email)).body;
 async function upload(job:any){
  const bytes=Buffer.from('Regenerated synthetic whole-document draft. All required sections are represented for protocol testing only.');const file={path:'outputs/client/regenerated.txt',mimeType:'text/plain',visibility:'client',purpose:'draft'};
  const initial=await call(`/api/worker/${job.id}/uploads`,{...file,filename:'regenerated.txt',leaseId:job.leaseId,totalBytes:bytes.length,sha256:hash(bytes)},true);assert.equal(initial.status,201);
  const r=await fetch(new URL(`/api/worker/${job.id}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`,'x-zora-lease':job.leaseId,'x-zora-offset':'0'},body:new Uint8Array(bytes)});assert.equal(r.status,200);assert.equal((await call(`/api/worker/${job.id}/uploads/${initial.body.id}`,{leaseId:job.leaseId},true)).status,200);return file;
 }
 try{
  const f=await seed(),route=`/api/cases/${f.id}/trust-reset`,request={version:2,feedbackId:f.feedback.id};
  assert.equal((await call(route,request,false,'outsider@mindmapdigital.ai')).status,403);assert.equal((await call(route,request)).status,409);await explanation(f);assert.equal((await call(route,request)).status,409);
  const b=await baseline(f);assert.equal((await call(route,request)).status,409);
  await db.query("UPDATE zora_artifacts SET created_at='2026-01-01T00:00:00.000900Z' WHERE id=$1",[b.id]);
  await db.query("INSERT INTO zora_approvals(case_id,stage_id,version,actor,role,created_at) VALUES($1,'W3-G1',1,'tester@mindmapdigital.ai','consultant','2026-01-01T00:00:00.000950Z')",[f.id]);
  const qcRun=randomUUID(),reviewId=randomUUID(),reviewContext='earlier-review-'+randomUUID();
  await db.query("INSERT INTO zora_qc_runs(id,case_id,job_id,case_version,source_revision,creator_context,state,packet,packet_hash) VALUES($1,$2,$3,1,1,$4,'blocked','{\"elements\":[],\"files\":[],\"stageId\":\"W3-18\"}',$5)",[qcRun,f.id,f.job,f.context,'0'.repeat(64)]);
  await db.query("INSERT INTO zora_reviews(id,run_id,case_id,checker,pass_number,method,loop_number,state) VALUES($1,$2,$3,'D6',1,'Synthetic earlier reviewer',1,'blocked')",[reviewId,qcRun,f.id]);
  await db.query('INSERT INTO zora_review_contexts(case_id,context_id,review_id) VALUES($1,$2,$3)',[f.id,reviewContext,reviewId]);
  const expiredProducer='expired-producer-'+randomUUID();await db.query('INSERT INTO zora_draft_contexts(case_id,context_id,job_id) VALUES($1,$2,$3)',[f.id,expiredProducer,f.job]);
  const queued=await Promise.all([call(route,request),call(route,request)]);assert.deepEqual(queued.map(r=>r.status).sort(),[200,409]);
  assert.equal((await claim(f.context)).body.job,null);assert.equal((await claim(reviewContext)).body.job,null);assert.equal((await claim(expiredProducer)).body.job,null);assert.equal((await claim()).body.job,null);
  const attempt='expired-reset-'+randomUUID(),first=(await claim(attempt)).body.job;assert.equal(first.stage.id,'ESC-3');
  await db.query("UPDATE zora_jobs SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",[first.id]);assert.equal((await claim(attempt)).body.job,null);
  // Invoke the real bounded native bridge in a different synthetic context.
  // Mailbox maintenance is separately verified; stub only that unrelated loopback call.
  await mkdir(root,{recursive:true,mode:0o700});const maintenanceFixture=root+'/maintenance.mjs';
  await writeFile(maintenanceFixture,`if(new URL(process.env.ZORA_APP_URL).hostname!=='127.0.0.1')throw new Error('Local fixture only');const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const url=new URL(input);if(url.origin===new URL(process.env.ZORA_APP_URL).origin&&url.pathname==='/api/microsoft/maintenance')return Response.json({subscription:{renewed:false},sync:{synced:0}});return original(input,init);};`,{mode:0o600});
  const nativeContext='fresh-reset-'+randomUUID();const run=spawnSync(process.execPath,['--import',maintenanceFixture,'--import','tsx','scripts/cloud_routine.ts','claim'],{env:{...process.env,...env,NODE_USE_ENV_PROXY:'',VERCEL_TOKEN:'',ZORA_NOTIFICATION_BYPASS:'',CODEX_THREAD_ID:nativeContext,ZORA_WORK_ROOT:root},encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const output=run.stdout.trim().split('\n').map(s=>JSON.parse(s)).find(v=>v.workspace);const dir=output.workspace;const job=JSON.parse(await readFile(dir+'/request.json','utf8'));assert.equal(job.id,first.id);assert.equal(job.stage.id,'ESC-3');
  for(const canary of ['OLD_BRIEF_CANARY','OLD_REASONING_CANARY','OLD_DRAFT_CANARY'])assert.ok(!JSON.stringify(job).includes(canary));assert.ok(!('prior' in job));assert.ok(!('gateFeedback' in job));assert.equal(job.sources.length,1);assert.equal(job.artifacts.length,1);assert.equal(job.artifacts[0].id,b.id);
  assert.deepEqual(await readFile(dir+'/sources/'+f.source+'.source'),f.sourceBytes);assert.deepEqual(await readFile(dir+'/artifacts/'+b.id+'.source'),b.bytes);
  const headers={Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`};assert.equal((await fetch(new URL(`/api/worker/${job.id}/artifacts/${f.artifact}?leaseId=${job.leaseId}`,origin),{headers})).status,403);
  assert.equal((await call(`/api/worker/${job.id}/heartbeat`,{leaseId:first.leaseId},true)).status,409);
  const report={packetHash:job.trustReset.packetHash,checkedSourceIds:[f.source],checkedBaselineIds:[b.id],sections:[{section:'Requirements and approach',assessment:'PRIVATE_RESET_NOTE: the synthetic requirements were checked.',changes:'The omitted synthetic requirement is now represented.'}],findingResponses:[{findingIndex:0,correction:'The missing synthetic source requirement was restored.'}]};
  const result={status:'completed',summary:'Synthetic re-evaluation protocol, not semantic acceptance.',missingInputs:[],outputFiles:[],citations:[],reviewReports:[],resetReport:report};
  const complete=(r:any)=>call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result:r},true);
  assert.equal((await complete(result)).status,422);const file=await upload(job);assert.equal((await complete({...result,outputFiles:[file],missingInputs:['A source still needs clarification.']})).status,422);
  for(const changed of [{...report,packetHash:'0'.repeat(64)},{...report,checkedSourceIds:[f.source,f.source]},{...report,checkedBaselineIds:[f.artifact]},{...report,findingResponses:[]},{...report,sections:[]}])assert.ok([400,422].includes((await complete({...result,outputFiles:[file],resetReport:changed})).status));
  await writeFile(dir+'/outputs/client/regenerated.txt','Regenerated synthetic whole-document draft. All required sections are represented for protocol testing only.',{mode:0o600});await writeFile(dir+'/result.json',JSON.stringify({...result,outputFiles:[file]}),{mode:0o600});
  const completion=spawnSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts','complete',dir],{env:{...process.env,...env,NODE_USE_ENV_PROXY:'',VERCEL_TOKEN:'',ZORA_NOTIFICATION_BYPASS:'',CODEX_THREAD_ID:nativeContext,ZORA_WORK_ROOT:root},encoding:'utf8'});assert.equal(completion.status,0,completion.stderr);const done=JSON.parse(completion.stdout);assert.equal(done.escalationResolved,false);assert.equal(done.independentRerunRequired,true);assert.equal((await complete({...result,outputFiles:[file]})).status,409);
  let d=await detail(f.id);assert.equal(d.case.status,'blocked');assert.equal(d.gateFeedback[0].state,'open');assert.equal(d.gateFeedback[0].resetRuns[0].state,'completed');assert.equal(d.gateFeedback[0].resetRuns[0].report,null);assert.ok(!JSON.stringify(d).includes('PRIVATE_RESET_NOTE'));assert.ok(!JSON.stringify((await call(`/api/cases/${f.id}/pack`)).body).includes('PRIVATE_RESET_NOTE'));
  await call(`/api/cases/${f.id}/team`,{emails:['pricing-tester@mindmapdigital.ai']});assert.ok(JSON.stringify(await detail(f.id,'pricing-tester@mindmapdigital.ai')).includes('PRIVATE_RESET_NOTE'));
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback.id})).status,409);
  await db.query("UPDATE zora_cases SET status='awaiting_approval' WHERE id=$1",[f.id]);assert.equal((await call(`/api/cases/${f.id}/decision`,{version:d.case.version,action:'approve'})).status,409);
  // A revision cancels a leased reset, preserves its context exclusion and retains the escalation.
  const g=await seed();await db.query("UPDATE zora_cases SET title='LOCAL REVISION RESET — synthetic' WHERE id=$1",[g.id]);await explanation(g);await baseline(g);await db.query("INSERT INTO zora_approvals(case_id,stage_id,version,actor,role) VALUES($1,'W3-G1',1,'tester@mindmapdigital.ai','consultant')",[g.id]);
  if(process.env.ZORA_LOCAL_BROWSER==='1'){
   const modulePath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(modulePath);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
   try{const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies([{name:'zora_session',value:cookies['tester@mindmapdigital.ai'],url:origin.origin}]);const page=await context.newPage();await page.goto(origin.origin);await page.getByRole('button',{name:/LOCAL REVISION RESET/}).click();await page.getByRole('button',{name:'Start fresh re-evaluation',exact:true}).click();await page.getByText('Fresh drafter queued',{exact:true}).waitFor();}finally{await browser.close();}
  }else assert.equal((await call(`/api/cases/${g.id}/trust-reset`,{version:2,feedbackId:g.feedback.id})).status,200);
  const old=(await claim('revision-reset-'+randomUUID())).body.job;
  assert.equal((await call(`/api/cases/${g.id}/revision`,{version:3,action:'revise',note:'New sources invalidate the isolated packet and lease.'})).status,200);assert.equal((await call(`/api/worker/${old.id}/heartbeat`,{leaseId:old.leaseId},true)).status,409);assert.equal((await detail(g.id)).gateFeedback[0].state,'open');
  if(process.env.ZORA_LOCAL_BROWSER==='1'){
   const modulePath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(modulePath);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors:string[]=[];
   try{for(const [width,email]of [[1440,'pricing-tester@mindmapdigital.ai'],[390,'tester@mindmapdigital.ai']] as const){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});await context.addCookies([{name:'zora_session',value:cookies[email],url:origin.origin}]);const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(origin.origin);await page.getByRole('button',{name:/LOCAL FRESH DRAFTER VERIFICATION/}).first().click();try{await page.getByText('Re-evaluation recorded — independent checks pending',{exact:true}).waitFor();}catch(e){await page.screenshot({path:'/workspace/solve-environment/zora-reset-browser-failure.png',fullPage:true});console.error(JSON.stringify({pageErrors:errors,body:(await page.locator('body').innerText()).slice(-5000)}));throw e;}if(width===1440){await page.getByText('Internal re-evaluation note',{exact:true}).click();await page.getByText('Requirements and approach',{exact:true}).waitFor();await page.locator('.gate-feedback').screenshot({path:'/workspace/solve-environment/zora-trust-reset.png'});}else assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_RESET_NOTE'));assert.ok(await page.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));await context.close();}assert.deepEqual(errors,[]);}finally{await browser.close();}
   console.log('Compiled trust-reset views passed: readable section notes, internal privacy, desktop/mobile and no page errors.');
  }
  console.log('Local ESC-3 protocol passed: source/approved-baseline packet, concurrent queueing, original/expired context denial, native claim/download hashes, old-draft exclusion, bounded report coverage, stored draft, internal notes, replay/revision denial and retained escalation. Synthetic protocol only; ESC-4 and semantic acceptance remain pending.');
 }finally{
  for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();await rm(root,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:'Local trust reset checks failed');process.exitCode=1;});
