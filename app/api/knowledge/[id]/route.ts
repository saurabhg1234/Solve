import { z } from 'zod';
import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { knowledgeDecision,decideKnowledge } from '@/lib/knowledge';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;if(!z.uuid().safeParse(id).success)throw new HttpError(400,'Invalid knowledge version');const input=knowledgeDecision.safeParse(await request.json());if(!input.success)throw new HttpError(400,'Provide the exact version, decision and a meaningful note');return Response.json({version:await decideKnowledge(id,input.data,user)});}catch(error){return responseError(error);}
}
