import {randomUUID} from 'node:crypto';
import {database,transaction} from './db';
import {microsoftConfig} from './config';
import {graph,safeGraphUrl} from './microsoft';
import {HttpError} from './auth';

/** A verified, explicitly registered conversation is the scope. Jarvis and our own messages stay excluded. */
export function isThreadReply(item:any,conversationId:string,mailbox:string):boolean{
  return typeof item.id==='string'&&!!item.id&&!item['@removed']&&!item.isDraft&&item.conversationId===conversationId&&
    !String(item.subject||'').toUpperCase().includes('[JARVIS]')&&
    !(Array.isArray(item.categories)?item.categories:[]).some((c:unknown)=>typeof c==='string'&&c.toLowerCase()==='jarvis')&&
    typeof item.from?.emailAddress?.address==='string'&&item.from.emailAddress.address.toLowerCase()!==mailbox.toLowerCase();
}

/** One bounded page per maintenance invocation, with a durable cursor and exclusive expiring lease. */
export async function syncRegisteredThread(io={graph}){
  const ms=microsoftConfig(),db=database(),lease=randomUUID();
  const thread=(await db.query("UPDATE zora_mail_threads SET sync_lease=$2,syncing_until=now()+interval '55 seconds' WHERE (mailbox,conversation_id)=(SELECT mailbox,conversation_id FROM zora_mail_threads WHERE mailbox=$1 AND enabled AND (syncing_until IS NULL OR syncing_until<now()) ORDER BY checked_at NULLS FIRST,registered_at,conversation_id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",[ms.mailbox,lease])).rows[0];
  if(!thread)return {synced:0,checked:0};
  const started=thread.scan_started_at?new Date(thread.scan_started_at):new Date();
  let synced=0;
  try{
    const filter=`receivedDateTime ge ${new Date(thread.scan_from).toISOString()} and receivedDateTime le ${started.toISOString()} and conversationId eq '${thread.conversation_id.replaceAll("'","''")}'`;
    const link=thread.next_link||`users/${encodeURIComponent(ms.mailbox)}/messages?`+new URLSearchParams({'$filter':filter,'$orderby':'receivedDateTime asc','$top':'50','$select':'id,subject,from,body,receivedDateTime,hasAttachments,categories,conversationId,isDraft'});
    safeGraphUrl(link);const page=await io.graph(link);
    if(!Array.isArray(page.value)||page.value.length>100)throw new HttpError(502,'Microsoft returned an invalid correspondence page');
    const next=page['@odata.nextLink'];if(next!==undefined){if(typeof next!=='string')throw new HttpError(502,'Microsoft returned an invalid correspondence cursor');safeGraphUrl(next);}
    for(const item of page.value){
      if(!isThreadReply(item,thread.conversation_id,ms.mailbox))continue;
      if(!item.receivedDateTime||!Number.isFinite(Date.parse(item.receivedDateTime)))throw new HttpError(502,'Correspondence is missing its received time');
      await transaction(async client=>{
        // The lease and registration are checked again under lock before persisting correspondence.
        const active=(await client.query('SELECT 1 FROM zora_mail_threads WHERE mailbox=$1 AND conversation_id=$2 AND enabled AND sync_lease=$3 AND syncing_until>now() AND case_id=$4 FOR UPDATE',[ms.mailbox,thread.conversation_id,lease,thread.case_id])).rows.length;
        if(!active)throw new HttpError(409,'Correspondence monitoring lease changed');
        const receipt=await client.query("INSERT INTO zora_mail_receipts(mailbox,message_id,case_id,disposition) VALUES($1,$2,$3,'zora_thread') ON CONFLICT(mailbox,message_id) DO UPDATE SET case_id=excluded.case_id,disposition=excluded.disposition WHERE zora_mail_receipts.disposition='ignored' RETURNING message_id",[ms.mailbox,item.id,thread.case_id]);
        if(!receipt.rows.length)return;
        const inboxId=randomUUID();
        const saved=await client.query('INSERT INTO zora_inbox(id,mailbox,message_id,subject,sender,body_text,received_at,attachment_notice,conversation_id,case_id,triage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(mailbox,message_id) DO NOTHING RETURNING id',[inboxId,ms.mailbox,item.id,String(item.subject||'').slice(0,500),item.from.emailAddress.address,String(item.body?.content||''),item.receivedDateTime,item.hasAttachments?'Reply has attachments; review them before changing pursuit sources.':null,thread.conversation_id,thread.case_id,JSON.stringify({state:'related',relatedCaseId:thread.case_id,reason:'Reply in a registered Zora conversation; no source change or approval inferred'})]);
        if(saved.rows.length){await client.query("INSERT INTO zora_events(case_id,type,actor,data) VALUES($1,'mailbox.reply_received','zora-mail-monitor',$2)",[thread.case_id,JSON.stringify({inboxId,messageId:item.id,receivedAt:item.receivedDateTime})]);synced++;}
      });
    }
    const result=await db.query('UPDATE zora_mail_threads SET checked_at=now(),next_link=$4,scan_started_at=$5,scan_from=CASE WHEN $4::text IS NULL THEN $6 ELSE scan_from END WHERE mailbox=$1 AND conversation_id=$2 AND sync_lease=$3 AND enabled AND syncing_until>now()',[ms.mailbox,thread.conversation_id,lease,next||null,next?started:null,new Date(Math.max(new Date(thread.scan_from).getTime(),started.getTime()-60000))]);
    if(!result.rowCount)throw new HttpError(409,'Correspondence monitoring lease changed');
    return {synced,checked:1,more:!!next};
  }finally{await db.query('UPDATE zora_mail_threads SET syncing_until=NULL,sync_lease=NULL WHERE mailbox=$1 AND conversation_id=$2 AND sync_lease=$3',[ms.mailbox,thread.conversation_id,lease]);}
}
