export function microsoftConfig() {
  return {
    tenant: process.env.MS_TENANT_ID || process.env.Tenant,
    client: process.env.MS_CLIENT_ID || process.env.Client,
    secret: process.env.MS_CLIENT_SECRET || process.env.Client_secret,
    object: process.env.MS_SERVICE_PRINCIPAL_OBJECT_ID || process.env.Object,
    mailbox: process.env.MS_ZORA_MAILBOX || process.env.EMAIL || 'apex.ap@mindmapdigital.ai',
    folder: process.env.MS_ZORA_FOLDER_ID,
    tag: process.env.ZORA_SUBJECT_TAG || '[ZORA]',
  };
}
export function appUrl(): string {
  if (!process.env.ZORA_APP_URL) throw new Error('ZORA_APP_URL must be configured');
  const url = new URL(process.env.ZORA_APP_URL);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production ZORA_APP_URL must use HTTPS');
  return url.origin;
}
export function notificationUrl(origin = appUrl(), bypass = process.env.ZORA_NOTIFICATION_BYPASS): string {
  const url = new URL('/api/microsoft/notifications', origin);
  // A service-specific automation token keeps the portal's Vercel protection intact.
  if (bypass) url.searchParams.set('x-vercel-protection-bypass', bypass);
  return url.href;
}
export function ready() {
  const ms = microsoftConfig();
  return { database: !!process.env.DATABASE_URL, identity: !!(ms.tenant && ms.client && ms.secret && process.env.ZORA_SESSION_SECRET && process.env.ZORA_ALLOWED_EMAILS && process.env.ZORA_APP_URL), mailbox: !!(ms.tenant && ms.client && ms.secret && ms.folder && process.env.ZORA_WEBHOOK_SECRET), runner: !!process.env.ZORA_RUNNER_TOKEN };
}
