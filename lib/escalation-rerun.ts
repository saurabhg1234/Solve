import { createHash,randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { HttpError,type Actor } from './auth';
import { event } from './cases';
import type { CaseRecord,Role } from './catalogue';
import { checklistEntriesSchema,rerunCheckers,validateChecklist,type ChecklistEntry } from './checklist';
import { stagesFor,type Stage } from './engine';
import { canReadResetNote,documentGates,type SavedGateFinding } from './gate-feedback';
import { needsIndependentReview,type StageResult } from './result';
import { beginReview } from './reviews';
import { resetDigest,resetReportSchema } from './trust-reset-contract';

export const rerunRequestSchema=z.object({version:z.number().int().positive(),feedbackId:z.uuid(),checklist:checklistEntriesSchema}).strict();
export const noteReadsSchema=z.array(z.object({feedbackId:z.uuid(),reportHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(20);
export type NoteRead=z.infer<typeof noteReadsSchema>[number];
export type RerunRecord={resetJobId:string;rerunJobId:string;qcRunId:string;returnStage:string;sourceRevision:number;caseVersion:number;draftFiles:{id:string;sha256:string}[];reportHash:string;startedBy:string;startedAt:string};

/**
 * BRD ESC-4: after the fresh ESC-3 draft, re-run the QC loop with new reviewer instances from the
 * return point, and add each root cause to the relevant checklist before those reviewers start.
 */
export async function startEscalationRerun(db:PoolClient,c:CaseRecord,feedbackId:string,checklist:ChecklistEntry[],user:Actor){
  const row=(await db.query('SELECT * FROM zora_gate_feedback WHERE id=$1 AND case_id=$2 FOR UPDATE',[feedbackId,c.id])).rows[0];
  const stages=stagesFor(c.workflow);
  if(c.status!=='blocked'||!row||!row.escalation_required||row.state!=='open'||row.source_revision!==c.sourceRevision||row.stage_id!==stages[c.stageIndex]?.id)throw new HttpError(409,'Start the re-run at the rejected document gate with unchanged sources and an open escalation');
  const reset=(await db.query("SELECT * FROM zora_jobs WHERE case_id=$1 AND reset_packet->>'feedbackId'=$2 AND source_revision=$3 ORDER BY created_at DESC,id DESC LIMIT 1",[c.id,feedbackId,c.sourceRevision])).rows[0];
  if(reset?.state!=='completed')throw new HttpError(409,'A completed fresh whole-document re-evaluation (ESC-3) is required before the independent re-run');
  const report=resetReportSchema.safeParse(reset.result?.resetReport);
  if(!report.success||resetDigest(reset.reset_packet)!==reset.reset_packet_hash||report.data.packetHash!==reset.reset_packet_hash)throw new HttpError(409,'The re-evaluation note no longer matches its isolated packet');
  const drafts=(await db.query("SELECT id,sha256,data FROM zora_artifacts WHERE job_id=$1 AND lease_id=$2 AND case_id=$3 AND visibility='client' AND purpose='draft' ORDER BY created_at,id",[reset.id,reset.lease_id,c.id])).rows;
  if(!drafts.length||drafts.some(f=>createHash('sha256').update(f.data).digest('hex')!==f.sha256))throw new HttpError(409,'The regenerated draft is missing or failed its stored-byte integrity check');
  const returnIndex=stages.findIndex(s=>s.id===row.return_stage);
  if(returnIndex<0||returnIndex>=c.stageIndex||stages[returnIndex].kind!=='task'||!needsIndependentReview(row.return_stage))throw new HttpError(409,'The BRD return point is unavailable for an independent re-run');
  const findings=row.findings as SavedGateFinding[],allowed=rerunCheckers(c.workflow,row.return_stage,row.stage_id);
  const invalid=validateChecklist(checklist,findings.length,allowed);if(invalid)throw new HttpError(422,invalid);
  for(const entry of checklist)await db.query('INSERT INTO zora_checklist_rules(id,case_id,feedback_id,finding_index,workflow,checkers,rule,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),c.id,feedbackId,entry.findingIndex,c.workflow,JSON.stringify(entry.checkers),entry.rule,user.email]);
  c.stageIndex=returnIndex;c.version++;
  await db.query('UPDATE zora_cases SET stage_index=$2,version=$3,updated_at=now() WHERE id=$1',[c.id,c.stageIndex,c.version]);
  // The fresh drafter is the creator of the reviewed draft; claimReview also excludes every earlier
  // drafter, reviewer and reset context on this pursuit, so each pass is a new reviewer instance.
  const jobId=randomUUID();
  await db.query("INSERT INTO zora_jobs(id,case_id,stage_id,case_version,source_revision,context_id,worker_id) VALUES($1,$2,$3,$4,$5,$6,'escalation-rerun')",[jobId,c.id,row.return_stage,c.version,c.sourceRevision,reset.context_id]);
  const result:StageResult={status:'completed',summary:`ESC-4 independent re-run from ${row.return_stage} of the fresh ESC-3 draft.`,missingInputs:[],outputFiles:[],reviewArtifactIds:drafts.map(f=>f.id),citations:[],reviewReports:[]};
  const review=await beginReview(db,{id:jobId,stage_id:row.return_stage,context_id:reset.context_id,worker_id:'escalation-rerun'},c,result);
  if(!review.runId)throw new HttpError(409,review.missingInputs.join(' ')||'Independent re-run could not start');
  const rerun:RerunRecord={resetJobId:reset.id,rerunJobId:jobId,qcRunId:review.runId,returnStage:row.return_stage,sourceRevision:c.sourceRevision,caseVersion:c.version,draftFiles:drafts.map(f=>({id:f.id,sha256:f.sha256})),reportHash:resetDigest(report.data),startedBy:user.email,startedAt:new Date().toISOString()};
  await db.query("UPDATE zora_gate_feedback SET state='rerunning',rerun=$2 WHERE id=$1",[feedbackId,JSON.stringify(rerun)]);
  await event(db,c.id,'gate.escalation_rerun_started',user.email,{feedbackId,qcRunId:review.runId,returnStage:row.return_stage,rules:checklist.length});
  return {qcRunId:review.runId,returnStage:row.return_stage,rules:checklist.length};
}

/**
 * The next document gate after the re-run must read the re-evaluation note. Each approver acknowledges
 * the exact note hash; the re-run must have passed fresh independent QC at the return point.
 */
export async function acknowledgeRerunNotes(db:PoolClient,c:CaseRecord,stage:Stage,user:Actor,reads:NoteRead[]){
  if(!documentGates.has(stage.id))return [];
  const rows=(await db.query("SELECT * FROM zora_gate_feedback WHERE case_id=$1 AND escalation_required AND state='rerunning' ORDER BY created_at,id FOR UPDATE",[c.id])).rows;
  const checked=[];
  for(const row of rows){
    const rerun=row.rerun as RerunRecord;
    if(rerun.sourceRevision!==c.sourceRevision)throw new HttpError(409,'Sources changed after this escalation re-run. Changed-source reconciliation is required before document-gate approval.');
    const passed=(await db.query("SELECT id,packet FROM zora_qc_runs WHERE case_id=$1 AND source_revision=$2 AND packet->>'stageId'=$3 AND state='passed' AND created_at>=(SELECT created_at FROM zora_qc_runs WHERE id=$4) ORDER BY completed_at DESC,id DESC LIMIT 1",[c.id,c.sourceRevision,rerun.returnStage,rerun.qcRunId])).rows[0];
    if(!passed)throw new HttpError(409,`The independent re-run from ${rerun.returnStage} has not passed for this escalation`);
    if(!canReadResetNote(user,c.workflow,row.restricted))throw new HttpError(409,'This escalation involves restricted material. An approver with internal access must read the re-evaluation note.');
    if(!reads.some(r=>r.feedbackId===row.id&&r.reportHash===rerun.reportHash))throw new HttpError(409,'Read and acknowledge the re-evaluation note before approving this gate');
    const read={actor:user.email,roles:user.roles.filter(r=>stage.approvers.includes(r)),stageId:stage.id,caseVersion:c.version,reportHash:rerun.reportHash,passedQcRunId:passed.id,readAt:new Date().toISOString()};
    await db.query("UPDATE zora_gate_feedback SET note_reads=note_reads||$2::jsonb WHERE id=$1",[row.id,JSON.stringify([read])]);
    await event(db,c.id,'gate.reevaluation_note_read',user.email,{feedbackId:row.id,stage:stage.id,reportHash:rerun.reportHash});
    checked.push({row,passed});
  }
  return checked;
}

/** Controlled closure: only a completed approval of the gate that read the note resolves the escalation. */
export async function resolveRerunEscalations(db:PoolClient,c:CaseRecord,stage:Stage,user:Actor,checked:Awaited<ReturnType<typeof acknowledgeRerunNotes>>,approvedRoles:Role[]){
  for(const {row,passed} of checked){
    const rerun=row.rerun as RerunRecord;
    const resolution={stageId:stage.id,caseVersion:c.version,closedBy:user.email,approvedRoles,closedAt:new Date().toISOString(),reportHash:rerun.reportHash,rerunQcRunId:rerun.qcRunId,passedQcRunId:passed.id,reviewedDrafts:(passed.packet.files as any[]).filter(f=>f.role==='draft').map(f=>({id:f.id,sha256:f.sha256}))};
    await db.query("UPDATE zora_gate_feedback SET state='addressed',resolution=$2 WHERE id=$1 AND state='rerunning'",[row.id,JSON.stringify(resolution)]);
    await event(db,c.id,'gate.escalation_resolved',user.email,{feedbackId:row.id,stage:stage.id,passedQcRunId:passed.id});
  }
}

export const checklistDecisionSchema=z.object({decision:z.enum(['standing','declined']),note:z.string().trim().min(10).max(1000)}).strict();
/** The team decides whether an escalation rule becomes standing for every pursuit of the workflow. */
export async function decideChecklistRule(db:PoolClient,id:string,user:Actor,decision:'standing'|'declined',note:string){
  if(!user.roles.includes('admin'))throw new HttpError(403,'Only an administrator can change standing checklist rules');
  const rule=(await db.query('SELECT * FROM zora_checklist_rules WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!rule)throw new HttpError(404,'Checklist rule not found');
  if(rule.standing===decision||(rule.standing==='declined'))throw new HttpError(409,'This checklist decision is already recorded');
  await db.query('UPDATE zora_checklist_rules SET standing=$2,decided_by=$3,decided_at=now(),decision_note=$4 WHERE id=$1',[id,decision,user.email,note]);
  await event(db,rule.case_id,decision==='standing'?'checklist.rule_standing':'checklist.rule_declined',user.email,{ruleId:id,workflow:rule.workflow});
  return {id,standing:decision};
}
