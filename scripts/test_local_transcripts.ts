/** Synthetic local protocol fixtures. Never send these cases or identities to production. */
import { readFile,mkdir,writeFile,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { downloadFiles } from '../worker/transport';
import { stagesFor } from '../lib/engine';

async function main(){
  const local=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));
  if(process.env.ZORA_LOCAL_TEST_ORIGIN)local.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin=new URL(local.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(local.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:local.DATABASE_URL}),cases:string[]=[],root=resolve(`.zora/local-transcripts-${randomUUID()}`);
  const cookies:Record<string,string>={};for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic transcript fixture'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(local.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
    const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${local.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  const native=(action:string,dir:string,context:string,plan?:string)=>spawnSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts',action,dir,...(plan?[plan]:[])],{env:{...process.env,...local,CODEX_THREAD_ID:context,ZORA_WORK_ROOT:root,ZORA_NOTIFICATION_BYPASS:'',VERCEL_TOKEN:''},encoding:'utf8',timeout:60000});
  async function upload(job:any,path:string,bytes:Buffer,purpose:string,visibility:string,expected=200){
    const metadata={leaseId:job.leaseId,path,filename:path.split('/').at(-1),mimeType:'application/json',purpose,visibility,totalBytes:bytes.length,sha256:hash(bytes)};
    const initial=await call(`/api/worker/${job.id}/uploads`,metadata,true);assert.equal(initial.status,201,JSON.stringify(initial.body));
    const r=await fetch(new URL(`/api/worker/${job.id}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,Authorization:`Bearer ${local.ZORA_RUNNER_TOKEN}`,'x-zora-offset':'0','x-zora-lease':job.leaseId},body:new Uint8Array(bytes)});assert.equal(r.status,200);
    assert.equal((await call(`/api/worker/${job.id}/uploads/${initial.body.id}`,{leaseId:job.leaseId},true)).status,expected);return initial.body.id;
  }
  const claim=async(contextId=`synthetic-transcript-review-${randomUUID()}`)=>(await call('/api/worker/claim',{workerId:'local-transcript-fixture',contextId},true)).body.job;
  async function prepare(mode:'clean'|'missing'|'private'|'pages'|'stale'){
    const created=await call('/api/cases',{title:'LOCAL TRANSCRIPT VERIFICATION — not a pursuit',client:'Synthetic only',workflow:'W8',briefing:'Isolated scanned-source review protocol. All preceding semantic workflow steps are unrun; no human approval or acceptance is implied.'});assert.equal(created.status,201);const id=created.body.case.id;cases.push(id);
    await db.query("UPDATE zora_jobs SET state='blocked' WHERE case_id=$1",[id]);
    await db.query("UPDATE zora_cases SET status='blocked',stage_index=$2,version=version+1 WHERE id=$1",[id,stagesFor('W8').findIndex(s=>s.id==='W8-3')]);
    const visibility=mode==='private'?'internal':'client',sourceId=randomUUID(),dir=join(root,id);await mkdir(dir,{recursive:true,mode:0o700});
    const generated=spawnSync('/workspace/solve-environment/.venv/bin/python',['-c',`import fitz,sys
pdf=fitz.open();text=fitz.open();p=text.new_page(width=300,height=300);p.insert_text((20,40),'Synthetic source request only.')
page=pdf.new_page(width=300,height=300);page.insert_image(page.rect,stream=p.get_pixmap(matrix=fitz.Matrix(2,2)).tobytes('png'))
pdf.new_page(width=300,height=300);pdf.save(sys.argv[1])`,join(dir,'source.pdf')],{encoding:'utf8'});assert.equal(generated.status,0);
    const pdf=await readFile(join(dir,'source.pdf'));
    await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,visibility) VALUES($1,$2,$3,$4,$5,$6,$7)',[sourceId,id,'scan.pdf','application/pdf',pdf,hash(pdf),visibility]);
    await call(`/api/cases/${id}/team`,{emails:['pricing-tester@mindmapdigital.ai']});
    const version=(await call(`/api/cases/${id}`)).body.case.version;
    assert.equal((await call(`/api/cases/${id}/qc-policy`,{version,cleanLoops:2,maxLoops:2})).status,200);
    assert.equal((await call(`/api/cases/${id}/revision`,{version:version+1,action:'resume',note:'Synthetic source and explicit local QC settings only.'})).status,200);
    const job=await claim(`synthetic-transcript-creator-${randomUUID()}`);assert.equal(job.case.id,id);assert.equal(job.stage.id,'W8-3');
    Object.assign(process.env,local,{ZORA_NOTIFICATION_BYPASS:'',VERCEL_TOKEN:''});await downloadFiles(job,job.sources,dir,'sources');await downloadFiles(job,job.artifacts,dir,'artifacts');await writeFile(join(dir,'request.json'),JSON.stringify(job),{mode:0o600});
    const plan={version:1,status:'unverified',sourceId,sourceSha256:hash(pdf),pages:[{page:1,blocks:[{kind:'paragraph',text:'Synthetic source request only.'}]},{page:2,blocks:[],noTextReason:'The second page is blank in this synthetic PDF.'}]};
    const outputFiles:any[]=[];let transcriptId='';
    if(mode!=='missing'){
      if(mode==='clean'){
        assert.notEqual(native('build-transcript',dir,'wrong-synthetic-context','plan.json').status,0);
        await writeFile(join(root,'outside.json'),JSON.stringify(plan));assert.notEqual(native('build-transcript',dir,job.contextId,'../outside.json').status,0);
        await upload(job,'outputs/client/bad-hash.json',Buffer.from(JSON.stringify({...plan,sourceSha256:'0'.repeat(64)})),'source_transcript','client',422);
        await upload(job,'outputs/client/foreign-source.json',Buffer.from(JSON.stringify({...plan,sourceId:randomUUID()})),'source_transcript','client',422);
      }
      if(mode==='private')await upload(job,'outputs/client/private-transcript.json',Buffer.from(JSON.stringify(plan)),'source_transcript','client',422);
      await writeFile(join(dir,'plan.json'),JSON.stringify(plan),{mode:0o600});
      const built=native('build-transcript',dir,job.contextId,'plan.json');assert.equal(built.status,0,built.stderr);
      const metadata=JSON.parse(built.stdout.trim()).outputFiles[0];assert.equal(metadata.visibility,visibility);
      if(mode==='pages')await writeFile(join(dir,metadata.path),JSON.stringify({...plan,pages:plan.pages.slice(0,1)}));
      transcriptId=await upload(job,metadata.path,await readFile(join(dir,metadata.path)),'source_transcript',visibility);outputFiles.push(metadata);
    }
    const path='outputs/client/draft.json';await mkdir(join(dir,'outputs/client'),{recursive:true});const draft=Buffer.from('{"draft":"Synthetic acknowledgment for protocol checking only."}');
    await upload(job,path,draft,'draft','client');outputFiles.push({path,visibility:'client',mimeType:'application/json',purpose:'draft'});
    const result={status:'completed',summary:'Synthetic transcription/QC fixture only. No semantic verdict is claimed.',missingInputs:[],outputFiles,citations:[],reviewReports:[]};
    const completed=await call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result},true);assert.equal(completed.status,200,JSON.stringify(completed.body));
    assert.equal(completed.body.resultStatus,['missing','pages'].includes(mode)?'blocked':'reviewing');
    return {id,job,transcriptId,sourceId,dir};
  }
  async function report(job:any){
    const elements:any[]=[];let offset:number|null=0;while(offset!==null){const r=await call(`/api/reviews/${job.id}/inventory?leaseId=${job.leaseId}&offset=${offset}`,undefined,true);assert.equal(r.status,200);elements.push(...r.body.elements);offset=r.body.nextOffset;}
    return {packetHash:job.packetHash,checkedElementIds:elements.map(e=>e.id),summary:'Synthetic complete-coverage response; no actual fresh Codex judgement claimed.',findings:[] as any[],missingInputs:[]};
  }
  const finish=async(job:any,result:any)=>call(`/api/reviews/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result},true);
  try{
    await prepare('missing');await prepare('pages');
    const clean=await prepare('clean');assert.equal(await claim(clean.job.contextId),null);
    for(let n=0;n<10;n++){
      const job=await claim();assert.equal(job.kind,'review');assert.equal(job.packet.caseId,clean.id);
      assert.equal(job.checker==='SOURCE_TRANSCRIPT',n===0||n===5);
      const association=job.packet.sourceTranscripts[0];assert.equal(association.sourceId,clean.sourceId);assert.equal(association.transcriptId,clean.transcriptId);assert.equal(association.pageCount,2);assert.equal(association.status,'unverified');assert.ok(!('prior' in job));
      if(job.checker==='SOURCE_TRANSCRIPT'){
        const concurrent=await Promise.all([claim(),claim()]);assert.deepEqual(concurrent,[null,null],'Ordinary QC must wait for transcription even with concurrent claims');
        assert.ok(job.instructions.includes('Check omissions and additions'));
      }
      const result=await report(job);if(n===0)assert.equal((await finish(job,{...result,checkedElementIds:result.checkedElementIds.slice(1)})).status,422);
      assert.equal((await finish(job,result)).status,200);assert.equal((await finish(job,result)).status,409);
    }
    const detail=(await call(`/api/cases/${clean.id}`)).body;assert.equal(detail.case.status,'awaiting_approval');assert.equal(detail.reviews[0].passes.length,10);
    if(process.env.ZORA_LOCAL_BROWSER==='1'){
      const modulePath='/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';const {chromium}=await import(modulePath);
      const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
      try{
        const errors:string[]=[];
        for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
          const context=await browser.newContext({ignoreHTTPSErrors:true,viewport});await context.addCookies([{name:'zora_session',value:cookies['tester@mindmapdigital.ai'],url:origin.origin}]);
          const page=await context.newPage();page.on('pageerror',(e:Error)=>errors.push(e.message));await page.goto(origin.origin);
          await page.getByRole('button',{name:/LOCAL TRANSCRIPT VERIFICATION/}).first().click();
          await page.getByText('Source transcription · Pass 1 · Loop 1',{exact:true}).waitFor();
          await page.getByText('Scanned-source text is checked against every original PDF page before the other review tasks can start.',{exact:true}).waitFor();
          assert.ok((await page.locator('body').innerText()).includes('Source transcript · see review status'));
          assert.ok(await page.locator('body').evaluate((el:HTMLElement)=>el.scrollWidth<=window.innerWidth));
          if(viewport.width===1440){await page.getByRole('heading',{name:'Independent review',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/workspace/solve-environment/zora-source-transcript-review.png'});}
          await context.close();
        }
        assert.deepEqual(errors,[]);console.log('Compiled transcript browser checks passed: source-file labeling, ordered transcription/QC progress, desktop/mobile width and zero page errors.');
      }finally{await browser.close();}
    }
    const privateCase=await prepare('private');
    const owner=(await call(`/api/cases/${privateCase.id}`)).body,pricing=(await call(`/api/cases/${privateCase.id}`,undefined,false,'pricing-tester@mindmapdigital.ai')).body;
    assert.ok(!owner.artifacts.some((f:any)=>f.id===privateCase.transcriptId));assert.ok(pricing.artifacts.some((f:any)=>f.id===privateCase.transcriptId));
    assert.equal((await call(`/api/cases/${privateCase.id}/files/artifacts/${privateCase.transcriptId}`)).status,403);
    const reviewer=await claim(),result=await report(reviewer);assert.equal(reviewer.checker,'SOURCE_TRANSCRIPT');result.findings=[{elementId:result.checkedElementIds.find((id:string)=>id.startsWith(privateCase.sourceId+'/')),severity:'minor',kind:'source',description:'PRIVATE_TRANSCRIPT_CANARY: a synthetic omitted word.',evidence:'Synthetic source page 1 versus the transcription fixture.'}];
    assert.equal((await finish(reviewer,result)).body.status,'blocked');assert.equal(await claim(),null,'Even minor transcription errors stop every downstream pass');
    assert.ok(!JSON.stringify((await call(`/api/cases/${privateCase.id}`)).body).includes('PRIVATE_TRANSCRIPT_CANARY'));assert.ok(JSON.stringify((await call(`/api/cases/${privateCase.id}`,undefined,false,'pricing-tester@mindmapdigital.ai')).body.reviews).includes('PRIVATE_TRANSCRIPT_CANARY'));
    const stale=await prepare('stale');let expired=await claim();assert.equal(expired.checker,'SOURCE_TRANSCRIPT');await db.query("UPDATE zora_reviews SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",[expired.id]);assert.equal(await claim(expired.contextId),null);const replacement=await claim();assert.equal(replacement.id,expired.id);assert.notEqual(replacement.contextId,expired.contextId);assert.equal((await finish(expired,{packetHash:expired.packetHash,checkedElementIds:['stale'],summary:'Expired lease fixture response.',findings:[],missingInputs:[]})).status,409);
    const version=(await call(`/api/cases/${stale.id}`)).body.case.version;assert.equal((await call(`/api/cases/${stale.id}/revision`,{version,action:'revise',note:'Synthetic later source invalidates this transcription review.'})).status,200);assert.equal((await finish(replacement,{packetHash:replacement.packetHash,checkedElementIds:['stale'],summary:'Cancelled revision fixture response.',findings:[],missingInputs:[]})).status,409);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=ANY($1::uuid[])',[cases])).rows[0].n,0);
    console.log('Local transcript checks passed: native packaging/lease/path guards, exact hashes/pages, private-source upload/download isolation, mandatory transcription before concurrent QC, two clean loops with 10 synthetic fresh contexts, minor-error hold, expired-context/replay/revision rejection and zero human approvals. Semantic acceptance is unrun.');
  }finally{
    for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();await rm(root,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local transcript checks failed');process.exitCode=1;});
