import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { accessCase,event,queueStage,requireCaseManager } from '@/lib/cases';
import { transaction } from '@/lib/db';
import { stagesFor } from '@/lib/engine';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const input=z.object({action:z.enum(['resume','revise','rework']),version:z.number().int().positive(),note:z.string().trim().min(10).max(5000),feedbackId:z.uuid().optional()}).safeParse(await request.json());if(!input.success)throw new HttpError(400,'Explain the inputs or changes for this revision');
    await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);
      if(c.version!==input.data.version)throw new HttpError(409,'The pursuit changed; refresh before deciding');
      const previousVersion=c.version;
      if(input.data.action==='rework'){
        const feedback=(await db.query("SELECT * FROM zora_gate_feedback WHERE id=$1 AND case_id=$2 FOR UPDATE",[input.data.feedbackId,id])).rows[0];
        if(c.status!=='blocked'||!feedback||feedback.state!=='open'||feedback.stage_id!==stagesFor(c.workflow)[c.stageIndex]?.id||feedback.source_revision!==c.sourceRevision||feedback.case_version>=c.version)throw new HttpError(409,'Use current gate feedback with unchanged sources, or open a full revision');
        if(feedback.escalation_required)throw new HttpError(409,'This issue requires ESC explanation and fresh trust reset, not ordinary rework');
        const index=stagesFor(c.workflow).findIndex(s=>s.id===feedback.return_stage&&s.kind==='task');if(index<0||index>=c.stageIndex)throw new HttpError(409,'Correction route is unavailable');
        c.stageIndex=index;c.version++;
        await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[id,index,c.version]);
        await db.query("UPDATE zora_gate_feedback SET state='reworking' WHERE id=$1",[feedback.id]);await queueStage(db,c);
      }else if(input.data.action==='resume'){
        if(c.status!=='blocked'||stagesFor(c.workflow)[c.stageIndex]?.kind==='gate')throw new HttpError(409,'Use a revision to address a rejected human gate');
        c.version++;await db.query('UPDATE zora_cases SET version=$2,updated_at=now() WHERE id=$1',[id,c.version]);
        if(c.stageIndex===0&&!['W2','W8'].includes(c.workflow))await db.query("UPDATE zora_cases SET status='awaiting_confirmation' WHERE id=$1",[id]);else await queueStage(db,c);
      }else{
        await db.query("UPDATE zora_jobs SET state='blocked' WHERE case_id=$1 AND state IN ('queued','leased','reviewing')",[id]);
        await db.query("UPDATE zora_reviews SET state='blocked' WHERE case_id=$1 AND state IN ('queued','leased')",[id]);
        await db.query("UPDATE zora_qc_runs SET state='blocked',missing_inputs='[\"Pursuit revision changed\"]'::jsonb WHERE case_id=$1 AND state='reviewing'",[id]);
        await db.query("UPDATE zora_gate_feedback SET state='superseded' WHERE case_id=$1 AND NOT escalation_required AND state IN ('open','reworking')",[id]);
        await db.query("UPDATE zora_cases SET stage_index=0,status='blocked',version=version+1,source_revision=source_revision+1,updated_at=now() WHERE id=$1",[id]);
      }
      await event(db,id,input.data.action==='resume'?'stage.resumed':input.data.action==='rework'?'gate.rework_started':'revision.started',user.email,{note:input.data.note,feedbackId:input.data.feedbackId,previousVersion,previousSourceRevision:c.sourceRevision});
    });return Response.json({saved:true});
  }catch(e){return responseError(e);}
}
