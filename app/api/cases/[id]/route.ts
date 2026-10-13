import { requireActor, responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor } from '@/lib/engine';
import { database } from '@/lib/db';

export async function GET(_request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const user=await requireActor(); const {id}=await context.params; const c=await accessCase(id,user);
    const events=await database().query('SELECT type,actor,created_at FROM zora_events WHERE case_id=$1 ORDER BY id DESC LIMIT 100',[id]);
    return Response.json({case:c,stages:stagesFor(c.workflow).map(s=>({id:s.id,title:s.title,kind:s.kind,approvers:s.approvers})),events:events.rows},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return responseError(e);}
}
