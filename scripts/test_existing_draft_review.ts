/** Local synthetic protocol checks only. No real reviewer judgement or client delivery is claimed. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
import {hashBytes} from '../lib/files';

async function main(){
  const config=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
  const origin=new URL(process.env.ZORA_LOCAL_TEST_ORIGIN||config.ZORA_APP_URL);
  assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(config.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:config.DATABASE_URL}),cases:string[]=[];
  const tokens:Record<string,string>={};
  for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])tokens[email]=await new SignJWT({name:'Local fixture'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(config.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,options:{method?:string;worker?:boolean;email?:string;origin?:string;unsigned?:boolean}={}){
    const response=await fetch(new URL(path,origin),{method:options.method||(body===undefined?'GET':'POST'),headers:{Origin:options.origin||origin.origin,'Content-Type':'application/json',...(options.unsigned?{}:options.worker?{Authorization:`Bearer ${config.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${tokens[options.email||'tester@mindmapdigital.ai']}`})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  async function fixture(){
    const created=await call('/api/cases',{title:'LOCAL existing proposal review fixture',client:'Synthetic only',workflow:'W3',briefing:'Physical meeting notes: reconcile invoices with goods receipts; exceptions need human approval.'});assert.equal(created.status,201);
    const id=created.body.case.id;cases.push(id);
    async function file(filename:string,text:string,visibility='client'){
      const sourceId=randomUUID(),bytes=Buffer.from(text);
      await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,visibility,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[sourceId,id,filename,'text/plain',bytes,hashBytes(bytes),visibility,JSON.stringify({context:{category:'reference',label:'User context',notes:'Unverified context only'}})]);return sourceId;
    }
    const draft=await file('existing-proposal.txt','Synthetic proposal: automated invoice reconciliation, exception approval by a human. Price: requires pricing owner approval.');
    const source=await file('buyer-notes.txt','Buyer meeting notes: retain human approval for exceptions.');
    const excluded=await file('earlier-report.txt','PRIOR_REVIEW_CANARY must never enter a fresh reviewer packet.');
    const internal=await file('private.txt','INTERNAL_CANARY pricing context.','internal');
    return {id,draft,source,excluded,internal,input:{version:1,draftSourceIds:[draft],sourceIds:[source],brief:created.body.case.briefing},path:`/api/cases/${id}/existing-review`};
  }
  async function claim(contextId=`synthetic-review-${randomUUID()}`){const r=await call('/api/worker/claim',{workerId:'local-existing-review-fixture',contextId},{worker:true});assert.equal(r.status,200);return r.body.job;}
  async function report(job:any){
    const ids:string[]=[];let offset:number|null=0;
    while(offset!==null){const r=await call(`/api/reviews/${job.id}/inventory?leaseId=${job.leaseId}&offset=${offset}`,undefined,{worker:true});assert.equal(r.status,200);ids.push(...r.body.elements.map((e:any)=>e.id));offset=r.body.nextOffset;}
    return {packetHash:job.packetHash,checkedElementIds:ids,summary:'Synthetic protocol result; no real independent semantic review.',findings:[] as any[],missingInputs:[] as string[],checkedRuleIds:[]};
  }
  const finish=(job:any,result:any)=>call(`/api/reviews/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result},{worker:true});
  try{
    const f=await fixture();
    assert.equal((await call(f.path,f.input,{unsigned:true})).status,401);
    assert.equal((await call(f.path,f.input,{origin:'https://other.example'})).status,403);
    assert.equal((await call(f.path,f.input,{email:'outsider@mindmapdigital.ai'})).status,403);
    assert.equal((await call(f.path,{...f.input,sourceIds:[f.draft]})).status,400);
    assert.equal((await call(f.path,{...f.input,draftSourceIds:[f.draft,f.draft]})).status,400);
    assert.equal((await call(f.path,{...f.input,sourceIds:[f.internal]})).status,403);
    assert.equal((await call(f.path,{...f.input,sourceIds:[randomUUID()]})).status,403);
    const starts=await Promise.all([call(f.path,f.input),call(f.path,f.input)]);
    assert.deepEqual(starts.map(r=>r.status).sort(),[201,409],'Concurrent starts create one packet');
    const run=starts.find(r=>r.status===201)!.body;assert.equal(run.passes,10);
    const stored=(await db.query('SELECT * FROM zora_qc_runs WHERE id=$1',[run.runId])).rows[0];assert.equal(stored.job_id,null);assert.equal(stored.creator_context,null);assert.equal(stored.purpose,'existing_draft');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_jobs WHERE case_id=$1',[f.id])).rows[0].n,0,'No generated job or native completion is invented');
    const before=(await call(`/api/cases/${f.id}`)).body;assert.equal(before.progress.reviewPurpose,'existing_draft');assert.equal(before.progress.reviewQueued,10);assert.equal(before.reviews[0].snapshot.brief,f.input.brief);assert.deepEqual(before.reviews[0].snapshot.files.map((file:any)=>file.id).sort(),[f.draft,f.source].sort());
    assert.equal((await call(`/api/cases/${f.id}/decision`,{version:2,action:'approve'})).status,403);
    let firstContext='';
    for(let index=0;index<10;index++){
      const job=await claim();assert.equal(job.kind,'review');assert.equal(job.packet.caseId,f.id);assert.equal(job.packet.baselineStatus,'unapproved');assert.equal(job.packet.purpose,'existing_draft');
      assert.equal(job.packet.files.find((file:any)=>file.id===f.draft).role,'draft');assert.equal(job.packet.files.find((file:any)=>file.id===f.source).role,'source');assert.equal(job.packet.files.length,2);assert.ok(job.instructions.includes('EXISTING PROPOSAL DIAGNOSTIC'));
      assert.ok(!JSON.stringify(job).includes('PRIOR_REVIEW_CANARY'));assert.ok(!JSON.stringify(job).includes('INTERNAL_CANARY'));assert.ok(!JSON.stringify(job).includes('FINDING_CANARY'));
      const result=await report(job);assert.ok(result.checkedElementIds.some(id=>id.startsWith('request-notes/')));
      if(index===0){
        firstContext=job.contextId;assert.equal(await claim(firstContext),null,'Same reviewer context cannot claim a second pass');
        assert.equal((await call(`/api/reviews/${job.id}/files/sources/${f.excluded}?leaseId=${job.leaseId}`,undefined,{worker:true})).status,403);
        assert.equal((await finish(job,{...result,packetHash:'0'.repeat(64)})).status,422);
        assert.equal((await finish(job,{...result,checkedElementIds:result.checkedElementIds.slice(1)})).status,422);
        result.findings=[{elementId:result.checkedElementIds[0],kind:'source',severity:'major',description:'FINDING_CANARY synthetic unsupported assertion.',evidence:'The fixture requires a documented supporting source.'}];
      }
      if(index===1)result.missingInputs=['Synthetic capacity evidence is absent.'];
      const done=await finish(job,result);assert.equal(done.status,200);assert.equal(done.body.status,index===9?'completed':'reviewing','Findings do not cancel remaining independent lenses');
      assert.equal((await finish(job,result)).status,409,'Completion replay rejected');
    }
    const after=(await call(`/api/cases/${f.id}`)).body;assert.equal(after.case.status,'blocked');assert.equal(after.case.stageIndex,0);assert.equal(after.case.version,3);assert.equal(after.reviews[0].state,'blocked');assert.equal(after.reviews[0].passes.length,10);assert.ok(after.reviews[0].passes.every((p:any)=>p.state==='completed'));assert.deepEqual(after.reviews[0].missingInputs,['Synthetic capacity evidence is absent.']);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=$1',[f.id])).rows[0].n,0);
    assert.equal((await call(f.path,{...f.input,version:3})).status,201);
    assert.equal(await claim(firstContext),null,'Reviewer identity remains used across reruns');
    for(let index=0;index<10;index++){const job=await claim();assert.equal((await finish(job,await report(job))).status,200);}
    const clean=(await call(`/api/cases/${f.id}`)).body;assert.equal(clean.reviews[0].state,'passed');assert.equal(clean.case.status,'blocked');assert.equal(clean.case.stageIndex,0);assert.equal(clean.case.version,5);
    const next=await call(f.path,{...f.input,version:5});assert.equal(next.status,201);const stale=await claim();const staleResult=await report(stale);
    assert.equal((await call(f.path,{version:6,runId:next.body.runId},{method:'DELETE'})).status,200);
    assert.equal((await finish(stale,staleResult)).status,409);assert.equal(await claim(),null);
    assert.equal((await call(f.path,{...f.input,version:7})).status,201);const revoked=await claim();const revokedResult=await report(revoked);
    assert.equal((await call(`/api/cases/${f.id}/revision`,{version:8,action:'revise',note:'New client information invalidates the old diagnostic snapshot.'})).status,200);
    assert.equal((await finish(revoked,revokedResult)).status,409);assert.equal(await claim(),null);
    console.log('Existing-draft API checks passed: auth, file-role/privacy isolation, atomic start, exact packet/notes coverage, ten separate contexts, full finding collection, retry, cancel and revision invalidation; no stage/job/approval/release fabricated. Synthetic fixtures only.');
  }finally{
    for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_draft_contexts','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
