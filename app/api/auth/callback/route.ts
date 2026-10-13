import { cookies } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { appUrl,microsoftConfig } from '@/lib/config';
import { constantTimeEqual } from '@/lib/engine';
import { sessionToken,responseError,HttpError } from '@/lib/auth';

export async function GET(request:Request) {
  try {
    const jar=await cookies();const saved=jar.get('zora_oauth')?.value;jar.delete('zora_oauth');
    const url=new URL(request.url);const code=url.searchParams.get('code');const state=url.searchParams.get('state');
    if(!saved||!code||!state) throw new HttpError(400,'Sign-in expired. Please start again.');
    const proof=JSON.parse(saved);if(!constantTimeEqual(state,proof.state)) throw new HttpError(400,'Invalid sign-in state');
    const ms=microsoftConfig();if(!ms.tenant||!ms.client||!ms.secret) throw new HttpError(503,'Sign-in is not configured');
    const token=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(ms.tenant)}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:ms.client,client_secret:ms.secret,grant_type:'authorization_code',code,redirect_uri:`${appUrl()}/api/auth/callback`,code_verifier:proof.verifier}),signal:AbortSignal.timeout(20000)});
    if(!token.ok) throw new HttpError(502,'Microsoft could not complete sign-in');
    const body=await token.json();if(typeof body.id_token!=='string') throw new HttpError(502,'Microsoft did not return an identity token');
    const issuer=`https://login.microsoftonline.com/${ms.tenant}/v2.0`;
    const {payload}=await jwtVerify(body.id_token,createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${ms.tenant}/discovery/v2.0/keys`)),{issuer,audience:ms.client,algorithms:['RS256']});
    if(payload.nonce!==proof.nonce||payload.tid!==ms.tenant) throw new HttpError(403,'Identity verification failed');
    const email=String(payload.preferred_username||payload.email||'').toLowerCase();
    const allowed=(process.env.ZORA_ALLOWED_EMAILS||'').toLowerCase().split(',').map(v=>v.trim());
    if(!email||!allowed.includes(email)) throw new HttpError(403,'This work account is not enabled for Zora');
    jar.set('zora_session',await sessionToken(email,String(payload.name||email)),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800});
    return Response.redirect(appUrl(),302);
  } catch(e){return responseError(e);}
}
