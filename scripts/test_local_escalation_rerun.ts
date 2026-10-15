/** Local-only ESC-4 fixture: re-run from the return point, checklist learning, note reading and closure. All identities are synthetic. */
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { stagesFor } from '../lib/engine';
import { packetRules } from '../lib/checklist';
async function main(){
 const env=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));if(process.env.ZORA_LOCAL_TEST_ORIGIN)env.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
 const origin=new URL(env.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(env.DATABASE_URL).hostname,'127.0.0.1');
 const db=new Pool({connectionString:env.DATABASE_URL}),cases:string[]=[],cookies:Record<string,string>={};
 for(const email of ['tester@mindmapdigital.ai','outsider@mindmapdigital.ai','demo-tester@mindmapdigital.ai','admin-tester@mindmapdigital.ai'])cookies[email]=await new SignJWT({name:'Synthetic ESC-4 test'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(env.ZORA_SESSION_SECRET));
 async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
  const r=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${cookies[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};
 }
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const claim=async(contextId:string)=>(await call('/api/worker/claim',{workerId:'local-esc4-fixture',contextId},true)).body.job;
 const detail=async(id:string,email?:string)=>(await call(`/api/cases/${id}`,undefined,false,email)).body;
 const G3=stagesFor('W3').findIndex(s=>s.id==='W3-G3');
 async function upload(job:any,name:string,text:string){
  const bytes=Buffer.from(text),file={path:`outputs/client/${name}`,mimeType:'text/plain',visibility:'client',purpose:'draft'};
  const initial=await call(`/api/worker/${job.id}/uploads`,{...file,filename:name,leaseId:job.leaseId,totalBytes:bytes.length,sha256:hash(bytes)},true);assert.equal(initial.status,201);
  const r=await fetch(new URL(`/api/worker/${job.id}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`,'x-zora-lease':job.leaseId,'x-zora-offset':'0'},body:new Uint8Array(bytes)});assert.equal(r.status,200);
  const done=await call(`/api/worker/${job.id}/uploads/${initial.body.id}`,{leaseId:job.leaseId},true);assert.equal(done.status,200);return {file,sha256:hash(bytes)};
 }
 /** A W3 pursuit rejected at W3-G3 with a recorded ESC-2 explanation, confirmed baseline and explicit QC policy. */
 async function seed(title:string){
  const r=await call('/api/cases',{workflow:'W3',title,client:'Synthetic only',briefing:'Synthetic ESC-4 protocol fixture.'});assert.equal(r.status,201);const id=r.body.case.id;cases.push(id);
  await db.query("UPDATE zora_cases SET status='awaiting_approval',stage_index=$2,qc_clean_loops=1,qc_max_loops=3 WHERE id=$1",[id,G3]);
  const source=randomUUID(),sourceBytes=Buffer.from('Synthetic source requires a complete response with a named integration.');await db.query("INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,'source.txt','text/plain',$3,$4)",[source,id,sourceBytes,hash(sourceBytes)]);
  const job=randomUUID(),lease=randomUUID(),context='original-'+randomUUID(),artifact=randomUUID(),bytes=Buffer.from('OLD_DRAFT_CANARY: synthetic draft without the integration.');
  await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id,result) VALUES($1,$2,'W3-14',1,1,'completed',$3,$4,'{\"summary\":\"OLD_REASONING_CANARY\"}')",[job,id,lease,context]);
  await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path) VALUES($1,$2,$3,'draft.txt','text/plain','client',$4,$5,$6,1,1,'draft','outputs/client/draft.txt')",[artifact,id,job,bytes,hash(bytes),lease]);
  assert.equal((await call(`/api/cases/${id}/decision`,{action:'reject',version:1,note:'Synthetic omitted integration needs the escalation protocol.',findings:[{artifactId:artifact,location:'Line 1',severity:'major',scope:'document',description:'Synthetic named integration omitted.',evidence:'The source names a required integration.'}]})).status,200);
  const feedback=(await detail(id)).gateFeedback[0];
  assert.equal((await call(`/api/worker/${job}/escalations`,{action:'explain',leaseId:lease,contextId:context,explanations:[{feedbackId:feedback.id,findingIndex:0,artifactId:artifact,sha256:hash(bytes),cause:'missed',rootCause:'The synthetic integration was absent from the draft.',whyChecksMissedIt:'No checklist item compared named integrations with the scope.',correctionPlan:'Re-evaluate every section against named integrations.'}]},true)).status,200);
  const bJob=randomUUID(),bLease=randomUUID(),bytesB=Buffer.from('Locked baseline: the named integration is in scope.');
  await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,state,lease_id,context_id,created_at) VALUES($1,$2,'W3-6',1,1,'completed',$3,$4,'2026-01-01T00:00:00Z')",[bJob,id,bLease,'baseline-'+randomUUID()]);
  await db.query("INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,lease_id,case_version,source_revision,purpose,source_path,created_at) VALUES($1,$2,$3,'baseline.txt','text/plain','client',$4,$5,$6,1,1,'reference','outputs/client/baseline.txt','2026-01-01T00:00:00.000900Z')",[randomUUID(),id,bJob,bytesB,hash(bytesB),bLease]);
  await db.query("INSERT INTO zora_approvals(case_id,stage_id,version,actor,role,created_at) VALUES($1,'W3-G1',1,'tester@mindmapdigital.ai','consultant','2026-01-01T00:00:00.000950Z')",[id]);
  return {id,artifact,context,feedback:feedback.id};
 }
 /** Fresh ESC-3 drafter through the real claim/upload/complete routes. */
 async function trustReset(f:any){
  const d=await detail(f.id);assert.equal((await call(`/api/cases/${f.id}/trust-reset`,{version:d.case.version,feedbackId:f.feedback})).status,200);
  const job=await claim('fresh-reset-'+randomUUID());assert.equal(job.stage.id,'ESC-3');
  const {file,sha256}=await upload(job,'regenerated.txt','Regenerated synthetic draft including the named integration in scope and architecture.');
  const report={packetHash:job.trustReset.packetHash,checkedSourceIds:job.sources.map((s:any)=>s.id),checkedBaselineIds:job.artifacts.map((a:any)=>a.id),sections:[{section:'Scope and integrations',assessment:'RESET_NOTE_CANARY: every named integration was checked against the source.',changes:'The named integration is now in scope and the architecture.'}],findingResponses:[{findingIndex:0,correction:'The named synthetic integration was restored in scope.'}]};
  const done=await call(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result:{status:'completed',summary:'Synthetic re-evaluation protocol, not semantic acceptance.',missingInputs:[],outputFiles:[file],citations:[],reviewReports:[],resetReport:report}},true);assert.equal(done.status,200);
  const draft=(await db.query("SELECT id FROM zora_artifacts WHERE job_id=$1 AND purpose='draft'",[job.id])).rows[0].id;
  return {context:job.contextId,draft,sha256};
 }
 /** One independent pass in a new synthetic reviewer identity with complete element and rule coverage. */
 async function review(options:{omitRules?:boolean}={}){
  const job=await claim('reviewer-'+randomUUID());assert.equal(job?.kind,'review');
  const elements:any[]=[];let offset:number|null=0;
  while(offset!==null){const page=await call(`/api/reviews/${job.id}/inventory?leaseId=${job.leaseId}&offset=${offset}`,undefined,true);assert.equal(page.status,200);elements.push(...page.body.elements);offset=page.body.nextOffset;}
  const rules=(job.packet.checklist as any[]).filter(r=>r.checkers.includes(job.checker)).map(r=>r.id);
  const result={packetHash:job.packetHash,checkedElementIds:elements.map(e=>e.id),summary:'Synthetic complete coverage fixture; no reviewer judgement claimed.',findings:[],missingInputs:[],...(options.omitRules?{}:{checkedRuleIds:rules})};
  const r=await call(`/api/reviews/${job.id}/complete`,{leaseId:job.leaseId,contextId:job.contextId,result},true);
  return {job,status:r.status,body:r.body,rules};
 }
 try{
  const f=await seed('LOCAL ESC-4 RE-RUN — synthetic'),route=`/api/cases/${f.id}/escalation-rerun`;
  const rule='Compare every integration named in the sources with the scope, architecture and assumptions sections.';
  const entry={findingIndex:0,checkers:['D1','D6'],rule};
  let d=await detail(f.id);
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[entry]})).status,409,'re-run before ESC-3');
  const reset=await trustReset(f);d=await detail(f.id);
  assert.deepEqual(d.gateFeedback[0].rerunCheckers,['D1','D2','D3','D4','D5','D6']);
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[entry]},false,'outsider@mindmapdigital.ai')).status,403);
  assert.equal((await call(route,{version:d.case.version-1,feedbackId:f.feedback,checklist:[entry]})).status,409);
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[]})).status,400);
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[{...entry,checkers:['D7']}]})).status,422);
  assert.equal((await call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[entry,{...entry,findingIndex:1}]})).status,422);
  const started=await Promise.all([call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[entry]}),call(route,{version:d.case.version,feedbackId:f.feedback,checklist:[entry]})]);
  assert.deepEqual(started.map(r=>r.status).sort(),[200,409]);
  d=await detail(f.id);const item=d.gateFeedback[0];
  assert.equal(item.state,'rerunning');assert.equal(d.case.status,'queued');assert.equal(d.stages[d.case.stageIndex].id,'W3-17');
  assert.equal(item.rerun.draftFiles[0].sha256,reset.sha256);assert.equal(item.rerun.reportHash,item.resetRuns[0].reportHash);
  assert.equal(item.checklist.length,1);assert.equal(item.checklist[0].standing,'proposed');
  // Neither the original drafter nor the fresh drafter can review the re-run.
  assert.equal(await claim(f.context),null);assert.equal(await claim(reset.context),null);
  const first=await review({omitRules:true});assert.equal(first.job.checker,'D1');assert.equal(first.status,422);
  assert.equal(first.rules.length,1);
  const draftFiles=first.job.packet.files.filter((x:any)=>x.role==='draft');assert.deepEqual(draftFiles.map((x:any)=>x.sha256),[reset.sha256]);
  assert.ok(!first.job.packet.files.some((x:any)=>x.id===f.artifact));assert.ok(!JSON.stringify(first.job).includes('OLD_REASONING_CANARY'));assert.ok(!JSON.stringify(first.job).includes('RESET_NOTE_CANARY'));
  // The lease that failed rule coverage expires; a new reviewer instance takes the pass.
  await db.query("UPDATE zora_reviews SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",[first.job.id]);
  let passes=0,last:any;
  for(;;){last=await review();assert.equal(last.status,200,JSON.stringify(last.body));passes++;if(last.body.status!=='reviewing')break;}
  assert.equal(last.body.status,'completed');assert.equal(passes,7);
  d=await detail(f.id);assert.equal(d.stages[d.case.stageIndex].id,'W3-18');assert.equal(d.gateFeedback[0].state,'rerunning');
  // W3-18 proofread runs again: a new drafter submits, then a fresh D6 reviewer applies the D6 rule.
  const drafter=await claim('proofread-'+randomUUID());assert.equal(drafter.stage.id,'W3-18');
  const proofread=await call(`/api/worker/${drafter.id}/complete`,{leaseId:drafter.leaseId,contextId:drafter.contextId,result:{status:'completed',summary:'Synthetic proofread submission of the regenerated draft.',missingInputs:[],outputFiles:[],reviewArtifactIds:[reset.draft],citations:[],reviewReports:[]}},true);
  assert.equal(proofread.status,200);assert.equal(proofread.body.resultStatus,'reviewing');
  const d6=await review();assert.equal(d6.job.checker,'D6');assert.equal(d6.rules.length,1);assert.equal(d6.body.status,'completed');
  d=await detail(f.id);assert.equal(d.case.status,'awaiting_approval');assert.equal(d.stages[d.case.stageIndex].id,'W3-G3');
  const reportHash=d.gateFeedback[0].rerun.reportHash,decision=(body:any,email?:string)=>call(`/api/cases/${f.id}/decision`,{version:d.case.version,action:'approve',...body},false,email);
  assert.equal((await decision({})).status,409);
  assert.equal((await decision({readNotes:[{feedbackId:f.feedback,reportHash:'0'.repeat(64)}]})).status,409);
  assert.ok(JSON.stringify(d).includes('RESET_NOTE_CANARY'),'the gate approver reads the note');
  await call(`/api/cases/${f.id}/team`,{emails:['demo-tester@mindmapdigital.ai']});assert.ok(!JSON.stringify(await detail(f.id,'demo-tester@mindmapdigital.ai')).includes('RESET_NOTE_CANARY'));
  const approved=await decision({readNotes:[{feedbackId:f.feedback,reportHash}]});assert.equal(approved.status,200,JSON.stringify(approved.body));
  d=await detail(f.id);const closed=d.gateFeedback.find((x:any)=>x.id===f.feedback);
  assert.equal(closed.state,'addressed');assert.equal(closed.resolution.stageId,'W3-G3');assert.deepEqual(closed.resolution.reviewedDrafts.map((x:any)=>x.sha256),[reset.sha256]);
  assert.equal(closed.noteReads.length,1);assert.equal(closed.noteReads[0].reportHash,reportHash);assert.ok(d.case.stageIndex>G3);
  // The team decides whether the rule becomes standing for every W3 pursuit.
  const ruleId=closed.checklist[0].id,decide=(decision:string,email:string)=>call(`/api/checklist/${ruleId}`,{decision,note:'Synthetic team decision for the fixture.'},false,email);
  assert.equal((await decide('standing','tester@mindmapdigital.ai')).status,403);
  assert.equal((await decide('standing','admin-tester@mindmapdigital.ai')).status,200);assert.equal((await decide('standing','admin-tester@mindmapdigital.ai')).status,409);
  assert.ok((await packetRules(db,randomUUID(),'W3',['D1'])).some(r=>r.id===ruleId));assert.ok(!(await packetRules(db,randomUUID(),'W4',['D1'])).some(r=>r.id===ruleId));assert.ok(!(await packetRules(db,randomUUID(),'W3',['D2'])).some(r=>r.id===ruleId));
  assert.equal((await decide('declined','admin-tester@mindmapdigital.ai')).status,200);assert.ok(!(await packetRules(db,randomUUID(),'W3',['D1'])).some(r=>r.id===ruleId));
  assert.ok((await packetRules(db,f.id,'W3',['D1'])).some(r=>r.id===ruleId),'a declined rule still applies to its own pursuit');
  // Changed sources after the re-run starts cannot be closed through the same-source path.
  const g=await seed('LOCAL ESC-4 CHANGED SOURCE — synthetic');await trustReset(g);let e=await detail(g.id);
  assert.equal((await call(`/api/cases/${g.id}/escalation-rerun`,{version:e.case.version,feedbackId:g.feedback,checklist:[{...entry,checkers:['D1']}]})).status,200);
  e=await detail(g.id);assert.equal((await call(`/api/cases/${g.id}/revision`,{version:e.case.version,action:'revise',note:'Synthetic changed sources after the re-run started.'})).status,200);
  await db.query("UPDATE zora_cases SET status='awaiting_approval',stage_index=$2 WHERE id=$1",[g.id,G3]);e=await detail(g.id);
  const changed=await call(`/api/cases/${g.id}/decision`,{version:e.case.version,action:'approve',readNotes:[{feedbackId:g.feedback,reportHash:e.gateFeedback[0].rerun.reportHash}]});
  assert.equal(changed.status,409);assert.match(changed.body.error,/Changed-source reconciliation/);
  console.log('Local ESC-4 protocol passed: ESC-3 prerequisite, owner/version/checklist validation, concurrent start, fresh reviewer exclusion, regenerated-draft-only packet, rule coverage, 7-pass return-point loop, downstream D6 rule, note-hash acknowledgement, gate-approver note visibility, controlled closure, admin standing/retire decisions and changed-source hold. Synthetic protocol only; semantic review quality remains unaccepted.');
 }finally{
  for(const id of cases){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_checklist_rules','zora_gate_feedback','zora_draft_contexts','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();
 }
}
main().catch(e=>{console.error(e instanceof Error?e.stack:'Local ESC-4 checks failed');process.exitCode=1;});
