/** Local-only W8 draft rendering. No mail transport or model calls. */
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { brandedEmail, zoraRecipients } from './email';
import { inventory, MAX_REVIEW_ELEMENTS, type ReviewElement } from './review-manifest';

const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const clean = (max: number) => z.string().trim().min(1).max(max).refine(s => !/[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u.test(s), 'Control characters are not allowed');
const line = (max: number) => clean(max).refine(s => !/[\r\n\t]/u.test(s), 'Use one line');
const sourceSchema = z.object({ id: z.uuid(), filename: line(250), mime_type: line(150), path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).passthrough();
const policySchema = z.object({ maxWords: z.number().int().min(1).max(2000), hypeWords: z.array(line(100)).max(200) }).strict();
const citationSchema = z.object({ sourceId: z.uuid(), location: line(1000), quote: clean(12000) }).strict();
const segmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('claim'), text: line(4000), citations: z.array(citationSchema).min(1).max(10) }).strict(),
  z.object({ kind: z.literal('courtesy'), text: line(4000), reason: clean(1000) }).strict(),
]);
const planSchema = z.object({
  policySourceId: z.uuid(), to: z.array(line(254)).min(1).max(50), cc: z.array(line(254)).max(50),
  subject: segmentSchema, paragraphs: z.array(z.array(segmentSchema).min(1).max(20)).min(1).max(30),
}).strict();
type Source = z.infer<typeof sourceSchema> & { bytes: Buffer; elements: ReviewElement[] };

async function containedFile(root: string, path: string, max: number) {
  const actual = await realpath(resolve(root, path));
  if (!actual.startsWith(root + sep)) throw new Error('Email input escapes its private workspace');
  const file = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stats = await file.stat(); if (!stats.isFile() || stats.size < 1 || stats.size > max) throw new Error('Email input exceeds its file bound'); return await file.readFile(); }
  finally { await file.close(); }
}

async function loadSources(workspace: string) {
  const root = await realpath(workspace);
  const files = z.array(sourceSchema).min(1).max(30).parse(JSON.parse((await containedFile(root, 'sources.json', 1024 * 1024)).toString('utf8')));
  if (new Set(files.map(f => f.id)).size !== files.length) throw new Error('Source IDs must be unique');
  const sources: Source[] = []; let total = 0, count = 0;
  for (const file of files) {
    const bytes = await containedFile(root, file.path, 32 * 1024 * 1024); total += bytes.length;
    if (total > 64 * 1024 * 1024 || hash(bytes) !== file.sha256) throw new Error('Email source bytes exceed the packet bound or fail their SHA-256');
    // Rebuild references from actual bytes rather than accepting an edited extraction cache.
    const elements = await inventory({ ...file, data: bytes, role: 'source' }); count += elements.length;
    if (count > MAX_REVIEW_ELEMENTS) throw new Error('Split the email source packet into bounded sections');
    sources.push({ ...file, bytes, elements });
  }
  return { root, sources };
}

async function privateOutput(root: string, path: string, bytes: string) {
  const destination = join(root, path);
  for (const directory of [join(root, 'outputs'), dirname(destination)]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await lstat(directory)).isSymbolicLink() || !(await realpath(directory)).startsWith(root + sep)) throw new Error('Email output directory must stay inside the private workspace');
  }
  try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('Email output cannot replace a symlink'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const temporary = destination + '.' + randomUUID() + '.tmp';
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(bytes, 'utf8'); await file.close(); await rename(temporary, destination); }
  finally { await file.close(); await rm(temporary, { force: true }); }
  return { path, sha256: hash(bytes), byteSize: Buffer.byteLength(bytes) };
}

export async function emailContext(workspace: string) {
  const { root, sources } = await loadSources(workspace);
  const context = { version: 1, status: 'unverified-source-context', sourceApprovalRecorded: false,
    sources: sources.map(({ id, filename, sha256, elements }) => ({ id, filename, sha256, elements: elements.filter(e => e.kind !== 'word') })),
    note: 'Exact-byte extraction only. Codex must select the facts the email may use; citations do not establish truth, permission to disclose or semantic support. Visual source checks and independent W8 QC still apply.' };
  return { ...await privateOutput(root, 'outputs/internal/email-context.json', JSON.stringify(context, null, 2)), mimeType: 'application/json', visibility: 'internal', purpose: 'workpaper' };
}

