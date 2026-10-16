import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Pool,PoolClient} from 'pg';
import {HttpError,type Actor} from './auth';
import {event} from './cases';
import {digest} from './engine';
import {canReadInternal,cleanFilename,hashBytes} from './files';
import {contextSchema} from './review-plan';

// Small, atomic delivery packs stay below the hosting platform's request limit.
export const DELIVERY_BYTES=2*1024*1024;
export const DELIVERY_REQUEST_BYTES=3*1024*1024;
const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const deliverySchema=z.object({
  id:z.uuid(),caseId:z.uuid(),version:z.number().int().positive(),sourceRevision:z.number().int().positive(),
  contextId:contextSchema,title:z.string().trim().min(5).max(160),summary:z.string().trim().min(20).max(4000),
  visibility:z.enum(['client','internal']),
  sources:z.array(z.object({id:z.uuid(),sha256:sha}).strict()).min(1).max(24),
  files:z.array(z.object({filename:z.string().min(1).max(250),mimeType:z.enum(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','application/json']),sha256:sha,base64:z.string().min(4).max(Math.ceil(DELIVERY_BYTES/3)*4)}).strict()).min(1).max(8),
}).strict();
export type DirectDeliveryInput=z.infer<typeof deliverySchema>;

export async function readDeliveryBody(request:Request){
  if(Number(request.headers.get('content-length'))>DELIVERY_REQUEST_BYTES)throw new HttpError(413,'Delivery request exceeds 3 MB');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Provide a delivery pack');
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>DELIVERY_REQUEST_BYTES){await reader.cancel();throw new HttpError(413,'Delivery request exceeds 3 MB');}chunks.push(value);}
  let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Provide a valid delivery pack');}
  const parsed=deliverySchema.safeParse(value);if(!parsed.success)throw new HttpError(400,'Delivery metadata is invalid');return parsed.data;
}

/** Direct-session outputs are immutable evidence, never workflow completions or independent QC. */
export async function recordDirectDelivery(db:PoolClient,input:DirectDeliveryInput){
  if(new Set(input.sources.map(s=>s.id)).size!==input.sources.length)throw new HttpError(400,'Select each source once');
  const files=input.files.map(file=>{
    const filename=cleanFilename(file.filename);if(filename!==file.filename)throw new HttpError(400,'Use plain filenames');
    const bytes=Buffer.from(file.base64,'base64');
    if(!bytes.length||bytes.toString('base64')!==file.base64||hashBytes(bytes)!==file.sha256)throw new HttpError(422,'Delivery file bytes do not match their hash');
    return {...file,filename,bytes};
  });
  if(files.reduce((sum,f)=>sum+f.bytes.length,0)>DELIVERY_BYTES)throw new HttpError(413,'Delivery files exceed 2 MB; split the delivery');
  if(new Set(files.map(f=>f.filename.toLowerCase())).size!==files.length)throw new HttpError(400,'Use distinct delivery filenames');
  const c=(await db.query('SELECT * FROM zora_cases WHERE id=$1 FOR UPDATE',[input.caseId])).rows[0];if(!c)throw new HttpError(404,'Pursuit not found');
  const manifest={...input,files:files.map(({filename,mimeType,sha256,bytes})=>({filename,mimeType,sha256,size:bytes.length}))};
  const hash=digest(manifest),existing=(await db.query('SELECT id,case_id,manifest_hash FROM zora_direct_deliveries WHERE id=$1',[input.id])).rows[0];
  if(existing){if(existing.case_id!==input.caseId||existing.manifest_hash!==hash)throw new HttpError(409,'This delivery ID already records different work');return {id:existing.id,alreadyStored:true,independentQcCompleted:false,humanApprovalRecorded:false};}
  if(c.version!==input.version||c.source_revision!==input.sourceRevision)throw new HttpError(409,'The pursuit changed; review the current sources before delivery');
  if(c.status==='released')throw new HttpError(409,'Open a revision before adding work to a released pursuit');
  const sources=(await db.query('SELECT id,sha256,visibility FROM zora_sources WHERE case_id=$1 AND active AND id=ANY($2::uuid[])',[input.caseId,input.sources.map(s=>s.id)])).rows;
  if(sources.length!==input.sources.length||sources.some(s=>input.sources.find(w=>w.id===s.id)?.sha256!==s.sha256))throw new HttpError(409,'Selected source versions are no longer current');
  if(input.visibility==='client'&&sources.some(s=>s.visibility==='internal'))throw new HttpError(403,'Work based on private sources must remain internal');
  // Prevent a context that has drafted here from subsequently acting as an independent reviewer.
  if((await db.query('SELECT 1 FROM zora_review_contexts WHERE case_id=$1 AND context_id=$2',[input.caseId,input.contextId])).rowCount)throw new HttpError(409,'An independent reviewer cannot publish direct drafting work on this pursuit');
  await db.query('INSERT INTO zora_direct_deliveries(id,case_id,case_version,source_revision,context_id,title,summary,visibility,manifest,manifest_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[input.id,input.caseId,input.version,input.sourceRevision,input.contextId,input.title,input.summary,input.visibility,JSON.stringify(manifest),hash]);
  for(const file of files)await db.query('INSERT INTO zora_delivery_files(id,delivery_id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),input.id,input.caseId,file.filename,file.mimeType,file.bytes,file.sha256]);
  await event(db,input.caseId,'work.delivered','zora-native-session',{deliveryId:input.id,contextId:input.contextId,files:files.length,sourceRevision:input.sourceRevision,independentQcCompleted:false,humanApprovalRecorded:false});
  return {id:input.id,alreadyStored:false,independentQcCompleted:false,humanApprovalRecorded:false};
}

export async function readDirectDeliveries(db:Pool|PoolClient,caseId:string,user:Actor){
  const rows=(await db.query('SELECT id,title,summary,visibility,case_version,source_revision,created_at FROM zora_direct_deliveries WHERE case_id=$1 AND (visibility=\'client\' OR $2) ORDER BY created_at DESC LIMIT 20',[caseId,canReadInternal(user)])).rows;
  const files=rows.length?(await db.query('SELECT id,delivery_id,filename,mime_type,sha256,octet_length(data)::int AS size FROM zora_delivery_files WHERE case_id=$1 AND delivery_id=ANY($2::uuid[]) ORDER BY filename',[caseId,rows.map(r=>r.id)])).rows:[];
  return rows.map(row=>({...row,files:files.filter(f=>f.delivery_id===row.id)}));
}
