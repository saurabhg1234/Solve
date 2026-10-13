import { z } from 'zod';
import { requireRunner, responseError, HttpError } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { byteRange,fileResponse } from '@/lib/files';
import { leasedJob } from '@/lib/uploads';

export async function GET(request: Request, context: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    requireRunner(request);
    const params = await context.params;
    const ids = z.object({ id: z.uuid(), sourceId: z.uuid(), leaseId: z.uuid() }).safeParse({ ...params, leaseId: new URL(request.url).searchParams.get('leaseId') });
    if (!ids.success) throw new HttpError(400, 'Invalid source or lease identity');
    const { id, sourceId, leaseId } = ids.data;
    return await transaction(async db=>{
      const job=await leasedJob(db,id,leaseId);
      const source=(await db.query('SELECT filename,mime_type,sha256,octet_length(data)::int AS size FROM zora_sources WHERE id=$1 AND case_id=$2',[sourceId,job.case_id])).rows[0];
      if(!source)throw new HttpError(404,'Source not found in this pursuit');
      const range=byteRange(request.headers.get('range'),source.size);
      const bytes=(await db.query('SELECT substring(data FROM $3 FOR $4) AS bytes FROM zora_sources WHERE id=$1 AND case_id=$2',[sourceId,job.case_id,range.start+1,range.end-range.start+1])).rows[0].bytes;
      return fileResponse(bytes,source,range);
    });
  } catch (error) { return responseError(error); }
}
