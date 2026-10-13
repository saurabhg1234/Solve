import { requireRunner,responseError,HttpError } from '@/lib/auth';
import { beginArtifactUpload,uploadSchema } from '@/lib/uploads';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{requireRunner(request);const {id}=await context.params;const input=uploadSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,'Provide artifact metadata, size, hash and session lease');const upload=await beginArtifactUpload(id,input.data);return Response.json(upload,{status:upload.alreadyStored?200:201});}catch(e){return responseError(e);}
}
