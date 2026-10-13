import { spawn } from 'node:child_process';
import { mkdir,readFile,writeFile,realpath,stat } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { resultSchema,safeOutputPath } from '../lib/result';

const base=process.env.ZORA_APP_URL;const secret=process.env.ZORA_RUNNER_TOKEN;
if(!base||!secret||secret.length<32)throw new Error('Configure ZORA_APP_URL and a strong ZORA_RUNNER_TOKEN');
const url=new URL(base);if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('Worker connections must use HTTPS');
const root=resolve(process.env.ZORA_WORK_ROOT||'.zora/sessions');const repo=resolve(process.env.ZORA_REPO_ROOT||'.');
const workerId=process.env.ZORA_WORKER_ID||`zora-${randomUUID()}`;
async function post(path:string,body:unknown){const r=await fetch(new URL(path,url),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Zora endpoint failed (${r.status})`);return r.json();}
async function session(job:any){
  if(!/^[0-9a-f-]{36}$/.test(job.id))throw new Error('Invalid job identity');
  const dir=join(root,job.id,randomUUID());await mkdir(join(dir,'outputs/client'),{recursive:true});await mkdir(join(dir,'outputs/internal'),{recursive:true});
  await writeFile(join(dir,'request.json'),JSON.stringify(job,null,2));
  const resultPath=join(dir,'result.json');const schemaPath=join(dir,'result.schema.json');
  await writeFile(schemaPath,JSON.stringify(z.toJSONSchema(resultSchema)));
  // Block file-based claims until persistence/import and full QC enforcement are complete.
  const prompt=[job.instructions,`Read request.json. The BRD and templates are in ${repo}. Work only inside this session directory.`,
    'This is a foundation-stage runner. Do not claim that files have been delivered to the portal: artifact import is pending. Keep generated files here and return their paths.',
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
    if(result.outputFiles.length>0&&result.status==='completed'){result.status='blocked';result.missingInputs.push('Generated files remain in the runner workspace. Verified artifact import is required.');}
    await post(`/api/worker/${job.id}/complete`,{leaseId:job.leaseId,result});
  } finally {clearInterval(heartbeat);}
}
console.log('Zora runner is starting. Codex must already be signed in on this machine.');
if(process.env.CRON_SECRET){setInterval(()=>{void fetch(new URL('/api/microsoft/maintenance',url),{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(65000)}).then(r=>{if(!r.ok)console.error(`Mailbox maintenance failed (${r.status}).`);}).catch(()=>console.error('Mailbox maintenance could not reach the portal.'));},60000);}
async function run(){for(;;){try{const {job}=await post('/api/worker/claim',{workerId});if(job)await session(job);}catch(error){console.error(error instanceof Error?error.message:'Runner operation failed');}await new Promise(r=>setTimeout(r,10000));}}
run().catch(()=>{console.error('Zora runner stopped unexpectedly.');process.exitCode=1;});
