import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient,Pool } from 'pg';
import { HttpError,type Actor } from './auth';
import { transaction } from './db';
import { accessCase,requireCaseManager,event } from './cases';
import { hashBytes,FILE_LIMIT } from './files';
import { inventory,ReviewInputError } from './review-manifest';
import brd from '../data/brd-index.json';

export const knowledgeKinds=['company_profile','proposal_template','slide_template','architecture_format','demo','video','reference'] as const;
export const knowledgeInput=z.object({
  entryId:z.uuid().optional(),expectedVersion:z.number().int().positive().optional(),
  caseId:z.uuid(),sourceId:z.uuid(),kind:z.enum(knowledgeKinds),title:z.string().trim().min(3).max(160),notes:z.string().trim().max(20000).default(''),
  claim:z.object({statement:z.string().trim().min(5).max(4000),location:z.string().trim().min(2).max(300),quote:z.string().trim().min(5).max(8000)}).optional(),
}).refine(input=>input.kind!=='company_profile'||!!input.claim,{message:'A company-profile claim requires an exact source passage and location'});
export const knowledgeDecision=z.object({version:z.number().int().positive(),action:z.enum(['approve','reject','revoke']),note:z.string().trim().min(10).max(4000),sourceChecked:z.boolean().optional(),reuseAuthorised:z.boolean().optional()});
export function canProposeKnowledge(user:Actor){return user.roles.some(r=>['admin','consultant','bid_owner'].includes(r));}
function requireProposer(user:Actor){if(!canProposeKnowledge(user))throw new HttpError(403,'Reusable knowledge requires a consultant or bid owner');}
async function lockEntry(db:PoolClient,entry:string){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[entry]);}
export const knowledgeMetadata='id,entry_id,version,kind,title,notes,claim,filename,mime_type,sha256,octet_length(data)::int AS size,source_case_id,source_id,source_origin,ingestion_complete,owner_email,created_by,status,approved_by,approved_at,decision_note,created_at';
export async function proposeKnowledge(input:z.infer<typeof knowledgeInput>,user:Actor){
  requireProposer(user);return transaction(async db=>{
    await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR KEY SHARE',[input.caseId]);
    const sourceCase=await accessCase(input.caseId,user,db);requireCaseManager(sourceCase,user);
    const source=(await db.query('SELECT * FROM zora_sources WHERE id=$1 AND case_id=$2 AND active',[input.sourceId,input.caseId])).rows[0];
    if(!source)throw new HttpError(404,'Select an active source from a pursuit you manage');
    if(source.visibility!=='client')throw new HttpError(403,'Private pursuit sources cannot be proposed for firm-wide library reuse');
    if(source.data.length>FILE_LIMIT||hashBytes(source.data)!==source.sha256)throw new HttpError(409,'Reusable source failed its size/hash check');
    if(input.kind==='proposal_template'){
      if(!source.filename.toLowerCase().endsWith('.docx')||source.sha256===brd.source_sha256)throw new HttpError(400,'Provide the approved proposal DOCX layout; the BRD is not a template');
      try{await inventory({...source,role:'source'});}catch(error){throw new HttpError(400,error instanceof ReviewInputError?error.message:'Provide a clean, supported Word template file');}
    }
    if(input.kind==='slide_template'){
      if(!source.filename.toLowerCase().endsWith('.pptx'))throw new HttpError(400,'A slide template must be a PPTX file');
      try{await inventory({...source,role:'source'});}catch(error){throw new HttpError(400,error instanceof ReviewInputError?error.message:'Provide a clean, supported PowerPoint template file');}
    }
    const entryId=input.entryId||randomUUID();await lockEntry(db,entryId);
    const previous=(await db.query('SELECT * FROM zora_knowledge_versions WHERE entry_id=$1 ORDER BY version DESC LIMIT 1',[entryId])).rows[0];
    if(input.entryId&&!previous)throw new HttpError(404,'Reusable entry not found');
    if(previous&&(input.expectedVersion!==previous.version||(previous.owner_email!==user.email&&!user.roles.includes('admin'))))throw new HttpError(409,'Entry version or ownership changed; refresh before proposing an update');
    if(previous&&previous.kind!==input.kind)throw new HttpError(400,'A new version must keep the same knowledge type');
    const id=randomUUID();const result=await db.query(`INSERT INTO zora_knowledge_versions(id,entry_id,version,kind,title,notes,claim,filename,mime_type,data,sha256,source_case_id,source_id,owner_email,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${knowledgeMetadata}`,[id,entryId,(previous?.version||0)+1,input.kind,input.title,input.notes,input.claim?JSON.stringify(input.claim):null,source.filename,source.mime_type,source.data,source.sha256,input.caseId,input.sourceId,previous?.owner_email||user.email,user.email]);
    await event(db,input.caseId,'knowledge.proposed',user.email,{entryId,versionId:id,sha256:source.sha256});return result.rows[0];
  });
}
export async function decideKnowledge(id:string,input:z.infer<typeof knowledgeDecision>,user:Actor){
  if(!user.roles.includes('admin'))throw new HttpError(403,'The workspace administrator approves or withdraws reusable knowledge');
  return transaction(async db=>{
    const ref=(await db.query('SELECT entry_id,source_case_id FROM zora_knowledge_versions WHERE id=$1',[id])).rows[0];if(!ref)throw new HttpError(404,'Reusable version not found');
    if(ref.source_case_id)await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR KEY SHARE',[ref.source_case_id]);await lockEntry(db,ref.entry_id);
    const current=(await db.query('SELECT * FROM zora_knowledge_versions WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!current.ingestion_complete)throw new HttpError(409,'Source import is incomplete; wait for its verified checksum');
    const latest=(await db.query('SELECT max(version)::int AS version FROM zora_knowledge_versions WHERE entry_id=$1',[ref.entry_id])).rows[0].version;
    if(current.version!==input.version||(input.action!=='revoke'&&latest!==input.version))throw new HttpError(409,'Knowledge version changed; refresh before deciding');
    if(hashBytes(current.data)!==current.sha256)throw new HttpError(409,'Knowledge source hash changed');
    if(input.action==='approve'){
      if(current.status!=='draft'||!input.sourceChecked||!input.reuseAuthorised)throw new HttpError(409,'Check the actual source and authorise team reuse of this draft before approval');
      await db.query("UPDATE zora_knowledge_versions SET status='superseded' WHERE entry_id=$1 AND status='approved'",[ref.entry_id]);
      await db.query("UPDATE zora_knowledge_versions SET status='approved',approved_by=$2,approved_at=now(),decision_note=$3 WHERE id=$1",[id,user.email,input.note]);
    }else{
      if(input.action==='reject'&&current.status!=='draft'||input.action==='revoke'&&!['approved','superseded'].includes(current.status))throw new HttpError(409,'This decision is unavailable for the selected version');
      await db.query('UPDATE zora_knowledge_versions SET status=$2,decision_note=$3 WHERE id=$1',[id,input.action==='reject'?'rejected':'revoked',input.note]);
    }
    await event(db,current.source_case_id,`knowledge.${input.action}`,user.email,{entryId:ref.entry_id,versionId:id,sha256:current.sha256,note:input.note});
    return (await db.query(`SELECT ${knowledgeMetadata} FROM zora_knowledge_versions WHERE id=$1`,[id])).rows[0];
  });
}
export async function knowledgeHolds(db:PoolClient|Pool,caseId:string):Promise<string[]>{
  const bindings=(await db.query("SELECT provenance->'knowledge'->>'versionId' AS id,provenance->'knowledge'->>'sha256' AS sha256 FROM zora_sources WHERE case_id=$1 AND active AND provenance->>'kind'='approved_knowledge'",[caseId])).rows;
  if(!bindings.length)return [];
  const rows=(await db.query('SELECT id,title,version,status,sha256 FROM zora_knowledge_versions WHERE id::text=ANY($1::text[]) ORDER BY id FOR SHARE',[bindings.map(row=>row.id)])).rows;
  return bindings.flatMap(binding=>{
    const row=rows.find(row=>row.id===binding.id);
    if(!row)return ['A reusable source approval record is missing. Open a revision and restore, retire or replace this source.'];
    if(row.sha256!==binding.sha256)return [`Reusable source integrity mismatch: ${row.title} v${row.version}. Restore the checked source or open a revision.`];
    if(!['approved','superseded'].includes(row.status))return [`Reusable source withdrawn: ${row.title} v${row.version}. Open a revision and retire or replace this source.`];
    return [];
  });
}
export async function attachKnowledge(caseId:string,input:{version:number;versionIds:string[];retireEntryIds:string[];note?:string},user:Actor){
  requireProposer(user);return transaction(async db=>{
    await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[caseId]);const c=await accessCase(caseId,user,db);requireCaseManager(c,user);
    if(c.version!==input.version)throw new HttpError(409,'Pursuit version changed');
    if(!['awaiting_confirmation','blocked'].includes(c.status))throw new HttpError(409,'Open a revision before changing reusable sources');
    for(const entry of input.retireEntryIds)await db.query("UPDATE zora_sources SET active=false WHERE case_id=$1 AND provenance->'knowledge'->>'entryId'=$2",[caseId,entry]);
    for(const id of input.versionIds){
      const row=(await db.query('SELECT * FROM zora_knowledge_versions WHERE id=$1 FOR SHARE',[id])).rows[0];
      if(!row||row.status!=='approved'||!row.ingestion_complete)throw new HttpError(409,'Select a currently approved, complete reusable version');
      if(hashBytes(row.data)!==row.sha256)throw new HttpError(409,'Reusable source hash changed');
      await db.query("UPDATE zora_sources SET active=false WHERE case_id=$1 AND provenance->'knowledge'->>'entryId'=$2",[caseId,row.entry_id]);
      const provenance={kind:'approved_knowledge',knowledge:{entryId:row.entry_id,versionId:row.id,version:row.version,kind:row.kind,sha256:row.sha256,approvedBy:row.approved_by,approvedAt:row.approved_at}};
      if((await db.query("SELECT 1 FROM zora_sources WHERE case_id=$1 AND sha256=$2 AND visibility='internal'",[caseId,row.sha256])).rowCount)throw new HttpError(409,'An existing private source has identical bytes; library attachment cannot change its access classification');
      await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,provenance) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(case_id,sha256) DO UPDATE SET active=true',[randomUUID(),caseId,row.filename,row.mime_type,row.data,row.sha256,JSON.stringify({kind:'approved_knowledge_asset',sha256:row.sha256})]);
      const metadata=Buffer.from(JSON.stringify({title:row.title,knowledgeType:row.kind,version:row.version,notes:row.notes,claim:row.claim,source:{filename:row.filename,sha256:row.sha256},approval:{actor:row.approved_by,at:row.approved_at,note:row.decision_note},notice:'Human-approved reusable source snapshot. This is not pursuit-specific QC, an approval of client commitments or permission to send.',...provenance},null,2));
      if((await db.query("SELECT 1 FROM zora_sources WHERE case_id=$1 AND sha256=$2 AND visibility='internal'",[caseId,hashBytes(metadata)])).rowCount)throw new HttpError(409,'A private source conflicts with this reusable snapshot');
      await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,provenance) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(case_id,sha256) DO UPDATE SET active=true',[randomUUID(),caseId,`mindmap-knowledge-${row.id}.json`,'application/json',metadata,hashBytes(metadata),JSON.stringify(provenance)]);
    }
    await db.query("UPDATE zora_sources asset SET active=EXISTS(SELECT 1 FROM zora_sources snapshot WHERE snapshot.case_id=asset.case_id AND snapshot.active AND snapshot.provenance->>'kind'='approved_knowledge' AND snapshot.provenance->'knowledge'->>'sha256'=asset.sha256) WHERE asset.case_id=$1 AND asset.provenance->>'kind'='approved_knowledge_asset'",[caseId]);
    await db.query('UPDATE zora_cases SET version=version+1,source_revision=source_revision+1,updated_at=now() WHERE id=$1',[caseId]);
    await event(db,caseId,'knowledge.sources_changed',user.email,{versionIds:input.versionIds,retireEntryIds:input.retireEntryIds,note:input.note||'Attached approved reusable source snapshots.'});
    return {saved:true};
  });
}
