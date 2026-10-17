import type { Metadata } from 'next';
import { actor, HttpError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { DEMO_CASE_ID } from '@/lib/demos/reconciliation';
import { PentagonDemo } from '@/components/demos/pentagon-demo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pentagon · Invoice reconciliation | Mindmap', robots: { index: false, follow: false } };
export default async function Page() {
  const user = await actor();
  if (!user) return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 32 }}><h1>Pentagon demo workspace</h1><p>Sign in with your approved Mindmap work account, then reopen this demo link.</p><a className="button primary" href="/api/auth/login">Sign in with Microsoft</a></main>;
  try { await accessCase(DEMO_CASE_ID, user); }
  catch (error) {
    if (error instanceof HttpError && [403, 404].includes(error.status)) return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 32 }}><h1>Access required</h1><p>This demo is available to the Pentagon pursuit team.</p><a href="/">Return to Zora</a></main>;
    throw error;
  }
  return <PentagonDemo />;
}
