/** Native cloud transport only. Never imported into the deployed application. */
let resolved:Promise<string>|undefined;
function usable(value:string|undefined):value is string{return !!value&&value.length>=32&&/^[A-Za-z0-9_-]+$/.test(value);}
export async function protectionBypass():Promise<string|undefined>{
  const supplied=process.env.ZORA_NOTIFICATION_BYPASS;
  if(!supplied)return undefined;
  if(usable(supplied))return supplied;
  // Resolve the existing value through Vercel's documented authenticated endpoint.
  // No binding is rewritten, new token created, or credential printed/persisted.
  const project=process.env.VERCEL_PROJECT_ID,team=process.env.VERCEL_ORG_ID;
  const host=new URL(process.env.ZORA_APP_URL||'').hostname;
  if(project!=='prj_CMo2oudsZpGIt0JiuYLjV5mPjcyA'||team!=='team_5DBsUWiufrEcP2odn32rtSJD'||!process.env.VERCEL_TOKEN||!(host==='zora-mindmap.vercel.app'||host.endsWith('-saurabhs-projects-b11d59ff.vercel.app')))throw new Error('ZORA_NOTIFICATION_BYPASS is malformed; securely bind the existing Zora-project Vercel automation token');
  resolved??=(async()=>{
    async function get(path:string){const r=await fetch(`https://api.vercel.com/v9/projects/${project}/env${path}`,{headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Existing Vercel automation token could not be retrieved securely');return r.json();}
    const query=`?teamId=${team}`;
    const list=await get(query);
    const matches=(list.envs||[]).filter((e:any)=>e.key==='ZORA_NOTIFICATION_BYPASS'&&e.target?.includes('production'));
    if(matches.length!==1)throw new Error('The existing production automation-token binding is ambiguous or absent');
    const env=await get(`/${encodeURIComponent(matches[0].id)}${query}&decrypt=true`);
    if(!usable(env.value))throw new Error('The existing Vercel automation-token value is invalid');
    return env.value as string;
  })();
  return resolved;
}
