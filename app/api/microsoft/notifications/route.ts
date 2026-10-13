import { after } from 'next/server';
import { constantTimeEqual } from '@/lib/engine';
import { database } from '@/lib/db';
import { microsoftConfig } from '@/lib/config';
import { syncMailbox } from '@/lib/microsoft';
import { responseError,HttpError } from '@/lib/auth';

export const maxDuration=60;
export async function POST(request:Request) {
  const validation=new URL(request.url).searchParams.get('validationToken');
  if(validation!==null) return new Response(validation,{headers:{'Content-Type':'text/plain','X-Content-Type-Options':'nosniff'}});
  try {
    const secret=process.env.ZORA_WEBHOOK_SECRET;if(!secret||secret.length<32) throw new HttpError(503,'Mailbox monitoring is not configured');
    const payload=await request.json();if(!Array.isArray(payload.value)||payload.value.length>100) throw new HttpError(400,'Invalid notification batch');
    const ms=microsoftConfig();const state=(await database().query('SELECT subscription_id FROM zora_mail_state WHERE mailbox=$1',[ms.mailbox])).rows[0];
    let accepted=0;
    for(const notice of payload.value) {
      if(typeof notice.clientState!=='string'||!constantTimeEqual(notice.clientState,secret)||notice.subscriptionId!==state?.subscription_id) continue;
      if(notice.lifecycleEvent==='subscriptionRemoved') await database().query('UPDATE zora_mail_state SET subscription_id=NULL,subscription_expires_at=NULL WHERE mailbox=$1',[ms.mailbox]);
      if(notice.lifecycleEvent==='reauthorizationRequired') await database().query('UPDATE zora_mail_state SET subscription_expires_at=now() WHERE mailbox=$1',[ms.mailbox]);
      await database().query('INSERT INTO zora_mail_signals(mailbox,kind) VALUES($1,$2)',[ms.mailbox,notice.lifecycleEvent||'message.created']);accepted++;
    }
    if(accepted) after(async()=>{try{await syncMailbox();}catch{console.error('Mailbox catch-up remains queued for the next maintenance run.');}});
    return new Response(null,{status:202});
  } catch(e){return responseError(e);}
}
