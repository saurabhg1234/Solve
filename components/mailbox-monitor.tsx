'use client';
import {useEffect,useState} from 'react';
type Monitor={executionMode?:'on_request'|'scheduled';checkedAt:string;subscriptionExpiresAt:string|null;lastSyncAt:string|null;lastScheduledAt:string|null;scheduledOk:boolean;pendingMessages:number;intervalMinutes:number;lastDispatcherAt?:string|null;lastDispatcherAction?:string|null};
const when=(date:string|null)=>date?new Date(date).toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' Dubai':'Not recorded';
export function MailboxMonitor({allowed}:{allowed:boolean}){
  const [state,setState]=useState<Monitor|null>(null);const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!allowed)return;let live=true;
    async function refresh(){try{const r=await fetch('/api/mailbox/status',{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json();if(live){setState(data);setFailed(false);}}catch{if(live)setFailed(true);}}
    void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>{live=false;clearInterval(timer);};
  },[allowed]);
  if(!allowed)return <p className="subtle-note">Sign in as a consultant or bid owner to see live mailbox status.</p>;
  if(failed)return <p role="status" className="subtle-note">Mailbox status is unavailable. Retrying automatically.</p>;
  if(!state)return <p role="status" className="subtle-note">Checking mailbox monitoring…</p>;
  const active=!!state.subscriptionExpiresAt&&new Date(state.subscriptionExpiresAt).getTime()>Date.now();
  const fresh=!!state.lastScheduledAt&&Date.now()-new Date(state.lastScheduledAt).getTime()<12*60*1000;
  return <div className="mailbox-monitor" aria-live="polite"><span className="status-pill">{active&&fresh&&state.scheduledOk?'Mailbox monitor active':!active?'Microsoft subscription needs attention':!state.lastScheduledAt?'Awaiting first scheduled check':'Scheduled check needs attention'}</span><dl><div><dt>Inbox last checked</dt><dd>{when(state.lastSyncAt)}</dd></div><div><dt>Scheduled backup</dt><dd>Every {state.intervalMinutes} minutes</dd></div><div><dt>Last scheduled run</dt><dd>{when(state.lastScheduledAt)}</dd></div><div><dt>Work execution</dt><dd>{state.executionMode==='on_request'?'On request · active agent session':state.lastDispatcherAt?`${when(state.lastDispatcherAt)} (${state.lastDispatcherAction==='claim'?'work available':'idle'})`:'No wake recorded'}</dd></div><div><dt>Awaiting triage</dt><dd>{state.pendingMessages} {state.pendingMessages===1?'message':'messages'}</dd></div></dl><p className="subtle-note">Incoming mail is collected automatically. Zora performs requested work in the active session and saves completed files to the pursuit. Independent QC and human approvals are recorded separately.</p></div>;
}
