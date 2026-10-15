/** Local synthetic W8 stages and stored drafts; no send, QC verdict or human approval. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import { downloadFiles } from '../worker/transport';
import { inventory } from '../lib/review-manifest';
async function main() {
  const local = JSON.parse(await readFile(process.env.ZORA_LOCAL_TEST_CONFIG||'/workspace/solve-environment/zora-local-test.json', 'utf8'));
  if (process.env.ZORA_LOCAL_TEST_ORIGIN) local.ZORA_APP_URL = process.env.ZORA_LOCAL_TEST_ORIGIN;
  const origin = new URL(local.ZORA_APP_URL); assert.equal(origin.hostname, '127.0.0.1'); assert.equal(new URL(local.DATABASE_URL).hostname, '127.0.0.1');
  const db = new Pool({ connectionString: local.DATABASE_URL }); const cookies: Record<string, string> = {};
  for (const email of ['tester@mindmapdigital.ai', 'outsider@mindmapdigital.ai']) cookies[email] = await new SignJWT({ name: 'Synthetic W8 tester' }).setProtectedHeader({ alg: 'HS256' }).setSubject(email).setIssuer('zora').setAudience('zora-portal').setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(local.ZORA_SESSION_SECRET));
  const root = resolve('.zora/local-email-' + randomUUID()); let caseId: string | undefined;const scanned=process.env.ZORA_LOCAL_SCANNED_EMAIL==='1';
  async function call(path: string, body?: unknown, worker = false, email = 'tester@mindmapdigital.ai') {
    const response = await fetch(new URL(path, origin), { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin.origin, 'Content-Type': 'application/json', ...(worker ? { Authorization: `Bearer ${local.ZORA_RUNNER_TOKEN}` } : { Cookie: `zora_session=${cookies[email]}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  function native(action: string, dir: string, context: string, plan?: string) { return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/cloud_routine.ts', action, dir, ...(plan ? [plan] : [])], { env: { ...process.env, ...local, ZORA_WORK_ROOT: root, CODEX_THREAD_ID: context, ZORA_NOTIFICATION_BYPASS: '', VERCEL_TOKEN: '' }, encoding: 'utf8', timeout: 90000 }); }
  async function claim(stage: string) {
    const context = 'synthetic-email-' + randomUUID(); const job = (await call('/api/worker/claim', { workerId: 'local-email-fixture', contextId: context }, true)).body.job;
    assert.equal(job.case.id, caseId); assert.equal(job.stage.id, stage); const dir = join(root, job.id); await mkdir(dir, { recursive: true, mode: 0o700 }); await writeFile(join(dir, 'request.json'), JSON.stringify(job), { mode: 0o600 });
    Object.assign(process.env, local); process.env.ZORA_NOTIFICATION_BYPASS = ''; process.env.VERCEL_TOKEN = ''; await downloadFiles(job, job.sources, dir, 'sources'); await downloadFiles(job, job.artifacts, dir, 'artifacts'); return { context, job, dir };
  }
  const result = (files: unknown[]) => ({ status: 'completed', summary: 'Synthetic W8 format and transport fixture only. No real facts accepted, sending, semantic QC or human approval.', missingInputs: [], outputFiles: files, citations: [], reviewReports: [] });
  try {
    const c = (await call('/api/cases', { title: 'LOCAL EMAIL VERIFICATION — no send', client: 'Synthetic fixture only', workflow: 'W8', briefing: 'Verify source-bound email drafts, recipient visibility, private metadata and the native queue. This synthetic test never sends email or grants approval.' })).body.case; caseId = c.id;
    const sourceId = randomUUID(), policyId = randomUUID();
    for (const [id, filename, mime, content] of [[sourceId, 'synthetic-brief.txt', 'text/plain', 'Synthetic buyer requested a requirements discussion.'], [policyId, 'synthetic-email-policy.json', 'application/json', JSON.stringify({ maxWords: 100, hypeWords: ['revolutionary'] })]]) {
      let bytes = Buffer.from(content),storedName=filename,storedMime=mime;
      if(scanned&&id===sourceId){
        await mkdir(root,{recursive:true,mode:0o700});const target=join(root,'synthetic-scan.pdf');
        const made=spawnSync('/workspace/solve-environment/.venv/bin/python',['-c',`import fitz,sys
p=fitz.open();page=p.new_page(width=600,height=200);page.insert_text((20,40),'Synthetic buyer requested a requirements discussion.')
out=fitz.open();scan=out.new_page(width=600,height=200);scan.insert_image(scan.rect,stream=page.get_pixmap(matrix=fitz.Matrix(2,2)).tobytes('png'));out.save(sys.argv[1])`,target],{encoding:'utf8'});assert.equal(made.status,0);bytes=await readFile(target);storedName='synthetic-scan.pdf';storedMime='application/pdf';
      }
      await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,$3,$4,$5,$6)', [id, caseId, storedName, storedMime, bytes, createHash('sha256').update(bytes).digest('hex')]);
    }
    const contextStage = await claim('W8-1');let transcriptFiles:any[]=[];
    if(scanned){
      assert.notEqual(native('email-context',contextStage.dir,contextStage.context).status,0,'Image-only source holds without a page-linked transcript');
      const source=contextStage.job.sources.find((f:any)=>f.id===sourceId),transcript={version:1,status:'unverified',sourceId,sourceSha256:source.sha256,pages:[{page:1,blocks:[{kind:'paragraph',text:'Synthetic buyer requested a requirements discussion.'}]}]};
      await writeFile(join(contextStage.dir,'transcript-plan.json'),JSON.stringify(transcript));const packaged=native('build-transcript',contextStage.dir,contextStage.context,'transcript-plan.json');assert.equal(packaged.status,0);transcriptFiles=JSON.parse(packaged.stdout.trim()).outputFiles;
    }
    const preparedContext=native('email-context', contextStage.dir, contextStage.context);assert.equal(preparedContext.status, 0);
    assert.deepEqual(JSON.parse(preparedContext.stdout.trim()).additionalSourceFiles.map((f:any)=>f.path),transcriptFiles.map(f=>f.path));
    assert.notEqual(native('build-email', contextStage.dir, contextStage.context, 'missing-plan.json').status, 0, 'W8-1 cannot run the W8-2 renderer');
    await writeFile(join(contextStage.dir, 'result.json'), JSON.stringify(result([...transcriptFiles,{ path: 'outputs/internal/email-context.json', visibility: 'internal', mimeType: 'application/json', purpose: 'workpaper' }]))); assert.equal(native('complete', contextStage.dir, contextStage.context).status, 0);
    const draft = await claim('W8-2'); const { job, dir, context } = draft;
    const plan = { policySourceId: policyId, to: ['buyer@example.test'], cc: [], subject: { kind: 'courtesy', text: 'Requirements discussion', reason: 'Neutral topic heading.' }, paragraphs: [[{ kind: 'claim', text: 'You requested a requirements discussion.', citations: [{ sourceId, location: scanned?'PDF page 1, unverified transcript paragraph 1':'Line 1', quote: 'Synthetic buyer requested a requirements discussion.' }] }], [{ kind: 'courtesy', text: 'Would a discussion be useful?', reason: 'Open question, with no commitment.' }]] };
    await writeFile(join(dir, 'email-plan.json'), JSON.stringify(plan), { mode: 0o600 });
    assert.notEqual(native('build-email', dir, 'wrong-synthetic-context', 'email-plan.json').status, 0);
    await writeFile(join(root, 'outside.json'), JSON.stringify(plan)); assert.notEqual(native('build-email', dir, context, '../outside.json').status, 0);
    await db.query("UPDATE zora_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [job.id]); assert.notEqual(native('build-email', dir, context, 'email-plan.json').status, 0, 'An expired lease cannot build drafts'); await db.query("UPDATE zora_jobs SET lease_expires_at=now()+interval '5 minutes' WHERE id=$1", [job.id]);
    const built = native('build-email', dir, context, 'email-plan.json'); assert.equal(built.status, 0, 'Leased email build must work with filtered local environment'); const builtFiles = JSON.parse(built.stdout.trim()).files;
    const envelope = JSON.parse(await readFile(join(dir, 'outputs/client/email-envelope.json'), 'utf8')); assert.equal(envelope.sent, false); assert.equal(envelope.ccRecipients[0].emailAddress.address, 'saurabh@mindmapdigital.ai');
    await writeFile(join(dir, 'result.json'), JSON.stringify(result(builtFiles))); assert.equal(native('complete', dir, context).status, 0);
    const artifacts = (await db.query('SELECT * FROM zora_artifacts WHERE job_id=$1', [job.id])).rows; assert.equal(artifacts.length, 4);
    for (const file of artifacts) { assert.deepEqual(file.data, await readFile(join(dir, file.source_path))); if (file.visibility === 'client') assert.ok((await inventory({ ...file, role: 'draft' })).some(e => e.kind === 'word')); }
    const detail = (await call(`/api/cases/${caseId}`)).body; assert.equal(detail.artifacts.length, scanned?4:3, 'Consultants see client drafts, not internal mapping/rationale');
    const internal = artifacts.find(f => f.visibility === 'internal'); const endpoint = `/api/cases/${caseId}/files/artifacts/${internal.id}`;
    assert.equal((await fetch(new URL(endpoint, origin), { headers: { Cookie: `zora_session=${cookies['tester@mindmapdigital.ai']}` } })).status, 403);
    assert.equal((await call(`/api/cases/${caseId}`, undefined, false, 'outsider@mindmapdigital.ai')).status, 403);
    const qc = await claim('W8-3'); await writeFile(join(qc.dir, 'result.json'), JSON.stringify(result([]))); assert.equal(native('complete', qc.dir, qc.context).status, 0);
    const queued = (await call(`/api/cases/${caseId}`)).body; assert.equal(queued.case.status, 'queued', 'Independent reviewer tasks must run before the gate');
    const passes=scanned?5:4;
    for (let i = 0; i < passes; i++) {
      const contextId = 'synthetic-email-review-' + randomUUID(); const review = (await call('/api/worker/claim', { workerId: 'local-email-review-fixture', contextId }, true)).body.job;
      assert.equal(review.kind, 'review'); assert.ok(['D8','D4','D6','EMAIL_PATTERNS',...(scanned?['SOURCE_TRANSCRIPT']:[])].includes(review.checker));if(scanned){assert.equal(review.checker==='SOURCE_TRANSCRIPT',i===0);const build=JSON.parse(await readFile(join(dir,'outputs/internal/email-build.json'),'utf8'));const link=build.mapping[1].citations[0].sourceTranscript;assert.equal(link.artifactId,review.packet.sourceTranscripts[0].transcriptId);assert.equal(link.sha256,review.packet.sourceTranscripts[0].transcriptSha256);} assert.ok(!review.packet.files.some((file: any) => ['email-build.json','email-context.json'].includes(file.filename)), 'Drafter rationale cannot enter review');
      const ids: string[] = []; let offset: number | null = 0;
      while (offset !== null) { const response: Response = await fetch(new URL(`/api/reviews/${review.id}/inventory?leaseId=${review.leaseId}&offset=${offset}`, origin), { headers: { Authorization: `Bearer ${local.ZORA_RUNNER_TOKEN}` } }); assert.equal(response.status, 200); const page = await response.json(); ids.push(...page.elements.map((e: any) => e.id)); offset = page.nextOffset; }
      assert.equal(ids.length, review.elementCount);
      const recorded = await call(`/api/reviews/${review.id}/complete`, { leaseId: review.leaseId, contextId, result: { packetHash: review.packetHash, checkedElementIds: ids, summary: 'Synthetic protocol fixture only, not an actual semantic email review.', findings: [], missingInputs: [] } }, true); assert.equal(recorded.status, 200);
      if (i === passes-1) assert.equal(recorded.body.policyRequired, true);
    }
    const held = (await call(`/api/cases/${caseId}`)).body; assert.equal(held.case.status, 'blocked', 'Missing QC settings hold progression after protocol coverage');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM zora_approvals WHERE case_id=$1', [caseId])).rows[0].n, 0);
    if (process.env.ZORA_LOCAL_BROWSER === '1') {
      assert.equal(origin.origin, 'https://127.0.0.1:3002');
      const playwrightPath = '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'; const { chromium } = await import(playwrightPath);
      const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] }); const errors: string[] = [];
      try {
        for (const width of [1440, 390]) {
          const browserContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 } });
          await browserContext.addCookies([{ name: 'zora_session', value: cookies['tester@mindmapdigital.ai'], url: origin.origin }]); const page = await browserContext.newPage(); page.on('pageerror', (error: Error) => errors.push(error.message));
          await page.goto(origin.origin); await page.getByRole('button', { name: /LOCAL EMAIL VERIFICATION/ }).click();
          await page.locator('.file-row').filter({ has: page.getByText('email.txt', { exact: true }) }).getByRole('button', { name: 'Read', exact: true }).click();
          const preview = page.getByRole('article', { name: 'Email draft preview' }); await preview.waitFor(); assert.ok((await preview.innerText()).includes('saurabh@mindmapdigital.ai'));
          assert.equal(await preview.locator('img,script,iframe').count(), 0); assert.equal(await page.getByText('email-build.json', { exact: true }).count(), 0);
          assert.ok(await page.locator('body').evaluate((el: HTMLElement) => el.scrollWidth <= window.innerWidth));
          if (width === 1440) await preview.screenshot({ path: '/workspace/solve-environment/zora-email-draft-preview.png' });
          await browserContext.close();
        }
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    }

    if(scanned)console.log('Scanned W8 path passed: W8-1 native page packaging/context, stored transcript reuse in W8-2, exact citation-to-QC transcript hashes, transcription-first W8-3 and deferred-policy hold.');
    console.log('Native W8 checks passed: real context/drafter stage leases, context/stage/path/expiry holds, four byte-exact persisted email files, owner Cc, client/internal permissions, real draft QC inventory and missing-policy hold. No send or human approval.');
  } finally { if (caseId) { for (const table of ['zora_review_contexts','zora_reviews','zora_qc_runs','zora_uploads','zora_case_members','zora_approvals','zora_artifacts','zora_sources','zora_events','zora_jobs']) await db.query(`DELETE FROM ${table} WHERE case_id=$1`, [caseId]); await db.query('DELETE FROM zora_cases WHERE id=$1', [caseId]); } await db.end(); await rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Local W8 fixture failed'); process.exitCode = 1; });
