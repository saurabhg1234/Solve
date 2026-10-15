/** Synthetic protocol checks only; refuses non-loopback deployment/database. */
import { readFile,mkdir,writeFile,rm } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { stagesFor } from '../lib/engine';

async function main(){
 const env=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
 if(process.env.ZORA_LOCAL_TEST_ORIGIN)env.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
 const origin=new URL(env.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(env.DATABASE_URL).hostname,'127.0.0.1');
 const db=new Pool({connectionString:env.DATABASE_URL}),cases:string[]=[],cookies:Record<string,string>={};
 const root=(process.env.ZORA_LOCAL_WORK_ROOT||'/workspace/solve-environment')+'/explanation-fixture-'+randomUUID();
 for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic explanation test'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(env.ZORA_SESSION_SECRET));
 async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
  const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};
 }
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 async function seed(){
  const r=await call('/api/cases',{workflow:'W3',title:'LOCAL EXPLANATION VERIFICATION — synthetic',client:'Synthetic only',briefing:'Protocol fixture only. Prior drafting and semantic review are unrun. No genuine proposal or approval.'});assert.equal(r.status,201);const id=r.body.case.id;cases.push(id);
  await db.query("UPDATE zora_cases SET status='awaiting_approval',stage_index=$2 WHERE id=$1",[id,stagesFor('W3').findIndex(s=>s.id==='W3-G3')]);
  const producers=[];
  for(let i=0;i<2;i++){
   const job=randomUUID(),lease=randomUUID(),context='synthetic-drafter-'+randomUUID(),artifact=randomUUID(),bytes=Buffer.from('Synthetic file '+i);
   await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id) VALUES($1,$2,'W3-14',1,1,'completed',$3,$4)",[job,id,lease,context]);
   await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path) VALUES($1,$2,$3,$4,'text/plain','client',$5,$6,$7,1,1,'draft',$8)",[artifact,id,job,`draft-${i}.txt`,bytes,hash(bytes),lease,`outputs/client/draft-${i}.txt`]);
   producers.push({job,lease,context,artifact,sha256:hash(bytes)});
  }
  const findings=producers.map(p=>({artifactId:p.artifact,location:'Line 1',severity:'major',scope:'document',description:'Synthetic source requirement omitted.',evidence:'Synthetic source states the missing item.'}));
  assert.equal((await call(`/api/cases/${id}/decision`,{action:'reject',version:1,note:'Two files require an explanation and trust reset.',findings})).status,200);
  const feedback=(await call(`/api/cases/${id}`)).body.gateFeedback[0];return {id,producers,feedback};
 }
 const explain=(feedbackId:string,p:any,index:number)=>({feedbackId,findingIndex:index,artifactId:p.artifact,sha256:p.sha256,cause:'missed',rootCause:'PRIVATE_EXPLANATION_CANARY: the synthetic requirement was omitted.',whyChecksMissedIt:'The synthetic checklist did not cover this source requirement.',correctionPlan:'Recheck all sections against the synthetic source and baseline.'});
 function native(action:string,dir:string,context:string,plan?:string){
  return spawnSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts',action,dir,...(plan?[plan]:[])],{cwd:process.cwd(),env:{...process.env,...env,NODE_USE_ENV_PROXY:'',VERCEL_TOKEN:'',ZORA_NOTIFICATION_BYPASS:'',CODEX_THREAD_ID:context,ZORA_WORK_ROOT:root},encoding:'utf8'});
 }
 try{
  const f=await seed(),p=f.producers[0],q=f.producers[1],route=`/api/worker/${p.job}/escalations`,identity={leaseId:p.lease,contextId:p.context};
  assert.equal((await call(route,{...identity,action:'read'})).status,401);
  for(const wrong of [{...identity,contextId:q.context},{...identity,leaseId:randomUUID()}])assert.equal((await call(route,{...wrong,action:'read'},true)).status,409);
  let response=await call(route,{...identity,action:'read'},true);assert.equal(response.status,200);assert.equal(response.body.escalations[0].findings.length,1);assert.equal(response.body.escalations[0].findings[0].artifactId,p.artifact);assert.ok(!JSON.stringify(response.body).includes(q.artifact));
  const item=explain(f.feedback.id,p,0),post=(items:any[])=>call(route,{...identity,action:'explain',explanations:items},true);
  for(const bad of [{...item,sha256:'0'.repeat(64)},{...item,findingIndex:1},{...item,feedbackId:randomUUID()},explain(f.feedback.id,q,1)])assert.equal((await post([bad])).status,422);
  for(const bad of [{...item,cause:'unknown'},{...item,rootCause:''},{...item,escalationResolved:true}])assert.equal((await post([bad])).status,400);
  assert.equal((await post([item,item])).status,400);
  assert.equal((await post([item,explain(f.feedback.id,q,1)])).status,422);
  assert.equal((await call(`/api/cases/${f.id}`)).body.gateFeedback[0].explanationCount,0,'A mixed unauthorized batch must roll back the first explanation');
  const concurrent=await Promise.all([post([item]),post([item])]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal((await post([item])).status,409);
  response=await call(`/api/cases/${f.id}`);assert.equal(response.body.gateFeedback[0].explanationCount,1);assert.equal(response.body.gateFeedback[0].explanations,null);assert.ok(!JSON.stringify(response.body).includes('PRIVATE_EXPLANATION_CANARY'));assert.ok(!JSON.stringify((await call(`/api/cases/${f.id}/pack`)).body).includes('PRIVATE_EXPLANATION_CANARY'));
  assert.equal((await call(`/api/cases/${f.id}`,undefined,false,'outsider@mindmapdigital.ai')).status,403);
  assert.equal((await call(`/api/cases/${f.id}/team`,{emails:['pricing-tester@mindmapdigital.ai']})).status,200);
  assert.ok(JSON.stringify((await call(`/api/cases/${f.id}`,undefined,false,'pricing-tester@mindmapdigital.ai')).body).includes('PRIVATE_EXPLANATION_CANARY'));
  // A real native CLI invocation uses its original request workspace, without another claim or renewed stage lease.
  const dir=root+'/original';await mkdir(dir,{recursive:true,mode:0o700});
  await writeFile(dir+'/request.json',JSON.stringify({kind:'stage',id:q.job,leaseId:q.lease,contextId:q.context,case:{id:f.id,title:'Synthetic',workflow:'W3'},stage:{id:'W3-14',title:'Synthetic draft'},instructions:'Synthetic protocol only',requiresIndependentReview:false,sources:[],artifacts:[]}),{mode:0o600});
  let run=native('escalations',dir,q.context);assert.equal(run.status,0,run.stderr);const packet=JSON.parse(await readFile(dir+'/escalations.json','utf8'));assert.equal(packet.escalations[0].findings[0].findingIndex,1);assert.equal(packet.escalations[0].explanations.length,0);
  await writeFile(dir+'/explanation.json',JSON.stringify([explain(f.feedback.id,q,1)]),{mode:0o600});
  assert.notEqual(native('explain',dir,p.context,'explanation.json').status,0);
  const outside=root+'/outside.json';await writeFile(outside,'[]',{mode:0o600});assert.notEqual(native('explain',dir,q.context,'../outside.json').status,0);
  run=native('explain',dir,q.context,'explanation.json');assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).escalationResolved,false);
  response=await call(`/api/cases/${f.id}`);assert.equal(response.body.case.status,'blocked');assert.equal(response.body.gateFeedback[0].explanationCount,2);assert.equal(response.body.gateFeedback[0].state,'open');
  assert.equal((await call(`/api/cases/${f.id}/revision`,{action:'rework',version:2,feedbackId:f.feedback.id,note:'Explanation alone must not authorize ordinary rework.'})).status,409);
  assert.equal((await call(`/api/cases/${f.id}/revision`,{action:'revise',version:2,note:'Preserve explanations when opening a source revision.'})).status,200);
  assert.equal((await call(`/api/cases/${f.id}`)).body.gateFeedback[0].explanationCount,2);
  await db.query("UPDATE zora_cases SET stage_index=$2,status='awaiting_approval' WHERE id=$1",[f.id,stagesFor('W3').findIndex(s=>s.id==='W3-G3')]);
  assert.equal((await call(`/api/cases/${f.id}/decision`,{action:'approve',version:3})).status,409);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=$1',[f.id])).rows[0].n,0);
  assert.equal((await call(route,{...identity,action:'read'},true)).body.escalations[0].explanations.length,1);
  await db.query("UPDATE zora_jobs SET state='blocked' WHERE id=$1",[p.job]);assert.equal((await call(route,{...identity,action:'read'},true)).status,409);
  await db.query("UPDATE zora_jobs SET state='completed',context_id=NULL WHERE id=$1",[p.job]);assert.equal((await call(route,{...identity,action:'read'},true)).status,409);
  if(process.env.ZORA_LOCAL_BROWSER==='1'){
   const modulePath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(modulePath);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors:string[]=[];
   try{for(const [width,email]of [[1440,'pricing-tester@mindmapdigital.ai'],[390,'tester@mindmapdigital.ai']] as const){
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});await context.addCookies([{name:'zora_session',value:cookies[email],url:origin.origin}]);const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(origin.origin);await page.getByRole('button',{name:/LOCAL EXPLANATION VERIFICATION/}).click();await page.getByText('Drafter explanations: 2 of 2 recorded.',{exact:true}).waitFor();
    if(width===1440){await page.locator('.escalation-explanations summary').first().click();await page.getByText(/PRIVATE_EXPLANATION_CANARY/).first().waitFor();await page.locator('.gate-feedback').screenshot({path:'/workspace/solve-environment/zora-explanation-feedback.png'});}else assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_EXPLANATION_CANARY'));
    assert.ok(await page.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));assert.equal(await page.getByRole('button',{name:'Start correction',exact:true}).count(),0);await context.close();
   }assert.deepEqual(errors,[]);}finally{await browser.close();}
   console.log('Compiled explanation UI passed: internal detail, consultant redaction, desktop/mobile and retained escalation hold.');
  }
  console.log('Local ESC-2 protocol passed: original task/lease/file identity, scoped findings, batch rollback, immutable concurrent writes, native CLI and path/context guards, privacy and persistent approval block. Synthetic identities only; no fresh-drafter ESC-3/4 acceptance.');
 }finally{
  for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();await rm(root,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Local explanation checks failed');process.exitCode=1;});
