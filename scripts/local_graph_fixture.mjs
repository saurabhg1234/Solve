/** Preloaded only by the isolated local integration server. Never part of deployed routes. */
if(process.env.NODE_ENV!=='development'||process.env.MS_ZORA_MAILBOX!=='local-fixture')throw new Error('Graph fixtures require the isolated development mailbox');
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'synthetic-local-graph-token',expires_in:3600});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  const path=decodeURIComponent(url.pathname);
  if(!path.startsWith('/v1.0/users/local-fixture/messages/fixture-'))throw new Error('Unexpected Graph fixture request; real mailbox calls are not permitted');
  if(path.endsWith('/$value'))return new Response('Synthetic inline attachment bytes.',{headers:{'Content-Type':'text/plain'}});
  if(path.endsWith('/attachments'))return Response.json({value:path.includes('/fixture-inline-')?[{'@odata.type':'#microsoft.graph.fileAttachment',id:'inline-attachment',name:'inline-evidence.txt',contentType:'text/plain',size:34,isInline:true}]:[]});
  return Response.json({parentFolderId:'fixture-folder',subject:'[ZORA] Synthetic local email fixture',categories:[]});
};
