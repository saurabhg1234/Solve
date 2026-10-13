import { readFile,realpath,stat,writeFile,mkdir } from 'node:fs/promises';
import { join,sep } from 'node:path';
import { createHash } from 'node:crypto';
import { safeOutputPath,type StageResult } from '../lib/result';

const CHUNK=2*1024*1024,LIMIT=32*1024*1024;
type Session={id:string;leaseId:string};
type StoredFile={id:string;filename:string;mime_type:string;sha256:string;byte_size:number};
export async function portalRequest(path:string,credential:string,body?:unknown,extraHeaders:Record<string,string>={}) {
  const origin=new URL(process.env.ZORA_APP_URL||'');
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw new Error('Routine requires HTTPS');
  const secret=process.env[credential];if(!secret||secret.length<32)throw new Error(`${credential} is missing or too short`);
  const headers:Record<string,string>={Authorization:`Bearer ${secret}`,...extraHeaders};
  if(process.env.ZORA_NOTIFICATION_BYPASS){if(!/^[\x20-\x7e]+$/.test(process.env.ZORA_NOTIFICATION_BYPASS))throw new Error('ZORA_NOTIFICATION_BYPASS must be the actual ASCII automation token from Vercel');headers['x-vercel-protection-bypass']=process.env.ZORA_NOTIFICATION_BYPASS;}
  const binary=body instanceof Uint8Array;if(body!==undefined&&!binary)headers['Content-Type']='application/json';
  const response=await fetch(new URL(path,origin.origin),{method:binary?'PUT':body===undefined?'GET':'POST',headers,body:body===undefined?undefined:binary?new Uint8Array(body):JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Routine endpoint failed (${response.status}); check bindings, deployment protection, file limits and schema`);return response;
}
export async function keepLease(job:Session){await portalRequest(`/api/worker/${job.id}/heartbeat`,'ZORA_RUNNER_TOKEN',{leaseId:job.leaseId});}
export async function downloadFiles(job:Session,files:StoredFile[],dir:string,kind:'sources'|'artifacts'){
  await mkdir(join(dir,kind),{recursive:true,mode:0o700});const manifest=[];
  for(const file of files){
    if(!/^[0-9a-f-]{36}$/.test(file.id)||!Number.isSafeInteger(file.byte_size)||file.byte_size<1||file.byte_size>LIMIT)throw new Error('Invalid stored-file manifest');
    const chunks:Buffer[]=[];
    for(let offset=0;offset<file.byte_size;offset+=CHUNK){await keepLease(job);const end=Math.min(file.byte_size-1,offset+CHUNK-1);const response=await portalRequest(`/api/worker/${job.id}/${kind}/${file.id}?leaseId=${job.leaseId}`,'ZORA_RUNNER_TOKEN',undefined,{Range:`bytes=${offset}-${end}`});const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==end-offset+1)throw new Error('Incomplete source byte range');chunks.push(bytes);}
    const bytes=Buffer.concat(chunks);if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Stored-file hash does not match its manifest');
    const path=`${kind}/${file.id}.source`;await writeFile(join(dir,path),bytes,{mode:0o600});manifest.push({...file,path});
  }
  await writeFile(join(dir,`${kind}.json`),JSON.stringify(manifest,null,2),{mode:0o600});return manifest;
}
export async function persistOutputs(job:Session,result:StageResult,dir:string){
  for(const file of result.outputFiles){
    if(!safeOutputPath(file.path)||!file.path.startsWith(`outputs/${file.visibility}/`))throw new Error('Unsafe generated output path or visibility');
    const actual=await realpath(join(dir,file.path));if(!actual.startsWith(dir+sep)||!(await stat(actual)).isFile())throw new Error('Output escapes the private workspace');
    const bytes=await readFile(actual);if(!bytes.length||bytes.length>LIMIT)throw new Error('Each generated artifact must be nonempty and at most 32 MB');
    await keepLease(job);const upload=await(await portalRequest(`/api/worker/${job.id}/uploads`,'ZORA_RUNNER_TOKEN',{leaseId:job.leaseId,path:file.path,filename:file.path.split('/').at(-1),mimeType:file.mimeType,visibility:file.visibility,totalBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})).json();
    if(upload.alreadyStored)continue;
    for(let offset=0;offset<bytes.length;offset+=CHUNK){await keepLease(job);await portalRequest(`/api/worker/${job.id}/uploads/${upload.id}`,'ZORA_RUNNER_TOKEN',bytes.subarray(offset,offset+CHUNK),{'x-zora-lease':job.leaseId,'x-zora-offset':String(offset)});}
    await portalRequest(`/api/worker/${job.id}/uploads/${upload.id}`,'ZORA_RUNNER_TOKEN',{leaseId:job.leaseId});
  }
}
