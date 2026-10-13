import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { appUrl, microsoftConfig } from '@/lib/config';
import { responseError, HttpError } from '@/lib/auth';

export async function GET() {
  try {
    const ms=microsoftConfig(); if(!ms.tenant||!ms.client||!process.env.ZORA_SESSION_SECRET||!process.env.ZORA_ALLOWED_EMAILS) throw new HttpError(503,'Microsoft work-account sign-in needs configuration');
    const state=randomBytes(24).toString('base64url');const nonce=randomBytes(24).toString('base64url');const verifier=randomBytes(48).toString('base64url');
    const jar=await cookies();jar.set('zora_oauth',JSON.stringify({state,nonce,verifier}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/auth'});
    const url=new URL(`https://login.microsoftonline.com/${encodeURIComponent(ms.tenant)}/oauth2/v2.0/authorize`);
    url.search=new URLSearchParams({client_id:ms.client,response_type:'code',response_mode:'query',redirect_uri:`${appUrl()}/api/auth/callback`,scope:'openid profile email',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
    return Response.redirect(url,302);
  } catch(e){return responseError(e);}
}
