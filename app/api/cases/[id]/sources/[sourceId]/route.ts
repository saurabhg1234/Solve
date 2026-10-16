import {z} from 'zod';
import {requireActor,requireSameOrigin,responseError,HttpError} from '@/lib/auth';
import {accessCase,event} from '@/lib/cases';
import {canReadInternal} from '@/lib/files';
import {transaction} from '@/lib/db';
import {sourceContextSchema} from '@/lib/source-context';

export async function PATCH(request:Request,context:{params:Promise<{id:string;sourceId:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id,sourceId}=await context.params;
    const input=z.object({version:z.number().int().positive(),sourceContext:sourceContextSchema}).strict().safeParse(await request.json());
    if(!input.success||!z.uuid().safeParse(sourceId).success)throw new HttpError(400,'Provide a source category, optional label/notes and current pursuit version');
    const result=await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);
      const file=(await db.query('SELECT id,visibility,active,sha256,provenance FROM zora_sources WHERE case_id=$1 AND id=$2 FOR UPDATE',[id,sourceId])).rows[0];
      if(!file)throw new HttpError(404,'Source not found');
      if(file.visibility==='internal'?!canReadInternal(user):!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Your role cannot change this source context');
      if(!file.active)throw new HttpError(409,'Retired sources cannot be changed');
      if(!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Open a revision before changing source context');
      if(c.version!==input.data.version)throw new HttpError(409,'The pursuit changed; refresh before saving source context');
      const next={...input.data.sourceContext,updatedBy:user.email,updatedAt:new Date().toISOString()};
      await db.query("UPDATE zora_sources SET provenance=jsonb_set(provenance,'{context}',$2::jsonb) WHERE id=$1",[sourceId,JSON.stringify(next)]);
      const changed=(await db.query('UPDATE zora_cases SET version=version+1,source_revision=source_revision+1,updated_at=now() WHERE id=$1 RETURNING version',[id])).rows[0];
      await event(db,id,'source.context_updated',user.email,{sourceId,sha256:file.sha256,previousContext:file.provenance?.context||null,sourceContext:next});
      return {saved:true,version:changed.version};
    });
    return Response.json(result);
  }catch(error){return responseError(error);}
}
