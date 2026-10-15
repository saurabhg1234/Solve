/** Synthetic protocol/permission fixtures only; never point at production. */
import { readFile,mkdir,writeFile,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { brandedEmail } from '../lib/email';
import { downloadFiles } from '../worker/transport';

async function main(){
  const s=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
  if(process.env.ZORA_LOCAL_TEST_ORIGIN)s.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin=new URL(s.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');
  const db=new Pool({connectionString:s.DATABASE_URL}),cases:string[]=[];
  const privateRoot=resolve(`.zora/local-qc-${randomUUID()}`);
  const sessions:Record<string,string>={};
  for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])sessions[email]=await new SignJWT({name:'Synthetic local reviewer test'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(s.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
    const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${s.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${sessions[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Local fixture ${path}: HTTP ${r.status}, non-JSON response (${text.length} bytes)`);}return {status:r.status,body:data};
  }
  async function upload(base:string,bytes:Buffer,metadata:any,worker=false){
    const initial=await call(base,{...metadata,totalBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},worker);assert.equal(initial.status,201);
    const r=await fetch(new URL(`${base}/${initial.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,'x-zora-offset':'0',...(worker?{Authorization:`Bearer ${s.ZORA_RUNNER_TOKEN}`,'x-zora-lease':metadata.leaseId}:{Cookie:`zora_session=${sessions['tester@mindmapdigital.ai']}`})},body:new Uint8Array(bytes)});assert.equal(r.status,200);
    const saved=await call(`${base}/${initial.body.id}`,worker?{leaseId:metadata.leaseId}:{},worker);assert.equal(saved.status,200);return initial.body.id;
  }
  const done={status:'completed',summary:'Synthetic local stage fixture, not a real client result.',missingInputs:[],outputFiles:[] as any[],citations:[],reviewReports:[]};
  async function prepare(policy:boolean,internal=false){
    const created=await call('/api/cases',{title:'LOCAL QC VERIFICATION — not a proposal',client:'Synthetic client only',workflow:'W8',briefing:'This fixture checks independent review protocol and permissions. No actual Codex review or client communication is claimed.'});assert.equal(created.status,201);const id=created.body.case.id;cases.push(id);
    assert.equal((await call(`/api/cases/${id}/revision`,{version:1,action:'revise',note:'Pause the fixture to add explicit source and review settings.'})).status,200);
    await upload(`/api/cases/${id}/uploads`,Buffer.from('Synthetic source: confirm receipt of a document. No price, timeline or free demo is authorised.'),{filename:'source.txt',mimeType:'text/plain',version:2});
    let version=(await call(`/api/cases/${id}`)).body.case.version;
    if(policy){assert.equal((await call(`/api/cases/${id}/qc-policy`,{version,cleanLoops:2,maxLoops:2})).status,200);version++;}
    assert.equal((await call(`/api/cases/${id}/revision`,{version,action:'resume',note:'Fixture sources and explicit policy are ready.'})).status,200);
    assert.equal((await call(`/api/cases/${id}/team`,{emails:['pricing-tester@mindmapdigital.ai']})).status,200);
    const creator=`creator-${randomUUID()}`;let workpaperId='';let runId='';
    for(const stage of ['W8-1','W8-2','W8-3']){
      const job=(await call('/api/worker/claim',{workerId:'local-qc-fixture',contextId:creator},true)).body.job;assert.equal(job.case.id,id);assert.equal(job.stage.id,stage);
      const result={...done,outputFiles:[] as any[]};
      if(stage==='W8-2'){
        const files=[{filename:'email.html',visibility:'client',purpose:'draft',mimeType:'text/html',bytes:Buffer.from(brandedEmail('Synthetic verification only. Thank you; we received the document.'))},{filename:'private-cost.txt',visibility:'internal',purpose:internal?'draft':'workpaper',mimeType:'text/plain',bytes:Buffer.from('PRIVATE_COST_CANARY_1234: synthetic rate 750, hours 999. Not for a client.')},{filename:'earlier-review.json',visibility:'client',purpose:'workpaper',mimeType:'application/json',bytes:Buffer.from('{"priorReasoning":"EARLIER_REVIEW_CANARY"}')}];
        for(const file of files){const path=`outputs/${file.visibility}/${file.filename}`;const artifact=await upload(`/api/worker/${job.id}/uploads`,file.bytes,{...file,path,leaseId:job.leaseId},true);if(file.filename==='private-cost.txt')workpaperId=artifact;result.outputFiles.push({path,visibility:file.visibility,purpose:file.purpose,mimeType:file.mimeType});}
      }
      if(stage==='W8-3')assert.equal((await call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:creator,result:{...result,reviewReports:[{checker:'D8',runId:'fake',checkedElementIds:['fake'],findings:[]}]}},true)).status,400);
      const completed=await call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:creator,result},true);assert.equal(completed.status,200);if(stage==='W8-3'){assert.equal(completed.body.resultStatus,'reviewing');runId=completed.body.reviewRunId;}
    }
    return {id,creator,workpaperId,runId};
  }
  async function claim(contextId=`reviewer-${randomUUID()}`){const r=await call('/api/worker/claim',{workerId:'local-qc-fixture',contextId},true);assert.equal(r.status,200);return r.body.job;}
  async function report(job:any){
    const elements:any[]=[];let offset:number|null=0;
    while(offset!==null){const page=await call(`/api/reviews/${job.id}/inventory?leaseId=${job.leaseId}&offset=${offset}`,undefined,true);assert.equal(page.status,200);assert.equal(page.body.packetHash,job.packetHash);elements.push(...page.body.elements);offset=page.body.nextOffset;}
    return {packetHash:job.packetHash,checkedElementIds:elements.map(e=>e.id),summary:'Synthetic complete coverage fixture; no real reviewer judgement claimed.',findings:[] as any[],missingInputs:[]};
  }
  async function finish(job:any,result:any){return call(`/api/reviews/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result},true);}
  try{
    const clean=await prepare(true);assert.equal(await claim(clean.creator),null,'Drafter cannot become its reviewer');
    let reused='';
    for(let n=0;n<8;n++){
      const job=await claim();assert.equal(job.kind,'review');assert.equal(job.packet.caseId,clean.id);assert.ok(!('prior' in job));assert.ok(!JSON.stringify(job).includes('PRIVATE_COST_CANARY'));assert.ok(!JSON.stringify(job).includes('EARLIER_REVIEW_CANARY'));assert.equal(job.packet.files.some((f:any)=>f.id===clean.workpaperId),false);
      if(n===0){
        reused=job.contextId;
        assert.equal((await call(`/api/reviews/${job.id}/files/artifacts/${clean.workpaperId}?leaseId=${job.leaseId}`,undefined,true)).status,403);
        assert.equal((await call(`/api/reviews/${job.id}/heartbeat`,{leaseId:job.leaseId},true)).status,200);
      }
      const result=await report(job);
      if(n===0){
        assert.equal((await finish(job,{...result,checkedElementIds:result.checkedElementIds.slice(1)})).status,422);
        assert.equal((await finish(job,{...result,checkedElementIds:[...result.checkedElementIds,result.checkedElementIds[0]]})).status,422);
        assert.equal((await finish(job,{...result,packetHash:'0'.repeat(64)})).status,422);
        assert.equal((await call(`/api/reviews/${job.id}/complete`,{leaseId:job.leaseId,contextId:clean.creator,result},true)).status,409);
        assert.equal((await claim(reused)),null,'Same context cannot claim another pass');
      }
      let completed;
      if(n===0){
        const dir=join(privateRoot,'review');await mkdir(dir,{recursive:true,mode:0o700});
        Object.assign(process.env,s);process.env.ZORA_NOTIFICATION_BYPASS='';
        await downloadFiles(job,job.packet.files.filter((f:any)=>f.kind==='sources'),dir,'sources');
        await downloadFiles(job,job.packet.files.filter((f:any)=>f.kind==='artifacts'),dir,'artifacts');
        await writeFile(join(dir,'request.json'),JSON.stringify(job),{mode:0o600});await writeFile(join(dir,'result.json'),JSON.stringify(result),{mode:0o600});
        const child=spawnSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts','complete',dir],{env:{...process.env,...s,CODEX_THREAD_ID:job.contextId,ZORA_WORK_ROOT:privateRoot,ZORA_NOTIFICATION_BYPASS:'',VERCEL_TOKEN:''},encoding:'utf8',timeout:30000});
        assert.equal(child.status,0,'Native review completion bridge must succeed');assert.ok(child.stdout.includes('"kind":"review"'));
        completed={status:200};
      }else completed=await finish(job,result);assert.equal(completed.status,200);
      assert.equal((await finish(job,result)).status,409,'Report replay must fail');
    }
    const gated=(await call(`/api/cases/${clean.id}`)).body;assert.equal(gated.case.status,'awaiting_approval');assert.equal(gated.reviews[0].state,'passed');assert.equal(gated.reviews[0].cleanStreak,2);assert.equal(gated.reviews[0].passes.length,8);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM zora_approvals WHERE case_id=$1',[clean.id])).rows[0].count,0,'QC cannot write human approval');
    assert.equal((await call(`/api/cases/${clean.id}/decision`,{version:gated.case.version,action:'approve'},false,'pricing-tester@mindmapdigital.ai')).status,403);
    assert.equal((await call(`/api/cases/${clean.id}/decision`,{version:gated.case.version,action:'approve'})).status,200);
    assert.equal((await call(`/api/cases/${clean.id}`)).body.case.status,'released','Only the synthetic human action releases this fixture');
    const missing=await prepare(false);let last;
    for(let n=0;n<4;n++){const job=await claim();last=await finish(job,await report(job));assert.equal(last.status,200);}
    assert.equal(last!.body.policyRequired,true);assert.equal((await call(`/api/cases/${missing.id}`)).body.case.status,'blocked');
    const finding=await prepare(true,true);const reviewer=await claim();const result=await report(reviewer);const target=reviewer.packet.files.find((f:any)=>f.id===finding.workpaperId);assert.ok(target);
    result.findings=[{elementId:result.checkedElementIds.find((id:string)=>id.startsWith(finding.workpaperId+'/')),severity:'major',kind:'commercial',description:'PRIVATE_COST_CANARY_1234 must stay internal.',evidence:'Synthetic internal pricing fixture must not enter client copy.'}];assert.equal((await finish(reviewer,result)).body.status,'blocked');
    const owner=(await call(`/api/cases/${finding.id}`)).body;assert.equal(owner.reviews[0].restricted,true);assert.equal(owner.blockedTask.stage_id,'W8-3');assert.ok(!JSON.stringify(owner.reviews).includes('PRIVATE_COST_CANARY_1234'));assert.ok(!JSON.stringify(owner.blockedTask).includes('PRIVATE_COST_CANARY_1234'));
    const pricing=(await call(`/api/cases/${finding.id}`,undefined,false,'pricing-tester@mindmapdigital.ai')).body;assert.ok(JSON.stringify(pricing.reviews).includes('PRIVATE_COST_CANARY_1234'));
    if(process.env.ZORA_UI_VERIFY==='1'){
      const playwrightPath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(playwrightPath);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
      try{
        const errors:string[]=[];
        async function pageFor(email:string,viewport:{width:number;height:number}){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport});await context.addCookies([{name:'zora_session',value:sessions[email],url:s.ZORA_APP_URL}]);const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(s.ZORA_APP_URL);await page.getByRole('button',{name:/LOCAL QC VERIFICATION/}).first().click();await page.getByRole('heading',{name:'Independent review',exact:true}).waitFor();return page;}
        const ownerPage=await pageFor('tester@mindmapdigital.ai',{width:1440,height:1100});await ownerPage.getByText('Detailed findings are restricted to authorised internal reviewers.',{exact:true}).waitFor();assert.ok(!(await ownerPage.locator('body').innerText()).includes('PRIVATE_COST_CANARY_1234'));
        const pricingPage=await pageFor('pricing-tester@mindmapdigital.ai',{width:1440,height:1100});await pricingPage.locator('.qc-passes blockquote').getByText('major: PRIVATE_COST_CANARY_1234 must stay internal.',{exact:true}).waitFor();await pricingPage.getByRole('heading',{name:'Independent review',exact:true}).scrollIntoViewIfNeeded();await pricingPage.screenshot({path:'/workspace/solve-environment/zora-qc-review.png'});
        const mobile=await pageFor('tester@mindmapdigital.ai',{width:390,height:844});assert.ok(await mobile.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
        console.log('Compiled browser QC checks passed: actual progress/finding display, internal-role privacy, mobile width and zero page errors. Synthetic fixture only.');
      }finally{await browser.close();}
    }
    const stale=await prepare(true);const active=await claim();const current=(await call(`/api/cases/${stale.id}`)).body.case;assert.equal((await call(`/api/cases/${stale.id}/revision`,{version:current.version,action:'revise',note:'A later client source invalidates this review snapshot.'})).status,200);assert.equal((await finish(active,await reportForStale(active))).status,409);
    console.log('Local QC checks passed: source/draft inventory, 8 separate synthetic reviewer identities over 2 clean loops, self-review and prior-workpaper isolation, coverage/hash/context/replay rejection, deferred-policy hold, internal finding privacy, revision cancellation and real role-gated release. Protocol fixtures only; actual fresh Codex reviews remain unaccepted.');
  }finally{
    for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();await rm(privateRoot,{recursive:true,force:true});
  }
  async function reportForStale(job:any){return {packetHash:job.packetHash,checkedElementIds:['a valid shape; lease should reject first'],summary:'Stale review must fail before inspecting coverage.',findings:[],missingInputs:[]};}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Local QC checks failed');process.exitCode=1;});
