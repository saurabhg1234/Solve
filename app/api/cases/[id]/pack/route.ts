import { requireActor,responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor,taskInstructions } from '@/lib/engine';
import { database } from '@/lib/db';
import { canReadInternal } from '@/lib/files';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireActor();const {id}=await context.params;const c=await accessCase(id,user);const stage=stagesFor(c.workflow)[c.stageIndex];
    const sources=(await database().query('SELECT id,filename,mime_type,sha256,octet_length(data)::int AS size,provenance FROM zora_sources WHERE case_id=$1',[id])).rows;
    const artifacts=(await database().query('SELECT id,filename,mime_type,sha256,visibility,source_revision,octet_length(data)::int AS size FROM zora_artifacts WHERE case_id=$1 AND (visibility=$2 OR $3)',[id,'client',canReadInternal(user)])).rows;
    const pack={version:2,case:c,stage,sources,artifacts,instructions:stage?taskInstructions(c.workflow,stage):'This pursuit has no remaining stage.',reference:'Read actual source files and current-revision artifacts in the saurabhg1234/Solve checkout or protected portal downloads. This pack is a handoff, not evidence of a completed Codex session. Human approvals remain in the portal.'};
    return new Response(JSON.stringify(pack,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="zora-${id}.json"`,'Cache-Control':'no-store'}});
  } catch(e){return responseError(e);}
}
