import { requireActor,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
import { microsoftConfig } from '@/lib/config';

export async function GET(){
  try{
    const user=await requireActor();
    if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Mailbox status requires a consultant or bid owner');
    const mailbox=microsoftConfig().mailbox;const db=database();
    const [state,scheduled,pending,dispatcher]=await Promise.all([
      db.query('SELECT subscription_expires_at,last_sync_at FROM zora_mail_state WHERE mailbox=$1',[mailbox]),
      db.query("SELECT created_at,data FROM zora_events WHERE type='mailbox.maintenance' AND actor='vercel-cron' AND data->>'mailbox'=$1 ORDER BY created_at DESC LIMIT 1",[mailbox]),
      db.query('SELECT count(*)::int AS count FROM zora_inbox WHERE mailbox=$1 AND case_id IS NULL',[mailbox]),
      db.query("SELECT created_at,data FROM zora_events WHERE type='dispatcher.wake' ORDER BY created_at DESC LIMIT 1"),
    ]);
    const s=state.rows[0],run=scheduled.rows[0],wake=dispatcher.rows[0];
    return Response.json({checkedAt:new Date().toISOString(),subscriptionExpiresAt:s?.subscription_expires_at||null,lastSyncAt:s?.last_sync_at||null,lastScheduledAt:run?.created_at||null,scheduledOk:run?.data?.ok===true&&!run?.data?.busy,pendingMessages:pending.rows[0].count,intervalMinutes:5,lastDispatcherAt:wake?.created_at||null,lastDispatcherAction:wake?.data?.action||null},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return responseError(error);}
}
