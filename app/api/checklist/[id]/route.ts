import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { checklistDecisionSchema,decideChecklistRule } from '@/lib/escalation-rerun';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const user=await requireActor(),{id}=await context.params;if(!z.uuid().safeParse(id).success)throw new HttpError(404,'Checklist rule not found');
  const input=checklistDecisionSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,'Choose standing or pursuit-only and explain the decision');
  return Response.json(await transaction(db=>decideChecklistRule(db,id,user,input.data.decision,input.data.note)));
 }catch(e){return responseError(e);}
}
