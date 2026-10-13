import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { attachKnowledge } from '@/lib/knowledge';
const input=z.object({version:z.number().int().positive(),versionIds:z.array(z.uuid()).max(10).default([]),retireEntryIds:z.array(z.uuid()).max(10).default([]),note:z.string().trim().min(10).max(2000).optional()}).refine(v=>v.versionIds.length+v.retireEntryIds.length>0&&new Set(v.versionIds).size===v.versionIds.length&&new Set(v.retireEntryIds).size===v.retireEntryIds.length&&(!v.retireEntryIds.length||!!v.note));
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;if(!z.uuid().safeParse(id).success)throw new HttpError(400,'Invalid pursuit');const parsed=input.safeParse(await request.json());if(!parsed.success)throw new HttpError(400,'Select up to ten distinct reusable sources to attach or retire');return Response.json(await attachKnowledge(id,parsed.data,user));}catch(error){return responseError(error);}
}
