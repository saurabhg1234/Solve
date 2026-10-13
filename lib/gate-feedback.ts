import type { SavedExplanation } from './escalation-explanation';
import { randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { z } from 'zod';
import { HttpError,type Actor } from './auth';
import { canReadArtifact,canReadInternal } from './files';
import type { CaseRecord,WorkflowId } from './catalogue';

export const documentGates=new Set(['W3-G3','W3-G4','W4-G3','W4-G4']);
export const gateFindingSchema=z.object({
  artifactId:z.uuid(),location:z.string().trim().min(1).max(500),
  severity:z.enum(['critical','major','minor']),scope:z.enum(['document','commercials']),
  description:z.string().trim().min(10).max(2000),evidence:z.string().trim().min(5).max(4000),
  previousFinding:z.object({reviewId:z.uuid(),index:z.number().int().min(0).max(999)}).strict().optional(),
}).strict();
export const gateFindingsSchema=z.array(gateFindingSchema).max(20);
export type GateFinding=z.infer<typeof gateFindingSchema>;
export type SavedGateFinding=GateFinding&{filename:string;sha256:string;qcEscape:boolean};
export type GateFeedback={id:string;stage_id:string;case_version:number;source_revision:number;note:string|null;findings:SavedGateFinding[]|null;escalation_required:boolean;return_stage:string;state:string;created_by:string;created_at:string;restricted:boolean;explanations:SavedExplanation[]|null;explanationCount:number;findingCount:number};

export function gateReturnStage(workflow:WorkflowId,stage:string,findings:Pick<GateFinding,'scope'>[]):string {
  if(stage==='W3-G3')return 'W3-17';if(stage==='W4-G3')return 'W4-18';
  if(stage==='W3-G4')return findings.length&&findings.every(f=>f.scope==='commercials')?'W3-20':'W3-17';
  if(stage==='W4-G4')return findings.length&&findings.every(f=>f.scope==='commercials')?'W4-23':'W4-18';
  const ordinary:Record<string,string>={'W1-G1':'W1-4','W1-G2':'W1-11','W2-G1':'W2-1','W3-G1':'W3-5','W3-G2':'W3-8','W4-G1':'W4-3','W4-G2':'W4-8','W5-G1':'W5-2','W6-G1':'W6-1','W6-G2':'W6-1','W7-G1':'W7-1','W8-G1':'W8-2','S1-G1':'S1-1','S1-G2':'S1-1'};
  if(!ordinary[stage])throw new HttpError(409,`No correction route exists for ${workflow} at this gate`);return ordinary[stage];
}
export function needsGateEscalation(stage:string,findings:Pick<SavedGateFinding,'severity'|'qcEscape'>[]){
  return documentGates.has(stage)&&findings.some(f=>f.severity!=='minor'||f.qcEscape);
}
export async function recordGateFeedback(db:PoolClient,c:CaseRecord,stage:string,user:Actor,note:string,input:GateFinding[]){
  if(documentGates.has(stage)&&!input.length)throw new HttpError(400,'Document gates require a file, location, severity and evidence for each issue');
  const findings:SavedGateFinding[]=[];
  let restricted=(await db.query("SELECT 1 FROM zora_sources WHERE case_id=$1 AND visibility='internal' LIMIT 1",[c.id])).rows.length>0;
  for(const finding of input){
    const artifact=(await db.query("SELECT a.id,a.filename,a.sha256,a.visibility,a.purpose,j.stage_id,$4::text AS workflow FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.id=$1 AND a.case_id=$2 AND a.source_revision=$3 AND a.lease_id=j.lease_id AND j.state='completed' AND a.purpose IN ('draft','reference','rfi_review')",[finding.artifactId,c.id,c.sourceRevision,c.workflow])).rows[0];
    if(!artifact||!canReadArtifact(user,artifact))throw new HttpError(422,'Select a reviewable file you can access from this pursuit revision');
    restricted ||= artifact.visibility==='internal';
    let qcEscape=true;
    if(finding.previousFinding){
      const previous=(await db.query("SELECT r.result,q.packet FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id WHERE r.id=$1 AND r.case_id=$2 AND q.source_revision=$3 AND r.state='completed'",[finding.previousFinding.reviewId,c.id,c.sourceRevision])).rows[0];
      if(previous?.packet?.files?.some((f:any)=>!canReadArtifact(user,{...f,workflow:c.workflow,stage_id:previous.packet.stageId})))throw new HttpError(422,'The linked QC finding is restricted to an internal reviewer');
      if(previous?.packet?.files?.some((f:any)=>f.visibility==='internal'))restricted=true;
      const logged=previous?.result?.findings?.[finding.previousFinding.index];
      const element=previous?.packet?.elements?.find((e:any)=>e.id===logged?.elementId);
      const file=previous?.packet?.files?.find((f:any)=>f.id===finding.artifactId);
      if(!logged||element?.fileId!==artifact.id||file?.sha256!==artifact.sha256)throw new HttpError(422,'The cited QC finding must concern these exact file bytes in this source revision');
      const rank={minor:0,major:1,critical:2};
      if(rank[finding.severity]<rank[logged.severity as keyof typeof rank])throw new HttpError(422,'A linked QC finding cannot be downgraded below its recorded severity');
      // Linking an unrelated old issue must not turn a new QC escape into ordinary rework.
      if(finding.description!==logged.description||finding.evidence!==logged.evidence||finding.location!==element.location)throw new HttpError(422,'Reuse the exact logged finding and location, or report this as a new issue');
      qcEscape=false;
    }
    findings.push({...finding,filename:artifact.filename,sha256:artifact.sha256,qcEscape});
  }
  const id=randomUUID(),escalation=needsGateEscalation(stage,findings),returnStage=gateReturnStage(c.workflow,stage,findings);
  await db.query('INSERT INTO zora_gate_feedback(id,case_id,stage_id,case_version,source_revision,created_by,note,findings,escalation_required,return_stage,restricted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,c.id,stage,c.version,c.sourceRevision,user.email,note,JSON.stringify(findings),escalation,returnStage,restricted]);
  return {id,escalationRequired:escalation,returnStage};
}
export async function readGateFeedback(db:Pool|PoolClient,caseId:string,user?:Actor):Promise<GateFeedback[]>{
  const rows=(await db.query("SELECT id,stage_id,case_version,source_revision,created_by,created_at,note,findings,escalation_required,return_stage,restricted,state,explanations,jsonb_array_length(explanations) AS \"explanationCount\",jsonb_array_length(findings) AS \"findingCount\" FROM zora_gate_feedback WHERE case_id=$1 ORDER BY (state IN ('open','reworking')) DESC,created_at DESC,id DESC LIMIT 50",[caseId])).rows;
  return rows.map(row=>({...row,...(user&&row.restricted&&!canReadInternal(user)?{note:null,findings:null}:{}),explanations:user&&!canReadInternal(user)?null:row.explanations}));
}
export async function requireEscalationResolved(db:PoolClient,caseId:string,stage:string){
  if(!documentGates.has(stage))return;
  if((await db.query("SELECT 1 FROM zora_gate_feedback WHERE case_id=$1 AND escalation_required AND state IN ('open','reworking') LIMIT 1",[caseId])).rows.length)
    throw new HttpError(409,'A document-gate escalation remains open. Record the explanation, fresh whole-document trust reset and independent rerun before approval; an ordinary revision cannot clear it.');
}
