'use client';
import {Clock3,ShieldCheck,Activity} from 'lucide-react';
import type {CaseRecord} from '@/lib/catalogue';
import {progressSummary,type PursuitProgress} from '@/lib/pursuit-progress';
type Stage={id:string;title:string;kind:string;approvers:string[]};
function time(value:string){return new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' Dubai';}
export function PursuitProgressPanel({pursuit,progress,stages}:{pursuit:CaseRecord;progress:PursuitProgress;stages:Stage[]}){
  const status=progressSummary(pursuit.status,progress),stage=stages[pursuit.stageIndex];
  const nextGate=stages.slice(pursuit.stageIndex).find(s=>s.kind==='gate');
  return <section className="pursuit-progress" aria-label="Pursuit progress">
    <div className="files-heading"><h3><Activity size={18}/> Request progress</h3><span className="small-label">Updates every 15 seconds</span></div>
    <strong className="progress-title">{status.title}</strong><p>{status.detail}</p>
    <div className="progress-facts"><div><small>Current step</small><strong>{progress.reviewPurpose==='existing_draft'?'Existing proposal review':stage?`${stage.id} · ${stage.title}`:'Workflow complete'}</strong><span>Workflow position {Math.min(pursuit.stageIndex+1,stages.length)} of {stages.length}</span></div><div><small><ShieldCheck size={14}/> Next human decision</small><strong>{pursuit.status==='awaiting_confirmation'?'Confirm this workflow':nextGate?.title||'No further workflow gates'}</strong>{nextGate&&pursuit.status!=='awaiting_confirmation'&&<span>{nextGate.approvers.map(r=>r.replaceAll('_',' ')).join(' / ')}</span>}</div></div>
    {status.active.map((worker,i)=><div className="active-worker" key={i}><span className="accent-dot"/><strong>{worker.kind==='review'?`Independent reviewer · ${worker.checker}`:'Zora drafting agent'}</strong><span>{worker.name}</span><small>Last contact {time(new Date(new Date(worker.leaseExpiresAt).getTime()-5*60*1000).toISOString())}</small></div>)}
    {!!progress.reviewTotal&&<p>Current review: {progress.reviewCompleted} of {progress.reviewTotal} checks recorded{progress.reviewQueued?` · ${progress.reviewQueued} waiting`:''}.</p>}
    <div className="progress-timing"><Clock3 size={14}/>{progress.queuedAt&&<span>Step queued {time(progress.queuedAt)}</span>}<span>{progress.lastDispatcherAt?`Last dispatcher check ${time(progress.lastDispatcherAt)}`:'No dispatcher check recorded'}</span><span>Checked {time(progress.checkedAt)}</span></div>
  </section>;
}
