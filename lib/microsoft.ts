import { randomUUID } from 'node:crypto';
import { notificationUrl,microsoftConfig } from './config';
import { database,transaction } from './db';
import { ownsMessage } from './email';
import { HttpError } from './auth';
import { cleanFilename,FILE_LIMIT,hashBytes } from './files';

let cached: {token:string;until:number}|undefined;
export function safeGraphUrl(pathOrUrl:string):string {
  const url=new URL(pathOrUrl,'https://graph.microsoft.com/v1.0/');
  if(url.origin!=='https://graph.microsoft.com'||!url.pathname.startsWith('/v1.0/')) throw new Error('Invalid Microsoft continuation URL');
  return url.href;
}
async function token() {
  if(cached && cached.until>Date.now()) return cached.token;
  const ms=microsoftConfig();if(!ms.tenant||!ms.client||!ms.secret) throw new HttpError(503,'Microsoft credentials are not configured');
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(ms.tenant)}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:ms.client,client_secret:ms.secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new HttpError(502,'Microsoft application authentication failed');
  const data=await response.json();if(typeof data.access_token!=='string') throw new HttpError(502,'Microsoft did not return an access token');
  cached={token:data.access_token,until:Date.now()+Math.max(0,Number(data.expires_in)-120)*1000};return cached.token;
}
export async function graph(path:string,init:RequestInit={}) {
  const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${await token()}`);headers.set('Prefer','IdType="ImmutableId", outlook.body-content-type="text"');
  if(init.body) headers.set('Content-Type','application/json');
  const response=await fetch(safeGraphUrl(path),{...init,headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new HttpError(502,`Microsoft mailbox operation failed (${response.status})`);
  return response.status===204?{}:response.json();
}

async function attachmentBytes(path:string):Promise<Buffer> {
  const response=await fetch(safeGraphUrl(path),{headers:{Authorization:`Bearer ${await token()}`},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new HttpError(502,`Microsoft attachment retrieval failed (${response.status})`);
  if(Number(response.headers.get('content-length'))>FILE_LIMIT)throw new HttpError(413,'An email attachment exceeds the 32 MB limit');
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'Microsoft returned no attachment body');
  const chunks:Buffer[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>FILE_LIMIT){await reader.cancel();throw new HttpError(413,'An email attachment exceeds the 32 MB limit');}chunks.push(Buffer.from(value));}
  if(!size)throw new HttpError(422,'An email attachment is empty');return Buffer.concat(chunks);
}
export async function emailAttachments(mailbox:string,messageId:string,io={json:graph,bytes:attachmentBytes}) {
  const ms=microsoftConfig();
  if(mailbox.toLowerCase()!==ms.mailbox.toLowerCase())throw new HttpError(403,'This message is outside the configured Zora mailbox');
  const prefix=`users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}`;
  const message=await io.json(`${prefix}?$select=id,parentFolderId,subject,categories`);
  if(message.parentFolderId!==ms.folder||!ownsMessage(message.subject||'',message.categories||[],ms.tag))throw new HttpError(409,'The email is no longer an explicitly routed Zora request');
  const files:{filename:string;mimeType:string;data:Buffer;sha256:string;provenance:Record<string,unknown>}[]=[];
  let link:string|undefined=`${prefix}/attachments?$select=id,name,contentType,size,isInline`;let total=0;
  for(let page=0;link&&page<5;page++){
    const result=await io.json(link);
    if(!Array.isArray(result.value))throw new HttpError(502,'Microsoft returned an invalid attachment list');
    for(const item of result.value){
      if(item['@odata.type']!=='#microsoft.graph.fileAttachment')throw new HttpError(422,`Provide a file copy of the linked or nested attachment: ${cleanFilename(String(item.name||'attachment'))}`);
      if(files.length>=12||Number(item.size)>FILE_LIMIT||total+Number(item.size||0)>64*1024*1024)throw new HttpError(413,'Email intake supports up to 12 files, 32 MB per file and 64 MB total; provide larger inputs separately');
      const data=await io.bytes(`${prefix}/attachments/${encodeURIComponent(item.id)}/$value`);total+=data.length;
      if(total>64*1024*1024)throw new HttpError(413,'Email attachments exceed the 64 MB intake limit');
      const mimeType=/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(item.contentType||'')?item.contentType:'application/octet-stream';
      files.push({filename:cleanFilename(String(item.name||'attachment')),mimeType,data,sha256:hashBytes(data),provenance:{kind:'email_attachment',mailbox,messageId,attachmentId:item.id,originalFilename:String(item.name||'attachment'),inline:!!item.isInline}});
    }
    link=result['@odata.nextLink'];if(link)safeGraphUrl(link);
  }
  if(link)throw new HttpError(413,'The attachment list exceeds the intake limit');return files;
}

export async function renewSubscription() {
  const ms=microsoftConfig();const secret=process.env.ZORA_WEBHOOK_SECRET;
  if(!ms.folder||!secret||secret.length<32||secret.length>128) throw new HttpError(503,'Zora folder and webhook verification need configuration');
  const db=database();const row=(await db.query('SELECT * FROM zora_mail_state WHERE mailbox=$1',[ms.mailbox])).rows[0];
  if(row?.folder_id && row.folder_id!==ms.folder) throw new HttpError(409,'Mailbox folder changed; archive the previous sync state before reconnecting');
  if(row?.subscription_id && new Date(row.subscription_expires_at).getTime()>Date.now()+24*60*60*1000) return {renewed:false};
  const expires=new Date(Date.now()+5*24*60*60*1000).toISOString();
  let subscription;
  if(row?.subscription_id) {
    try {subscription=await graph(`subscriptions/${encodeURIComponent(row.subscription_id)}`,{method:'PATCH',body:JSON.stringify({expirationDateTime:expires})});}
    catch(error) {
      // Recreate only after confirming the subscription itself no longer exists.
      if(error instanceof HttpError && error.message.endsWith('(404)')) subscription=undefined;else throw error;
    }
  }
  if(!subscription) subscription=await graph('subscriptions',{method:'POST',body:JSON.stringify({changeType:'created',notificationUrl:notificationUrl(),lifecycleNotificationUrl:notificationUrl(),resource:`users/${ms.mailbox}/mailFolders/${ms.folder}/messages`,expirationDateTime:expires,clientState:secret})});
  await db.query('INSERT INTO zora_mail_state(mailbox,folder_id,subscription_id,subscription_expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(mailbox) DO UPDATE SET subscription_id=$3,subscription_expires_at=$4',[ms.mailbox,ms.folder,subscription.id,subscription.expirationDateTime]);
  return {renewed:true,expires:subscription.expirationDateTime};
}

export async function syncMailbox() {
  const ms=microsoftConfig();if(!ms.folder) throw new HttpError(503,'Select the Zora mail folder before monitoring');
  const db=database();await db.query('INSERT INTO zora_mail_state(mailbox,folder_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ms.mailbox,ms.folder]);
  const lease=randomUUID();
  const claim=await db.query("UPDATE zora_mail_state SET syncing_until=now()+interval '55 seconds',sync_lease=$3 WHERE mailbox=$1 AND folder_id=$2 AND (syncing_until IS NULL OR syncing_until<now()) RETURNING *",[ms.mailbox,ms.folder,lease]);
  if(!claim.rows[0]) return {synced:0,busy:true};
  let synced=0;
  const base=`users/${encodeURIComponent(ms.mailbox)}/mailFolders/${encodeURIComponent(ms.folder)}/messages/delta?$select=id,subject,from,body,receivedDateTime,hasAttachments,categories`;
  let link:string=claim.rows[0].delta_link||base;
  try {
    const started=Date.now();
    for(let page=0;page<5 && Date.now()-started<35000;page++) {
      const data=await graph(link);
      if(!Array.isArray(data.value)) throw new HttpError(502,'Microsoft returned an invalid mailbox page');
      for(const item of data.value) {
        if(item['@removed'] || !item.id) continue;
        const owned=ownsMessage(String(item.subject||''),item.categories||[],ms.tag);
        await transaction(async client=>{
          const receipt=await client.query('INSERT INTO zora_mail_receipts(mailbox,message_id,disposition) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING message_id',[ms.mailbox,item.id,owned?'zora':'ignored']);
          if(!receipt.rows.length||!owned) return;
          // Mail is never marked read, moved, categorised or deleted. Jarvis retains its own state.
          await client.query('INSERT INTO zora_inbox(id,mailbox,message_id,subject,sender,body_text,received_at,attachment_notice) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),ms.mailbox,item.id,String(item.subject||'').slice(0,500),String(item.from?.emailAddress?.address||''),String(item.body?.content||''),item.receivedDateTime||new Date().toISOString(),item.hasAttachments?'File attachments will be imported when a pursuit is created.':null]);
          synced++;
        });
      }
      const next=data['@odata.nextLink']||data['@odata.deltaLink'];
      if(typeof next!=='string') throw new HttpError(502,'Microsoft did not supply a continuation cursor');
      safeGraphUrl(next);link=next;
      const checkpoint=await db.query('UPDATE zora_mail_state SET delta_link=$2,last_sync_at=now() WHERE mailbox=$1 AND sync_lease=$3',[ms.mailbox,link,lease]);
      if(!checkpoint.rowCount)throw new HttpError(409,'Mailbox sync lease changed');
      if(!data['@odata.nextLink']) break;
    }
    await db.query('UPDATE zora_mail_signals SET processed_at=now() WHERE mailbox=$1 AND processed_at IS NULL AND created_at<=$2',[ms.mailbox,new Date(started)]);
    return {synced,busy:false};
  } finally {await db.query('UPDATE zora_mail_state SET syncing_until=NULL,sync_lease=NULL WHERE mailbox=$1 AND sync_lease=$2',[ms.mailbox,lease]);}
}
