import { database } from './db';
import { actorFor } from './auth';
import { createCase } from './cases';
import { workflowIds,type WorkflowId } from './catalogue';

/**
 * Automatic intake proposes a pursuit from an explicitly tagged Zora email. It never confirms
 * routing for W1/W3–W7 (a consultant still confirms), never sends mail and never touches Jarvis mail.
 */
export type Proposal={workflow:WorkflowId|null;basis:'explicit'|'keywords'|'none'|'ambiguous';reason:string};
const signals:Record<WorkflowId,RegExp[]>={
  W1:[/\bintro(?:duction|ductory)? (?:deck|presentation)\b/,/\bexploratory\b/,/\bcompany (?:deck|introduction)\b/,/\bpain points?\b/],
  W2:[/\b(?:existing|relevant) demos?\b/,/\bdemo (?:shortlist|showcase|library)\b/,/\bshowcase\b/],
  W3:[/\btranscript\b/,/\b(?:call|meeting|discovery) (?:notes|recording)\b/,/\bproposal from (?:the )?(?:call|meeting)\b/],
  W4:[/\brfp\b/,/\brfq\b/,/\btender\b/,/\brequest for proposal\b/,/\bbid (?:response|submission)\b/],
  W5:[/\brfi\b/,/\bclarifications?\b/,/\bpre-?bid (?:queries|questions)\b/,/\bquestions? (?:for|to) the buyer\b/],
  W6:[/\bbuild (?:a |the )?demo\b/,/\bdemo build\b/,/\bproof of concept build\b/],
  W7:[/\b(?:walkthrough|walk-through) video\b/,/\bdemo video\b/,/\brecord (?:a |the )?demo\b/],
  W8:[/\b(?:draft|write) (?:an? |the )?(?:email|reply|response email)\b/,/\bemail draft\b/,/\bfollow-?up email\b/],
};
export function plainText(html:string){
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/p>|<\/div>/gi,'\n\n').replace(/<br\s*\/?>|<\/li>/gi,'\n').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&')
    .split('\n').map(line=>line.replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function proposeWorkflow(subject:string,body:string):Proposal{
  const explicit=[...new Set([...subject.toUpperCase().matchAll(/\bW([1-8])\b/g)].map(m=>`W${m[1]}` as WorkflowId))];
  if(explicit.length===1)return {workflow:explicit[0],basis:'explicit',reason:`Subject names ${explicit[0]}`};
  if(explicit.length>1)return {workflow:null,basis:'ambiguous',reason:`Subject names several workflows: ${explicit.join(', ')}`};
  const text=`${subject}\n${body}`.toLowerCase();
  const scores=workflowIds.map(id=>({id,score:signals[id].filter(p=>p.test(text)).length})).filter(s=>s.score>0).sort((a,b)=>b.score-a.score);
  if(!scores.length)return {workflow:null,basis:'none',reason:'No workflow could be identified from the request'};
  if(scores[1]?.score===scores[0].score)return {workflow:null,basis:'ambiguous',reason:`Request matches ${scores.filter(s=>s.score===scores[0].score).map(s=>s.id).join(' and ')} equally`};
  return {workflow:scores[0].id,basis:'keywords',reason:`Request wording matches ${scores[0].id}`};
}
export function pursuitTitle(subject:string,tag:string){
  const title=subject.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),' ').replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i,'').replace(/\bW[1-8]\b\s*[:-]?/i,'').replace(/\s+/g,' ').trim();
  return (title.length>=3?title:'Email request').slice(0,200);
}

/** Process up to five untriaged messages. Each row is claimed atomically, so overlapping runs cannot duplicate pursuits. */
export async function autoIntake(tag=process.env.ZORA_SUBJECT_TAG||'[ZORA]',limit=5){
  const db=database(),mailbox=(process.env.MS_ZORA_MAILBOX||process.env.EMAIL||'apex.ap@mindmapdigital.ai').toLowerCase();
  const results:{inboxId:string;state:string;caseId?:string}[]=[];
  for(let i=0;i<limit;i++){
    const row=(await db.query("UPDATE zora_inbox SET triage=jsonb_build_object('state','processing','at',now()) WHERE id=(SELECT id FROM zora_inbox WHERE triage IS NULL AND case_id IS NULL ORDER BY received_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *")).rows[0];
    if(!row)break;
    const save=async(triage:Record<string,unknown>)=>{await db.query('UPDATE zora_inbox SET triage=$2 WHERE id=$1',[row.id,JSON.stringify({...triage,at:new Date().toISOString()})]);results.push({inboxId:row.id,state:String(triage.state),caseId:triage.caseId as string|undefined});};
    const sender=String(row.sender).toLowerCase(),body=plainText(String(row.body_text)),proposal=proposeWorkflow(String(row.subject),body);
    if(sender===mailbox){await save({state:'ignored',reason:'Sent from the Zora mailbox itself',proposal});continue;}
    // A message in a thread that already belongs to a pursuit is related correspondence, not a new pursuit.
    const related=row.conversation_id?(await db.query('SELECT case_id FROM zora_inbox WHERE conversation_id=$1 AND case_id IS NOT NULL AND id<>$2 ORDER BY received_at DESC LIMIT 1',[row.conversation_id,row.id])).rows[0]:undefined;
    if(related){await save({state:'related',relatedCaseId:related.case_id,reason:'Reply in an existing pursuit thread; a consultant decides whether it changes the sources',proposal});continue;}
    const actor=actorFor(sender);
    if(!actor||!actor.roles.some(r=>['consultant','bid_owner','admin'].includes(r))){await save({state:'needs_triage',reason:actor?'Sender is not a consultant or bid owner':'Sender is not an approved Zora account',proposal});continue;}
    if(!proposal.workflow){await save({state:'needs_triage',reason:proposal.reason,proposal});continue;}
    const briefing=body.length>=20?body.slice(0,40000):`Email request: ${String(row.subject)}. See the attached original email.`;
    try{
      const c=await createCase({title:pursuitTitle(String(row.subject),tag),client:'Client to confirm',workflow:proposal.workflow,briefing,inboxId:row.id},actor,'email');
      await db.query("INSERT INTO zora_events(case_id,type,actor,data) VALUES($1,'intake.auto_created','zora-intake',$2)",[c.id,JSON.stringify({inboxId:row.id,workflow:proposal.workflow,basis:proposal.basis})]);
      await save({state:'pursuit_created',caseId:c.id,workflow:proposal.workflow,routingConfirmed:['W2','W8'].includes(proposal.workflow),reason:proposal.reason,proposal});
    }catch(error){
      await save({state:'needs_triage',reason:'Automatic pursuit creation failed; create it manually from Requests',error:error instanceof Error?error.message.slice(0,300):'unknown',proposal});
    }
  }
  return results;
}
