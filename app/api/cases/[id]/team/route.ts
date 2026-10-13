import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { accessCase,event,requireCaseManager } from '@/lib/cases';
import { transaction } from '@/lib/db';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const body=z.object({emails:z.array(z.email()).max(20)}).safeParse(await request.json());if(!body.success)throw new HttpError(400,'Provide valid work email addresses');
    const emails=[...new Set(body.data.emails.map(e=>e.toLowerCase()))];const allowed=(process.env.ZORA_ALLOWED_EMAILS||'').split(',').map(e=>e.trim().toLowerCase());
    if(emails.some(e=>!allowed.includes(e)))throw new HttpError(400,'Every team member must first be an approved workspace account');
    await transaction(async db=>{await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);await db.query('DELETE FROM zora_case_members WHERE case_id=$1',[id]);for(const email of emails)await db.query('INSERT INTO zora_case_members(case_id,email,added_by) VALUES($1,$2,$3)',[id,email,user.email]);await event(db,id,'team.updated',user.email,{emails});});
    return Response.json({saved:true});
  }catch(e){return responseError(e);}
}
