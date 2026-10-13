import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { event,mapCase,queueStage } from '@/lib/cases';
import { stagesFor } from '@/lib/engine';
import { resultSchema,safeOutputPath,needsIndependentReview } from '@/lib/result';
import { leasedJob } from '@/lib/uploads';
import { beginReview } from '@/lib/reviews';
export const maxDuration=60;

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    requireRunner(request);const {id}=await context.params;const body=await request.json();const parsed=resultSchema.safeParse(body.result);
    if(!parsed.success||parsed.data.outputFiles.some(f=>!safeOutputPath(f.path)))throw new HttpError(400,'Session result does not match the required contract');
    if(parsed.data.reviewReports.length)throw new HttpError(400,'Independent reports must come from separately leased reviewer tasks');
    const outcome=await transaction(async db=>{
      const j=await leasedJob(db,id,String(body.leaseId||''));
      if(j.context_id&&body.contextId!==j.context_id)throw new HttpError(409,'Stage completion must use its claimed native task identity');
      const c=mapCase((await db.query('SELECT * FROM zora_cases WHERE id=$1 FOR UPDATE',[j.case_id])).rows[0]);
      if(c.version!==j.case_version)throw new HttpError(409,'Pursuit version changed during the session');
      const stage=stagesFor(c.workflow)[c.stageIndex];if(stage.id!==j.stage_id)throw new HttpError(409,'Pursuit stage changed');
      let result=parsed.data;
      const saved=(await db.query('SELECT source_path,mime_type,visibility,purpose,sha256 FROM zora_artifacts WHERE job_id=$1 AND lease_id=$2',[id,body.leaseId])).rows;
      const declared=new Set(result.outputFiles.map(f=>f.path));
      if(declared.size!==result.outputFiles.length||saved.length!==declared.size||result.outputFiles.some(f=>!saved.some(a=>a.source_path===f.path&&a.mime_type===f.mimeType&&a.visibility===f.visibility&&a.purpose===(f.purpose||(f.visibility==='client'?'draft':'workpaper')))))throw new HttpError(409,'Every declared output must first be stored with its verified hash and matching metadata');
      // Fail closed until independent review orchestration can verify the actual artifact
      // element manifest, every fresh session pass, clean loops and escalation evidence.
      // A model-supplied "passed" or an empty coverage list must never advance QC.
      if(needsIndependentReview(stage.id)&&result.status==='completed'){
        const review=await beginReview(db,j,c,result);
        if(review.runId)return {resultStatus:'reviewing',artifactCount:saved.length,reviewRunId:review.runId};
        result={...result,status:'blocked',missingInputs:[...result.missingInputs,...review.missingInputs]};
      }
      await db.query('UPDATE zora_jobs SET state=$2,result=$3,completed_at=now() WHERE id=$1',[id,result.status==='completed'?'completed':'blocked',JSON.stringify(result)]);
      await event(db,c.id,`session.${result.status}`,j.worker_id,{stage:stage.id,summary:result.summary,missingInputs:result.missingInputs});
      c.version++;
      if(result.status==='blocked'){await db.query("UPDATE zora_cases SET status='blocked',version=$2,updated_at=now() WHERE id=$1",[c.id,c.version]);}
      else{c.stageIndex++;await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[c.id,c.stageIndex,c.version]);await queueStage(db,c);}
      return {resultStatus:result.status,artifactCount:saved.length};
    });
    return Response.json({ok:true,...outcome});
  }catch(e){return responseError(e);}
}
