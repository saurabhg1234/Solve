import { requireActor,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
export async function GET() {
  try {
    const user=await requireActor();if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r))) throw new HttpError(403,'Inbox triage requires a consultant or bid owner');
    const result=await database().query('SELECT i.id,i.subject,i.sender,i.received_at,i.case_id,i.attachment_notice,i.triage FROM zora_inbox i WHERE i.case_id IS NULL OR $2 OR EXISTS(SELECT 1 FROM zora_cases c WHERE c.id=i.case_id AND (c.requested_by=$1 OR EXISTS(SELECT 1 FROM zora_case_members m WHERE m.case_id=c.id AND m.email=$1))) ORDER BY i.received_at DESC LIMIT 100',[user.email,user.roles.includes('admin')]);
    return Response.json({messages:result.rows},{headers:{'Cache-Control':'no-store'}});
  } catch(e){return responseError(e);}
}
