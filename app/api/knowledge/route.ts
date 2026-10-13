import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
import { knowledgeInput,knowledgeMetadata,proposeKnowledge,canProposeKnowledge } from '@/lib/knowledge';
import { z } from 'zod';

export async function GET(request:Request){
  try{
    const user=await requireActor();const offset=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('offset')||0);if(!offset.success)throw new HttpError(400,'Invalid library page');
    const rows=await database().query(`SELECT ${knowledgeMetadata} FROM zora_knowledge_versions WHERE status='approved' OR owner_email=$1 OR $2 ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $3`,[user.email,user.roles.includes('admin'),offset.data]);
    return Response.json({versions:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?offset.data+50:null,canPropose:canProposeKnowledge(user),canApprove:user.roles.includes('admin')},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return responseError(error);}
}
export async function POST(request:Request){
  try{requireSameOrigin(request);const user=await requireActor();const parsed=knowledgeInput.safeParse(await request.json());if(!parsed.success)throw new HttpError(400,'Select a source, knowledge type and title. Company claims require a passage/location; version updates require the latest version.');return Response.json({version:await proposeKnowledge(parsed.data,user)},{status:201});}catch(error){return responseError(error);}
}
