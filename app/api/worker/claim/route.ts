import { randomUUID } from 'node:crypto';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { mapCase,event } from '@/lib/cases';
import { stagesFor,taskInstructions } from '@/lib/engine';
import { needsIndependentReview } from '@/lib/result';
import { claimReview } from '@/lib/reviews';
import { contextSchema } from '@/lib/review-plan';

export async function POST(request:Request) {
  try {
    requireRunner(request);const body=await request.json();const worker=String(body.workerId||'').slice(0,100);if(!worker)throw new HttpError(400,'Worker identity is required');
    const context=body.contextId===undefined?undefined:contextSchema.safeParse(body.contextId);if(context&&!context.success)throw new HttpError(400,'Supply the native Codex task identity');
    const contextId=context?.success?context.data:null;
    const job=await transaction(async db=>{
      if(contextId){const review=await claimReview(db,worker,contextId);if(review)return review;}
      const selected=await db.query("SELECT c.* FROM zora_cases c WHERE EXISTS(SELECT 1 FROM zora_jobs j WHERE j.case_id=c.id AND j.case_version=c.version AND (j.state='queued' OR (j.state='leased' AND j.lease_expires_at<now()))) AND NOT EXISTS(SELECT 1 FROM zora_review_contexts x WHERE x.case_id=c.id AND x.context_id=$1) ORDER BY c.updated_at FOR UPDATE OF c SKIP LOCKED LIMIT 1",[contextId]);
      if(!selected.rows[0])return null;const c=mapCase(selected.rows[0]);
      const result=await db.query("SELECT * FROM zora_jobs WHERE case_id=$1 AND case_version=$2 AND (state='queued' OR (state='leased' AND lease_expires_at<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",[c.id,c.version]);
      if(!result.rows[0])return null;const j=result.rows[0];const leaseId=randomUUID();const stage=stagesFor(c.workflow)[c.stageIndex];
      if(!stage||stage.kind!=='task'||stage.id!==j.stage_id)throw new HttpError(409,'Queue stage is out of date');
      await db.query("UPDATE zora_jobs SET state='leased',lease_id=$2,worker_id=$3,context_id=$4,lease_expires_at=now()+interval '5 minutes' WHERE id=$1",[j.id,leaseId,worker,contextId]);
      await db.query("UPDATE zora_cases SET status='running',updated_at=now() WHERE id=$1",[c.id]);await event(db,c.id,'session.claimed',worker,{stage:stage.id,jobId:j.id});
      const sources=(await db.query('SELECT id,filename,mime_type,sha256,visibility,octet_length(data)::int AS byte_size,provenance FROM zora_sources WHERE case_id=$1 AND active',[c.id])).rows;
      const artifacts=(await db.query("SELECT a.id,a.filename,a.mime_type,a.sha256,a.visibility,a.purpose,a.source_path,a.source_revision,j.state,octet_length(a.data)::int AS byte_size FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.case_id=$1 AND a.source_revision=$2 AND a.lease_id=j.lease_id AND j.state IN ('completed','blocked') ORDER BY a.created_at DESC,a.id DESC",[c.id,c.sourceRevision])).rows;
      const prior=(await db.query("SELECT stage_id,result FROM zora_jobs WHERE case_id=$1 AND source_revision=$2 AND state='completed' ORDER BY completed_at",[c.id,c.sourceRevision])).rows;
      return {kind:'stage',id:j.id,leaseId,contextId,case:c,stage,requiresIndependentReview:needsIndependentReview(stage.id),instructions:taskInstructions(c.workflow,stage),sources,artifacts,prior};
    });
    return Response.json({job},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return responseError(e);}
}
