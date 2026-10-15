import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { HttpError } from './auth';
import { event,mapCase,queueStage } from './cases';
import { digest,stagesFor,validateCoverage } from './engine';
import type { CaseRecord } from './catalogue';
import type { StageResult } from './result';
import { inventory,MAX_REVIEW_ELEMENTS,ReviewInputError,type ReviewElement,type ReviewFile } from './review-manifest';
import { reviewPlan,reviewInstructions,type ReviewResult } from './review-plan';
import { knowledgeHolds } from './knowledge';
import { CHECKLIST_PACKET_LIMIT,packetRules,rulesFor } from './checklist';
import { exactIds } from './trust-reset-contract';
import { parseSourceTranscript,matchTranscript,transcriptHash,TRANSCRIPT_LIMIT,type SourceTranscript } from './source-transcript';

async function queuePasses(db:PoolClient,runId:string,caseId:string,stage:string,loop:number){
  const plan=reviewPlan(stage);if(!plan)throw new HttpError(409,'Independent review plan is missing');
  const passes=[...plan.passes];
  const packet=(await db.query('SELECT packet FROM zora_qc_runs WHERE id=$1',[runId])).rows[0]?.packet;
  if(packet?.sourceTranscripts?.length)passes.unshift({checker:'SOURCE_TRANSCRIPT',passNumber:1,method:'Compare every transcribed word, cell and caption against every original PDF page before downstream checks'});
  if(['W3-17','W4-18','W4-20'].includes(stage)){
    const previous=(await db.query("SELECT 1 FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id JOIN zora_qc_runs current ON current.id=$2 WHERE q.case_id=$1 AND q.source_revision=current.source_revision AND q.packet->>'stageId'=$3 AND r.checker='D1' AND r.pass_number=2 AND jsonb_array_length(r.result->'findings')>0 LIMIT 1",[caseId,runId,stage])).rows.length;
    if(previous)passes.push({checker:'D1',passNumber:3,method:'Third independent compliance pass after a second-pass finding; verify the corrected draft without seeing earlier reports'});
  }
  for(const [sequence,pass] of passes.entries())await db.query('INSERT INTO zora_reviews(id,run_id,case_id,checker,pass_number,method,loop_number,sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),runId,caseId,pass.checker,pass.passNumber,pass.method,loop,sequence]);
}

/** Inventory is derived from stored bytes, never from the drafter's claimed element IDs. */
export async function beginReview(db:PoolClient,job:any,c:CaseRecord,result:StageResult):Promise<{runId?:string;missingInputs:string[]}>{
  const withdrawn=await knowledgeHolds(db,c.id);if(withdrawn.length)return {missingInputs:withdrawn};
  if(!job.context_id)return {missingInputs:['Independent QC requires a native task identity; claim this stage in a fresh Codex cloud task.']};
  const plan=reviewPlan(job.stage_id);if(!plan)return {missingInputs:['Independent QC review plan is missing.']};
  const available=(await db.query("SELECT a.id,a.filename,a.mime_type,a.sha256,a.purpose,a.visibility,octet_length(a.data)::int AS byte_size,a.job_id FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.case_id=$1 AND a.source_revision=$2 AND a.lease_id=j.lease_id AND (j.state='completed' OR a.job_id=$3) AND (a.purpose IN ('draft','reference','source_transcript') OR (a.purpose='rfi_review' AND j.stage_id='W5-11')) ORDER BY a.created_at DESC,a.id DESC",[c.id,c.sourceRevision,job.id])).rows;
  let targets;
  if(result.reviewArtifactIds?.length){
    targets=available.filter(a=>a.purpose==='draft'&&result.reviewArtifactIds!.includes(a.id));
    if(targets.length!==new Set(result.reviewArtifactIds).size)return {missingInputs:['Select review drafts from this pursuit revision; workpapers and prior reports cannot be review targets.']};
  }else{
    const latest=available.find(a=>a.purpose==='draft')?.job_id;
    targets=available.filter(a=>a.purpose==='draft'&&a.job_id===latest);
  }
  if(!targets.length)return {missingInputs:['Independent QC needs an actual stored draft; label the deliverable or estimate purpose as draft.']};
  const sources=(await db.query('SELECT id,filename,mime_type,sha256,visibility,octet_length(data)::int AS byte_size FROM zora_sources WHERE case_id=$1 AND active',[c.id])).rows;
  const references=available.filter(a=>a.purpose==='reference'||a.purpose==='rfi_review');
  if(!sources.length)return {missingInputs:['Independent QC requires actual source documents, not a drafter summary.']};
  if(plan.passes.some(p=>['D1','D2','UNDERSTANDING','ARCHITECTURE','DOMAIN','EFFORT','COST'].includes(p.checker))&&!references.length)return {missingInputs:['Independent QC requires a selected reference/register/baseline; label that file as reference, separate from reasoning.']};
  if(['W3','W4'].includes(c.workflow)&&!['W3-7','W4-5'].includes(job.stage_id)){
    const baseline=(await db.query("SELECT 1 FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id JOIN zora_approvals p ON p.case_id=a.case_id WHERE a.case_id=$1 AND a.source_revision=$2 AND a.purpose='reference' AND a.lease_id=j.lease_id AND j.stage_id=ANY($3::text[]) AND p.stage_id=$4 AND p.version>=a.case_version AND p.created_at>=a.created_at LIMIT 1",[c.id,c.sourceRevision,c.workflow==='W3'?['W3-6']:['W4-3','W4-4'],`${c.workflow}-G1`])).rows.length;
    if(!baseline)return {missingInputs:['A reference baseline from this source revision must be confirmed at the requirement gate before technical/document QC.']};
  }
  // Select the latest valid transcript for each active source, never a workpaper cache.
  const transcripts=new Map<string,{artifact:any;transcript:SourceTranscript}>();
  try{
    for(const artifact of available.filter(a=>a.purpose==='source_transcript')){
      if(artifact.byte_size>TRANSCRIPT_LIMIT)throw new Error('Transcript bound');
      const bytes=(await db.query('SELECT data FROM zora_artifacts WHERE id=$1 AND case_id=$2',[artifact.id,c.id])).rows[0].data;
      if(transcriptHash(bytes)!==artifact.sha256)throw new Error('Transcript integrity');
      const transcript=parseSourceTranscript(bytes),source=sources.find(f=>f.id===transcript.sourceId);
      if(!source)continue; // Retired source transcripts cannot enter a new packet.
      matchTranscript(transcript,source,artifact.visibility);
      if(!transcripts.has(source.id))transcripts.set(source.id,{artifact,transcript});
    }
  }catch{return {missingInputs:['A source transcript is invalid, stale or has a different access classification. Supply an exact page-linked copy of the active original PDF.']};}
  const files=[...sources.map(f=>({...f,kind:'sources',role:'source'})),...[...references,...[...transcripts.values()].map(t=>t.artifact)].map(f=>({...f,kind:'artifacts',role:'reference'})),...targets.map(f=>({...f,kind:'artifacts',role:'draft'}))];
  if(files.length>30||files.reduce((size,f)=>size+f.byte_size,0)>64*1024*1024)return {missingInputs:['Independent QC packet exceeds 30 files or 64 MB; split it into bounded review sections.']};
  const elements:ReviewElement[]=[];
  try{
    for(const file of files){
      const table=file.kind==='sources'?'zora_sources':'zora_artifacts';
      const bytes=(await db.query(`SELECT data FROM ${table} WHERE id=$1 AND case_id=$2`,[file.id,c.id])).rows[0].data;
      elements.push(...await inventory({...file,data:bytes} as ReviewFile,file.kind==='sources'?transcripts.get(file.id)?.transcript:undefined));
      if(elements.length>MAX_REVIEW_ELEMENTS)throw new ReviewInputError('Review packet exceeds the element limit; split it into bounded sections');
    }
  }catch(error){
    if(error instanceof ReviewInputError)return {missingInputs:[error.message]};
    return {missingInputs:['A review document could not be inventoried completely. Supply a valid, unencrypted review copy; coverage will not be guessed.']};
  }
  const checklist=await packetRules(db,c.id,c.workflow,plan.passes.map(p=>p.checker));
  if(checklist.length>CHECKLIST_PACKET_LIMIT)return {missingInputs:[`More than ${CHECKLIST_PACKET_LIMIT} checklist rules apply; consolidate standing rules before QC.`]};
  const packet={caseId:c.id,workflow:c.workflow,stageId:job.stage_id,sourceRevision:c.sourceRevision,brief:c.briefing,checklist,sourceTranscripts:[...transcripts.values()].map(({artifact,transcript})=>({sourceId:transcript.sourceId,sourceSha256:transcript.sourceSha256,transcriptId:artifact.id,transcriptSha256:artifact.sha256,pageCount:transcript.pages.length,status:'unverified'})),files:files.map(({job_id,...file})=>file),elements};
  const hash=digest(packet),runId=randomUUID();
  const policy=(await db.query('SELECT qc_clean_loops,qc_max_loops FROM zora_cases WHERE id=$1',[c.id])).rows[0];
  await db.query('INSERT INTO zora_qc_runs(id,case_id,job_id,case_version,source_revision,creator_context,packet,packet_hash,clean_loops,max_loops) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[runId,c.id,job.id,c.version,c.sourceRevision,job.context_id,JSON.stringify(packet),hash,policy.qc_clean_loops,policy.qc_max_loops]);
  await queuePasses(db,runId,c.id,job.stage_id,1);
  await db.query("UPDATE zora_jobs SET state='reviewing',result=$2 WHERE id=$1",[job.id,JSON.stringify(result)]);
  await db.query("UPDATE zora_cases SET status='queued',updated_at=now() WHERE id=$1",[c.id]);
  await event(db,c.id,'qc.queued',job.worker_id,{runId,stage:job.stage_id,passes:plan.passes.length+(transcripts.size?1:0),elements:elements.length,packetHash:hash});
  return {runId,missingInputs:[]};
}

export async function leasedReview(db:PoolClient,id:string,leaseId:string){
  const ref=(await db.query('SELECT case_id FROM zora_reviews WHERE id=$1',[id])).rows[0];if(!ref)throw new HttpError(409,'Review lease is unavailable');
  await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[ref.case_id]);
  const row=(await db.query("SELECT r.*,q.job_id,q.case_version,q.packet,q.packet_hash,q.source_revision,q.creator_context,q.clean_loops,q.max_loops FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id JOIN zora_cases c ON c.id=r.case_id WHERE r.id=$1 AND r.lease_id=$2 AND r.state='leased' AND r.lease_expires_at>now() AND q.state='reviewing' AND q.case_version=c.version AND q.source_revision=c.source_revision FOR UPDATE OF r",[id,leaseId])).rows[0];
  if(!row)throw new HttpError(409,'Review lease or pursuit revision changed');return row;
}

export async function claimReview(db:PoolClient,worker:string,contextId:string){
  const candidate=(await db.query("SELECT c.id FROM zora_cases c WHERE EXISTS(SELECT 1 FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id WHERE r.case_id=c.id AND q.state='reviewing' AND q.case_version=c.version AND q.creator_context<>$1 AND (r.state='queued' OR (r.state='leased' AND r.lease_expires_at<now())) AND (r.checker='SOURCE_TRANSCRIPT' OR NOT EXISTS(SELECT 1 FROM zora_reviews prerequisite WHERE prerequisite.run_id=r.run_id AND prerequisite.loop_number=r.loop_number AND prerequisite.checker='SOURCE_TRANSCRIPT' AND prerequisite.state<>'completed'))) AND NOT EXISTS(SELECT 1 FROM zora_jobs j WHERE j.case_id=c.id AND j.context_id=$1) AND NOT EXISTS(SELECT 1 FROM zora_review_contexts x WHERE x.case_id=c.id AND x.context_id=$1) AND NOT EXISTS(SELECT 1 FROM zora_draft_contexts d WHERE d.case_id=c.id AND d.context_id=$1) ORDER BY c.updated_at FOR UPDATE OF c SKIP LOCKED LIMIT 1",[contextId])).rows[0];
  if(!candidate)return null;
  const r=(await db.query("SELECT r.id,r.checker,r.method,r.pass_number,r.loop_number,q.id AS run_id,q.packet,q.packet_hash FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id JOIN zora_cases c ON c.id=r.case_id WHERE r.case_id=$1 AND q.state='reviewing' AND q.case_version=c.version AND (r.state='queued' OR (r.state='leased' AND r.lease_expires_at<now())) AND (r.checker='SOURCE_TRANSCRIPT' OR NOT EXISTS(SELECT 1 FROM zora_reviews prerequisite WHERE prerequisite.run_id=r.run_id AND prerequisite.loop_number=r.loop_number AND prerequisite.checker='SOURCE_TRANSCRIPT' AND prerequisite.state<>'completed')) ORDER BY r.created_at,r.sequence FOR UPDATE OF r SKIP LOCKED LIMIT 1",[candidate.id])).rows[0];
  if(!r)return null;const leaseId=randomUUID();
  await db.query('INSERT INTO zora_review_contexts(case_id,context_id,review_id) VALUES($1,$2,$3)',[candidate.id,contextId,r.id]);
  await db.query("UPDATE zora_reviews SET state='leased',context_id=$2,worker_id=$3,lease_id=$4,lease_expires_at=now()+interval '5 minutes' WHERE id=$1",[r.id,contextId,worker,leaseId]);
  await event(db,candidate.id,'qc.claimed',worker,{reviewId:r.id,checker:r.checker,pass:r.pass_number,loop:r.loop_number});
  // No prior results, worker/drafter context, private workpapers or earlier review reports.
  const {elements,...packet}=r.packet;
  return {kind:'review',id:r.id,leaseId,contextId,runId:r.run_id,checker:r.checker,method:r.method,passNumber:r.pass_number,loopNumber:r.loop_number,packetHash:r.packet_hash,elementCount:elements.length,packet,instructions:reviewInstructions(r.checker,r.method)};
}

export async function completeReview(db:PoolClient,id:string,leaseId:string,contextId:string,result:ReviewResult){
  const review=await leasedReview(db,id,leaseId);
  if(contextId!==review.context_id||contextId===review.creator_context)throw new HttpError(409,'Review context does not match its independent lease');
  const expected=review.packet.elements.map((e:ReviewElement)=>e.id);
  if(result.packetHash!==review.packet_hash||!validateCoverage({expectedElementIds:expected,checkedElementIds:result.checkedElementIds}))throw new HttpError(422,'Review hash and complete, unique element coverage are required');
  const ids=new Set(expected);if(result.findings.some(f=>!ids.has(f.elementId)))throw new HttpError(422,'Every finding must reference an inventoried element');
  if(!exactIds(rulesFor(review.packet,review.checker),result.checkedRuleIds??[]))throw new HttpError(422,'Report every applicable checklist rule exactly once in checkedRuleIds');
  const withdrawn=await knowledgeHolds(db,review.case_id);if(withdrawn.length)result={...result,missingInputs:[...result.missingInputs,...withdrawn]};
  await db.query("UPDATE zora_reviews SET state='completed',result=$2,completed_at=now() WHERE id=$1",[id,JSON.stringify(result)]);
  await event(db,review.case_id,'qc.pass_recorded',review.worker_id,{reviewId:id,checker:review.checker,findings:result.findings.length,checked:result.checkedElementIds.length,loop:review.loop_number});
  // Any problem holds the loop. No vote or model-supplied 'passed' flag can override it.
  const plan=reviewPlan(review.packet.stageId)!;
  if(result.findings.length||result.missingInputs.length){
    const contradiction=plan.escalateContradictions&&['D2','D3'].includes(review.checker)&&result.findings.some(f=>f.kind==='contradiction');
    await hold(db,review,contradiction?'qc.escalated':'qc.needs_revision',[...result.missingInputs,...result.findings.map(f=>`${f.severity}: ${f.description}`)]);
    return {status:'blocked',findings:result.findings.length,escalated:contradiction};
  }
  // W3/W4 D1's second pass finding requires a third pass; findings already force a fix,
  // whose resumed packet will receive entirely new reviewer contexts.
  const pending=(await db.query("SELECT count(*)::int AS count FROM zora_reviews WHERE run_id=$1 AND loop_number=$2 AND state<>'completed'",[review.run_id,review.loop_number])).rows[0].count;
  if(pending)return {status:'reviewing',remaining:pending};
  const run=(await db.query('SELECT * FROM zora_qc_runs WHERE id=$1 FOR UPDATE',[review.run_id])).rows[0];
  const streak=run.clean_streak+1;
  if(!run.max_loops||(plan.repeat&&!run.clean_loops)){
    await hold(db,review,'qc.policy_required',['QC maximum loop count and the applicable clean-loop exit rule are unconfirmed. Saurabh deferred these settings; configure them explicitly before progression.']);
    return {status:'blocked',policyRequired:true};
  }
  const required=plan.repeat?run.clean_loops:1;
  if(streak<required){
    if(run.loop_number>=run.max_loops){await hold(db,review,'qc.loop_limit',['QC reached its configured loop maximum; a human must decide the next action.']);return {status:'blocked',loopLimit:true};}
    await db.query('UPDATE zora_qc_runs SET clean_streak=$2,loop_number=loop_number+1 WHERE id=$1',[run.id,streak]);
    await queuePasses(db,run.id,review.case_id,review.packet.stageId,run.loop_number+1);
    await event(db,review.case_id,'qc.next_loop',review.worker_id,{runId:run.id,loop:run.loop_number+1,cleanStreak:streak});return {status:'reviewing',nextLoop:run.loop_number+1};
  }
  const c=mapCase((await db.query('SELECT * FROM zora_cases WHERE id=$1',[review.case_id])).rows[0]);
  if(stagesFor(c.workflow)[c.stageIndex]?.id!==review.packet.stageId)throw new HttpError(409,'Pursuit stage changed');
  await db.query("UPDATE zora_qc_runs SET state='passed',clean_streak=$2,completed_at=now() WHERE id=$1",[run.id,streak]);
  await db.query("UPDATE zora_jobs SET state='completed',completed_at=now() WHERE id=$1",[review.job_id]);
  c.stageIndex++;c.version++;
  await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[c.id,c.stageIndex,c.version]);
  await event(db,c.id,'qc.completed',review.worker_id,{runId:run.id,cleanLoops:streak,packetHash:review.packet_hash});await queueStage(db,c);
  return {status:'completed',humanApprovalRecorded:false};
}
async function hold(db:PoolClient,review:any,type:string,reasons:string[]){
  await db.query("UPDATE zora_qc_runs SET state='blocked',missing_inputs=$2,completed_at=now() WHERE id=$1",[review.run_id,JSON.stringify(reasons)]);
  await db.query("UPDATE zora_reviews SET state='blocked' WHERE run_id=$1 AND state IN ('queued','leased')",[review.run_id]);
  const restricted=review.packet.files.some((file:any)=>file.visibility==='internal');
  const visibleReasons=restricted?['Independent QC needs revision or inputs. Authorised internal reviewers can inspect the detailed findings.']:reasons;
  await db.query("UPDATE zora_jobs SET state='blocked',result=jsonb_set(jsonb_set(result,'{status}','\"blocked\"'::jsonb),'{missingInputs}',$2::jsonb),completed_at=now() WHERE id=$1",[review.job_id,JSON.stringify(visibleReasons)]);
  await db.query("UPDATE zora_cases SET status='blocked',version=version+1,updated_at=now() WHERE id=$1",[review.case_id]);
  await event(db,review.case_id,type,review.worker_id,{runId:review.run_id,missingInputs:visibleReasons});
}
