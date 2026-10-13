import { z } from 'zod';
import { requireActor, requireSameOrigin, responseError, HttpError } from '@/lib/auth';
import { accessCase,event,mapCase,queueStage } from '@/lib/cases';
import { transaction } from '@/lib/db';
import { stagesFor,canApprove,approvalComplete } from '@/lib/engine';
import type { Role } from '@/lib/catalogue';

const schema=z.object({version:z.number().int().positive(),action:z.enum(['confirm','approve','reject']),note:z.string().max(5000).optional()});
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const parsed=schema.safeParse(await request.json()); if(!parsed.success) throw new HttpError(400,'Invalid approval');
    const result=await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);
      if(c.version!==parsed.data.version) throw new HttpError(409,'This pursuit changed. Refresh before deciding.');
      const stage=stagesFor(c.workflow)[c.stageIndex];
      if(parsed.data.action==='confirm') {
        if(c.status!=='awaiting_confirmation' || !user.roles.some(r=>['consultant','bid_owner'].includes(r))) throw new HttpError(403,'Workflow confirmation is not available for this role or stage');
        await event(db,id,'routing.confirmed',user.email,{version:c.version});await queueStage(db,c);
      } else {
        if(c.status!=='awaiting_approval' || !stage || !canApprove(stage,user.roles)) throw new HttpError(403,'You are not an approver for this gate');
        if(parsed.data.action==='reject') {
          if(!parsed.data.note?.trim()) throw new HttpError(400,'Please explain what needs revision');
          await db.query("UPDATE zora_cases SET status='blocked',version=version+1,updated_at=now() WHERE id=$1",[id]);
          await event(db,id,'gate.rejected',user.email,{stage:stage.id,note:parsed.data.note});
        } else {
          // Multi-role gates require each specified role; an admin cannot bypass a gate.
          for(const role of user.roles.filter(r=>stage.approvers.includes(r))) {
            await db.query('INSERT INTO zora_approvals(case_id,stage_id,version,actor,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,stage.id,c.version,user.email,role]);
          }
          const approvals=await db.query('SELECT role FROM zora_approvals WHERE case_id=$1 AND stage_id=$2 AND version=$3',[id,stage.id,c.version]);
          await event(db,id,'gate.approved',user.email,{stage:stage.id,version:c.version});
          if(approvalComplete(stage,approvals.rows.map(r=>r.role as Role))) {
            c.stageIndex++; c.version++;
            await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[id,c.stageIndex,c.version]);await queueStage(db,c);
          }
        }
      }
      return mapCase((await db.query('SELECT * FROM zora_cases WHERE id=$1',[id])).rows[0]);
    });
    return Response.json({case:result});
  } catch(e){return responseError(e);}
}
