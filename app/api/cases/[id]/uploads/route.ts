import { requireActor,requireSameOrigin,responseError,HttpError } from '@/lib/auth';
import { beginSourceUpload,uploadSchema } from '@/lib/uploads';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;const input=uploadSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,'Provide filename, media type, size, SHA-256 and current pursuit version');return Response.json(await beginSourceUpload(id,input.data,user),{status:201});}catch(e){return responseError(e);}
}
