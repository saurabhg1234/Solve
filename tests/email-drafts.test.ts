import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEmail, emailContext } from '../lib/native-email';
import { zoraRecipients } from '../lib/email';
import { emailPreview } from '../lib/email-preview';
import { inventory } from '../lib/review-manifest';

async function fixture(work: (f: any) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'zora-email-test-'));
  const sourceId = randomUUID(), policyId = randomUUID();
  const sourceText = 'Synthetic buyer asked for a requirements discussion.\nNo quotation or delivery commitment is approved.';
  const policy = { maxWords: 100, hypeWords: ['world-class', 'revolutionary'] };
  const source = { id: sourceId, filename: 'synthetic-brief.txt', mime_type: 'text/plain', path: 'brief.txt', sha256: createHash('sha256').update(sourceText).digest('hex') };
  const plan = { policySourceId: policyId, to: [' Buyer@Example.test '], cc: [], subject: { kind: 'courtesy', text: 'Requirements discussion', reason: 'Neutral subject heading; no factual proposition.' }, paragraphs: [[{ kind: 'courtesy', text: 'Hello,', reason: 'Greeting only.' }], [{ kind: 'claim', text: 'You asked for a requirements discussion.', citations: [{ sourceId, location: 'Line 1', quote: 'Synthetic buyer asked for a requirements discussion.' }] }], [{ kind: 'courtesy', text: 'Would a discussion be useful?', reason: 'Open question with no promised deliverable.' }]] };
  async function save() { const data = JSON.stringify(policy); await writeFile(join(root, 'policy.json'), data); await writeFile(join(root, 'sources.json'), JSON.stringify([source, { id: policyId, filename: 'synthetic-email-policy.json', mime_type: 'application/json', path: 'policy.json', sha256: createHash('sha256').update(data).digest('hex') }])); }
  await writeFile(join(root, 'brief.txt'), sourceText); await save();
  try { await work({ root, sourceId, policyId, source, sourceText, policy, plan, save }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('email source context and drafts bind exact bytes, preserve owner copy and separate internal rationale', () => fixture(async f => {
  await emailContext(f.root); const context = JSON.parse(await readFile(join(f.root, 'outputs/internal/email-context.json'), 'utf8'));
  assert.equal(context.sourceApprovalRecorded, false); assert.equal(context.sources[0].elements[0].text, f.sourceText.split('\n')[0]);
  const result = await buildEmail(f.root, f.plan); assert.equal(result.sent, false); assert.equal(result.files.length, 4);
  const report = JSON.parse(await readFile(join(f.root, 'outputs/internal/email-build.json'), 'utf8'));
  assert.equal(report.humanApprovalRecorded, false); assert.equal(report.mapping[2].citations[0].sourceSha256, f.source.sha256); assert.equal(report.mapping[2].citations[0].supportVerified, false);
  const envelope = JSON.parse(await readFile(join(f.root, 'outputs/client/email-envelope.json'), 'utf8'));
  assert.equal(envelope.ccRecipients[0].emailAddress.address, 'saurabh@mindmapdigital.ai'); assert.equal(envelope.toRecipients[0].emailAddress.address, 'buyer@example.test');
  for (const file of result.files) { const data = await readFile(join(f.root, file.path)); assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256); assert.equal((await stat(join(f.root, file.path))).mode & 0o777, 0o600);
    if (file.visibility === 'client') { assert.ok(!data.toString().includes('Synthetic buyer')); assert.ok(!data.toString().includes('Neutral subject heading')); const elements = await inventory({ id: randomUUID(), filename: file.path.split('/').at(-1)!, mime_type: file.mimeType, sha256: file.sha256, data, role: 'draft' }); assert.ok(elements.some(e => e.kind === 'word')); }
  }
  const html = await readFile(join(f.root, 'outputs/client/email.html'), 'utf8'); assert.ok(html.indexOf('height="6"') < html.indexOf('for Mindmap Digital'));
}));

test('owner is never duplicated and malformed recipient lists/headers are rejected', () => {
  const recipient = zoraRecipients(['Saurabh@mindmapdigital.ai'], ['saurabh@mindmapdigital.ai', 'other@example.test', 'OTHER@example.test']);
  assert.deepEqual(recipient.ccRecipients.map(r => r.emailAddress.address), ['other@example.test']);
  for (const address of ['a@example.test,b@example.test', 'a@example.test\r\nBcc: leaked@example.test', 'Name <a@example.test>', '.a@example.test', 'a..b@example.test', 'a@-example.test', 'a@exam\u0000ple.test']) assert.throws(() => zoraRecipients([address]));
});

test('missing or deferred email policy has no invented defaults and length/hype rules hold', () => fixture(async f => {
  for (const key of ['maxWords', 'hypeWords']) { const original = f.policy[key]; delete f.policy[key]; await f.save(); await assert.rejects(buildEmail(f.root, f.plan)); f.policy[key] = original; }
  f.policy.maxWords = 2; await f.save(); await assert.rejects(buildEmail(f.root, f.plan), /word limit/);
  f.policy.maxWords = 100; await f.save(); f.plan.subject.text = 'Our world—class discussion'; await assert.rejects(buildEmail(f.root, f.plan), /hype/);
  f.policy.hypeWords = []; await f.save(); await buildEmail(f.root, f.plan); // Explicit empty list is a decision; omission is not.
}));

test('changed hashes, fabricated quote locations and policy-as-fact references hold', () => fixture(async f => {
  const cite = f.plan.paragraphs[1][0].citations[0]; const saved = { ...cite };
  cite.location = 'Line 2'; await assert.rejects(buildEmail(f.root, f.plan), /exact location/);
  Object.assign(cite, saved); cite.quote = 'Invented approval'; await assert.rejects(buildEmail(f.root, f.plan), /exact location/);
  Object.assign(cite, saved); cite.sourceId = f.policyId; await assert.rejects(buildEmail(f.root, f.plan), /factual source/);
  Object.assign(cite, saved); await writeFile(join(f.root, 'brief.txt'), 'Changed bytes'); await assert.rejects(buildEmail(f.root, f.plan), /SHA-256/);
}));

test('all subject/body segments are classified and obvious prohibited promises are held', () => fixture(async f => {
  for (const text of ['Free demo', 'A complimentary proof-of-concept', 'A pilot at no charge', 'Our fee is 100', 'We will deliver within two weeks', 'Guaranteed results', 'The budget is AED 1000']) {
    f.plan.subject.text = text; await assert.rejects(buildEmail(f.root, f.plan), /wording|Commercial|commitment/);
  }
  f.plan.subject = { text: 'Unclassified content' }; await assert.rejects(buildEmail(f.root, f.plan));
}));

test('markup is escaped, headers cannot be injected and unknown send/attachment fields are rejected', () => fixture(async f => {
  f.plan.paragraphs[0][0].text = '<img src="https://example.test/track"> & <script>alert(1)</script>';
  await buildEmail(f.root, f.plan); const html = await readFile(join(f.root, 'outputs/client/email.html'), 'utf8');
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
  f.plan.subject.text = 'Hello\nBcc: leak@example.test'; await assert.rejects(buildEmail(f.root, f.plan));
  f.plan.subject.text = 'Discussion'; await assert.rejects(buildEmail(f.root, { ...f.plan, send: true })); await assert.rejects(buildEmail(f.root, { ...f.plan, attachments: ['internal-estimate.xlsx'] }));
}));

test('input and output symlinks cannot escape the private workspace', () => fixture(async f => {
  const outside = await mkdtemp(join(tmpdir(), 'zora-email-outside-'));
  try {
    await mkdir(join(f.root, 'outputs')); await symlink(outside, join(f.root, 'outputs/client'));
    await assert.rejects(buildEmail(f.root, f.plan), /directory/); await rm(join(f.root, 'outputs/client'));
    await writeFile(join(outside, 'brief.txt'), f.sourceText); await rm(join(f.root, 'brief.txt')); await symlink(join(outside, 'brief.txt'), join(f.root, 'brief.txt'));
    await assert.rejects(buildEmail(f.root, f.plan), /escapes/);
  } finally { await rm(outside, { recursive: true, force: true }); }
}));

test('email preview separates recipient headers and leaves arbitrary body markup inert', () => {
  const parsed = emailPreview('To: a@example.test\nCc: saurabh@mindmapdigital.ai\nSubject: <script>subject</script>\n\n<img src="https://example.test">');
  assert.equal(parsed?.cc, 'saurabh@mindmapdigital.ai'); assert.equal(parsed?.body, '<img src="https://example.test">');
  assert.equal(emailPreview('A normal file without email headers'), null); assert.equal(emailPreview('To: a@example.test\nBcc: b@example.test\nSubject: hidden\n\nBody'), null);
});

test('private source passages cannot become client email citations',()=>fixture(async f=>{
  f.source.visibility='internal';await f.save();await assert.rejects(buildEmail(f.root,f.plan),/private source/);
  f.plan.paragraphs[1]=[{kind:'courtesy',text:f.sourceText.split('\n')[0],reason:'False courtesy classification in a deliberate negative fixture.'}];await assert.rejects(buildEmail(f.root,f.plan),/copied private/);
}));
