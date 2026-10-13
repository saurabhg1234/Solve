import { cookies } from 'next/headers';
import { requireSameOrigin,responseError } from '@/lib/auth';
export async function POST(request:Request) {
  try {requireSameOrigin(request);(await cookies()).delete('zora_session');return Response.json({ok:true});}
  catch(e){return responseError(e);}
}
