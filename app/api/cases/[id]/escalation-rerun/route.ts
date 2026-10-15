import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { accessCase,requireCaseManager } from '@/lib/cases';
import { transaction } from '@/lib/db';
import { rerunRequestSchema,startEscalationRerun } from '@/lib/escalation-rerun';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const user=await requireActor(),{id}=await context.params;
  const input=rerunRequestSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,'Supply the current version, escalation and one checklist rule per finding');
  const result=await transaction(async db=>{await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);if(c.version!==input.data.version)throw new HttpError(409,'The pursuit changed; refresh before starting');return startEscalationRerun(db,c,input.data.feedbackId,input.data.checklist,user);});
  return Response.json(result);
 }catch(e){return responseError(e);}
}
