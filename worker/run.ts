import { spawn } from 'node:child_process';
import { mkdir,readFile,writeFile,realpath,stat } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { resultSchema,safeOutputPath } from '../lib/result';
import { portalRequest,downloadFiles,persistOutputs } from './transport';

const base=process.env.ZORA_APP_URL;const secret=process.env.ZORA_RUNNER_TOKEN;
if(!base||!secret||secret.length<32)throw new Error('Configure ZORA_APP_URL and a strong ZORA_RUNNER_TOKEN');
const url=new URL(base);if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('Worker connections must use HTTPS');
const root=resolve(process.env.ZORA_WORK_ROOT||'.zora/sessions');const repo=resolve(process.env.ZORA_REPO_ROOT||'.');
const workerId=process.env.ZORA_WORKER_ID||`zora-${randomUUID()}`;
async function post(path:string,body:unknown){return (await portalRequest(path,'ZORA_RUNNER_TOKEN',body)).json();}
async function session(job:any){
  if(!/^[0-9a-f-]{36}$/.test(job.id))throw new Error('Invalid job identity');
  const dir=join(root,job.id,randomUUID());await mkdir(join(dir,'outputs/client'),{recursive:true});await mkdir(join(dir,'outputs/internal'),{recursive:true});
  await writeFile(join(dir,'request.json'),JSON.stringify(job,null,2));
  await downloadFiles(job,job.sources,dir,'sources');await downloadFiles(job,job.artifacts||[],dir,'artifacts');
  const resultPath=join(dir,'result.json');const schemaPath=join(dir,'result.schema.json');
  await writeFile(schemaPath,JSON.stringify(z.toJSONSchema(resultSchema)));
  const prompt=[job.instructions,`Read request.json. The BRD and templates are in ${repo}. Work only inside this session directory.`,
    'Read sources.json and artifacts.json and the actual local files. Return generated output paths; the parent transport will persist and verify them. Do not claim human approval or release.',
    'Return JSON with status (completed or blocked), summary, missingInputs, outputFiles (path,visibility,mimeType), citations (source,location,quote), reviewReports (checker,runId,checkedElementIds,findings).',
    job.requiresIndependentReview?'This stage requires multiple independent reviewer sessions and verified element coverage. Return blocked until that importer/orchestrator is implemented; never mark QC as passed.':'Complete only this stage; never advance a human gate.'
  ].join('\n\n');
  let leaseLost=false;
  const heartbeat=setInterval(()=>void post(`/api/worker/${job.id}/heartbeat`,{leaseId:job.leaseId}).catch(()=>{leaseLost=true;child?.kill('SIGTERM');}),60000);
  let child:ReturnType<typeof spawn>|undefined;
  try {
    // Spawn directly: no shell interpolation, no API key, no copied OAuth/session credential.
    const exit=await new Promise<number>((done,reject)=>{
      const childEnv:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV??'production',...Object.fromEntries(Object.entries(process.env).filter(([name])=>['PATH','HOME','CODEX_HOME','LANG','LC_ALL','TERM','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','REQUESTS_CA_BUNDLE'].includes(name)))};
      const running=spawn('codex',['exec','--sandbox','workspace-write','--cd',dir,'--skip-git-repo-check','--output-schema',schemaPath,'--output-last-message',resultPath,prompt],{stdio:['ignore','inherit','inherit'],env:childEnv});
      child=running;running.on('error',reject);running.on('exit',code=>done(code??1));
    });
    if(leaseLost)throw new Error('Session lease lost');if(exit!==0)throw new Error(`Codex exited with status ${exit}`);
    const result=resultSchema.parse(JSON.parse(await readFile(resultPath,'utf8')));
    for(const file of result.outputFiles){if(!safeOutputPath(file.path))throw new Error('Unsafe output path');const actual=await realpath(join(dir,file.path));if(!actual.startsWith(dir+sep)||!(await stat(actual)).isFile())throw new Error('Output escapes the session workspace');}
    await persistOutputs(job,result,dir);
    await post(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,result});
  } finally {clearInterval(heartbeat);}
}
console.log('Zora runner is starting. Codex must already be signed in on this machine.');
if(process.env.CRON_SECRET){setInterval(()=>{void portalRequest('/api/microsoft/maintenance','CRON_SECRET',{}).catch(()=>console.error('Mailbox maintenance could not reach the portal.'));},60000);}
async function run(){for(;;){try{const {job}=await post('/api/worker/claim',{workerId});if(job)await session(job);}catch(error){console.error(error instanceof Error?error.message:'Runner operation failed');}await new Promise(r=>setTimeout(r,10000));}}
run().catch(()=>{console.error('Zora runner stopped unexpectedly.');process.exitCode=1;});
