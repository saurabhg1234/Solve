import { z } from 'zod';
import { requireActor,responseError,HttpError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { database } from '@/lib/db';
import { byteRange,canReadArtifact,fileResponse } from '@/lib/files';
export async function GET(request:Request,context:{params:Promise<{id:string;kind:string;fileId:string}>}){
  try{
    const user=await requireActor();const input=z.object({id:z.uuid(),kind:z.enum(['sources','artifacts']),fileId:z.uuid()}).safeParse(await context.params);if(!input.success)throw new HttpError(400,'Invalid pursuit file');
    const {id,kind,fileId}=input.data;const db=database();await accessCase(id,user,db);const table=kind==='sources'?'zora_sources':'zora_artifacts';
    const file=(await db.query(kind==='artifacts'?'SELECT a.filename,a.mime_type,a.sha256,octet_length(a.data)::int AS size,a.visibility,a.purpose,c.workflow,j.stage_id FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id JOIN zora_cases c ON c.id=a.case_id WHERE a.id=$1 AND a.case_id=$2 AND a.lease_id=j.lease_id':`SELECT filename,mime_type,sha256,octet_length(data)::int AS size FROM ${table} WHERE id=$1 AND case_id=$2`,[fileId,id])).rows[0];
    if(!file)throw new HttpError(404,'File not found in this pursuit');if(kind==='artifacts'&&!canReadArtifact(user,file))throw new HttpError(403,'This internal file requires its assigned review or commercial role');
    const range=byteRange(request.headers.get('range'),file.size);const bytes=(await db.query(`SELECT substring(data FROM $3 FOR $4) AS bytes FROM ${table} WHERE id=$1 AND case_id=$2`,[fileId,id,range.start+1,range.end-range.start+1])).rows[0].bytes;
    return fileResponse(bytes,file,range);
  }catch(e){return responseError(e);}
}
