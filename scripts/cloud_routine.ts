/** A bounded bridge for a native cloud Codex session. Never launches another model or daemon. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { resultSchema, safeOutputPath } from '../lib/result';

const jobSchema = z.object({
  id: z.uuid(), leaseId: z.uuid(),
  case: z.object({ id: z.uuid(), title: z.string(), workflow: z.string() }).passthrough(),
  stage: z.object({ id: z.string(), title: z.string() }).passthrough(),
  instructions: z.string(), requiresIndependentReview: z.boolean(),
  sources: z.array(z.object({ id: z.uuid(), filename: z.string(), mime_type: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })),
}).passthrough();
type Job = z.infer<typeof jobSchema>;
const root = resolve(process.env.ZORA_WORK_ROOT || '.zora/routine');

function origin() {
  const value = process.env.ZORA_APP_URL;
  if (!value) throw new Error('ZORA_APP_URL is missing');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Routine requires HTTPS');
  return url.origin;
}
async function request(path: string, credential: string, body?: unknown) {
  const secret = process.env[credential];
  if (!secret || secret.length < 32) throw new Error(`${credential} is missing or too short`);
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (process.env.ZORA_NOTIFICATION_BYPASS) headers['x-vercel-protection-bypass'] = process.env.ZORA_NOTIFICATION_BYPASS;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(new URL(path, origin()), { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Routine endpoint failed (${response.status}); check bindings, deployment protection and database migration`);
  return response;
}
async function maintenance() {
  const result = await (await request('/api/microsoft/maintenance', 'CRON_SECRET', {})).json();
  console.log(JSON.stringify({ maintenance: { renewed: result.subscription?.renewed, expires: result.subscription?.expires, synced: result.sync?.synced, busy: result.sync?.busy } }));
}
async function workspace(path: string): Promise<{ dir: string; job: Job }> {
  const dir = await realpath(resolve(path));
  const actualRoot = await realpath(root);
  if (!dir.startsWith(actualRoot + sep)) throw new Error('Routine workspace is outside its private root');
  const job = jobSchema.parse(JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')));
  return { dir, job };
}
async function heartbeat(job: Job) {
  await request(`/api/worker/${job.id}/heartbeat`, 'ZORA_RUNNER_TOKEN', { leaseId: job.leaseId });
}
async function claim() {
  await maintenance();
  const body = await (await request('/api/worker/claim', 'ZORA_RUNNER_TOKEN', { workerId: process.env.ZORA_WORKER_ID || `zora-cloud-${randomUUID()}` })).json();
  if (!body.job) { console.log(JSON.stringify({ job: null, message: 'No executable stage is queued. Inbox workflow confirmation and human gates remain portal actions.' })); return; }
  const job = jobSchema.parse(body.job);
  const dir = join(root, job.id, randomUUID());
  await mkdir(join(dir, 'sources'), { recursive: true, mode: 0o700 });
  await mkdir(join(dir, 'outputs/client'), { recursive: true, mode: 0o700 });
  await mkdir(join(dir, 'outputs/internal'), { recursive: true, mode: 0o700 });
  await writeFile(join(dir, 'request.json'), JSON.stringify(job, null, 2), { mode: 0o600 });
  await writeFile(join(dir, 'instructions.txt'), job.instructions, { mode: 0o600 });
  const manifest = [];
  for (const source of job.sources) {
    await heartbeat(job);
    const response = await request(`/api/worker/${job.id}/sources/${source.id}?leaseId=${job.leaseId}`, 'ZORA_RUNNER_TOKEN');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error('Downloaded source hash does not match its manifest');
    // Use server-issued UUIDs rather than email attachment filenames as local paths.
    const path = `sources/${source.id}.source`;
    await writeFile(join(dir, path), bytes, { mode: 0o600 });
    manifest.push({ ...source, path });
  }
  await writeFile(join(dir, 'sources.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await writeFile(join(dir, 'result.schema.json'), JSON.stringify(z.toJSONSchema(resultSchema), null, 2), { mode: 0o600 });
  await heartbeat(job);
  console.log(JSON.stringify({ workspace: dir, caseId: job.case.id, workflow: job.case.workflow, stage: job.stage.id, sources: manifest.length, requiresIndependentReview: job.requiresIndependentReview, next: 'Read instructions.txt, request.json and sources.json. Process this stage in the current native Codex session. Renew the lease at least every two minutes. Save result.json and use routine complete. Unimplemented artifact/QC stages must remain blocked.' }));
}
async function complete(path: string) {
  const { dir, job } = await workspace(path);
  const result = resultSchema.parse(JSON.parse(await readFile(join(dir, 'result.json'), 'utf8')));
  for (const file of result.outputFiles) {
    if (!safeOutputPath(file.path)) throw new Error('Unsafe generated output path');
    const actual = await realpath(join(dir, file.path));
    if (!actual.startsWith(dir + sep) || !(await stat(actual)).isFile()) throw new Error('Output escapes the private workspace');
  }
  if (result.outputFiles.length && result.status === 'completed') {
    result.status = 'blocked';
    result.missingInputs.push('Verified artifact import is pending. Generated files remain in the private cloud task workspace.');
  }
  await request(`/api/worker/${job.id}/complete`, 'ZORA_RUNNER_TOKEN', { leaseId: job.leaseId, result });
  console.log(JSON.stringify({ recorded: true, submittedStatus: result.status, note: 'The server independently enforces QC holds and human gates; this response does not claim release.' }));
}
async function main() {
  const [action = 'check', path] = process.argv.slice(2);
  if (action === 'check') return maintenance();
  if (action === 'claim') return claim();
  if (!path) throw new Error('Supply the private routine workspace path');
  if (action === 'heartbeat') { await heartbeat((await workspace(path)).job); console.log('Lease renewed.'); return; }
  if (action === 'complete') return complete(path);
  throw new Error('Use check, claim, heartbeat or complete');
}
main().catch(error => { console.error(error instanceof Error && error.message.startsWith('Routine endpoint failed') ? error.message : `Cloud routine failed (${error instanceof Error ? error.name : 'unknown'}); no credential or source values are logged.`); process.exitCode = 1; });
