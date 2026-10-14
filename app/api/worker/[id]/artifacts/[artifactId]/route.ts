import { requireResetFile } from '@/lib/trust-reset-contract';
import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { byteRange,fileResponse } from '@/lib/files';
import { leasedJob } from '@/lib/uploads';
export async function GET(request:Request,context:{params:Promise<{id:string;artifactId:string}>}){
  try{
    requireRunner(request);const parsed=z.object({id:z.uuid(),artifactId:z.uuid(),leaseId:z.uuid()}).safeParse({...await context.params,leaseId:new URL(request.url).searchParams.get('leaseId')});if(!parsed.success)throw new HttpError(400,'Invalid artifact/session identity');
    const {id,artifactId,leaseId}=parsed.data;
    return await transaction(async db=>{const job=await leasedJob(db,id,leaseId);const file=(await db.query('SELECT filename,mime_type,sha256,octet_length(data)::int AS size FROM zora_artifacts WHERE id=$1 AND case_id=$2 AND source_revision=$3',[artifactId,job.case_id,job.source_revision])).rows[0];if(!file)throw new HttpError(404,'Artifact not found in this pursuit revision');requireResetFile(job,'artifacts',artifactId,file.sha256);const range=byteRange(request.headers.get('range'),file.size);const bytes=(await db.query('SELECT substring(data FROM $2 FOR $3) AS bytes FROM zora_artifacts WHERE id=$1',[artifactId,range.start+1,range.end-range.start+1])).rows[0].bytes;return fileResponse(bytes,file,range);});
  }catch(e){return responseError(e);}
}
