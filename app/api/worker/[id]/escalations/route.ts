import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { completedProducer,explanationRequestSchema,producerEscalations,saveExplanations } from '@/lib/escalation-explanation';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireRunner(request);const id=z.uuid().safeParse((await context.params).id);const body=explanationRequestSchema.safeParse(await request.json());
    if(!id.success||!body.success)throw new HttpError(400,'Supply the original task identity and a complete, file-bound explanation');
    const result=await transaction(async db=>{
      const job=await completedProducer(db,id.data,body.data.leaseId,body.data.contextId);
      if(body.data.action==='read')return {escalations:await producerEscalations(db,job)};
      return saveExplanations(db,job,body.data.explanations);
    });return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return responseError(e);}
}
