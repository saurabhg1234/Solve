import {z} from 'zod';
import {requireActor,requireSameOrigin,responseError,HttpError} from '@/lib/auth';
import {accessCase,requireCaseManager} from '@/lib/cases';
import {transaction} from '@/lib/db';
import {beginExistingDraftReview,cancelExistingDraftReview,existingReviewSchema} from '@/lib/existing-draft-review';

export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const parsed=existingReviewSchema.safeParse(await request.json());
    if(!parsed.success)throw new HttpError(400,'Select distinct draft and evidence files, and provide meeting notes or requirements (10–20,000 characters)');
    const result=await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);
      return beginExistingDraftReview(db,c,user,parsed.data);
    });
    return Response.json(result,{status:201});
  }catch(error){return responseError(error);}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);const user=await requireActor();const {id}=await context.params;
    const parsed=z.object({version:z.number().int().positive(),runId:z.uuid()}).strict().safeParse(await request.json());
    if(!parsed.success)throw new HttpError(400,'Select the current review version');
    await transaction(async db=>{
      await db.query('SELECT id FROM zora_cases WHERE id=$1 FOR UPDATE',[id]);const c=await accessCase(id,user,db);requireCaseManager(c,user);
      await cancelExistingDraftReview(db,c,user,parsed.data.version,parsed.data.runId);
    });return Response.json({cancelled:true});
  }catch(error){return responseError(error);}
}
