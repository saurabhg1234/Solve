import { randomUUID } from 'node:crypto';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { mapCase,event } from '@/lib/cases';
import { stagesFor,taskInstructions } from '@/lib/engine';
import { needsIndependentReview } from '@/lib/result';

export async function POST(request:Request) {
  try {
    requireRunner(request);const body=await request.json();const worker=String(body.workerId||'').slice(0,100);if(!worker)throw new HttpError(400,'Worker identity is required');
    const job=await transaction(async db=>{
      const result=await db.query("SELECT j.* FROM zora_jobs j JOIN zora_cases c ON c.id=j.case_id WHERE j.case_version=c.version AND (j.state='queued' OR (j.state='leased' AND j.lease_expires_at<now())) ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1");
      if(!result.rows[0])return null;const j=result.rows[0];const leaseId=randomUUID();
      const c=mapCase((await db.query('SELECT * FROM zora_cases WHERE id=$1',[j.case_id])).rows[0]);const stage=stagesFor(c.workflow)[c.stageIndex];
      if(!stage||stage.kind!=='task'||stage.id!==j.stage_id)throw new HttpError(409,'Queue stage is out of date');
      await db.query("UPDATE zora_jobs SET state='leased',lease_id=$2,worker_id=$3,lease_expires_at=now()+interval '5 minutes' WHERE id=$1",[j.id,leaseId,worker]);
      await db.query("UPDATE zora_cases SET status='running',updated_at=now() WHERE id=$1",[c.id]);await event(db,c.id,'session.claimed',worker,{stage:stage.id,jobId:j.id});
      const sources=(await db.query('SELECT id,filename,mime_type,sha256 FROM zora_sources WHERE case_id=$1',[c.id])).rows;
      const prior=(await db.query("SELECT stage_id,result FROM zora_jobs WHERE case_id=$1 AND state='completed' ORDER BY completed_at",[c.id])).rows;
      return {id:j.id,leaseId,case:c,stage,requiresIndependentReview:needsIndependentReview(stage.id),instructions:taskInstructions(c.workflow,stage),sources,prior};
    });
    return Response.json({job},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return responseError(e);}
}
