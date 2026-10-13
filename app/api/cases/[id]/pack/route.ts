import { requireActor,responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor,taskInstructions } from '@/lib/engine';
import { database } from '@/lib/db';
import { canReadInternal,canReviewRfi } from '@/lib/files';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireActor();const {id}=await context.params;const c=await accessCase(id,user);const stage=stagesFor(c.workflow)[c.stageIndex];
    const sources=(await database().query("SELECT id,filename,mime_type,sha256,visibility,octet_length(data)::int AS size,provenance FROM zora_sources WHERE case_id=$1 AND active AND (visibility='client' OR $2)",[id,canReadInternal(user)])).rows;
    const artifacts=(await database().query("SELECT a.id,a.filename,a.mime_type,a.sha256,a.visibility,a.purpose,a.source_revision,octet_length(a.data)::int AS size FROM zora_artifacts a JOIN zora_jobs j ON j.id=a.job_id WHERE a.case_id=$1 AND a.lease_id=j.lease_id AND (a.visibility=$2 OR $3 OR ($4 AND a.purpose='rfi_review' AND j.stage_id='W5-11'))",[id,'client',canReadInternal(user),c.workflow==='W5'&&canReviewRfi(user)])).rows;
    const pack={version:2,case:c,stage,sources,artifacts,instructions:stage?taskInstructions(c.workflow,stage):'This pursuit has no remaining stage.',reference:'Read actual source files and current-revision artifacts in the saurabhg1234/Solve checkout or protected portal downloads. This pack is a handoff, not evidence of a completed Codex session. Human approvals remain in the portal.'};
    return new Response(JSON.stringify(pack,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="zora-${id}.json"`,'Cache-Control':'no-store'}});
  } catch(e){return responseError(e);}
}
