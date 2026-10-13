import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { event,mapCase,queueStage } from '@/lib/cases';
import { stagesFor } from '@/lib/engine';
import { resultSchema,safeOutputPath,needsIndependentReview } from '@/lib/result';

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    requireRunner(request);const {id}=await context.params;const body=await request.json();const parsed=resultSchema.safeParse(body.result);
    if(!parsed.success||parsed.data.outputFiles.some(f=>!safeOutputPath(f.path)))throw new HttpError(400,'Session result does not match the required contract');
    await transaction(async db=>{
      const j=(await db.query('SELECT * FROM zora_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!j||j.state!=='leased'||j.lease_id!==body.leaseId||new Date(j.lease_expires_at).getTime()<=Date.now())throw new HttpError(409,'Session lease is no longer valid');
      const c=mapCase((await db.query('SELECT * FROM zora_cases WHERE id=$1 FOR UPDATE',[j.case_id])).rows[0]);
      if(c.version!==j.case_version)throw new HttpError(409,'Pursuit version changed during the session');
      const stage=stagesFor(c.workflow)[c.stageIndex];if(stage.id!==j.stage_id)throw new HttpError(409,'Pursuit stage changed');
      let result=parsed.data;
      // Fail closed until the independent review importer can verify the actual artifact
      // element manifest, every fresh session pass, clean loops and escalation evidence.
      // A model-supplied "passed" or an empty coverage list must never advance QC.
      if(needsIndependentReview(stage.id)&&result.status==='completed') result={...result,status:'blocked',missingInputs:[...result.missingInputs,'Independent QC result verification and artifact import are required before this stage can advance.']};
      await db.query('UPDATE zora_jobs SET state=$2,result=$3,completed_at=now() WHERE id=$1',[id,result.status==='completed'?'completed':'blocked',JSON.stringify(result)]);
      await event(db,c.id,`session.${result.status}`,j.worker_id,{stage:stage.id,summary:result.summary,missingInputs:result.missingInputs});
      c.version++;
      if(result.status==='blocked'){await db.query("UPDATE zora_cases SET status='blocked',version=$2,updated_at=now() WHERE id=$1",[c.id,c.version]);}
      else{c.stageIndex++;await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[c.id,c.stageIndex,c.version]);await queueStage(db,c);}
    });
    return Response.json({ok:true});
  }catch(e){return responseError(e);}
}
