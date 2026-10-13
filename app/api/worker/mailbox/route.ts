import { requireRunner, responseError, HttpError } from '@/lib/auth';
import { microsoftConfig } from '@/lib/config';
import { graph } from '@/lib/microsoft';
import { database } from '@/lib/db';

/** Read-only connector check. Does not register monitoring or retrieve mail bodies. */
export async function GET(request: Request) {
  try {
    requireRunner(request);
    const ms = microsoftConfig();
    if (!ms.folder) throw new HttpError(503, 'Select the Zora folder before validating the connector');
    const folder = await graph(`users/${encodeURIComponent(ms.mailbox)}/mailFolders/${encodeURIComponent(ms.folder)}?$select=id,displayName,totalItemCount`);
    let storage = { connected: false, schemaReady: false };
    let monitoring: { subscriptionActive: boolean; expiresAt: string | null; lastSyncAt: string | null } = { subscriptionActive: false, expiresAt: null, lastSyncAt: null };
    if (process.env.DATABASE_URL) {
      const db = database();
      const schema = (await db.query("SELECT to_regclass('public.zora_mail_state') AS installed,to_regclass('public.zora_knowledge_versions') AS knowledge,EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zora_sources' AND column_name='active') AS source_lifecycle,EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zora_sources' AND column_name='visibility') AS source_privacy")).rows[0];
      storage = { connected: true, schemaReady: !!schema.installed&&!!schema.knowledge&&schema.source_lifecycle&&schema.source_privacy };
      if (schema.installed) {
        const state = (await db.query('SELECT subscription_id,subscription_expires_at,last_sync_at FROM zora_mail_state WHERE mailbox=$1', [ms.mailbox])).rows[0];
        monitoring = { subscriptionActive: !!state?.subscription_id && new Date(state.subscription_expires_at).getTime() > Date.now(), expiresAt: state?.subscription_expires_at?.toISOString() || null, lastSyncAt: state?.last_sync_at?.toISOString() || null };
      }
    }
    return Response.json({ authenticated: true, mailbox: ms.mailbox, folder: folder.displayName, messages: folder.totalItemCount, storage, monitoring, automaticProcessingVerified: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return responseError(error); }
}
