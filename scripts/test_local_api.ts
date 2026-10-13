/** Local integration checks only; never point this script at a hosted deployment. */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { Pool } from 'pg';

async function main() {
  const state=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));
  const origin=new URL(state.ZORA_APP_URL);
  assert.equal(origin.hostname,'127.0.0.1','These fixtures are restricted to the local test server');
  const token=await new SignJWT({name:'Local Integration Tester'}).setProtectedHeader({alg:'HS256'}).setSubject('tester@mindmapdigital.ai').setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(state.ZORA_SESSION_SECRET));
  const db=new Pool({connectionString:state.DATABASE_URL});
  const ids:string[]=[];const inboxId=randomUUID();
  async function request(path:string,method='GET',body?:unknown,worker=false,auth=true){
    const headers:Record<string,string>={'Content-Type':'application/json',Origin:origin.origin};
    if(auth)headers[worker?'Authorization':'Cookie']=worker?`Bearer ${state.ZORA_RUNNER_TOKEN}`:`zora_session=${token}`;
    const response=await fetch(new URL(path,origin),{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  try {
    assert.equal((await request('/api/cases','GET',undefined,false,false)).status,401);
    const workspace=await request('/api/workspace');assert.equal(workspace.body.user.email,'tester@mindmapdigital.ai');
    await db.query('INSERT INTO zora_inbox(id,mailbox,message_id,subject,sender,body_text,received_at) VALUES($1,$2,$3,$4,$5,$6,now())',[inboxId,'local-fixture','fixture-'+inboxId,'[ZORA] W8 integration fixture','sender@example.test','A synthetic email source for local intake validation.']);
    const created=await request('/api/cases','POST',{title:'Local email intake fixture',client:'Synthetic Client',workflow:'W8',briefing:'Draft an internal test note with no client commitments.',inboxId});
    assert.equal(created.status,201);const c=created.body.case;ids.push(c.id);assert.equal(c.source,'email');assert.equal(c.status,'queued');
    const source=(await db.query('SELECT id,filename,data,sha256 FROM zora_sources WHERE case_id=$1',[c.id])).rows;
    assert.equal(source.length,1);assert.equal(source[0].filename,'request-email.txt');assert.ok(source[0].data.toString().includes('synthetic email source'));assert.equal(source[0].sha256.length,64);
    const duplicate=await request('/api/cases','POST',{title:'Duplicate email fixture',client:'Synthetic Client',workflow:'W8',briefing:'Do not duplicate this existing email-linked pursuit.',inboxId});assert.equal(duplicate.status,409);
    const pack=await fetch(new URL(`/api/cases/${c.id}/pack`,origin),{headers:{Cookie:`zora_session=${token}`}});assert.equal(pack.status,200);assert.equal((await pack.json()).case.source,'email');
    const done={status:'completed',summary:'Synthetic stage result for local queue verification.',missingInputs:[],outputFiles:[],citations:[],reviewReports:[]};
    const other=await request('/api/cases','POST',{title:'Other pursuit source fixture',client:'Other Synthetic Client',workflow:'W1',briefing:'Await human confirmation; this fixture must not enter the stage queue.'});
    assert.equal(other.status,201);ids.push(other.body.case.id);const otherSource=randomUUID();
    await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,$3,$4,$5,$6)',[otherSource,other.body.case.id,'other.txt','text/plain',source[0].data,source[0].sha256]);
    for(const stage of ['W8-1','W8-2','W8-3']){
      const claim=await request('/api/worker/claim','POST',{workerId:'local-integration-test'},true);assert.equal(claim.status,200);const job=claim.body.job;assert.equal(job.case.id,c.id);assert.equal(job.stage.id,stage);
      if(stage==='W8-1'){
        const path=`/api/worker/${job.id}/sources/${source[0].id}?leaseId=${job.leaseId}`;
        const headers={Authorization:`Bearer ${state.ZORA_RUNNER_TOKEN}`};
        assert.equal((await fetch(new URL(path,origin))).status,401);
        const downloaded=await fetch(new URL(path,origin),{headers});assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('x-zora-sha256'),source[0].sha256);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),source[0].data);
        assert.equal((await fetch(new URL(`/api/worker/${job.id}/sources/${source[0].id}?leaseId=${randomUUID()}`,origin),{headers})).status,409);
        assert.equal((await fetch(new URL(`/api/worker/${job.id}/sources/${otherSource}?leaseId=${job.leaseId}`,origin),{headers})).status,404);
      }
      const heartbeat=await request(`/api/worker/${job.id}/heartbeat`,'POST',{leaseId:job.leaseId},true);assert.equal(heartbeat.status,200);
      const finish=await request(`/api/worker/${job.id}/complete`,'POST',{leaseId:job.leaseId,result:done},true);assert.equal(finish.status,200);
      const replay=await request(`/api/worker/${job.id}/complete`,'POST',{leaseId:job.leaseId,result:done},true);assert.equal(replay.status,409);
    }
    const final=await request(`/api/cases/${c.id}`);assert.equal(final.body.case.status,'blocked');assert.equal(final.body.case.stageIndex,2);
    const report=(await db.query('SELECT result FROM zora_jobs WHERE case_id=$1 AND stage_id=$2',[c.id,'W8-3'])).rows[0].result;
    assert.ok(report.missingInputs.some((s:string)=>s.includes('Independent QC')));
    const wrongOrigin=await fetch(new URL('/api/cases',origin),{method:'POST',headers:{Origin:'https://wrong.example',Cookie:`zora_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({})});assert.equal(wrongOrigin.status,403);
    console.log('Local PostgreSQL/API checks passed: authentication, source integrity, lease-bound/case-scoped source downloads, duplicate protection, request pack, heartbeat, replay denial, QC hold and origin enforcement.');
  } finally {
    await db.query('DELETE FROM zora_inbox WHERE id=$1',[inboxId]);
    for(const id of ids){
      await db.query('DELETE FROM zora_approvals WHERE case_id=$1',[id]);
      await db.query('DELETE FROM zora_artifacts WHERE case_id=$1',[id]);
      await db.query('DELETE FROM zora_sources WHERE case_id=$1',[id]);
      await db.query('DELETE FROM zora_events WHERE case_id=$1',[id]);
      await db.query('DELETE FROM zora_jobs WHERE case_id=$1',[id]);
      await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);
    }
    await db.end();
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local test failed');process.exitCode=1;});
