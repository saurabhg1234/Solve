import { createHash } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './auth';
export const resetReportSchema=z.object({
  packetHash:z.string().regex(/^[a-f0-9]{64}$/),
  checkedSourceIds:z.array(z.uuid()).min(1).max(30),checkedBaselineIds:z.array(z.uuid()).min(1).max(30),
  sections:z.array(z.object({section:z.string().trim().min(1).max(300),assessment:z.string().trim().min(20).max(2000),changes:z.string().trim().min(20).max(2000)}).strict()).min(1).max(500),
  findingResponses:z.array(z.object({findingIndex:z.number().int().min(0).max(19),correction:z.string().trim().min(20).max(2000)}).strict()).min(1).max(20),
}).strict();
export type ResetReport=z.infer<typeof resetReportSchema>;
export function exactIds(expected:string[],actual:string[]){return expected.length===actual.length&&new Set(actual).size===actual.length&&expected.every(id=>actual.includes(id));}
export function requireResetFile(job:any,kind:'sources'|'artifacts',id:string,sha256:string){
  if(!job.reset_packet)return;
  const allowed=(kind==='sources'?job.reset_packet.sources:job.reset_packet.baselines).some((f:any)=>f.id===id&&f.sha256===sha256);
  if(!allowed)throw new HttpError(403,'This file is outside the isolated trust-reset packet');
}

// PostgreSQL JSONB normalizes key order; hashes must survive storage round trips.
export function resetDigest(value:unknown):string{
 const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
