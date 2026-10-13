import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { completeReview } from '@/lib/reviews';
import { contextSchema,reviewResultSchema } from '@/lib/review-plan';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireRunner(request);const {id}=await context.params;const input=z.object({leaseId:z.uuid(),contextId:contextSchema,result:reviewResultSchema}).safeParse(await request.json());if(!input.success)throw new HttpError(400,'Invalid independent review report');return Response.json(await transaction(db=>completeReview(db,id,input.data.leaseId,input.data.contextId,input.data.result)));
  }catch(e){return responseError(e);}
}
