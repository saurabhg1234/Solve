import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import {z} from 'zod';
import {sourceContextSchema} from '@/lib/source-context';
import { appendUpload,finishUpload } from '@/lib/uploads';
import { readUploadChunk } from '@/lib/files';
export async function PUT(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id,uploadId}=await context.params;return Response.json(await appendUpload(uploadId,{kind:'source',caseId:id,user},Number(request.headers.get('x-zora-offset')),await readUploadChunk(request)));}catch(e){return responseError(e);}
}
export async function POST(request:Request,context:{params:Promise<{id:string;uploadId:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id,uploadId}=await context.params;const text=await request.text();let body:unknown;try{body=text?JSON.parse(text):{};}catch{throw new HttpError(400,'Provide valid source context JSON');}const input=z.object({sourceContext:sourceContextSchema.optional()}).strict().safeParse(body);if(!input.success)throw new HttpError(400,'Source context must contain a valid category, label up to 100 characters and notes up to 3,000 characters');return Response.json(await finishUpload(uploadId,{kind:'source',caseId:id,user},input.data.sourceContext));}catch(e){return responseError(e);}
}
