import { constantTimeEqual } from '@/lib/engine';
import { responseError,HttpError } from '@/lib/auth';
import { renewSubscription,syncMailbox } from '@/lib/microsoft';
import { database } from '@/lib/db';
export const maxDuration=60;
export async function POST(request:Request) {
  try {
    const secret=process.env.CRON_SECRET;const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
    if(!secret||secret.length<32||!constantTimeEqual(secret,supplied)) throw new HttpError(401,'Maintenance authentication required');
    const subscription=await renewSubscription();const sync=await syncMailbox();await database().query('DELETE FROM zora_uploads WHERE expires_at<now()');return Response.json({subscription,sync});
  } catch(e){return responseError(e);}
}
