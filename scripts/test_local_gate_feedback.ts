/** Isolated local gate fixtures; prior workflow work is deliberately unrun. */
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { stagesFor } from '../lib/engine';

async function main(){
  const s=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));
  if(process.env.ZORA_LOCAL_TEST_ORIGIN)s.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin=new URL(s.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(s.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:s.DATABASE_URL}),cases:string[]=[],cookies:Record<string,string>={};
  for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai','admin-tester@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic gate feedback fixture'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(s.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
    const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${s.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
  async function seed(workflow:'W3'|'W8'='W3',stage=workflow==='W3'?'W3-G3':'W8-G1',privateInput=false,title='LOCAL GATE FEEDBACK VERIFICATION — synthetic'){
    const r=await call('/api/cases',{workflow,title,client:'Synthetic only',briefing:'Local gate-only fixture. Prior semantic workflow work is unrun; no client deliverable or actual human acceptance is implied.'});assert.equal(r.status,201);const id=r.body.case.id;cases.push(id);
    await db.query("UPDATE zora_jobs SET state='blocked' WHERE case_id=$1",[id]);
    await db.query("UPDATE zora_cases SET stage_index=$2,status='awaiting_approval' WHERE id=$1",[id,stagesFor(workflow).findIndex(s=>s.id===stage)]);
    const source=Buffer.from('Synthetic source for a correction only.');await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,sha256,data,visibility) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,'source.txt','text/plain',hash(source),source,privateInput?'internal':'client']);
    const job=randomUUID(),lease=randomUUID(),artifact=randomUUID(),data=Buffer.from('Synthetic draft needs a correction.');
    await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id) VALUES($1,$2,$3,1,1,'completed',$4,$5)",[job,id,workflow==='W8'?'W8-2':'W3-14',lease,'synthetic-earlier-'+randomUUID()]);
    await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path) VALUES($1,$2,$3,'draft.txt','text/plain','client',$4,$5,$6,1,1,'draft','outputs/client/draft.txt')",[artifact,id,job,data,hash(data),lease]);
    await call(`/api/cases/${id}/team`,{emails:['pricing-tester@mindmapdigital.ai']});
    return {id,job,artifact,sha256:hash(data),version:1,stage};
  }
  const finding=(f:Awaited<ReturnType<typeof seed>>,severity='minor',scope='document')=>({artifactId:f.artifact,location:'Line 1',severity,scope,description:'A synthetic requirement is missing.',evidence:'The synthetic source requires this item.'});
  async function existingFinding(f:Awaited<ReturnType<typeof seed>>,severity='minor'){
    const run=randomUUID(),review=randomUUID(),issue=finding(f,severity),elementId=f.artifact+'/1';
    const packet={stageId:'W3-18',files:[{id:f.artifact,sha256:f.sha256,visibility:'client'}],elements:[{id:elementId,fileId:f.artifact,location:issue.location}]};
    await db.query("INSERT INTO zora_qc_runs(id,case_id,job_id,case_version,source_revision,creator_context,state,packet,packet_hash) VALUES($1,$2,$3,1,1,$4,'blocked',$5,$6)",[run,f.id,f.job,'synthetic-creator-'+randomUUID(),JSON.stringify(packet),hash(Buffer.from(JSON.stringify(packet)))]);
    await db.query("INSERT INTO zora_reviews(id,run_id,case_id,checker,pass_number,method,loop_number,state,result) VALUES($1,$2,$3,'D6',1,'Synthetic prior finding only',1,'completed',$4)",[review,run,f.id,JSON.stringify({findings:[{...issue,elementId}],checkedElementIds:[elementId]})]);
    return {...issue,previousFinding:{reviewId:review,index:0}};
  }
  const detail=async(id:string,email?:string)=>(await call(`/api/cases/${id}`,undefined,false,email)).body;
  const claim=async()=> (await call('/api/worker/claim',{workerId:'local-feedback-fixture',contextId:'synthetic-feedback-'+randomUUID()},true)).body.job;
  async function upload(job:any){
    const bytes=Buffer.from('Revised synthetic draft after human feedback.');const metadata={leaseId:job.leaseId,path:'outputs/client/revised.txt',filename:'revised.txt',mimeType:'text/plain',visibility:'client',purpose:'draft',totalBytes:bytes.length,sha256:hash(bytes)};
    const initial=await call(`/api/worker/${job.id}/uploads`,metadata,true);assert.equal(initial.status,201);
    const sent=await fetch(new URL(`/api/worker/${job.id}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Authorization:`Bearer ${s.ZORA_RUNNER_TOKEN}`,'x-zora-lease':job.leaseId,'x-zora-offset':'0'},body:new Uint8Array(bytes)});assert.equal(sent.status,200);assert.equal((await call(`/api/worker/${job.id}/uploads/${initial.body.id}`,{leaseId:job.leaseId},true)).status,200);return metadata;
  }
  const result=(files:any[])=>({status:'completed',summary:'Synthetic gate correction protocol only; no real semantic verdict.',missingInputs:[],outputFiles:files,citations:[],reviewReports:[]});
  try{
    const ordinary=await seed('W8');const note='Please correct the salutation before this draft can be approved.';
    assert.equal((await call(`/api/cases/${ordinary.id}/decision`,{version:1,action:'reject',note},false,'pricing-tester@mindmapdigital.ai')).status,403);
    const response=await call(`/api/cases/${ordinary.id}/decision`,{version:1,action:'reject',note});assert.equal(response.status,200);assert.equal((await call(`/api/cases/${ordinary.id}/decision`,{version:1,action:'reject',note})).status,409);
    let d=await detail(ordinary.id);const feedback=d.gateFeedback[0];assert.equal(feedback.note,note);assert.equal(feedback.escalation_required,false);assert.equal(feedback.return_stage,'W8-2');assert.equal((await call(`/api/cases/${ordinary.id}/pack`)).body.gateFeedback[0].note,note);
    assert.equal((await call(`/api/cases/${ordinary.id}/revision`,{version:d.case.version,action:'resume',note:'Ordinary resume must not skip a rejected gate.'})).status,409);
    assert.equal((await call(`/api/cases/${ordinary.id}/qc-policy`,{version:d.case.version,cleanLoops:1,maxLoops:1})).status,200);d=await detail(ordinary.id);
    const rework={version:d.case.version,action:'rework',feedbackId:feedback.id,note:'Start the requested synthetic correction.'};
    assert.equal((await call(`/api/cases/${ordinary.id}/revision`,rework,false,'outsider@mindmapdigital.ai')).status,403);
    const simultaneous=await Promise.all([call(`/api/cases/${ordinary.id}/revision`,rework),call(`/api/cases/${ordinary.id}/revision`,rework)]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
    const draft=await claim();assert.equal(draft.stage.id,'W8-2');assert.equal(draft.gateFeedback[0].note,note);const file=await upload(draft);
    assert.equal((await call(`/api/worker/${draft.id}/complete`,{leaseId:draft.leaseId,contextId:draft.contextId,result:result([file])},true)).status,200);
    const qc=await claim();assert.equal(qc.stage.id,'W8-3');assert.equal((await call(`/api/worker/${qc.id}/complete`,{leaseId:qc.leaseId,contextId:qc.contextId,result:result([])},true)).body.resultStatus,'reviewing');
    for(let n=0;n<4;n++){
      const review=await claim();assert.equal(review.kind,'review');assert.ok(!('gateFeedback' in review));assert.ok(!JSON.stringify(review).includes(note),'Independent reviewers must not receive human/drafter commentary');
      const ids:string[]=[];let offset:number|null=0;while(offset!==null){const page=await call(`/api/reviews/${review.id}/inventory?leaseId=${review.leaseId}&offset=${offset}`,undefined,true);assert.equal(page.status,200);ids.push(...page.body.elements.map((e:any)=>e.id));offset=page.body.nextOffset;}
      assert.equal((await call(`/api/reviews/${review.id}/complete`,{leaseId:review.leaseId,contextId:review.contextId,result:{packetHash:review.packetHash,checkedElementIds:ids,summary:'Synthetic protocol reviewer, not semantic acceptance.',findings:[],missingInputs:[]}},true)).status,200);
    }
    d=await detail(ordinary.id);assert.equal(d.case.status,'awaiting_approval');assert.equal(d.gateFeedback[0].state,'reworking');assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=$1',[ordinary.id])).rows[0].n,0);
    assert.equal((await call(`/api/cases/${ordinary.id}/decision`,{version:d.case.version,action:'approve'})).status,200);d=await detail(ordinary.id);assert.equal(d.case.status,'released');assert.equal(d.gateFeedback[0].state,'addressed');

    const escaped=await seed();const issue=finding(escaped);assert.equal((await call(`/api/cases/${escaped.id}/decision`,{version:1,action:'reject',note:'Document issue needs a precise location.'})).status,400);
    for(const f of [{...issue,artifactId:ordinary.artifact},{...issue,qcEscape:false},{...issue,previousFinding:{reviewId:randomUUID(),index:0}}])assert.ok([400,422].includes((await call(`/api/cases/${escaped.id}/decision`,{version:1,action:'reject',note:'Synthetic invalid evidence test.',findings:[f]})).status));
    assert.equal((await call(`/api/cases/${escaped.id}/decision`,{version:1,action:'reject',note:'New minor issue escaped prior QC.',findings:[issue]})).status,200);d=await detail(escaped.id);assert.equal(d.gateFeedback[0].escalation_required,true);assert.equal(d.gateFeedback[0].findings[0].sha256,escaped.sha256);
    assert.equal((await call(`/api/cases/${escaped.id}/revision`,{version:d.case.version,action:'rework',feedbackId:d.gateFeedback[0].id,note:'Ordinary rework cannot clear this escalation.'})).status,409);
    assert.equal((await call(`/api/cases/${escaped.id}/revision`,{version:d.case.version,action:'revise',note:'A full source revision preserves the original escaped issue.'})).status,200);d=await detail(escaped.id);assert.equal(d.gateFeedback[0].state,'open');
    // Put only this local fixture back at its document gate to test the approval barrier.
    await db.query("UPDATE zora_cases SET stage_index=$2,status='awaiting_approval' WHERE id=$1",[escaped.id,stagesFor('W3').findIndex(s=>s.id==='W3-G3')]);assert.equal((await call(`/api/cases/${escaped.id}/decision`,{version:d.case.version,action:'approve'})).status,409);

    const known=await seed();const logged=await existingFinding(known);assert.equal((await call(`/api/cases/${known.id}/decision`,{version:1,action:'reject',note:'Exact recorded minor issue requires correction.',findings:[{...logged,description:'An unrelated new issue must not reuse this reference.'}]})).status,422);
    assert.equal((await call(`/api/cases/${known.id}/decision`,{version:1,action:'reject',note:'Exact recorded minor issue requires correction.',findings:[logged]})).status,200);d=await detail(known.id);assert.equal(d.gateFeedback[0].escalation_required,false);assert.equal(d.gateFeedback[0].findings[0].qcEscape,false);
    // Source changes require a full revision rather than reusing a stale correction route.
    await db.query('UPDATE zora_cases SET source_revision=source_revision+1 WHERE id=$1',[known.id]);
    assert.equal((await call(`/api/cases/${known.id}/revision`,{version:d.case.version,action:'rework',feedbackId:d.gateFeedback[0].id,note:'Changed source revision must reject ordinary rework.'})).status,409);
    assert.equal((await call(`/api/cases/${known.id}/revision`,{version:d.case.version,action:'revise',note:'A full revision supersedes ordinary feedback only.'})).status,200);assert.equal((await detail(known.id)).gateFeedback[0].state,'superseded');
    const internalArtifact=await seed();await db.query("UPDATE zora_artifacts SET visibility='internal' WHERE id=$1",[internalArtifact.artifact]);
    assert.equal((await call(`/api/cases/${internalArtifact.id}/decision`,{version:1,action:'reject',note:'Inaccessible internal evidence cannot be referenced.',findings:[finding(internalArtifact)]})).status,422);
    const internalReview=await seed();const internalLogged=await existingFinding(internalReview);
    await db.query(`UPDATE zora_qc_runs SET packet=jsonb_set(packet,'{files}',(packet->'files')||$2::jsonb) WHERE case_id=$1`,[internalReview.id,JSON.stringify([{id:randomUUID(),visibility:'internal',purpose:'draft'}])]);
    assert.equal((await call(`/api/cases/${internalReview.id}/decision`,{version:1,action:'reject',note:'Private reviewer packet cannot be used by a consultant.',findings:[internalLogged]})).status,422);
    const major=await seed('W3','W3-G4');const prior=await existingFinding(major,'major');assert.equal((await call(`/api/cases/${major.id}/decision`,{version:1,action:'reject',note:'Cannot lower the stored severity.',findings:[{...prior,severity:'minor'}]})).status,422);
    assert.equal((await call(`/api/cases/${major.id}/decision`,{version:1,action:'reject',note:'Commercial issue was already recorded.',findings:[{...prior,scope:'commercials'}]})).status,200);d=await detail(major.id);assert.equal(d.gateFeedback[0].escalation_required,true);assert.equal(d.gateFeedback[0].return_stage,'W3-20');

    const confidential=await seed('W3','W3-G3',true);const privateNote='PRIVATE_FEEDBACK_CANARY: synthetic internal source concern.';
    assert.equal((await call(`/api/cases/${confidential.id}/decision`,{version:1,action:'reject',note:privateNote,findings:[finding(confidential,'major')]},false,'admin-tester@mindmapdigital.ai')).status,200);
    assert.ok(!JSON.stringify(await detail(confidential.id)).includes('PRIVATE_FEEDBACK_CANARY'));assert.ok(!JSON.stringify((await call(`/api/cases/${confidential.id}/pack`)).body).includes('PRIVATE_FEEDBACK_CANARY'));assert.ok(JSON.stringify(await detail(confidential.id,'pricing-tester@mindmapdigital.ai')).includes('PRIVATE_FEEDBACK_CANARY'));
    assert.equal((await call(`/api/cases/${confidential.id}`,undefined,false,'outsider@mindmapdigital.ai')).status,403);

    if(process.env.ZORA_LOCAL_BROWSER==='1'){
      const f=await seed('W3','W3-G3',false,'LOCAL FEEDBACK UI VERIFICATION — synthetic');
      const modulePath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(modulePath);const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors:string[]=[];
      try{for(const width of [1440,390]){
        const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});await context.addCookies([{name:'zora_session',value:cookies['tester@mindmapdigital.ai'],url:origin.origin}]);const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(origin.origin);await page.getByRole('button',{name:/LOCAL FEEDBACK UI VERIFICATION/}).click();
        if(width===1440){await page.locator('.gate-feedback-form summary').click();await page.getByLabel('Revision note',{exact:true}).fill('Please correct the omitted synthetic requirement.');await page.getByLabel('File',{exact:true}).selectOption(f.artifact);await page.getByLabel('Page, slide or section',{exact:true}).fill('Line 1');await page.getByLabel('Severity',{exact:true}).selectOption('major');await page.getByLabel('Issue description',{exact:true}).fill('The synthetic source requirement is missing.');await page.getByLabel('Evidence or expected correction',{exact:true}).fill('Restore the item stated in the synthetic source.');await page.getByRole('button',{name:'Save revision request',exact:true}).click();}
        await page.getByText('Trust reset required',{exact:true}).waitFor();await page.getByText('The synthetic source requirement is missing.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Start correction',exact:true}).count(),0);assert.ok(await page.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));
        if(width===1440)await page.locator('.gate-feedback').screenshot({path:'/workspace/solve-environment/zora-gate-feedback.png'});await context.close();
      }assert.deepEqual(errors,[]);}finally{await browser.close();}
      console.log('Compiled gate-feedback browser checks passed: file-linked rejection form, visible issue/history and trust-reset hold, desktop/mobile layout and zero page errors.');
    }
    console.log('Local gate feedback checks passed: note/file evidence retention, ordinary correction through fresh QC and a new human gate, one synthetic human release, concurrent/stale/role guards, QC-link/hash/severity checks, BRD escape/commercial routes, privacy and unresolved escalation blocking approval across a full revision. ESC-2/3/4 automation is not implemented by this milestone.');
  }finally{
    for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();
  }
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Local feedback checks failed');process.exitCode=1;});