const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en').replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function checkWording(text: string, hypeWords: string[]) {
  const normal = normalized(text);
  for (const phrase of hypeWords) {
    const term = normalized(phrase);
    if (!term) throw new Error('Hype-word entries must contain a word');
    if ((' ' + normal + ' ').includes(' ' + term + ' ')) throw new Error('Draft contains a configured hype phrase');
  }
  // These are bounded mechanical holds, not substitutes for the independent D4/D6 checks.
  const free = '(?:free|complimentary|no cost|zero cost|at no charge|without charge)';
  const demo = '(?:demo|demonstration|poc|proof of concept|pilot)';
  if (new RegExp(`\\b${free}\\b(?: \\w+){0,8} \\b${demo}\\b|\\b${demo}\\b(?: \\w+){0,8} \\b${free}\\b`, 'u').test(normal)) throw new Error('Remove free demo/POC wording before email export');
  if (/[$€£₹¥]|\b(?:usd|aed|inr|eur|gbp|sar)\s*[\d,.]|\b(?:price|priced|cost|fee|fees|charge|charges|rate|discount|margin|overhead|man[ -]?hours?|hourly)\b/iu.test(text)) throw new Error('Commercial wording requires removal before W8 export; internal estimates must never enter an email');
  if (/\b(?:guarantee|guaranteed|promise|promised|commit|committed)\b/iu.test(text) || /\b(?:deliver|complete|finish|deploy|launch|go live|ready)\b.{0,80}\b(?:by|within|tomorrow|today|days?|weeks?|months?)\b/iu.test(normal)) throw new Error('Remove delivery/guarantee commitments before email export');
}

export async function buildEmail(workspace: string, input: unknown) {
  const plan = planSchema.parse(input);
  const { root, sources } = await loadSources(workspace);
  const policyFile = sources.find(f => f.id === plan.policySourceId);
  if (!policyFile) throw new Error('Select an actual email policy source; deferred values have no defaults');
  const policy = policySchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(policyFile.bytes)));
  const recipients = zoraRecipients(plan.to, plan.cc);
  const to = recipients.toRecipients.map(r => r.emailAddress.address), cc = recipients.ccRecipients.map(r => r.emailAddress.address);
  const subject = plan.subject.text;
  if (subject.length > 200) throw new Error('Email subject exceeds its header bound');
  if (/\[jarvis\]/iu.test(subject)) throw new Error('Zora drafts cannot use the other agent identity');
  const paragraphs = plan.paragraphs.map(p => p.map(s => s.text).join(' '));
  const segments = [{ location: 'subject', segment: plan.subject }, ...plan.paragraphs.flatMap((p, i) => p.map((segment, j) => ({ location: `paragraph ${i + 1}, segment ${j + 1}`, segment })))];
  const mapping = segments.map(({ location, segment }) => {
    if (segment.kind === 'courtesy') return { location, ...segment, classificationVerified: false };
    const citations = segment.citations.map(citation => {
      const source = sources.find(f => f.id === citation.sourceId);
      if (!source || source.id === plan.policySourceId) throw new Error('A client claim must cite a factual source, not the email policy');
      const element = source.elements.find(e => e.location === citation.location && ['paragraph', 'caption', 'table_cell'].includes(e.kind) && e.text?.includes(citation.quote));
      if (!element) throw new Error('A claim citation must quote an actual source passage at its exact location');
      return { ...citation, filename: source.filename, sourceSha256: source.sha256, elementId: element.id, supportVerified: false };
    });
    return { location, ...segment, citations };
  });
  const content = subject + '\n' + paragraphs.join('\n\n');
  const words = content.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length || 0;
  if (words > policy.maxWords) throw new Error('Draft exceeds the explicitly configured subject/body word limit');
  checkWording(content, policy.hypeWords);
  const body = paragraphs.join('\n\n');
  const envelope = { version: 1, status: 'draft', subject, ...recipients, bodyFile: 'email.html', textFile: 'email.txt', attachmentIds: [], humanProofreadRequired: true, independentQcRequired: true, sent: false };
  const outputs = [
    { path: 'outputs/client/email.html', bytes: brandedEmail(body), mimeType: 'text/html' },
    { path: 'outputs/client/email.txt', bytes: `To: ${to.join(', ')}\nCc: ${cc.join(', ')}\nSubject: ${subject}\n\n${body}\n\nPrepared by Zora · Mindmap Digital\n`, mimeType: 'text/plain' },
    { path: 'outputs/client/email-envelope.json', bytes: JSON.stringify(envelope, null, 2), mimeType: 'application/json' },
  ];
  const files = [];
  for (const file of outputs) files.push({ ...await privateOutput(root, file.path, file.bytes), mimeType: file.mimeType, visibility: 'client', purpose: 'draft' });
  const report = { version: 1, status: 'draft', sent: false, humanApprovalRecorded: false, qcRequired: true,
    policy: { sourceId: policyFile.id, sha256: policyFile.sha256, ...policy }, countedWords: words, wordScope: 'Subject and authored body; fixed brand signature and recipient headers excluded',
    ...recipients, mapping, files,
    limitations: ['Exact quotes do not prove the paraphrase or claim is supported.', 'Courtesy classification is supplied by the author and must be independently checked.', 'Pattern checks are conservative and incomplete; D8, D4 and D6 still check every word.', 'No attachment is added or represented as approved; sending is a human action.'] };
  const receipt = await privateOutput(root, 'outputs/internal/email-build.json', JSON.stringify(report, null, 2));
  return { status: 'draft', files: [...files, { ...receipt, mimeType: 'application/json', visibility: 'internal', purpose: 'workpaper' }], sent: false, qcRequired: true };
}

export async function readEmailPlan(workspace: string, path: string) {
  return JSON.parse((await containedFile(await realpath(workspace), path, 1024 * 1024)).toString('utf8'));
}
