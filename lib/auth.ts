import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { appUrl } from './config';
import { constantTimeEqual, parseRoles } from './engine';
import type { Role } from './catalogue';

export interface Actor { email: string; name: string; roles: Role[]; }
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function key() {
  const secret = process.env.ZORA_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'Sign-in is not configured');
  return new TextEncoder().encode(secret);
}
export async function actor(): Promise<Actor | null> {
  const token = (await cookies()).get('zora_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: 'zora', audience: 'zora-portal', algorithms: ['HS256'] });
    const found = actorFor(String(payload.sub || ''));
    return found ? { ...found, name: String(payload.name || found.email) } : null;
  } catch { return null; }
}
/** Resolves an approved account and its configured roles; used for sessions and verified mailbox senders. */
export function actorFor(address: string): Actor | null {
  const email = address.trim().toLowerCase();
  const allowed = (process.env.ZORA_ALLOWED_EMAILS || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
  if (!email || !allowed.includes(email)) return null;
  const map = JSON.parse(process.env.ZORA_ROLE_MAP || '{}');
  return { email, name: email, roles: parseRoles(map[email] ?? ['consultant']) };
}
export async function requireActor(): Promise<Actor> {
  const user = await actor(); if (!user) throw new HttpError(401, 'Please sign in with your approved work account'); return user;
}
export async function sessionToken(email: string, name: string) {
  return new SignJWT({ name }).setProtectedHeader({ alg: 'HS256' }).setSubject(email.toLowerCase()).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('8h').sign(key());
}
export function requireSameOrigin(request: Request) {
  if (request.headers.get('origin') !== appUrl()) throw new HttpError(403, 'Request origin is not allowed');
}
export function requireRunner(request: Request) {
  const expected = process.env.ZORA_RUNNER_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!expected || expected.length < 32 || !constantTimeEqual(supplied, expected)) throw new HttpError(401, 'Worker authentication required');
}
export function responseError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  // Never return provider response bodies, credentials, raw email, or SQL diagnostics.
  console.error('Zora operation failed:', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: 'This operation is unavailable. Check the workspace configuration.' }, { status: 503 });
}
