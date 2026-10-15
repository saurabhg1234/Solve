import type { PoolClient,Pool } from 'pg';

/**
 * The dispatcher decides whether a freshly started agent session has anything to claim.
 * It never claims, approves or sends: each fresh worker session claims exactly one item through the
 * ordinary claim endpoint, and human gates (workflow confirmation, approvals, triage) stay human.
 */
export type DispatchCounts={stages:number;resets:number;reviews:number;leased:number;needsTriage:number;awaitingConfirmation:number;awaitingApproval:number;blocked:number};
export type DispatchPlan={action:'claim'|'idle';claimable:number;workerSessions:number;human:{needsTriage:number;awaitingConfirmation:number;awaitingApproval:number;blocked:number};reason:string};

/** Fresh worker sessions a dispatcher wake may start; each claims one item under its own identity. */
export const MAX_WORKER_SESSIONS=5;

export function dispatchPlan(c:DispatchCounts):DispatchPlan{
  const claimable=c.stages+c.resets+c.reviews;
  const human={needsTriage:c.needsTriage,awaitingConfirmation:c.awaitingConfirmation,awaitingApproval:c.awaitingApproval,blocked:c.blocked};
  if(!claimable)return {action:'idle',claimable,workerSessions:0,human,reason:c.leased?`${c.leased} item(s) already leased by another session`:'Nothing is queued for an agent'};
  return {action:'claim',claimable,workerSessions:Math.min(claimable,MAX_WORKER_SESSIONS),human,reason:`${claimable} item(s) are claimable: ${c.stages} stage(s), ${c.resets} fresh re-evaluation(s), ${c.reviews} independent review(s)`};
}

/** Read-only counts that mirror the claim queries' eligibility (current version, queued or expired lease). */
export async function dispatchCounts(db:Pool|PoolClient):Promise<DispatchCounts>{
  const r=(await db.query(`SELECT
    (SELECT count(*) FROM zora_jobs j JOIN zora_cases c ON c.id=j.case_id WHERE j.case_version=c.version AND j.reset_packet IS NULL AND (j.state='queued' OR (j.state='leased' AND j.lease_expires_at<now())))::int AS stages,
    (SELECT count(*) FROM zora_jobs j JOIN zora_cases c ON c.id=j.case_id WHERE j.case_version=c.version AND j.source_revision=c.source_revision AND j.reset_packet IS NOT NULL AND (j.state='queued' OR (j.state='leased' AND j.lease_expires_at<now())))::int AS resets,
    (SELECT count(*) FROM zora_reviews r JOIN zora_qc_runs q ON q.id=r.run_id JOIN zora_cases c ON c.id=r.case_id WHERE q.state='reviewing' AND q.case_version=c.version AND (r.state='queued' OR (r.state='leased' AND r.lease_expires_at<now())))::int AS reviews,
    ((SELECT count(*) FROM zora_jobs WHERE state='leased' AND lease_expires_at>=now())+(SELECT count(*) FROM zora_reviews WHERE state='leased' AND lease_expires_at>=now()))::int AS leased,
    (SELECT count(*) FROM zora_inbox WHERE case_id IS NULL AND triage->>'state'='needs_triage')::int AS "needsTriage",
    (SELECT count(*) FILTER (WHERE status='awaiting_confirmation') FROM zora_cases)::int AS "awaitingConfirmation",
    (SELECT count(*) FILTER (WHERE status='awaiting_approval') FROM zora_cases)::int AS "awaitingApproval",
    (SELECT count(*) FILTER (WHERE status='blocked') FROM zora_cases)::int AS blocked`)).rows[0];
  return r as DispatchCounts;
}
