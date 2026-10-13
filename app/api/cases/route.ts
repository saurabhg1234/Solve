import { z } from 'zod';
import { requireActor, requireSameOrigin, responseError } from '@/lib/auth';
import { database } from '@/lib/db';
import { createCase, mapCase } from '@/lib/cases';

const input = z.object({ title: z.string().trim().min(3).max(200), client: z.string().trim().min(2).max(150), workflow: z.enum(['W1','W2','W3','W4','W5','W6','W7','W8']), briefing: z.string().trim().min(20).max(40000), inboxId:z.string().uuid().optional() });
export async function GET() {
  try {
    const user=await requireActor();
    const result=await database().query('SELECT c.* FROM zora_cases c WHERE requested_by=$1 OR $2 OR EXISTS(SELECT 1 FROM zora_case_members m WHERE m.case_id=c.id AND m.email=$1) ORDER BY updated_at DESC LIMIT 100',[user.email,user.roles.includes('admin')]);
    return Response.json({ cases:result.rows.map(mapCase) },{headers:{'Cache-Control':'no-store'}});
  } catch(e) { return responseError(e); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const user=await requireActor();
    const parsed=input.safeParse(await request.json());
    if (!parsed.success) return Response.json({error:'Provide a client, title, workflow, and a brief of at least 20 characters.'},{status:400});
    return Response.json({ case:await createCase(parsed.data,user) },{status:201});
  } catch(e) {return responseError(e);}
}
