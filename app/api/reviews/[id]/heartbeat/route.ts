import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { leasedReview } from '@/lib/reviews';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireRunner(request);const {id}=await context.params;const input=z.object({leaseId:z.uuid()}).safeParse(await request.json());if(!input.success)throw new HttpError(400,'Invalid review lease');
    await transaction(async db=>{await leasedReview(db,id,input.data.leaseId);await db.query("UPDATE zora_reviews SET lease_expires_at=now()+interval '5 minutes' WHERE id=$1",[id]);});return Response.json({ok:true});
  }catch(e){return responseError(e);}
}
