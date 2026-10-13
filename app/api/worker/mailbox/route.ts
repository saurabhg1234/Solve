import { requireRunner, responseError, HttpError } from '@/lib/auth';
import { microsoftConfig } from '@/lib/config';
import { graph } from '@/lib/microsoft';

/** Read-only connector check. Does not register monitoring or retrieve mail bodies. */
export async function GET(request: Request) {
  try {
    requireRunner(request);
    const ms = microsoftConfig();
    if (!ms.folder) throw new HttpError(503, 'Select the Zora folder before validating the connector');
    const folder = await graph(`users/${encodeURIComponent(ms.mailbox)}/mailFolders/${encodeURIComponent(ms.folder)}?$select=id,displayName,totalItemCount`);
    return Response.json({ authenticated: true, mailbox: ms.mailbox, folder: folder.displayName, messages: folder.totalItemCount, monitoringActive: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return responseError(error); }
}
