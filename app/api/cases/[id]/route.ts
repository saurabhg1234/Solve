import { requireActor, responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor } from '@/lib/engine';
import { database } from '@/lib/db';
import { canReadInternal } from '@/lib/files';

export async function GET(_request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const user=await requireActor(); const {id}=await context.params; const c=await accessCase(id,user);
    const events=await database().query('SELECT type,actor,created_at FROM zora_events WHERE case_id=$1 ORDER BY id DESC LIMIT 100',[id]);
    const sources=await database().query('SELECT id,filename,mime_type,sha256,octet_length(data)::int AS size,provenance,created_at FROM zora_sources WHERE case_id=$1 ORDER BY created_at',[id]);
    const artifacts=await database().query('SELECT a.id,a.filename,a.mime_type,a.sha256,a.visibility,a.case_version,a.source_revision,octet_length(a.data)::int AS size,a.created_at,j.stage_id,j.state FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.case_id=$1 AND (a.visibility=$2 OR $3) AND a.lease_id=j.lease_id ORDER BY a.created_at DESC',[id,'client',canReadInternal(user)]);
    const team=await database().query('SELECT email FROM zora_case_members WHERE case_id=$1 ORDER BY email',[id]);
    const manage=user.roles.includes('admin')||c.requestedBy===user.email;
    const tasks=await database().query('SELECT stage_id,state,result->>$2 AS summary,result-> $3 AS missing_inputs FROM zora_jobs WHERE case_id=$1 AND state=$4 ORDER BY completed_at DESC LIMIT 1',[id,'summary','missingInputs','blocked']);
    return Response.json({case:c,stages:stagesFor(c.workflow).map(s=>({id:s.id,title:s.title,kind:s.kind,approvers:s.approvers})),events:events.rows,sources:sources.rows,artifacts:artifacts.rows,team:team.rows.map(r=>r.email),canManage:manage,availableTeam:manage?(process.env.ZORA_ALLOWED_EMAILS||'').split(',').map(e=>e.trim()).filter(Boolean):[],blockedTask:tasks.rows[0]||null},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return responseError(e);}
}
