import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {HttpError,type Actor} from './auth';
import type {CaseRecord} from './catalogue';
import {event} from './cases';
import {digest} from './engine';
import {canReadSource,hashBytes} from './files';
import {knowledgeHolds} from './knowledge';
import {inventory,MAX_REVIEW_ELEMENTS,ReviewInputError} from './review-manifest';
import {CHECKLIST_PACKET_LIMIT,packetRules} from './checklist';
import {reviewPlan} from './review-plan';
import {queuePasses} from './reviews';

const selectedIds=z.array(z.uuid()).max(24).refine(ids=>new Set(ids).size===ids.length,'Select each file only once');
export const existingReviewSchema=z.object({
  version:z.number().int().positive(),
  draftSourceIds:selectedIds.refine(ids=>ids.length>0,'Select an existing draft'),
  sourceIds:selectedIds,
  brief:z.string().trim().min(10).max(20000),
}).strict().refine(input=>!input.draftSourceIds.some(id=>input.sourceIds.includes(id)),'A draft cannot also be its own source evidence');
export type ExistingReviewInput=z.infer<typeof existingReviewSchema>;

/** Caller holds the case row lock and has verified owner/admin authority. No native work is claimed here. */
export async function beginExistingDraftReview(db:PoolClient,c:CaseRecord,user:Actor,input:ExistingReviewInput,creatorContext:string|null=null){
  if(c.version!==input.version)throw new HttpError(409,'The pursuit changed; refresh before starting review');
  if(!['W3','W4'].includes(c.workflow)||c.stageIndex!==0||!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Existing proposals can enter review before workflow processing starts. Open a revision first if processing has started.');
  const active=(await db.query("SELECT 1 FROM zora_qc_runs WHERE case_id=$1 AND state='reviewing' UNION ALL SELECT 1 FROM zora_jobs WHERE case_id=$1 AND state IN ('queued','leased','reviewing') LIMIT 1",[c.id])).rows.length;
  if(active)throw new HttpError(409,'Cancel the current work or open a revision before starting another review');
  if((await knowledgeHolds(db,c.id)).length)throw new HttpError(409,'Replace or retire withdrawn reusable sources before review');
  const selected=[...input.draftSourceIds,...input.sourceIds];
  if(selected.length>24)throw new HttpError(400,'Select up to 24 files in one review');
  const rows=(await db.query("SELECT id,filename,mime_type,sha256,visibility,octet_length(data)::int AS byte_size,provenance->'context' AS source_context FROM zora_sources WHERE case_id=$1 AND active AND id=ANY($2::uuid[]) ORDER BY id",[c.id,selected])).rows;
  if(rows.length!==selected.length||rows.some(f=>!canReadSource(user,f.visibility)))throw new HttpError(403,'Select active files you can access in this pursuit');
  if(rows.reduce((n,f)=>n+f.byte_size,0)>64*1024*1024)throw new HttpError(413,'Review files exceed 64 MB; split the review');
  const files=rows.map(f=>({...f,kind:'sources',role:input.draftSourceIds.includes(f.id)?'draft' as const:'source' as const}));
  const briefBytes=Buffer.from(input.brief);
  // Meeting notes are first-class review elements without inventing a transcript or generated artifact.
  const elements=await inventory({id:'request-notes',filename:'request-notes.txt',mime_type:'text/plain',data:briefBytes,sha256:hashBytes(briefBytes),role:'source'});
  try{
    for(const file of files){
      const bytes=(await db.query('SELECT data FROM zora_sources WHERE id=$1 AND case_id=$2',[file.id,c.id])).rows[0].data;
      elements.push(...await inventory({...file,data:bytes}));
      if(elements.length>MAX_REVIEW_ELEMENTS)throw new ReviewInputError('Review exceeds the element limit; split the documents');
    }
  }catch(error){throw new HttpError(422,error instanceof ReviewInputError?error.message:'A file could not be fully inventoried. Supply a valid, unencrypted review copy.');}
  const stageId='EXISTING-PROPOSAL',plan=reviewPlan(stageId)!;
  const checklist=await packetRules(db,c.id,c.workflow,plan.passes.map(p=>p.checker));
  if(checklist.length>CHECKLIST_PACKET_LIMIT)throw new HttpError(409,'Consolidate applicable checklist rules before review');
  const packet={purpose:'existing_draft',caseId:c.id,workflow:c.workflow,stageId,sourceRevision:c.sourceRevision,brief:input.brief,briefSha256:hashBytes(briefBytes),baselineStatus:'unapproved',checklist,sourceTranscripts:[],files,elements};
  const runId=randomUUID(),packetHash=digest(packet),version=c.version+1;
  await db.query("INSERT INTO zora_qc_runs(id,case_id,job_id,case_version,source_revision,creator_context,purpose,packet,packet_hash,clean_loops,max_loops) VALUES($1,$2,NULL,$3,$4,$5,'existing_draft',$6,$7,1,1)",[runId,c.id,version,c.sourceRevision,creatorContext,JSON.stringify(packet),packetHash]);
  await queuePasses(db,runId,c.id,stageId,1);
  await db.query("UPDATE zora_cases SET status='queued',version=$2,updated_at=now() WHERE id=$1",[c.id,version]);
  await event(db,c.id,'existing_review.queued',user.email,{runId,version,sourceRevision:c.sourceRevision,draftSourceIds:input.draftSourceIds,sourceIds:input.sourceIds,briefSha256:packet.briefSha256,packetHash,passes:plan.passes.length,workflowAdvanced:false});
  return {runId,version,packetHash,passes:plan.passes.length,elementCount:elements.length,humanApprovalRecorded:false};
}

export async function cancelExistingDraftReview(db:PoolClient,c:CaseRecord,user:Actor,version:number,runId:string){
  if(c.version!==version)throw new HttpError(409,'The pursuit changed; refresh before cancelling');
  const run=(await db.query("UPDATE zora_qc_runs SET state='blocked',missing_inputs='[\"Cancelled by pursuit manager\"]'::jsonb,completed_at=now() WHERE id=$1 AND case_id=$2 AND purpose='existing_draft' AND state='reviewing' AND case_version=$3 RETURNING id",[runId,c.id,version])).rows[0];
  if(!run)throw new HttpError(409,'This review is no longer active');
  await db.query("UPDATE zora_reviews SET state='blocked' WHERE run_id=$1 AND state IN ('queued','leased')",[runId]);
  await db.query("UPDATE zora_cases SET status='blocked',version=version+1,updated_at=now() WHERE id=$1",[c.id]);
  await event(db,c.id,'existing_review.cancelled',user.email,{runId,previousVersion:version});
}
