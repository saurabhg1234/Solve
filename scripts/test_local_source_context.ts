/** Real loopback upload/context/progress checks. Never use production settings. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {Pool} from 'pg';
async function main(){
 const env=JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json','utf8'));
 const origin=new URL(env.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(env.DATABASE_URL).hostname,'127.0.0.1');
 const db=new Pool({connectionString:env.DATABASE_URL});const ids:string[]=[];
 const tokens:Record<string,string>={};
 for(const name of ['tester','outsider','demo-tester','pricing-tester'])tokens[name]=await new SignJWT({name:'Synthetic context tester'}).setProtectedHeader({alg:'HS256'}).setSubject(`${name}@mindmapdigital.ai`).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(env.ZORA_SESSION_SECRET));
 async function call(path:string,body?:unknown,method=body===undefined?'GET':'POST',who='tester'){
   const response=await fetch(new URL(path,origin),{method,headers:{Origin:origin.origin,'Content-Type':'application/json',Cookie:`zora_session=${tokens[who]}`},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};
 }
 try{
   const created=await call('/api/cases',{title:'LOCAL source context and progress fixture',client:'Synthetic only',workflow:'W3',briefing:'Synthetic source notes and batch transport verification; never a real client request.'});assert.equal(created.status,201);const id=created.body.case.id;ids.push(id);let version=created.body.case.version;
   const context={category:'answers',label:'Buyer answers',notes:'This is the latest signed answer set. <script>inert</script>'};const sourceIds:string[]=[];
   for(let i=0;i<2;i++){
     const bytes=Buffer.from(`Synthetic source ${i}, for local transport only.`);const sha256=createHash('sha256').update(bytes).digest('hex');
     const init=await call(`/api/cases/${id}/uploads`,{filename:`source-${i}.txt`,mimeType:'text/plain',totalBytes:bytes.length,sha256,version});assert.equal(init.status,201);
     const put=await fetch(new URL(`/api/cases/${id}/uploads/${init.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,Cookie:`zora_session=${tokens.tester}`,'x-zora-offset':'0'},body:bytes});assert.equal(put.status,200);
     if(i===0)assert.equal((await call(`/api/cases/${id}/uploads/${init.body.id}`,{sourceContext:{...context,approved:true}})).status,400);
     const saved=await call(`/api/cases/${id}/uploads/${init.body.id}`,{sourceContext:{...context,label:`File ${i}`}});assert.equal(saved.status,200);version=saved.body.version;sourceIds.push(init.body.id);
   }
   let detail=(await call(`/api/cases/${id}`)).body;assert.equal(detail.sources.length,2);assert.equal(detail.sources[1].provenance.context.label,'File 1');assert.equal(detail.progress.workers.length,0);
   const path=`/api/cases/${id}/sources/${sourceIds[0]}`;
   assert.equal((await call(path,{version,sourceContext:context},'PATCH','outsider')).status,403);
   assert.equal((await call(`/api/cases/${id}`,undefined,'GET','outsider')).status,403);
   await call(`/api/cases/${id}/team`,{emails:['demo-tester@mindmapdigital.ai','pricing-tester@mindmapdigital.ai']});
   assert.equal((await call(path,{version,sourceContext:context},'PATCH','demo-tester')).status,403);
   assert.equal((await call(path,{version:version-1,sourceContext:context},'PATCH')).status,409);
   const oldHash=detail.sources[0].sha256,oldRevision=detail.case.sourceRevision;
   const saved=await call(path,{version,sourceContext:context},'PATCH');assert.equal(saved.status,200);version=saved.body.version;
   detail=(await call(`/api/cases/${id}`)).body;assert.equal(detail.sources[0].sha256,oldHash);assert.equal(detail.case.sourceRevision,oldRevision+1);assert.equal(detail.sources[0].provenance.context.notes,context.notes);
   assert.ok((await call(`/api/cases/${id}/pack`)).body.sources.some((s:any)=>s.provenance.context.label==='Buyer answers'));
   assert.equal((await call(`/api/cases/${id}/decision`,{version,action:'confirm'})).status,200);
   detail=(await call(`/api/cases/${id}`)).body;assert.ok(detail.progress.queuedAt);assert.equal(detail.progress.workers.length,0);
   assert.equal((await call(path,{version:detail.case.version,sourceContext:context},'PATCH')).status,409);
   const claim=await fetch(new URL('/api/worker/claim',origin),{method:'POST',headers:{Authorization:`Bearer ${env.ZORA_RUNNER_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({workerId:'local-context-worker',contextId:'synthetic-source-context-2026'})});assert.equal(claim.status,200);const job=(await claim.json()).job;assert.equal(job.case.id,id);assert.equal(job.sources[0].provenance.context.notes,context.notes);
   detail=(await call(`/api/cases/${id}`)).body;assert.equal(detail.progress.workers[0].name,'local-context-worker');assert.equal(detail.progress.workers[0].kind,'stage');
   const privateBytes=Buffer.from('Synthetic private numbers');const privateId=crypto.randomUUID();
   await db.query("INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,visibility,provenance) VALUES($1,$2,'private.txt','text/plain',$3,$4,'internal',$5)",[privateId,id,privateBytes,createHash('sha256').update(privateBytes).digest('hex'),JSON.stringify({context:{...context,notes:'Private fixture only'}})]);
   detail=(await call(`/api/cases/${id}`)).body;assert.ok(!detail.sources.some((s:any)=>s.id===privateId));assert.equal((await call(`/api/cases/${id}/sources/${privateId}`,{version:detail.case.version,sourceContext:context},'PATCH')).status,403);
   assert.ok((await call(`/api/cases/${id}`,undefined,'GET','pricing-tester')).body.sources.some((s:any)=>s.id===privateId));
   console.log('Source context integration passed: two sequential files, notes in worker/pack, exact bytes, version guards, role/private isolation and truthful live job status.');
 }finally{
   for(const id of ids){for(const table of ['zora_draft_contexts','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}
   await db.end();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
