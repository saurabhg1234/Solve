import { actor } from '@/lib/auth';
import { ready } from '@/lib/config';
export async function GET() {
  const user=await actor();
  return Response.json({ user,configured:ready().database&&ready().identity },{headers:{'Cache-Control':'no-store'}});
}
