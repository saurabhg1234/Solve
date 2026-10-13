/** Real local transport/rendering fixtures; never a client deliverable or semantic acceptance. */
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,rm,copyFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve,join } from 'node:path';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import { downloadFiles } from '../worker/transport';
import { inventory } from '../lib/review-manifest';
import { stagesFor } from '../lib/engine';

async function main(){
  const local=JSON.parse(await readFile('/workspace/solve-environment/zora-local-test.json','utf8'));
  if(process.env.ZORA_LOCAL_TEST_ORIGIN)local.ZORA_APP_URL=process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin=new URL(local.ZORA_APP_URL);assert.equal(origin.hostname,'127.0.0.1');assert.equal(new URL(local.DATABASE_URL).hostname,'127.0.0.1');
  const db=new Pool({connectionString:local.DATABASE_URL});const privateRoot=resolve('.zora/local-documents-'+randomUUID());
  const cookie=await new SignJWT({name:'Synthetic local document tester'}).setProtectedHeader({alg:'HS256'}).setSubject('tester@mindmapdigital.ai').setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(local.ZORA_SESSION_SECRET));
  const env={...process.env,...local,ZORA_WORK_ROOT:privateRoot,ZORA_NOTIFICATION_BYPASS:'',VERCEL_TOKEN:''};
  const python='/workspace/solve-environment/.venv/bin/python';let caseId:string|undefined;const caseIds:string[]=[];
  const roleTokens:Record<string,string>={'tester@mindmapdigital.ai':cookie};
  for(const email of ['demo-tester@mindmapdigital.ai','outsider@mindmapdigital.ai'])roleTokens[email]=await new SignJWT({name:'Synthetic scoped reviewer'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(local.ZORA_SESSION_SECRET));
  async function call(path:string,body?:unknown,worker=false,email='tester@mindmapdigital.ai'){
    const response=await fetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin.origin,'Content-Type':'application/json',...(worker?{Authorization:`Bearer ${local.ZORA_RUNNER_TOKEN}`}:{Cookie:`zora_session=${roleTokens[email]}`})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};
  }
  async function upload(job:any,path:string,data:Buffer,purpose:string,visibility='internal',mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
    const initialized=await call(`/api/worker/${job.id}/uploads`,{leaseId:job.leaseId,path,filename:path.split('/').at(-1),visibility,mimeType,purpose,totalBytes:data.length,sha256:createHash('sha256').update(data).digest('hex')},true);assert.equal(initialized.status,201);
    assert.equal((await fetch(new URL(`/api/worker/${job.id}/uploads/${initialized.body.id}`,origin),{method:'PUT',headers:{Authorization:`Bearer ${local.ZORA_RUNNER_TOKEN}`,'x-zora-lease':job.leaseId,'x-zora-offset':'0'},body:new Uint8Array(data)})).status,200);assert.equal((await call(`/api/worker/${job.id}/uploads/${initialized.body.id}`,{leaseId:job.leaseId},true)).status,200);return initialized.body.id;
  }
  function native(action:string,workspace:string,context:string,plan?:string){
    return spawnSync(process.execPath,['--import','tsx','scripts/cloud_routine.ts',action,workspace,...(plan?[plan]:[])],{env:{...env,CODEX_THREAD_ID:context},encoding:'utf8',timeout:120000});
  }
  try{
    const created=await call('/api/cases',{title:'LOCAL DOCUMENT VERIFICATION — not a proposal',client:'Synthetic client only',workflow:'W1',briefing:'Verify local document preparation, approved-template editing, rendering and file transport only. This is not company research, a real proposal or a human approval.'});assert.equal(created.status,201);caseId=created.body.case.id;caseIds.push(caseId!);
    const bytes=Buffer.from('00:01:12 Synthetic source: acknowledge receipt only.\n00:02:10 No client price or deadline is approved.');
    const initial=await call(`/api/cases/${caseId}/uploads`,{filename:'synthetic-transcript.txt',mimeType:'text/plain',totalBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),version:created.body.case.version});assert.equal(initial.status,201);
    assert.equal((await fetch(new URL(`/api/cases/${caseId}/uploads/${initial.body.id}`,origin),{method:'PUT',headers:{Origin:origin.origin,Cookie:`zora_session=${cookie}`,'x-zora-offset':'0'},body:new Uint8Array(bytes)})).status,200);
    assert.equal((await call(`/api/cases/${caseId}/uploads/${initial.body.id}`,{})).status,200);
    const pursuit=(await call(`/api/cases/${caseId}`)).body.case;
    assert.equal((await call(`/api/cases/${caseId}/decision`,{version:pursuit.version,action:'confirm'})).status,200);
    const context='synthetic-document-'+randomUUID();const claimed=await call('/api/worker/claim',{workerId:'local-document-fixture',contextId:context},true);assert.equal(claimed.status,200);const job=claimed.body.job;assert.equal(job.case.id,caseId);assert.equal(job.stage.id,'W1-1');
    const dir=join(privateRoot,job.id);await mkdir(dir,{recursive:true,mode:0o700});await writeFile(join(dir,'request.json'),JSON.stringify(job),{mode:0o600});
    Object.assign(process.env,local);process.env.ZORA_NOTIFICATION_BYPASS='';process.env.VERCEL_TOKEN='';
    await downloadFiles(job,job.sources,dir,'sources');await downloadFiles(job,job.artifacts,dir,'artifacts');
    const prepared=native('prepare',dir,context);assert.equal(prepared.status,0,'Native source helper must preserve its live lease');
    const evidence=JSON.parse(await readFile(join(dir,'prepared/evidence.json'),'utf8'));assert.equal(evidence.status,'prepared');assert.equal(evidence.evidence[0].timestamp,'00:01:12');assert.equal(evidence.evidence[0].verified,false);
    const template=resolve('AI_Solutioning_Agent_BRD_v1.0/02_Templates/Reference deck/Reference_Deck_Slides.pptx');
    const inspected=spawnSync(python,['scripts/build_documents.py','inspect',template,'--format','pptx'],{encoding:'utf8',timeout:30000});assert.equal(inspected.status,0);const details=JSON.parse(inspected.stdout);const part=details.parts.find((p:any)=>p.part==='ppt/slides/slide8.xml');
    const plan={format:'pptx',template,templateSha256:details.templateSha256,approvedTemplate:true,slides:[{sourceSlide:8,edits:part.texts.map((x:any)=>({index:x.index,expected:x.text,text:x.index===0?'LOCAL VERIFICATION':'Synthetic fixture only'})),retained:[]}],output:'outputs/client/verification.pptx',pdf:true};
    await writeFile(join(dir,'build-plan.json'),JSON.stringify(plan),{mode:0o600});
    assert.notEqual(native('build',dir,'different-synthetic-task','build-plan.json').status,0,'Context mismatch must stop the document helper');
    await writeFile(join(privateRoot,'outside-plan.json'),JSON.stringify(plan),{mode:0o600});assert.notEqual(native('build',dir,context,'../outside-plan.json').status,0,'Plan paths outside the claimed workspace must fail');
    const built=native('build',dir,context,'build-plan.json');assert.equal(built.status,0,'Approved-template/PDF builder must work with filtered process environment');
    const pictures=spawnSync(python,['-c',`
import sys,json,hashlib
from pathlib import Path
from PIL import Image
from pptx import Presentation
from pptx.util import Inches
sys.path.insert(0,'scripts')
from build_documents import inspect
root=Path(sys.argv[1]);old=root/'fixture-old.png';new=root/'fixture-new.png'
Image.new('RGB',(400,200),'blue').save(old);Image.new('RGB',(800,400),'red').save(new)
p=Presentation();slide=p.slides.add_slide(p.slide_layouts[6]);slide.shapes.add_textbox(Inches(.5),Inches(.2),Inches(6),Inches(.5)).text='Synthetic picture transport only'
for n in range(2):slide.shapes.add_picture(str(old),Inches(.5+n*4),Inches(1),width=Inches(3))
template=root/'synthetic-picture-template.pptx';p.save(template);details=inspect(template,'pptx');part=details['parts'][0]
plan={'format':'pptx','template':str(template),'templateSha256':details['templateSha256'],'approvedTemplate':True,'output':'outputs/client/picture-verification.pptx','pdf':True,'slides':[{'sourceSlide':1,'edits':[],'retained':[{'index':x['index'],'expected':x['text']} for x in part['texts']],'images':[{'index':0,'expectedSha256':part['images'][0]['sha256'],'path':new.name,'sha256':hashlib.sha256(new.read_bytes()).hexdigest(),'altText':'Synthetic changed picture for byte and caption verification only.','sourceNote':'Synthetic local fixture generated for transport validation, not a client diagram.'}],'retainedImages':[{'index':1,'expectedSha256':part['images'][1]['sha256']}]}]}
(root/'picture-plan.json').write_text(json.dumps(plan))
`,dir],{encoding:'utf8',timeout:30000});assert.equal(pictures.status,0);
    assert.equal(native('build',dir,context,'picture-plan.json').status,0,'Native picture build retains its lease and approved source layout');
    const pictureReport=JSON.parse(await readFile(join(dir,'outputs/internal/picture-verification.pptx.build.json'),'utf8'));assert.equal(pictureReport.imageReplacements.length,1);assert.equal(pictureReport.imageReplacements[0].newSha256,createHash('sha256').update(await readFile(join(dir,'fixture-new.png'))).digest('hex'));
    assert.equal((await call(`/api/worker/${job.id}/uploads`,{leaseId:job.leaseId,path:'outputs/internal/rfi-tracker.xlsx',filename:'rfi-tracker.xlsx',visibility:'internal',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',purpose:'rfi_review',totalBytes:1,sha256:'0'.repeat(64)},true)).status,400,'An unrelated workflow cannot expose an internal workbook as RFI review');
    const report=JSON.parse(await readFile(join(dir,'outputs/internal/verification.pptx.build.json'),'utf8'));assert.equal(report.qcRequired,true);
    await copyFile(join(dir,'prepared/evidence.json'),join(dir,'outputs/internal/source-evidence.json'));
    const rfiPlan={questionCap:2,anonymised:true,buyerTemplateRequired:false,questions:[{id:'Q1',rank:1,simple:'Which channel should we use to acknowledge receipt?',complex:'Please identify the receipt acknowledgment channel. This is a synthetic export fixture.',answerState:'not_found',impacts:['design'],impactReason:'The channel affects the acknowledgment integration design.',searchedEvidenceIds:evidence.evidence.map((e:any)=>e.id),citations:[{evidenceId:evidence.evidence[0].id,quote:evidence.evidence[0].text}]}]};
    await writeFile(join(dir,'rfi-plan.json'),JSON.stringify(rfiPlan),{mode:0o600});assert.equal(native('build-rfi',dir,context,'rfi-plan.json').status,0,'Leased native RFI workbook export must succeed');
    const result={status:'blocked',summary:'Local native document and transport fixture completed. This is not actual company research, a semantic review or a client proposal.',missingInputs:['Synthetic verification only: real client research and full workflow acceptance are outside this fixture.'],outputFiles:[{path:'outputs/client/verification.pptx',visibility:'client',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',purpose:'draft'},{path:'outputs/client/verification.pdf',visibility:'client',mimeType:'application/pdf',purpose:'draft'},{path:'outputs/client/clarification-questions.xlsx',visibility:'client',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',purpose:'draft'},{path:'outputs/internal/rfi-tracker.xlsx',visibility:'internal',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',purpose:'workpaper'},{path:'outputs/internal/rfi-build.json',visibility:'internal',mimeType:'application/json',purpose:'workpaper'},{path:report.buildReport,visibility:'internal',mimeType:'application/json',purpose:'workpaper'},{path:'outputs/internal/source-evidence.json',visibility:'internal',mimeType:'application/json',purpose:'workpaper'}],citations:[],reviewReports:[]};
    result.outputFiles.push({path:'outputs/client/picture-verification.pptx',visibility:'client',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',purpose:'draft'},{path:'outputs/client/picture-verification.pdf',visibility:'client',mimeType:'application/pdf',purpose:'draft'},{path:pictureReport.buildReport,visibility:'internal',mimeType:'application/json',purpose:'workpaper'});
    await writeFile(join(dir,'result.json'),JSON.stringify(result),{mode:0o600});const complete=native('complete',dir,context);assert.equal(complete.status,0,'Native generated files must persist before completion');
    const stored=(await db.query('SELECT * FROM zora_artifacts WHERE case_id=$1',[caseId])).rows;assert.equal(stored.length,10);
    for(const file of stored){assert.equal(file.sha256,createHash('sha256').update(file.data).digest('hex'));const own=await readFile(join(dir,file.source_path));assert.deepEqual(file.data,own);if(file.visibility==='client'){const elements=await inventory({...file,role:'draft'});assert.ok(elements.some(e=>e.kind==='word'));if(file.filename==='picture-verification.pptx')assert.ok(elements.some(e=>e.kind==='caption'&&e.text==='Synthetic changed picture for byte and caption verification only.'));assert.ok(elements.some(e=>file.filename.endsWith('.xlsx')?e.kind==='table_cell':e.kind==='image'||e.kind==='diagram'));}}
    const client=(await call(`/api/cases/${caseId}`)).body;assert.equal(client.artifacts.length,5,'Private trackers/evidence/build reports must not leak to the consultant role');assert.equal(client.case.status,'blocked');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM zora_approvals WHERE case_id=$1',[caseId])).rows[0].count,0);
    const scoped=await call('/api/cases',{title:'LOCAL RFI ACCESS VERIFICATION — not a pursuit',client:'Synthetic client only',workflow:'W5',briefing:'Isolated W5-11 permission fixture. Earlier workflow processing is deliberately unrun; no pilot or semantic acceptance is claimed.'});assert.equal(scoped.status,201);const scopedId=scoped.body.case.id;caseIds.push(scopedId);
    // Seed one exact fixture stage only in the owned local database; no fake approvals.
    await db.query("UPDATE zora_cases SET status='blocked',stage_index=$2 WHERE id=$1",[scopedId,stagesFor('W5').findIndex(stage=>stage.id==='W5-11')]);await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),scopedId,'synthetic-source.txt','text/plain',bytes,createHash('sha256').update(bytes).digest('hex')]);
    assert.equal((await call(`/api/cases/${scopedId}/team`,{emails:['demo-tester@mindmapdigital.ai']})).status,200);
    assert.equal((await call(`/api/cases/${scopedId}/revision`,{version:scoped.body.case.version,action:'resume',note:'Resume only this synthetic permission fixture.'})).status,200);
    const crosscheck=(await call('/api/worker/claim',{workerId:'local-rfi-access-fixture',contextId:'synthetic-rfi-'+randomUUID()},true)).body.job;assert.equal(crosscheck.case.id,scopedId);assert.equal(crosscheck.stage.id,'W5-11');
    const trackerId=await upload(crosscheck,'outputs/internal/rfi-tracker.xlsx',await readFile(join(dir,'outputs/internal/rfi-tracker.xlsx')),'rfi_review');
    await upload(crosscheck,'outputs/client/clarification-questions.xlsx',await readFile(join(dir,'outputs/client/clarification-questions.xlsx')),'draft','client');
    const privateId=await upload(crosscheck,'outputs/internal/private-cost.txt',Buffer.from('PRIVATE_COST_CANARY: private synthetic hours and rates.'),'workpaper','internal','text/plain');
    assert.equal((await call(`/api/cases/${scopedId}`)).body.artifacts.length,2);assert.equal((await call(`/api/cases/${scopedId}/pack`)).body.artifacts.length,2);
    const fileUrl=`/api/cases/${scopedId}/files/artifacts/${trackerId}`;
    assert.equal((await fetch(new URL(fileUrl,origin),{headers:{Cookie:`zora_session=${cookie}`}})).status,200,'Assigned consultant can download this internal cross-check sheet');
    assert.equal((await fetch(new URL(`/api/cases/${scopedId}/files/artifacts/${privateId}`,origin),{headers:{Cookie:`zora_session=${cookie}`}})).status,403,'Commercial workpapers remain restricted');
    assert.equal((await fetch(new URL(fileUrl,origin),{headers:{Cookie:`zora_session=${roleTokens['demo-tester@mindmapdigital.ai']}`}})).status,403,'Demo team membership does not confer RFI review');
    assert.equal((await fetch(new URL(fileUrl,origin),{headers:{Cookie:`zora_session=${roleTokens['outsider@mindmapdigital.ai']}`}})).status,403,'An unassigned consultant cannot read another pursuit');
    const completed=await call(`/api/worker/${crosscheck.id}/complete`,{leaseId:crosscheck.leaseId,contextId:crosscheck.contextId,result:{status:'completed',summary:'Synthetic RFI access fixture. No actual source search or reviewer judgement is claimed.',missingInputs:[],citations:[],reviewReports:[],outputFiles:[{path:'outputs/internal/rfi-tracker.xlsx',visibility:'internal',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',purpose:'rfi_review'},{path:'outputs/client/clarification-questions.xlsx',visibility:'client',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',purpose:'draft'},{path:'outputs/internal/private-cost.txt',visibility:'internal',mimeType:'text/plain',purpose:'workpaper'}]}},true);assert.equal(completed.body.resultStatus,'reviewing');
    const reviewer=(await call('/api/worker/claim',{workerId:'local-rfi-review-fixture',contextId:'synthetic-rfi-review-'+randomUUID()},true)).body.job;assert.equal(reviewer.kind,'review');assert.ok(reviewer.packet.files.some((f:any)=>f.id===trackerId&&f.role==='reference'));assert.ok(!reviewer.packet.files.some((f:any)=>f.id===privateId));
    const inventoryPage=await call(`/api/reviews/${reviewer.id}/inventory?leaseId=${reviewer.leaseId}`,undefined,true);const elements=inventoryPage.body.elements;assert.equal(inventoryPage.body.nextOffset,null);
    assert.equal((await call(`/api/reviews/${reviewer.id}/complete`,{leaseId:reviewer.leaseId,contextId:reviewer.contextId,result:{packetHash:reviewer.packetHash,summary:'Synthetic role visibility finding fixture only.',checkedElementIds:elements.map((e:any)=>e.id),findings:[{elementId:elements.find((e:any)=>e.fileId===trackerId).id,severity:'major',kind:'source',description:'RFI_REVIEW_CANARY: the referenced receipt channel still requires an answer.',evidence:'The synthetic source names no acknowledgment channel.'}],missingInputs:[]}},true)).status,200);
    const consultantView=(await call(`/api/cases/${scopedId}`)).body;assert.equal(consultantView.reviews[0].restricted,false);assert.ok(JSON.stringify(consultantView.reviews).includes('RFI_REVIEW_CANARY'));assert.ok(!JSON.stringify(consultantView).includes('PRIVATE_COST_CANARY'));
    const demoView=(await call(`/api/cases/${scopedId}`,undefined,false,'demo-tester@mindmapdigital.ai')).body;assert.equal(demoView.reviews[0].restricted,true);assert.ok(!JSON.stringify(demoView).includes('RFI_REVIEW_CANARY'));
    console.log('Native document integration passed: leased source preparation, timestamps/hashes, approved-template PPT/PDF generation, separate buyer/internal RFI workbooks, filtered child environment, context/path guards, ten persisted artifacts including isolated picture replacement, tagged PDF/workbook QC inventory, internal workpaper privacy and explicit blocked fixture. No production case or pilot acceptance claimed.');
    console.log('W5 cross-check access passed: assigned consultant download/pack/findings, restricted pricing workpapers, denied demo/unassigned accounts, scoped reviewer reference packet and wrong-workflow rejection. Synthetic protocol fixture only.');
  }finally{
    for(const id of caseIds){for(const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs'])await db.query(`DELETE FROM ${table} WHERE case_id=$1`,[id]);await db.query('DELETE FROM zora_cases WHERE id=$1',[id]);}await db.end();await rm(privateRoot,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local document fixture failed');process.exitCode=1;});
