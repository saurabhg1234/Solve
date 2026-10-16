import {requireRunner,responseError} from '@/lib/auth';
import {transaction} from '@/lib/db';
import {readDeliveryBody,recordDirectDelivery} from '@/lib/direct-deliveries';

export async function POST(request:Request){
  try{requireRunner(request);const input=await readDeliveryBody(request);const result=await transaction(db=>recordDirectDelivery(db,input));return Response.json(result,{status:result.alreadyStored?200:201,headers:{'Cache-Control':'no-store'}});}
  catch(e){return responseError(e);}
}
