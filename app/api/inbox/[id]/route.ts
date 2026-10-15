import { requireActor,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireActor();
    if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Inbox triage requires a consultant or bid owner');
    const {id}=await context.params;
    const row=(await database().query('SELECT id,subject,sender,body_text,received_at,case_id,attachment_notice,triage FROM zora_inbox WHERE id=$1',[id])).rows[0];
    if(!row)throw new HttpError(404,'Email request not found');
    return Response.json({message:row},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return responseError(error);}
}
