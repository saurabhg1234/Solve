import { constantTimeEqual } from '@/lib/engine';
import { responseError,HttpError } from '@/lib/auth';
import { renewSubscription,syncMailbox } from '@/lib/microsoft';
import { database } from '@/lib/db';
import { autoIntake } from '@/lib/triage';
import { microsoftConfig } from '@/lib/config';
export const maxDuration=60;
async function maintain(request:Request) {
  let authenticated=false;
  const source=request.method==='GET'&&request.headers.get('user-agent')==='vercel-cron/1.0'?'vercel-cron':'manual';
  try {
    const secret=process.env.CRON_SECRET;const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
    if(!secret||secret.length<32||!constantTimeEqual(secret,supplied)) throw new HttpError(401,'Maintenance authentication required');
    authenticated=true;
    const subscription=await renewSubscription();const sync=await syncMailbox();const intake=await autoIntake();await database().query('DELETE FROM zora_uploads WHERE expires_at<now()');
    await database().query("INSERT INTO zora_events(case_id,type,actor,data) VALUES(null,'mailbox.maintenance',$1,$2)",[source,JSON.stringify({mailbox:microsoftConfig().mailbox,ok:true,synced:sync.synced,busy:sync.busy,renewed:subscription.renewed,intake:intake.map(r=>r.state)})]);
    return Response.json({subscription,sync,intake:intake.map(({inboxId,state})=>({inboxId,state}))},{headers:{'Cache-Control':'no-store'}});
  } catch(e){
    if(authenticated)try{await database().query("INSERT INTO zora_events(case_id,type,actor,data) VALUES(null,'mailbox.maintenance',$1,$2)",[source,JSON.stringify({mailbox:microsoftConfig().mailbox,ok:false})]);}catch{console.error('Mailbox maintenance failure could not be recorded.');}
    return responseError(e);
  }
}
export const POST=maintain;
// Vercel Cron invokes GET with the existing CRON_SECRET bearer credential.
export const GET=maintain;
