/** Local synthetic API/security fixture. Never runs against production. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
import {hashBytes} from '../lib/files';

async function main(){
  const config=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8')),origin=new URL(config.ZORA_APP_URL);
  assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(config.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:config.DATABASE_URL}),ids=[randomUUID(),randomUUID()],tokens:Record<string,string>={};
  for(const email of ['tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])tokens[email]=await new SignJWT({name:'Synthetic delivery fixture'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(config.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,who='runner',extra:Record<string,string>={}){
    const response=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(who==='runner'?{Authorization:`Bearer ${config.ZORA_RUNNER_TOKEN}`}:who==='unsigned'?{}:{Cookie:`zora_session=${tokens[who]}`}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text(),headers:response.headers};
  }
  try{
    for(const id of ids)await db.query("INSERT INTO zora_cases(id,title,client,workflow,status,source,requested_by,briefing) VALUES($1,'LOCAL direct work','Synthetic','W3','blocked','manual','tester@mindmapdigital.ai','Meeting notes: reconcile invoices with receipts.')",[id]);
    const source=randomUUID(),privateSource=randomUUID(),bytes=Buffer.from('Synthetic buyer requirements, no real client content.'),privateBytes=Buffer.from('Private synthetic pricing source.');
    for(const [id,visibility] of [[source,'client'],[privateSource,'internal']])await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,visibility) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,ids[0],id+'.txt','text/plain',visibility==='internal'?privateBytes:bytes,hashBytes(visibility==='internal'?privateBytes:bytes),visibility]);
    const file=Buffer.from('Corrected synthetic proposal for review. No independent pass is claimed.');
    const input={id:randomUUID(),caseId:ids[0],version:1,sourceRevision:1,contextId:'synthetic-delivery-'+randomUUID(),title:'Completed correction work',summary:'Synthetic correction delivered without changing workflow or approval state.',visibility:'client',sources:[{id:source,sha256:hashBytes(bytes)}],files:[{filename:'corrected.txt',mimeType:'text/plain',sha256:hashBytes(file),base64:file.toString('base64')}]};
    const path='/api/worker/deliveries';
    assert.equal((await call(path,input,'unsigned')).status,401);
    assert.equal((await call(path,input,'tester@mindmapdigital.ai')).status,401,'Human cookie cannot use worker publishing');
    assert.equal((await call(path,{...input,independentQcCompleted:true})).status,400);
    assert.equal((await call(path,{...input,version:99})).status,409);
    assert.equal((await call(path,{...input,sources:[{id:source,sha256:'0'.repeat(64)}]})).status,409);
    assert.equal((await call(path,{...input,sources:[input.sources[0],input.sources[0]]})).status,400);
    assert.equal((await call(path,{...input,sources:[{id:privateSource,sha256:hashBytes(privateBytes)}]})).status,403);
    assert.equal((await call(path,{...input,caseId:ids[1]})).status,409,'Foreign source rejected');
    assert.equal((await call(path,{...input,files:[{...input.files[0],sha256:'0'.repeat(64)}]})).status,422);
    assert.equal((await call(path,{...input,files:[{...input.files[0],filename:'../bad.txt'}]})).status,400);
    const concurrent=await Promise.all([call(path,input),call(path,input)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,201]);
    assert.equal(concurrent[0].body.independentQcCompleted,false);assert.equal(concurrent[0].body.humanApprovalRecorded,false);
    assert.equal((await call(path,{...input,title:'Different content same identifier'})).status,409);
    const privateDelivery={...input,id:randomUUID(),title:'PRIVATE_DELIVERY_CANARY',summary:'PRIVATE_SUMMARY_CANARY remains restricted to internal roles.',visibility:'internal',sources:[{id:privateSource,sha256:hashBytes(privateBytes)}]};
    assert.equal((await call(path,privateDelivery)).status,201);
    const owner=await call(`/api/cases/${ids[0]}`,undefined,'tester@mindmapdigital.ai');assert.equal(owner.status,200);assert.equal(owner.body.deliveries.length,1);assert.ok(!JSON.stringify(owner.body).includes('PRIVATE_DELIVERY_CANARY'));assert.ok(!JSON.stringify(owner.body).includes('PRIVATE_SUMMARY_CANARY'));assert.equal(owner.body.progress.executionMode,'on_request');
    const saved=owner.body.deliveries[0].files[0];assert.equal(saved.sha256,hashBytes(file));
    const filePath=`/api/cases/${ids[0]}/files/deliveries/${saved.id}`;
    assert.equal((await call(filePath,undefined,'unsigned')).status,401);
    assert.equal((await call(filePath,undefined,'outsider@mindmapdigital.ai')).status,403);
    const downloaded=await call(filePath,undefined,'tester@mindmapdigital.ai');assert.equal(downloaded.status,200);assert.equal(downloaded.body,file.toString());assert.equal(downloaded.headers.get('x-zora-sha256'),hashBytes(file));
    const partial=await call(filePath,undefined,'tester@mindmapdigital.ai',{Range:'bytes=1-5'});assert.equal(partial.status,206);assert.equal(partial.body,file.subarray(1,6).toString());
    assert.equal((await call(filePath,undefined,'tester@mindmapdigital.ai',{Range:'bytes=0-999999'})).status,416);
    assert.equal((await call(`/api/cases/${ids[1]}/files/deliveries/${saved.id}`,undefined,'tester@mindmapdigital.ai')).status,404);
    const privateFile=(await db.query('SELECT id FROM zora_delivery_files WHERE delivery_id=$1',[privateDelivery.id])).rows[0].id;
    assert.equal((await call(`/api/cases/${ids[0]}/files/deliveries/${privateFile}`,undefined,'tester@mindmapdigital.ai')).status,403);
    await db.query("INSERT INTO zora_case_members(case_id,email,added_by) VALUES($1,'pricing-tester@mindmapdigital.ai','local-fixture')",[ids[0]]);
    assert.equal((await call(`/api/cases/${ids[0]}`,undefined,'pricing-tester@mindmapdigital.ai')).body.deliveries.length,2);
    const unchanged=(await db.query('SELECT status,version,source_revision,stage_index FROM zora_cases WHERE id=$1',[ids[0]])).rows[0];assert.deepEqual(unchanged,{status:'blocked',version:1,source_revision:1,stage_index:0});
    for(const name of ['zora_jobs','zora_approvals','zora_reviews'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${name} WHERE case_id=$1`,[ids[0]])).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM zora_events WHERE case_id=$1 AND type='work.delivered'",[ids[0]])).rows[0].n,2,'Retry did not duplicate audit event');
    const cliDir=await mkdtemp(join(tmpdir(),'zora-direct-cli-'));
    try{
      const {contextId,...withoutContext}=input;const plan={...withoutContext,id:randomUUID(),files:[{path:'draft.txt',mimeType:'text/plain'}]};
      await writeFile(join(cliDir,'draft.txt'),file);await writeFile(join(cliDir,'plan.json'),JSON.stringify(plan));
      const out=execFileSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts','deliver',join(cliDir,'plan.json')],{cwd:process.cwd(),env:{...process.env,...config,NODE_USE_ENV_PROXY:'',VERCEL_TOKEN:'',ZORA_NOTIFICATION_BYPASS:'',CODEX_THREAD_ID:'synthetic-cli-'+randomUUID()},encoding:'utf8'});
      assert.equal(JSON.parse(out).recorded,true);const receipt=JSON.parse(await readFile(join(cliDir,'plan.json.receipt.json'),'utf8'));assert.equal(receipt.id,plan.id);assert.equal(receipt.files[0].sha256,hashBytes(file));
    }finally{await rm(cliDir,{recursive:true,force:true});}
    const review=await call(`/api/cases/${ids[0]}/existing-review`,{version:1,draftSourceIds:[source],sourceIds:[],brief:'Synthetic meeting notes for invoice matching.'},'tester@mindmapdigital.ai');assert.equal(review.status,201);
    const resetJob=randomUUID();await db.query('INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,reset_packet,reset_packet_hash) VALUES($1,$2,\'ESC-3\',2,1,$3,$4)',[resetJob,ids[0],JSON.stringify({sources:[],baselines:[],findings:[],explanations:[]}),'synthetic-unclaimed-reset']);
    const self=await call('/api/worker/claim',{contextId:input.contextId,workerId:'synthetic-direct-fixture'});assert.equal(self.body.job,null,'Direct producer cannot become independent reviewer');
    await db.query('DELETE FROM zora_jobs WHERE id=$1',[resetJob]);
    const fresh=await call('/api/worker/claim',{contextId:'synthetic-fresh-'+randomUUID(),workerId:'synthetic-direct-fixture'});assert.equal(fresh.body.job?.kind,'review');
    const asReviewer=await call(path,{...input,id:randomUUID(),version:2,contextId:fresh.body.job.contextId});assert.equal(asReviewer.status,409,'Independent reviewer cannot publish direct drafting on same case');
    assert.equal((await call(path,{...input,id:randomUUID()})).status,409,'Earlier-version delivery rejected');
    assert.equal((await call(path,input)).status,200,'Exact old receipt remains safely idempotent after version change');
    await db.query("UPDATE zora_cases SET status='released' WHERE id=$1",[ids[0]]);
    assert.equal((await call(path,{...input,id:randomUUID(),version:2})).status,409);
    console.log('Direct delivery API passed: auth, exact source/version binding, private-source protection, byte hashes, atomic replay, immutable receipts, case/file privacy, ranges, producer/reviewer isolation, released-case guard, unchanged workflow/QC/approvals.');
  }finally{
    for(const id of ids){for(const name of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_draft_contexts','zora_jobs','zora_direct_deliveries','zora_case_members','zora_sources','zora_events'])await db.query(`DELETE FROM ${name} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
