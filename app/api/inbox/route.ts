import { requireActor,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
export async function GET() {
  try {
    const user=await requireActor();if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r))) throw new HttpError(403,'Inbox triage requires a consultant or bid owner');
    const result=await database().query('SELECT id,subject,sender,received_at,case_id,attachment_notice,triage FROM zora_inbox ORDER BY received_at DESC LIMIT 100');
    return Response.json({messages:result.rows},{headers:{'Cache-Control':'no-store'}});
  } catch(e){return responseError(e);}
}
