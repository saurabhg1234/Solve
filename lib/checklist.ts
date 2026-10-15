import type { Pool,PoolClient } from 'pg';
import { z } from 'zod';
import type { WorkflowId } from './catalogue';
import { stagesFor } from './engine';
import { reviewPlan } from './review-plan';

/** BRD ESC-4 / section 17: escalation root causes become checklist rules; the team decides which become standing rules. */
export const CHECKLIST_PACKET_LIMIT=100;
export const checklistEntrySchema=z.object({
  findingIndex:z.number().int().min(0).max(19),
  checkers:z.array(z.string().regex(/^[A-Z0-9_]{2,20}$/)).min(1).max(8),
  rule:z.string().trim().min(20).max(1000),
}).strict();
export const checklistEntriesSchema=z.array(checklistEntrySchema).min(1).max(20);
export type ChecklistEntry=z.infer<typeof checklistEntrySchema>;
export type ChecklistRule={id:string;findingIndex:number;checkers:string[];rule:string|null;standing:'proposed'|'standing'|'declined';createdBy:string;createdAt:string;decidedBy:string|null;decidedAt:string|null;decisionNote:string|null};
export type PacketRule={id:string;checkers:string[];rule:string};

/** Checkers that run in the re-run loop, from the return point up to and including the escalated gate. */
export function rerunCheckers(workflow:WorkflowId,returnStage:string,gate:string):string[]{
  const stages=stagesFor(workflow),from=stages.findIndex(s=>s.id===returnStage),to=stages.findIndex(s=>s.id===gate);
  if(from<0||to<=from)return [];
  return [...new Set(stages.slice(from,to+1).flatMap(s=>reviewPlan(s.id)?.passes.map(p=>p.checker)??[]))].sort();
}
/** Exactly one rule per finding, each aimed at a checker that actually runs again. */
export function validateChecklist(entries:ChecklistEntry[],findingCount:number,allowed:string[]):string|null{
  const indexes=entries.map(e=>e.findingIndex);
  if(indexes.length!==findingCount||new Set(indexes).size!==findingCount||indexes.some(i=>i>=findingCount))return 'Record one checklist rule for every escalated finding';
  if(entries.some(e=>new Set(e.checkers).size!==e.checkers.length||e.checkers.some(c=>!allowed.includes(c))))return `Checklist rules must target checkers that run again: ${allowed.join(', ')}`;
  return null;
}
/** Rules a QC packet must carry: this pursuit's escalation rules plus standing rules for the workflow. */
export async function packetRules(db:Pool|PoolClient,caseId:string,workflow:WorkflowId,checkers:string[]):Promise<PacketRule[]>{
  const rows=(await db.query("SELECT id,checkers,rule FROM zora_checklist_rules WHERE case_id=$1 OR (standing='standing' AND workflow=$2) ORDER BY created_at,id",[caseId,workflow])).rows;
  return rows.filter(r=>r.checkers.some((c:string)=>checkers.includes(c))).map(r=>({id:r.id,checkers:r.checkers,rule:r.rule}));
}
export function rulesFor(packet:{checklist?:PacketRule[]},checker:string):string[]{
  return (packet.checklist??[]).filter(r=>r.checkers.includes(checker)).map(r=>r.id);
}
