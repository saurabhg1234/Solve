/** A bounded bridge for a native cloud Codex session. Never launches another model or daemon. */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile,access } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { resultSchema, safeOutputPath } from '../lib/result';
import { portalRequest,downloadFiles,persistOutputs } from '../worker/transport';
import { contextSchema,reviewResultSchema } from '../lib/review-plan';
import { spawn,type ChildProcess } from 'node:child_process';

const stageJobSchema = z.object({
  kind:z.literal('stage').default('stage'),contextId:contextSchema.nullable().optional(),
  id: z.uuid(), leaseId: z.uuid(),
  case: z.object({ id: z.uuid(), title: z.string(), workflow: z.string() }).passthrough(),
  stage: z.object({ id: z.string(), title: z.string() }).passthrough(),
  instructions: z.string(), requiresIndependentReview: z.boolean(),
  sources: z.array(z.object({ id: z.uuid(), filename: z.string(), mime_type: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),byte_size:z.number().int().positive() })),
  artifacts: z.array(z.object({id:z.uuid(),filename:z.string(),mime_type:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),byte_size:z.number().int().positive(),visibility:z.string(),purpose:z.string().optional(),source_path:z.string()})).default([]),
}).passthrough();
const fileSchema=z.object({id:z.uuid(),filename:z.string(),mime_type:z.string(),sha256:z.string(),byte_size:z.number().int().positive(),kind:z.enum(['sources','artifacts']),role:z.enum(['source','reference','draft'])}).passthrough();
const reviewJobSchema=z.object({kind:z.literal('review'),id:z.uuid(),leaseId:z.uuid(),contextId:contextSchema,runId:z.uuid(),checker:z.string(),method:z.string(),packetHash:z.string(),elementCount:z.number().int().positive(),instructions:z.string(),packet:z.object({files:z.array(fileSchema)}).passthrough()}).passthrough();
const jobSchema=z.union([reviewJobSchema,stageJobSchema]);
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
  origin();return portalRequest(path,credential,body);
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
  if(job.contextId!==process.env.CODEX_THREAD_ID)throw new Error('Use the same claimed native task for heartbeat/completion; a fresh reviewer must claim its own packet');
  return { dir, job };
}
async function heartbeat(job: Job) {
  await request(`/api/${job.kind==='review'?'reviews':'worker'}/${job.id}/heartbeat`, 'ZORA_RUNNER_TOKEN', { leaseId: job.leaseId });
}
async function claim() {
  const contextId=contextSchema.parse(process.env.CODEX_THREAD_ID);
  const marker=join(root,'contexts',`${contextId}.json`);
  let claimed=false;try{await access(marker);claimed=true;}catch{}
  if(claimed)throw new Error('This native task already claimed a stage or review; finish it and start a fresh standalone task for the next claim');
  await maintenance();
  const body = await (await request('/api/worker/claim', 'ZORA_RUNNER_TOKEN', { workerId: process.env.ZORA_WORKER_ID || `zora-cloud-${randomUUID()}`,contextId })).json();
  if (!body.job) { console.log(JSON.stringify({ job: null, message: 'No executable stage is queued. Inbox workflow confirmation and human gates remain portal actions.' })); return; }
  const job = jobSchema.parse(body.job);
  await mkdir(join(root,'contexts'),{recursive:true,mode:0o700});await writeFile(marker,JSON.stringify({jobId:job.id,kind:job.kind}),{mode:0o600,flag:'wx'});
  const dir = join(root, job.id, randomUUID());
  await mkdir(join(dir, 'sources'), { recursive: true, mode: 0o700 });
  await mkdir(join(dir, 'outputs/client'), { recursive: true, mode: 0o700 });
  await mkdir(join(dir, 'outputs/internal'), { recursive: true, mode: 0o700 });
  await writeFile(join(dir, 'request.json'), JSON.stringify(job, null, 2), { mode: 0o600 });
  await writeFile(join(dir, 'instructions.txt'), job.instructions, { mode: 0o600 });
  const sources=job.kind==='review'?job.packet.files.filter(f=>f.kind==='sources'):job.sources;
  const artifacts=job.kind==='review'?job.packet.files.filter(f=>f.kind==='artifacts'):job.artifacts;
  const manifest=await downloadFiles(job,sources,dir,'sources');
  await downloadFiles(job,artifacts,dir,'artifacts');
  if(job.kind==='review'){
    const elements=[];let offset:number|null=0;
    while(offset!==null){await heartbeat(job);const page=await(await request(`/api/reviews/${job.id}/inventory?leaseId=${job.leaseId}&offset=${offset}`,'ZORA_RUNNER_TOKEN')).json();if(page.packetHash!==job.packetHash)throw new Error('Review packet hash changed');elements.push(...page.elements);offset=page.nextOffset;}
    if(elements.length!==job.elementCount)throw new Error('Review element inventory was incomplete');await writeFile(join(dir,'inventory.json'),JSON.stringify(elements,null,2),{mode:0o600});
  }
  await writeFile(join(dir, 'result.schema.json'), JSON.stringify(z.toJSONSchema(job.kind==='review'?reviewResultSchema:resultSchema), null, 2), { mode: 0o600 });
  await heartbeat(job);
  console.log(JSON.stringify({ workspace: dir,kind:job.kind,sources:manifest.length,next:job.kind==='review'?'Read only this isolated packet and inventory.json. Check every element in this fresh native session; complete with the review schema. Do not read other session directories or earlier reports.':'Read instructions.txt, request.json, sources.json and artifacts.json. Work on this stage, label drafts/references separately from workpapers, then save result.json and routine complete. QC stages enqueue fresh independent reviewers; they do not approve themselves.' }));
}
async function complete(path: string) {
  const { dir, job } = await workspace(path);
  if(job.kind==='review'){
    const result=reviewResultSchema.parse(JSON.parse(await readFile(join(dir,'result.json'),'utf8')));
    const outcome=await(await request(`/api/reviews/${job.id}/complete`,'ZORA_RUNNER_TOKEN',{leaseId:job.leaseId,contextId:job.contextId,result})).json();console.log(JSON.stringify({recorded:true,kind:'review',...outcome}));return;
  }
  const result = resultSchema.parse(JSON.parse(await readFile(join(dir, 'result.json'), 'utf8')));
  for (const file of result.outputFiles) {
    if (!safeOutputPath(file.path)) throw new Error('Unsafe generated output path');
    const actual = await realpath(join(dir, file.path));
    if (!actual.startsWith(dir + sep) || !(await stat(actual)).isFile()) throw new Error('Output escapes the private workspace');
  }
  await persistOutputs(job,result,dir);
  const outcome=await(await request(`/api/worker/${job.id}/complete`, 'ZORA_RUNNER_TOKEN', { leaseId: job.leaseId,contextId:job.contextId, result })).json();
  console.log(JSON.stringify({ recorded: true, resultStatus:outcome.resultStatus,artifactCount:outcome.artifactCount,note:'Files are stored for review. Independent QC and human gates still apply; this response does not claim release.' }));
}
async function documentTool(path:string,action:'prepare'|'build'|'build-rfi',plan?:string){
  const {dir,job}=await workspace(path);
  if(action!=='prepare'&&job.kind==='review')throw new Error('An independent reviewer cannot create or replace the draft');
  const script=resolve('scripts',action==='prepare'?'prepare_sources.py':action==='build-rfi'?'build_rfi.py':'build_documents.py');
  const python=process.env.ZORA_DOCUMENT_PYTHON||'/workspace/solve-environment/.venv/bin/python';
  let arguments_:string[]=[script,dir];
  if(action!=='prepare'){
    if(!plan)throw new Error('Supply the inspected approved-template plan');
    const actual=await realpath(resolve(dir,plan));if(!actual.startsWith(dir+sep))throw new Error('Build plan must stay in the private workspace');arguments_=action==='build-rfi'?[script,dir,actual]:[script,'build',dir,actual];
  }
  await heartbeat(job);let failed=false;let child:ChildProcess|undefined;
  const timer=setInterval(()=>{void heartbeat(job).catch(()=>{failed=true;child?.kill('SIGTERM');});},60000);
  try{
    const environment:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV||'development',...Object.fromEntries(Object.entries(process.env).filter(([name])=>['PATH','HOME','LANG','LC_ALL','FONTCONFIG_PATH','FONTCONFIG_FILE','TESSDATA_PREFIX'].includes(name)))};
    const code=await new Promise<number>((done,reject)=>{const running=spawn(python,arguments_,{stdio:['ignore','inherit','inherit'],env:environment});child=running;running.once('error',reject);running.once('exit',code=>done(code??1));});
    if(code!==0||failed)throw new Error('Native document preparation/build failed or its lease was lost');await heartbeat(job);
  }finally{clearInterval(timer);}
}
async function main() {
  const [action = 'check', path,plan] = process.argv.slice(2);
  if (action === 'check') return maintenance();
  if (action === 'claim') return claim();
  if (!path) throw new Error('Supply the private routine workspace path');
  if (action === 'heartbeat') { await heartbeat((await workspace(path)).job); console.log('Lease renewed.'); return; }
  if (action === 'complete') return complete(path);
  if (action === 'prepare'||action==='build'||action==='build-rfi') return documentTool(path,action,plan);
  throw new Error('Use check, claim, heartbeat, prepare, build, build-rfi or complete');
}
main().catch(error => { console.error(error instanceof Error && (error.message.startsWith('Routine endpoint failed')||error.message.startsWith('ZORA_NOTIFICATION_BYPASS')) ? error.message : `Cloud routine failed (${error instanceof Error ? error.name : 'unknown'}); no credential or source values are logged.`); process.exitCode = 1; });
