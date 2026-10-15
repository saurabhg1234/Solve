import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { database, transaction } from './db';
import { stagesFor } from './engine';
import { HttpError, type Actor } from './auth';
import type { CaseRecord, WorkflowId } from './catalogue';
import { emailAttachments } from './microsoft';
import { FILE_LIMIT } from './files';
import { defaultQcPolicy } from './config';

export function mapCase(row: Record<string, unknown>): CaseRecord {
  return { id: String(row.id), title: String(row.title), client: String(row.client), workflow: row.workflow as WorkflowId,
    status: row.status as CaseRecord['status'], stageIndex: Number(row.stage_index), version: Number(row.version), sourceRevision:Number(row.source_revision||1),qcPolicy:{cleanLoops:row.qc_clean_loops?Number(row.qc_clean_loops):null,maxLoops:row.qc_max_loops?Number(row.qc_max_loops):null},
    source: row.source as CaseRecord['source'], requestedBy: String(row.requested_by), briefing: String(row.briefing),
    createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() };
}
export async function event(db: PoolClient, caseId: string|null, type: string, who: string, data: unknown = {}) {
  await db.query('INSERT INTO zora_events(case_id,type,actor,data) VALUES($1,$2,$3,$4)', [caseId,type,who,JSON.stringify(data)]);
}
export async function queueStage(db: PoolClient, c: CaseRecord) {
  const stage = stagesFor(c.workflow)[c.stageIndex];
  if (!stage) {
    // Completion of stages is not sufficient for release without release gates.
    await db.query("UPDATE zora_cases SET status='released',updated_at=now() WHERE id=$1",[c.id]);
  } else if (stage.kind === 'gate') {
    await db.query("UPDATE zora_cases SET status='awaiting_approval',updated_at=now() WHERE id=$1",[c.id]);
  } else {
    await db.query('INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision) VALUES($1,$2,$3,$4,$5)',[randomUUID(),c.id,stage.id,c.version,c.sourceRevision]);
    await db.query("UPDATE zora_cases SET status='queued',updated_at=now() WHERE id=$1",[c.id]);
  }
}
export async function createCase(input: { title: string; client: string; workflow: WorkflowId; briefing: string; inboxId?: string }, user: Actor, source: 'manual'|'email'='manual') {
  if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Creating a pursuit requires a consultant or bid owner');
  let attachments:Awaited<ReturnType<typeof emailAttachments>>=[];
  if(input.inboxId){
    const inbox=(await database().query('SELECT * FROM zora_inbox WHERE id=$1',[input.inboxId])).rows[0];
    if(!inbox)throw new HttpError(404,'Email request not found');
    if(inbox.case_id)throw new HttpError(409,'This email is already linked to a pursuit');
    // hasAttachments excludes inline files; always inspect the actual attachment list.
    attachments=await emailAttachments(inbox.mailbox,inbox.message_id);
  }
  const id = randomUUID();
  return transaction(async db => {
    let inbox;
    if (input.inboxId) {
      if (!user.roles.some(r => ['consultant','bid_owner','admin'].includes(r))) throw new HttpError(403,'Inbox triage requires a consultant or bid owner');
      inbox = (await db.query('SELECT * FROM zora_inbox WHERE id=$1 FOR UPDATE',[input.inboxId])).rows[0];
      if (!inbox) throw new HttpError(404,'Email request not found');
      if (inbox.case_id) throw new HttpError(409,'This email is already linked to a pursuit');
      source = 'email';
    }
    const qc = defaultQcPolicy();
    const result = await db.query("INSERT INTO zora_cases(id,title,client,workflow,status,source,requested_by,briefing,qc_clean_loops,qc_max_loops) VALUES($1,$2,$3,$4,'awaiting_confirmation',$5,$6,$7,$8,$9) RETURNING *",[id,input.title,input.client,input.workflow,source,user.email,input.briefing,qc?.cleanLoops??null,qc?.maxLoops??null]);
    await event(db,id,'request.created',user.email,{workflow:input.workflow,source});
    if (inbox) {
      const bytes = Buffer.from(`Subject: ${inbox.subject}\nFrom: ${inbox.sender}\nReceived: ${new Date(inbox.received_at).toISOString()}\nMicrosoft message ID: ${inbox.message_id}\n\n${inbox.body_text}`);
      if(bytes.length>FILE_LIMIT)throw new HttpError(413,'Provide the full email as a file within the 32 MB source limit; no truncated pursuit will be created');
      await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,'request-email.txt','text/plain; charset=utf-8',bytes,createHash('sha256').update(bytes).digest('hex')]);
      for(const file of attachments)await db.query('INSERT INTO zora_sources(id,case_id,filename,mime_type,data,sha256,provenance) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(case_id,sha256) DO NOTHING',[randomUUID(),id,file.filename,file.mimeType,file.data,file.sha256,JSON.stringify(file.provenance)]);
      await db.query('UPDATE zora_inbox SET case_id=$2 WHERE id=$1',[input.inboxId,id]);
      await db.query('UPDATE zora_mail_receipts SET case_id=$3 WHERE mailbox=$1 AND message_id=$2',[inbox.mailbox,inbox.message_id,id]);
      await db.query('UPDATE zora_inbox SET attachment_notice=NULL WHERE id=$1',[input.inboxId]);
      await event(db,id,'email.linked',user.email,{inboxId:input.inboxId,attachmentsImported:attachments.length});
    }
    const c = mapCase(result.rows[0]);
    // W2 and W8 show the routing card and proceed, as RT7 specifies.
    if (['W2','W8'].includes(c.workflow)) { await queueStage(db,c); c.status='queued'; }
    return c;
  });
}
export async function accessCase(id: string, user: Actor, db: Pool | PoolClient = database()) {
  const result = await db.query('SELECT * FROM zora_cases WHERE id=$1',[id]);
  if (!result.rows[0]) throw new HttpError(404,'Pursuit not found');
  const c=mapCase(result.rows[0]);
  const member=c.requestedBy===user.email||user.roles.includes('admin')||(await db.query('SELECT 1 FROM zora_case_members WHERE case_id=$1 AND email=$2',[id,user.email])).rowCount;
  if (!member) throw new HttpError(403,'You do not have access to this pursuit');
  return c;
}
export function requireCaseManager(c:CaseRecord,user:Actor){
  if(!user.roles.includes('admin')&&c.requestedBy!==user.email)throw new HttpError(403,'Only the pursuit owner or administrator can manage its team and revisions');
  if(!user.roles.some(r=>['consultant','bid_owner','admin'].includes(r)))throw new HttpError(403,'Pursuit management requires a consultant or bid owner');
}
