import { requireRunner,responseError } from '@/lib/auth';
import { appendUpload,finishUpload } from '@/lib/uploads';
import { readUploadChunk } from '@/lib/files';
export async function PUT(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireRunner(request);const {id,uploadId}=await context.params;return Response.json(await appendUpload(uploadId,{kind:'artifact',jobId:id,leaseId:request.headers.get('x-zora-lease')||''},Number(request.headers.get('x-zora-offset')),await readUploadChunk(request)));}catch(e){return responseError(e);}
}
export async function POST(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireRunner(request);const {id,uploadId}=await context.params;const body=await request.json();return Response.json(await finishUpload(uploadId,{kind:'artifact',jobId:id,leaseId:String(body.leaseId||'')}));}catch(e){return responseError(e);}
}
