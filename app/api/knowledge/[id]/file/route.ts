import { z } from 'zod';
import { requireActor,responseError,HttpError } from '@/lib/auth';
import { database } from '@/lib/db';
import { byteRange,fileResponse } from '@/lib/files';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const user=await requireActor();const {id}=await context.params;if(!z.uuid().safeParse(id).success)throw new HttpError(400,'Invalid reusable file');const db=database();
    const file=(await db.query('SELECT filename,mime_type,sha256,status,owner_email,ingestion_complete,octet_length(data)::int AS size FROM zora_knowledge_versions WHERE id=$1',[id])).rows[0];if(!file)throw new HttpError(404,'Reusable file not found');
    if(file.status!=='approved'&&file.owner_email!==user.email&&!user.roles.includes('admin'))throw new HttpError(403,'Only approved reusable files are available to this account');
    if(!file.ingestion_complete)throw new HttpError(409,'Source import is incomplete; wait for its verified checksum');
    const range=byteRange(request.headers.get('range'),file.size);const bytes=(await db.query('SELECT substring(data FROM $2 FOR $3) AS bytes FROM zora_knowledge_versions WHERE id=$1',[id,range.start+1,range.end-range.start+1])).rows[0].bytes;
    return fileResponse(bytes,file,range);
  }catch(error){return responseError(error);}
}
