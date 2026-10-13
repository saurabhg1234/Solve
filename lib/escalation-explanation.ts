import { z } from 'zod';
import type { PoolClient } from 'pg';
import { HttpError } from './auth';
import { event } from './cases';
import { contextSchema } from './review-plan';
import type { SavedGateFinding } from './gate-feedback';

export const explanationSchema=z.object({
  feedbackId:z.uuid(),findingIndex:z.number().int().min(0).max(19),artifactId:z.uuid(),sha256:z.string().regex(/^[a-f0-9]{64}$/),
  cause:z.enum(['missed','added','missed_and_added']),
  rootCause:z.string().trim().min(20).max(2000),
  whyChecksMissedIt:z.string().trim().min(20).max(2000),
  correctionPlan:z.string().trim().min(20).max(2000),
}).strict();
export const explanationBatchSchema=z.array(explanationSchema).min(1).max(20).refine(items=>new Set(items.map(i=>`${i.feedbackId}/${i.findingIndex}`)).size===items.length,'Explain each finding once');
export type Explanation=z.infer<typeof explanationSchema>;
export type SavedExplanation=Explanation&{jobId:string;contextId:string;recordedAt:string};
export const explanationRequestSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('read'),leaseId:z.uuid(),contextId:contextSchema}).strict(),
  z.object({action:z.literal('explain'),leaseId:z.uuid(),contextId:contextSchema,explanations:explanationBatchSchema}).strict(),
]);

// This is a continuation of an already completed producer task, never a new task claim.
export async function completedProducer(db:PoolClient,id:string,leaseId:string,contextId:string){
  await db.query('SELECT c.id FROM zora_cases c JOIN zora_jobs j ON j.case_id=c.id WHERE j.id=$1 FOR UPDATE OF c',[id]);
  const job=(await db.query("SELECT * FROM zora_jobs WHERE id=$1 AND lease_id=$2 AND context_id=$3 AND state='completed'",[id,leaseId,contextId])).rows[0];
  if(!job)throw new HttpError(409,'Use the original completed drafting task and its stored lease identity; another task cannot explain on its behalf');
  return job;
}
async function producerFiles(db:PoolClient,job:any){
  return (await db.query('SELECT id,filename,sha256,source_revision FROM zora_artifacts WHERE job_id=$1 AND lease_id=$2 AND case_id=$3',[job.id,job.lease_id,job.case_id])).rows;
}
export async function producerEscalations(db:PoolClient,job:any){
  const files=await producerFiles(db,job);
  const rows=(await db.query("SELECT id,stage_id,source_revision,findings,explanations,return_stage FROM zora_gate_feedback WHERE case_id=$1 AND escalation_required AND state IN ('open','reworking') ORDER BY created_at,id",[job.case_id])).rows;
  return rows.flatMap(row=>{
    const findings=(row.findings as SavedGateFinding[]).flatMap((finding,index)=>files.some(f=>f.id===finding.artifactId&&f.sha256===finding.sha256&&f.source_revision===row.source_revision)?[{...finding,findingIndex:index}]:[]);
    if(!findings.length)return [];
    return [{id:row.id,stageId:row.stage_id,sourceRevision:row.source_revision,returnStage:row.return_stage,findings,explanations:(row.explanations as SavedExplanation[]).filter(e=>e.jobId===job.id)}];
  });
}
export async function saveExplanations(db:PoolClient,job:any,input:Explanation[]){
  const files=await producerFiles(db,job);
  // Case lock serializes writes even when one feedback item spans multiple producer jobs.
  for(const explanation of input){
    const row=(await db.query("SELECT * FROM zora_gate_feedback WHERE id=$1 AND case_id=$2 AND escalation_required AND state IN ('open','reworking') FOR UPDATE",[explanation.feedbackId,job.case_id])).rows[0];
    const finding:SavedGateFinding|undefined=row?.findings?.[explanation.findingIndex];
    if(!finding||finding.artifactId!==explanation.artifactId||finding.sha256!==explanation.sha256||!files.some(f=>f.id===finding.artifactId&&f.sha256===finding.sha256&&f.source_revision===row.source_revision))throw new HttpError(422,'The explanation must address an unresolved finding on these exact bytes produced by this task');
    if(row.explanations.some((e:SavedExplanation)=>e.findingIndex===explanation.findingIndex))throw new HttpError(409,'This finding already has an immutable drafter explanation');
    const saved:SavedExplanation={...explanation,jobId:job.id,contextId:job.context_id,recordedAt:new Date().toISOString()};
    await db.query('UPDATE zora_gate_feedback SET explanations=explanations||$2::jsonb WHERE id=$1',[row.id,JSON.stringify([saved])]);
    await event(db,job.case_id,'gate.explanation_recorded','Zora',{feedbackId:row.id,findingIndex:explanation.findingIndex,jobId:job.id});
  }
  return {recorded:input.length,escalationResolved:false};
}
