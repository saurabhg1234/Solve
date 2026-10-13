import { requireActor,responseError } from '@/lib/auth';
import { accessCase } from '@/lib/cases';
import { stagesFor,taskInstructions } from '@/lib/engine';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireActor();const {id}=await context.params;const c=await accessCase(id,user);const stage=stagesFor(c.workflow)[c.stageIndex];
    const pack={version:1,case:c,stage,instructions:stage?taskInstructions(c.workflow,stage):'This pursuit has no remaining stage.',reference:'Read the BRD and source files in the saurabhg1234/Solve checkout. This pack is a handoff, not evidence of a completed Codex session. Human approvals remain in the portal.'};
    return new Response(JSON.stringify(pack,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="zora-${id}.json"`,'Cache-Control':'no-store'}});
  } catch(e){return responseError(e);}
}
