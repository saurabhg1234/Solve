import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { accessCase,requireCaseManager,event } from '@/lib/cases';
import { transaction } from '@/lib/db';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;const input=z.object({version:z.number().int().positive(),cleanLoops:z.number().int().min(1).max(10),maxLoops:z.number().int().min(1).max(20)}).refine(v=>v.maxLoops>=v.cleanLoops).safeParse(await request.json());if(!input.success)throw new HttpError(400,'Set an explicit clean-loop exit rule and a maximum at least as large');
    await transaction(async db=>{await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);if(c.version!==input.data.version)throw new HttpError(409,'Pursuit version changed');if(!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Pause work or open a revision before changing QC policy');await db.query('UPDATE zora_cases SET qc_clean_loops=$2,qc_max_loops=$3,version=version+1,updated_at=now() WHERE id=$1',[id,input.data.cleanLoops,input.data.maxLoops]);await event(db,id,'qc.policy_set',user.email,{cleanLoops:input.data.cleanLoops,maxLoops:input.data.maxLoops});});return Response.json({saved:true});
  }catch(e){return responseError(e);}
}
