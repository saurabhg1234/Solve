import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
import { dispatchCounts,dispatchPlan } from '@/lib/dispatch';
import { contextSchema } from '@/lib/review-plan';

/** Records a dispatcher wake and says how many fresh worker sessions to start. It never claims or changes work. */
export async function POST(request:Request){
  try{
    requireRunner(request);const body=await request.json().catch(()=>({}));
    const context=contextSchema.safeParse(body.contextId);if(!context.success)throw new HttpError(400,'Supply the native session identity');
    const db=database();const counts=await dispatchCounts(db);const plan=dispatchPlan(counts);
    await db.query("INSERT INTO zora_events(case_id,type,actor,data) VALUES(NULL,'dispatcher.wake',$1,$2)",[String(body.workerId||'zora-dispatcher').slice(0,100),JSON.stringify({contextId:context.data,action:plan.action,claimable:plan.claimable,workerSessions:plan.workerSessions,counts})]);
    return Response.json({plan,counts},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return responseError(e);}
}
