import { requireActor,requireSameOrigin,responseError } from '@/lib/auth';
import { appendUpload,finishUpload } from '@/lib/uploads';
import { readUploadChunk } from '@/lib/files';
export async function PUT(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id,uploadId}=await context.params;return Response.json(await appendUpload(uploadId,{kind:'source',caseId:id,user},Number(request.headers.get('x-zora-offset')),await readUploadChunk(request)));}catch(e){return responseError(e);}
}
export async function POST(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id,uploadId}=await context.params;return Response.json(await finishUpload(uploadId,{kind:'source',caseId:id,user}));}catch(e){return responseError(e);}
}
