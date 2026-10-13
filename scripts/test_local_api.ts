/** Local integration checks only; never point this script at a hosted deployment. */
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { Pool } from 'pg';

async function main() {
  const state=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));
  const origin=new URL(state.ZORA_APP_URL);
  assert.equal(origin.hostname,'127.0.0.1','These fixtures are restricted to the local test server');
  const token=await new SignJWT({name:'Local Integration Tester'}).setProtectedHeader({alg:'HS256'}).setSubject('tester@mindmapdigital.ai').setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(state.ZORA_SESSION_SECRET));
  const tokens:Record<string,string>={'tester@mindmapdigital.ai':token};
  for(const email of ['pricing-tester@mindmapdigital.ai','outsider@mindmapdigital.ai','demo-tester@mindmapdigital.ai'])tokens[email]=await new SignJWT({name:'Synthetic Role Tester'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(state.ZORA_SESSION_SECRET));
  const db=new Pool({connectionString:state.DATABASE_URL});
  const ids:string[]=[];const inboxId=randomUUID();const inlineInboxId=randomUUID();
  async function request(path:string,method='GET',body?:unknown,worker=false,auth=true,email='tester@mindmapdigital.ai'){
    const headers:Record<string,string>={'Content-Type':'application/json',Origin:origin.origin};
    if(auth)headers[worker?'Authorization':'Cookie']=worker?`Bearer ${state.ZORA_RUNNER_TOKEN}`:`zora_session=${tokens[email]}`;
    const response=await fetch(new URL(path,origin),{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  const chunk=2*1024*1024;
  async function upload(base:string,metadata:Record<string,unknown>,bytes:Buffer,leaseId?:string){
    const init=await request(base,'POST',{...metadata,totalBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),leaseId},!!leaseId);assert.equal(init.status,201);
    const headers:Record<string,string>={Origin:origin.origin};if(leaseId){headers.Authorization=`Bearer ${state.ZORA_RUNNER_TOKEN}`;headers['x-zora-lease']=leaseId;}else headers.Cookie=`zora_session=${token}`;
    for(let offset=0;offset<bytes.length;offset+=chunk){const r=await fetch(new URL(`${base}/${init.body.id}`,origin),{method:'PUT',headers:{...headers,'x-zora-offset':String(offset)},body:new Uint8Array(bytes.subarray(offset,offset+chunk))});assert.equal(r.status,200);if(offset===0){const replay=await fetch(new URL(`${base}/${init.body.id}`,origin),{method:'PUT',headers:{...headers,'x-zora-offset':'0'},body:new Uint8Array(bytes.subarray(0,Math.min(chunk,bytes.length)))});assert.equal(replay.status,409);}}
    const saved=await request(`${base}/${init.body.id}`,'POST',leaseId?{leaseId}:undefined,!!leaseId);assert.equal(saved.status,200);return {...saved.body,bytes};
  }
  async function download(path:string,size:number,email='tester@mindmapdigital.ai'){
    const parts:Buffer[]=[];for(let offset=0;offset<size;offset+=chunk){const end=Math.min(size-1,offset+chunk-1);const r=await fetch(new URL(path,origin),{headers:{Cookie:`zora_session=${tokens[email]}`,Range:`bytes=${offset}-${end}`}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes ${offset}-${end}/${size}`);parts.push(Buffer.from(await r.arrayBuffer()));}return Buffer.concat(parts);
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
    const large=Buffer.alloc(chunk+8192,97);const largeSource=await upload(`/api/cases/${other.body.case.id}/uploads`,{filename:'large-source.txt',mimeType:'text/plain',version:other.body.case.version},large);
    assert.deepEqual(await download(`/api/cases/${other.body.case.id}/files/sources/${largeSource.id}`,large.length),large);
    assert.equal((await request(`/api/cases/${other.body.case.id}/uploads`,'POST',{filename:'late.txt',mimeType:'text/plain',version:other.body.case.version,totalBytes:1,sha256:createHash('sha256').update('x').digest('hex')})).status,409);
    assert.equal((await request(`/api/cases/${c.id}`,'GET',undefined,false,true,'outsider@mindmapdigital.ai')).status,403);
    assert.equal((await request(`/api/cases/${c.id}/team`,'POST',{emails:['pricing-tester@mindmapdigital.ai','demo-tester@mindmapdigital.ai']})).status,200);
    assert.equal((await request(`/api/cases/${c.id}`,'GET',undefined,false,true,'pricing-tester@mindmapdigital.ai')).status,200);
    assert.equal((await request(`/api/cases/${c.id}/team`,'POST',{emails:[]},false,true,'pricing-tester@mindmapdigital.ai')).status,403);
    assert.equal((await request(`/api/cases/${c.id}/team`,'POST',{emails:['unapproved@example.test']})).status,400);
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
      const result={...done,outputFiles:[] as {path:string;visibility:'client'|'internal';mimeType:string}[]};
      if(stage==='W8-1'){
        const client=Buffer.alloc(chunk+1234,98);const internal=Buffer.from('Synthetic internal cost workpaper: not a client proposal.');
        const missing={...result,outputFiles:[{path:'outputs/client/missing.txt',visibility:'client',mimeType:'text/plain'}]};
        assert.equal((await request(`/api/worker/${job.id}/complete`,'POST',{leaseId:job.leaseId,result:missing},true)).status,409);
        const savedClient=await upload(`/api/worker/${job.id}/uploads`,{filename:'transport-client.txt',path:'outputs/client/transport-client.txt',visibility:'client',mimeType:'text/plain'},client,job.leaseId);
        const savedInternal=await upload(`/api/worker/${job.id}/uploads`,{filename:'transport-internal.txt',path:'outputs/internal/transport-internal.txt',visibility:'internal',mimeType:'text/plain'},internal,job.leaseId);
        const retryMetadata={filename:'transport-client.txt',path:'outputs/client/transport-client.txt',visibility:'client',mimeType:'text/plain',totalBytes:client.length,sha256:createHash('sha256').update(client).digest('hex'),leaseId:job.leaseId};
        const retried=await request(`/api/worker/${job.id}/uploads`,'POST',retryMetadata,true);assert.equal(retried.status,200);assert.equal(retried.body.alreadyStored,true);assert.equal(retried.body.id,savedClient.id);
        assert.equal((await request(`/api/worker/${job.id}/uploads`,'POST',{...retryMetadata,sha256:'0'.repeat(64)},true)).status,409);
        assert.deepEqual(await download(`/api/cases/${c.id}/files/artifacts/${savedClient.id}`,client.length),client);
        assert.equal((await fetch(new URL(`/api/cases/${c.id}/files/artifacts/${savedInternal.id}`,origin),{headers:{Cookie:`zora_session=${token}`}})).status,403);
        assert.deepEqual(await download(`/api/cases/${c.id}/files/artifacts/${savedInternal.id}`,internal.length,'pricing-tester@mindmapdigital.ai'),internal);
        assert.equal((await request(`/api/cases/${c.id}`)).body.artifacts.length,1);assert.equal((await request(`/api/cases/${c.id}`,'GET',undefined,false,true,'pricing-tester@mindmapdigital.ai')).body.artifacts.length,2);
        result.outputFiles=[{path:'outputs/client/transport-client.txt',visibility:'client',mimeType:'text/plain'},{path:'outputs/internal/transport-internal.txt',visibility:'internal',mimeType:'text/plain'}];
        const badHash=await request(`/api/worker/${job.id}/uploads`,'POST',{filename:'wrong.txt',path:'outputs/client/wrong.txt',mimeType:'text/plain',visibility:'client',totalBytes:1,sha256:'0'.repeat(64),leaseId:job.leaseId},true);assert.equal(badHash.status,201);
        const put=await fetch(new URL(`/api/worker/${job.id}/uploads/${badHash.body.id}`,origin),{method:'PUT',headers:{Authorization:`Bearer ${state.ZORA_RUNNER_TOKEN}`,'x-zora-lease':job.leaseId,'x-zora-offset':'0'},body:new Uint8Array([120])});assert.equal(put.status,200);
        assert.equal((await request(`/api/worker/${job.id}/uploads/${badHash.body.id}`,'POST',{leaseId:job.leaseId},true)).status,422);
        assert.equal((await request(`/api/worker/${job.id}/uploads`,'POST',{filename:'bad.txt',path:'outputs/internal/bad.txt',visibility:'client',mimeType:'text/plain',totalBytes:1,sha256:'0'.repeat(64),leaseId:job.leaseId},true)).status,400);
      }
      const finish=await request(`/api/worker/${job.id}/complete`,'POST',{leaseId:job.leaseId,result},true);assert.equal(finish.status,200);
      const replay=await request(`/api/worker/${job.id}/complete`,'POST',{leaseId:job.leaseId,result:done},true);assert.equal(replay.status,409);
    }
    const final=await request(`/api/cases/${c.id}`);assert.equal(final.body.case.status,'blocked');assert.equal(final.body.case.stageIndex,2);
    const report=(await db.query('SELECT result FROM zora_jobs WHERE case_id=$1 AND stage_id=$2',[c.id,'W8-3'])).rows[0].result;
    assert.ok(report.missingInputs.some((s:string)=>s.includes('Independent QC')));
    await db.query('INSERT INTO zora_inbox(id,mailbox,message_id,subject,sender,body_text,received_at) VALUES($1,$2,$3,$4,$5,$6,now())',[inlineInboxId,'local-fixture','fixture-inline-'+inlineInboxId,'[ZORA] Inline-only source fixture','sender@example.test','Synthetic inline evidence; hasAttachments is false.']);
    const inline=await request('/api/cases','POST',{title:'Inline attachment intake fixture',client:'Synthetic Client',workflow:'W1',briefing:'Preserve inline-only attachment evidence before the workflow is confirmed.',inboxId:inlineInboxId});assert.equal(inline.status,201);ids.push(inline.body.case.id);
    const inlineSources=(await db.query('SELECT filename,data,provenance FROM zora_sources WHERE case_id=$1 ORDER BY filename',[inline.body.case.id])).rows;
    assert.equal(inlineSources.length,2);assert.equal(inlineSources[0].filename,'inline-evidence.txt');assert.equal(inlineSources[0].provenance.inline,true);assert.equal(inlineSources[0].data.toString(),'Synthetic inline attachment bytes.');
    const revision=await request(`/api/cases/${c.id}/revision`,'POST',{action:'revise',version:final.body.case.version,note:'Synthetic source revision; approvals and old generation must remain historical.'});assert.equal(revision.status,200);
    const revised=await request(`/api/cases/${c.id}`);assert.equal(revised.body.case.stageIndex,0);assert.equal(revised.body.case.sourceRevision,2);
    assert.equal((await request(`/api/cases/${c.id}/revision`,'POST',{action:'resume',version:final.body.case.version,note:'Stale version must fail.'})).status,409);
    const staleUpload=await request(`/api/cases/${c.id}/uploads`,'POST',{filename:'stale-source.txt',mimeType:'text/plain',totalBytes:1,sha256:createHash('sha256').update('x').digest('hex'),version:revised.body.case.version});assert.equal(staleUpload.status,201);
    assert.equal((await fetch(new URL(`/api/cases/${c.id}/uploads/${staleUpload.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,Cookie:`zora_session=${token}`,'x-zora-offset':'0'},body:new Uint8Array([120])})).status,200);
    assert.equal((await request(`/api/cases/${c.id}/revision`,'POST',{action:'revise',version:revised.body.case.version,note:'Another source baseline supersedes the upload in progress.'})).status,200);
    assert.equal((await request(`/api/cases/${c.id}/uploads/${staleUpload.body.id}`,'POST')).status,409);
    const wrongOrigin=await fetch(new URL('/api/cases',origin),{method:'POST',headers:{Origin:'https://wrong.example',Cookie:`zora_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({})});assert.equal(wrongOrigin.status,403);
    console.log('Local PostgreSQL/API checks passed: chunked sources/outputs, byte-accurate downloads, hash/offset failures, team isolation, internal-file privacy, missing-output denial, leases/replays, revisions, QC hold and origin enforcement.');
  } finally {
    await db.query('DELETE FROM zora_inbox WHERE id=$1',[inboxId]);
    await db.query('DELETE FROM zora_inbox WHERE id=$1',[inlineInboxId]);
    for(const id of ids){
      await db.query('DELETE FROM zora_uploads WHERE case_id=$1',[id]);await db.query('DELETE FROM zora_case_members WHERE case_id=$1',[id]);
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
