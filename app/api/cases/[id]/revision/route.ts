import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { accessCase,event,queueStage,requireCaseManager } from '@/lib/cases';
import { transaction } from '@/lib/db';
import { stagesFor } from '@/lib/engine';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const input=z.object({action:z.enum(['resume','revise']),version:z.number().int().positive(),note:z.string().trim().min(10).max(5000)}).safeParse(await request.json());if(!input.success)throw new HttpError(400,'Explain the inputs or changes for this revision');
    await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);
      if(c.version!==input.data.version)throw new HttpError(409,'The pursuit changed; refresh before deciding');
      const previousVersion=c.version;
      if(input.data.action==='resume'){
        if(c.status!=='blocked'||stagesFor(c.workflow)[c.stageIndex]?.kind==='gate')throw new HttpError(409,'Use a revision to address a rejected human gate');
        c.version++;await db.query('UPDATE zora_cases SET version=$2,updated_at=now() WHERE id=$1',[id,c.version]);
        if(c.stageIndex===0&&!['W2','W8'].includes(c.workflow))await db.query("UPDATE zora_cases SET status='awaiting_confirmation' WHERE id=$1",[id]);else await queueStage(db,c);
      }else{
        await db.query("UPDATE zora_jobs SET state='blocked' WHERE case_id=$1 AND state IN ('queued','leased')",[id]);
        await db.query("UPDATE zora_cases SET stage_index=0,status='blocked',version=version+1,source_revision=source_revision+1,updated_at=now() WHERE id=$1",[id]);
      }
      await event(db,id,input.data.action==='resume'?'stage.resumed':'revision.started',user.email,{note:input.data.note,previousVersion,previousSourceRevision:c.sourceRevision});
    });return Response.json({saved:true});
  }catch(e){return responseError(e);}
}
