import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { leasedReview } from '@/lib/reviews';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{requireRunner(request);const {id}=await context.params;const url=new URL(request.url);const input=z.object({leaseId:z.uuid(),offset:z.coerce.number().int().min(0).max(40000)}).safeParse({leaseId:url.searchParams.get('leaseId'),offset:url.searchParams.get('offset')||0});if(!input.success)throw new HttpError(400,'Invalid inventory page');
    return await transaction(async db=>{const review=await leasedReview(db,id,input.data.leaseId);const elements=review.packet.elements.slice(input.data.offset,input.data.offset+1000);return Response.json({packetHash:review.packet_hash,elements,total:review.packet.elements.length,nextOffset:input.data.offset+elements.length<review.packet.elements.length?input.data.offset+elements.length:null},{headers:{'Cache-Control':'no-store'}});});
  }catch(e){return responseError(e);}
}
