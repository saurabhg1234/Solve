import { resetDigest } from './trust-reset-contract';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { HttpError,type Actor } from './auth';
import { accessCase,event } from './cases';
import { transaction } from './db';
import { cleanFilename,FILE_CHUNK,FILE_LIMIT,hashBytes,canReadInternal } from './files';
import { safeOutputPath } from './result';
import { parseSourceTranscript,matchTranscript,TRANSCRIPT_LIMIT } from './source-transcript';

export const uploadSchema=z.object({filename:z.string().min(1).max(250),mimeType:z.string().regex(/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9= .+-]+)?$/).max(150),totalBytes:z.number().int().positive().max(FILE_LIMIT),sha256:z.string().regex(/^[a-f0-9]{64}$/),visibility:z.enum(['client','internal']).default('internal'),purpose:z.enum(['draft','reference','workpaper','rfi_review','source_transcript']).optional(),path:z.string().max(250).optional(),leaseId:z.uuid().optional(),version:z.number().int().positive().optional()});
export const sourceUploadSchema=uploadSchema.extend({visibility:z.enum(['client','internal']).default('client')});
type UploadInput=z.infer<typeof uploadSchema>;
export async function leasedJob(db:PoolClient,id:string,leaseId:string) {
  if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(leaseId).success)throw new HttpError(400,'Invalid session identity');
  const ref=(await db.query('SELECT case_id FROM zora_jobs WHERE id=$1',[id])).rows[0];if(!ref)throw new HttpError(409,'Session lease is no longer valid');
  await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[ref.case_id]);
  const row=(await db.query("SELECT j.*,c.source_revision FROM zora_jobs j JOIN zora_cases c ON c.id=j.case_id WHERE j.id=$1 AND j.lease_id=$2 AND j.state='leased' AND j.lease_expires_at>now() AND j.case_version=c.version AND j.source_revision=c.source_revision FOR UPDATE OF j",[id,leaseId])).rows[0];
  if(!row)throw new HttpError(409,'Session lease is no longer valid');if(row.reset_packet&&resetDigest(row.reset_packet)!==row.reset_packet_hash)throw new HttpError(409,'Trust-reset packet integrity changed');return row;
}
function sourceEditor(user:Actor,visibility:string){
  if(visibility==='internal'){if(!canReadInternal(user))throw new HttpError(403,'Private source uploads require a pricing or internal review role');}
  else if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Team source changes require a consultant or bid owner');
}
export async function beginSourceUpload(caseId:string,input:UploadInput,user:Actor){
  return transaction(async db=>{
    sourceEditor(user,input.visibility);await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[caseId]);const c=await accessCase(caseId,user,db);
    if(!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Pause or start a revision before changing sources');
    if(input.version!==c.version)throw new HttpError(409,'The pursuit changed; refresh before uploading');
    const id=randomUUID();await db.query('INSERT INTO zora_uploads(id,case_id,kind,owner,filename,mime_type,total_bytes,sha256,case_version,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,caseId,'source',user.email,cleanFilename(input.filename),input.mimeType,input.totalBytes,input.sha256,c.version,input.visibility]);
    return {id,chunkSize:FILE_CHUNK,nextOffset:0};
  });
}
export async function beginArtifactUpload(jobId:string,input:UploadInput){
  return transaction(async db=>{
    if(!input.leaseId||!input.path||!safeOutputPath(input.path)||!input.path.startsWith(`outputs/${input.visibility}/`))throw new HttpError(400,'Artifact path and visibility must match');
    const job=await leasedJob(db,jobId,input.leaseId);
    const purpose=input.purpose||(input.visibility==='client'?'draft':'workpaper');
    if(purpose==='rfi_review'&&(job.stage_id!=='W5-11'||input.visibility!=='internal'||input.path!=='outputs/internal/rfi-tracker.xlsx'||cleanFilename(input.filename)!=='rfi-tracker.xlsx'||input.mimeType!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))throw new HttpError(400,'RFI review access is limited to the internal W5-11 cross-check workbook');
    if(purpose==='rfi_review'&&(await db.query("SELECT 1 FROM zora_sources WHERE case_id=$1 AND visibility='internal' LIMIT 1",[job.case_id])).rowCount)throw new HttpError(409,'A pursuit with private sources cannot expose its cross-check workpaper through consultant RFI access');
    if(purpose==='source_transcript'&&(input.mimeType!=='application/json'||input.totalBytes>TRANSCRIPT_LIMIT))throw new HttpError(400,'Source transcripts require bounded JSON');
    const existing=(await db.query('SELECT id,filename,mime_type,visibility,purpose,sha256,octet_length(data)::int AS bytes FROM zora_artifacts WHERE job_id=$1 AND lease_id=$2 AND source_path=$3',[jobId,input.leaseId,input.path])).rows[0];
    if(existing){
      if(existing.filename!==cleanFilename(input.filename)||existing.mime_type!==input.mimeType||existing.visibility!==input.visibility||existing.purpose!==purpose||existing.sha256!==input.sha256||existing.bytes!==input.totalBytes)throw new HttpError(409,'This output path was stored with different content or metadata');
      return {id:existing.id,alreadyStored:true,chunkSize:FILE_CHUNK,nextOffset:input.totalBytes};
    }
    const id=randomUUID();
    await db.query('INSERT INTO zora_uploads(id,case_id,job_id,kind,owner,lease_id,filename,mime_type,visibility,source_path,total_bytes,sha256,purpose) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,job.case_id,jobId,'artifact',job.worker_id,input.leaseId,cleanFilename(input.filename),input.mimeType,input.visibility,input.path,input.totalBytes,input.sha256,purpose]);
    return {id,chunkSize:FILE_CHUNK,nextOffset:0};
  });
}
export type UploadIdentity={kind:'source';caseId:string;user:Actor}|{kind:'artifact';jobId:string;leaseId:string};
async function permitted(db:PoolClient,id:string,identity:UploadIdentity){
  if(!z.uuid().safeParse(id).success)throw new HttpError(400,'Invalid upload identity');
  const row=(await db.query('SELECT id,case_id,job_id,kind,owner,lease_id,filename,mime_type,visibility,purpose,source_path,total_bytes,sha256,case_version,next_offset,state,expires_at FROM zora_uploads WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!row||row.kind!==identity.kind||new Date(row.expires_at).getTime()<=Date.now())throw new HttpError(404,'Upload not available');
  if(identity.kind==='source'){
    sourceEditor(identity.user,row.visibility);await accessCase(identity.caseId,identity.user,db);
    if(row.case_id!==identity.caseId||row.owner!==identity.user.email)throw new HttpError(403,'Upload belongs to another pursuit or account');
  }else{
    if(row.job_id!==identity.jobId||row.lease_id!==identity.leaseId)throw new HttpError(403,'Upload belongs to another session');
    await leasedJob(db,identity.jobId,identity.leaseId);
  }
  return row;
}
export async function appendUpload(id:string,identity:UploadIdentity,offset:number,bytes:Buffer){
  if(!Number.isSafeInteger(offset)||offset<0||!bytes.length||bytes.length>FILE_CHUNK)throw new HttpError(400,'Invalid upload chunk');
  return transaction(async db=>{
    const row=await permitted(db,id,identity);
    if(row.state!=='uploading'||row.next_offset!==offset||offset+bytes.length>row.total_bytes)throw new HttpError(409,'Upload offset changed; retry from the saved offset');
    await db.query('UPDATE zora_uploads SET data=data||$2::bytea,next_offset=next_offset+$3 WHERE id=$1',[id,bytes,bytes.length]);
    return {id,nextOffset:offset+bytes.length};
  });
}
export async function finishUpload(id:string,identity:UploadIdentity){
  return transaction(async db=>{
    const row=await permitted(db,id,identity);
    if(row.state==='completed')return {id,sha256:row.sha256,alreadyStored:true};
    const bytes=(await db.query('SELECT data FROM zora_uploads WHERE id=$1',[id])).rows[0].data;
    if(row.next_offset!==row.total_bytes||hashBytes(bytes)!==row.sha256)throw new HttpError(422,'Upload size or SHA-256 does not match');
    let version:number|undefined;
    if(identity.kind==='source'){
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[identity.caseId]);const c=await accessCase(identity.caseId,identity.user,db);
      if(!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Pause or start a revision before changing sources');
      if(row.case_version!==c.version)throw new HttpError(409,'The pursuit changed during upload; refresh and upload against the current revision');
      const existing=(await db.query('SELECT visibility FROM zora_sources WHERE case_id=$1 AND sha256=$2',[row.case_id,row.sha256])).rows[0];
      if(existing&&existing.visibility!==row.visibility)throw new HttpError(409,'Identical source bytes already have a different access classification; uploading cannot change it');
      const added=await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,provenance,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(case_id,sha256) DO NOTHING RETURNING id',[id,row.case_id,row.filename,row.mime_type,bytes,row.sha256,JSON.stringify({kind:'upload',uploadedBy:identity.user.email}),row.visibility]);
      version=added.rowCount?(await db.query('UPDATE zora_cases SET version=version+1,source_revision=source_revision+1,updated_at=now() WHERE id=$1 RETURNING version',[row.case_id])).rows[0].version:c.version;
      await event(db,row.case_id,'source.uploaded',identity.user.email,{filename:row.filename,sha256:row.sha256,bytes:row.total_bytes,visibility:row.visibility,duplicate:!added.rowCount});
    }else{
      const job=await leasedJob(db,identity.jobId,identity.leaseId);
      const existing=await db.query('SELECT id FROM zora_artifacts WHERE job_id=$1 AND lease_id=$2 AND source_path=$3',[identity.jobId,identity.leaseId,row.source_path]);
      if(existing.rowCount)throw new HttpError(409,'This session output path is already stored');
      if(row.purpose==='source_transcript'){
        try{
          const transcript=parseSourceTranscript(bytes);
          const source=(await db.query('SELECT id,sha256,mime_type,filename,visibility FROM zora_sources WHERE id=$1 AND case_id=$2 AND active',[transcript.sourceId,row.case_id])).rows[0];
          if(!source)throw new Error('Missing source');matchTranscript(transcript,source,row.visibility);
        }catch{throw new HttpError(422,'Transcript must match an active PDF source, its hash, access classification and page contract');}
      }
      await db.query('INSERT INTO zora_artifacts(id,case_id,job_id,filename,mime_type,visibility,data,sha256,source_path,lease_id,case_version,source_revision,purpose) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,row.case_id,row.job_id,row.filename,row.mime_type,row.visibility,bytes,row.sha256,row.source_path,row.lease_id,job.case_version,job.source_revision,row.purpose]);
      await event(db,row.case_id,'artifact.stored',job.worker_id,{artifactId:id,filename:row.filename,sha256:row.sha256,visibility:row.visibility,stage:job.stage_id});
    }
    await db.query("UPDATE zora_uploads SET state='completed',data=''::bytea WHERE id=$1",[id]);
    return {id,sha256:row.sha256,bytes:row.total_bytes,version};
  });
}
