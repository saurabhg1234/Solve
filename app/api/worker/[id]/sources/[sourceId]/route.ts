import { z } from 'zod';
import { requireRunner, responseError, HttpError } from '@/lib/auth';
import { database } from '@/lib/db';

export async function GET(request: Request, context: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    requireRunner(request);
    const params = await context.params;
    const ids = z.object({ id: z.uuid(), sourceId: z.uuid(), leaseId: z.uuid() }).safeParse({ ...params, leaseId: new URL(request.url).searchParams.get('leaseId') });
    if (!ids.success) throw new HttpError(400, 'Invalid source or lease identity');
    const { id, sourceId, leaseId } = ids.data;
    const db = database();
    const job = (await db.query("SELECT j.case_id FROM zora_jobs j JOIN zora_cases c ON c.id=j.case_id WHERE j.id=$1 AND j.lease_id=$2 AND j.state='leased' AND j.lease_expires_at>now() AND j.case_version=c.version", [id, leaseId])).rows[0];
    if (!job) throw new HttpError(409, 'Session lease is no longer valid');
    const source = (await db.query('SELECT data,mime_type,sha256 FROM zora_sources WHERE id=$1 AND case_id=$2', [sourceId, job.case_id])).rows[0];
    if (!source) throw new HttpError(404, 'Source not found in this pursuit');
    if (source.data.length > 4_000_000) throw new HttpError(413, 'This source requires the private large-file storage path');
    return new Response(new Uint8Array(source.data), { headers: { 'Content-Type': source.mime_type, 'Cache-Control': 'no-store', 'X-Zora-Sha256': source.sha256, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return responseError(error); }
}
