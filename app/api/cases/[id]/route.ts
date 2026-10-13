import { requireActor, responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor } from '@/lib/engine';
import { database } from '@/lib/db';
import { canReadInternal,canReviewRfi } from '@/lib/files';
import { knowledgeHolds } from '@/lib/knowledge';

export async function GET(_request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const user=await requireActor(); const {id}=await context.params; const c=await accessCase(id,user);
    const events=await database().query('SELECT type,actor,created_at FROM zora_events WHERE case_id=$1 ORDER BY id DESC LIMIT 100',[id]);
    const sources=await database().query("SELECT id,filename,mime_type,sha256,visibility,octet_length(data)::int AS size,provenance,active,created_at FROM zora_sources WHERE case_id=$1 AND (visibility='client' OR $2) ORDER BY created_at",[id,canReadInternal(user)]);
    const artifacts=await database().query("SELECT a.id,a.filename,a.mime_type,a.sha256,a.visibility,a.purpose,a.case_version,a.source_revision,octet_length(a.data)::int AS size,a.created_at,j.stage_id,j.state FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.case_id=$1 AND (a.visibility=$2 OR $3 OR ($4 AND a.purpose='rfi_review' AND j.stage_id='W5-11')) AND a.lease_id=j.lease_id ORDER BY a.created_at DESC",[id,'client',canReadInternal(user),c.workflow==='W5'&&canReviewRfi(user)]);
    const team=await database().query('SELECT email FROM zora_case_members WHERE case_id=$1 ORDER BY email',[id]);
    const manage=user.roles.includes('admin')||c.requestedBy===user.email;
    const tasks=c.status==='blocked'?await database().query('SELECT stage_id,state,result->>$2 AS summary,result-> $3 AS missing_inputs FROM zora_jobs WHERE case_id=$1 AND state=$4 AND stage_id=$5 AND source_revision=$6 ORDER BY completed_at DESC NULLS LAST,created_at DESC LIMIT 1',[id,'summary','missingInputs','blocked',stagesFor(c.workflow)[c.stageIndex]?.id,c.sourceRevision]):{rows:[]};
    const privateInputs=!canReadInternal(user)&&(await database().query("SELECT 1 FROM zora_sources WHERE case_id=$1 AND visibility='internal' LIMIT 1",[id])).rows.length>0;
    if(privateInputs&&tasks.rows[0])tasks.rows[0]={...tasks.rows[0],summary:'Internal work needs input. Assigned pricing/internal reviewers can inspect the details.',missing_inputs:['Private source details are available to assigned pricing/internal reviewers.']};
    const reviewRows=(await database().query("SELECT id,state,loop_number,clean_streak,missing_inputs,packet->>'stageId' AS stage_id,jsonb_array_length(packet->'elements') AS elements,EXISTS(SELECT 1 FROM jsonb_array_elements(packet->'files') f WHERE f->>'visibility'='internal' AND (coalesce(f->>'purpose','')<>'rfi_review' OR NOT $2)) AS internal FROM zora_qc_runs WHERE case_id=$1 ORDER BY created_at DESC LIMIT 5",[id,c.workflow==='W5'&&canReviewRfi(user)])).rows;
    const reviews=[];
    for(const run of reviewRows){const visible=!run.internal||canReadInternal(user);const passes=(await database().query("SELECT checker,pass_number,loop_number,state,coalesce(jsonb_array_length(result->'checkedElementIds'),0) AS checked,coalesce(jsonb_array_length(result->'findings'),0) AS \"findingCount\",CASE WHEN $2 THEN result->'findings' ELSE null END AS findings FROM zora_reviews WHERE run_id=$1 ORDER BY loop_number,sequence,created_at,pass_number",[run.id,visible])).rows;reviews.push({id:run.id,state:run.state,stageId:run.stage_id,loop:run.loop_number,cleanStreak:run.clean_streak,elementCount:run.elements,restricted:!visible,missingInputs:visible?run.missing_inputs:[],passes});}
    return Response.json({case:c,stages:stagesFor(c.workflow).map(s=>({id:s.id,title:s.title,kind:s.kind,approvers:s.approvers})),events:events.rows,sources:sources.rows,artifacts:artifacts.rows,team:team.rows.map(r=>r.email),canManage:manage,canUploadInternal:canReadInternal(user),availableTeam:manage?(process.env.ZORA_ALLOWED_EMAILS||'').split(',').map(e=>e.trim()).filter(Boolean):[],blockedTask:tasks.rows[0]||null,reviews,sourceNotices:await knowledgeHolds(database(),id)},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return responseError(e);}
}
