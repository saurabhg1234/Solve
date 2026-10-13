import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try{requireRunner(request);const {id}=await context.params;const body=await request.json();
    const result=await database().query("UPDATE zora_jobs SET lease_expires_at=now()+interval '5 minutes' WHERE id=$1 AND lease_id=$2 AND state='leased' AND lease_expires_at>now() RETURNING id",[id,body.leaseId]);
    if(!result.rows.length)throw new HttpError(409,'Session lease expired');return Response.json({ok:true});
  }catch(e){return responseError(e);}
}
