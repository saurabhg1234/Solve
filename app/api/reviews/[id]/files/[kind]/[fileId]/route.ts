import { z } from 'zod';
import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { leasedReview } from '@/lib/reviews';
import { byteRange,fileResponse } from '@/lib/files';
export async function GET(request:Request,context:{params:Promise<{id:string;kind:string;fileId:string}>}){
  try{requireRunner(request);const ids=z.object({id:z.uuid(),kind:z.enum(['sources','artifacts']),fileId:z.uuid(),leaseId:z.uuid()}).safeParse({...await context.params,leaseId:new URL(request.url).searchParams.get('leaseId')});if(!ids.success)throw new HttpError(400,'Invalid review file/lease');const {id,kind,fileId,leaseId}=ids.data;
    return await transaction(async db=>{const review=await leasedReview(db,id,leaseId);const selected=review.packet.files.find((f:any)=>f.id===fileId&&f.kind===kind);if(!selected)throw new HttpError(403,'This file is outside the isolated review packet');const table=kind==='sources'?'zora_sources':'zora_artifacts';const file=(await db.query(`SELECT filename,mime_type,sha256,octet_length(data)::int AS size FROM ${table} WHERE id=$1 AND case_id=$2`,[fileId,review.case_id])).rows[0];if(!file||file.sha256!==selected.sha256)throw new HttpError(409,'Review file snapshot changed');const range=byteRange(request.headers.get('range'),file.size);const bytes=(await db.query(`SELECT substring(data FROM $2 FOR $3) AS bytes FROM ${table} WHERE id=$1`,[fileId,range.start+1,range.end-range.start+1])).rows[0].bytes;return fileResponse(bytes,file,range);});
  }catch(e){return responseError(e);}
}
