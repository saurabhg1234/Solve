import type {CaseStatus} from './catalogue';

export type WorkerProgress={kind:'stage'|'review';name:string;checker?:string;leaseExpiresAt:string};
export type PursuitProgress={reviewPurpose?:string|null;checkedAt:string;queuedAt:string|null;lastDispatcherAt:string|null;workers:WorkerProgress[];reviewQueued:number;reviewCompleted:number;reviewTotal:number};
export function progressSummary(status:CaseStatus,progress:PursuitProgress,now=Date.now()){
  const active=progress.workers.filter(w=>new Date(w.leaseExpiresAt).getTime()>now);
  if(status==='awaiting_confirmation')return {title:'Ready for your workflow confirmation',detail:'Check the brief and source files, then confirm the workflow to queue the first step.',active:[]};
  if(status==='awaiting_approval')return {title:'Waiting for human review',detail:'The assigned approver needs to review this version and decide before Zora continues.',active:[]};
  if(status==='blocked')return {title:'Needs attention before continuing',detail:'See the review findings, required inputs or workflow notes below. Resolve the recorded issue before resuming the step.',active:[]};
  if(status==='released')return {title:'Workflow released',detail:'The required workflow gates are complete. Sending or submitting remains a separate human action.',active:[]};
  if(active.length)return {title:active.some(w=>w.kind==='review')?'Independent review in progress':'Zora is working on this step',detail:'An agent has claimed the work and is maintaining contact. Saved files and review results appear below.',active};
  if(progress.reviewQueued)return {title:'Waiting for independent reviewers',detail:`${progress.reviewQueued} review task(s) are queued for fresh sessions. No reviewer is active at this check.${progress.lastDispatcherAt&&now-new Date(progress.lastDispatcherAt).getTime()>90*60*1000?' The hourly dispatcher check is overdue.':''}`,active};
  if(progress.lastDispatcherAt&&now-new Date(progress.lastDispatcherAt).getTime()>90*60*1000)return {title:'Queued — dispatcher check overdue',detail:'The hourly dispatcher has not checked in recently. Your request is saved, but no agent is currently active on this step.',active};
  return {title:status==='running'?'Waiting for an agent to reconnect':'Queued — waiting for an agent',detail:status==='running'?'The previous agent’s contact has expired. The queued work can be reclaimed; this screen does not count it as active work.':'Your request is saved. No agent has claimed this step yet. The dispatcher checks the queue hourly.',active};
}
