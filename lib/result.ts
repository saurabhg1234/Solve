import { z } from 'zod';

export const resultSchema=z.object({
  status:z.enum(['completed','blocked']),
  summary:z.string().min(10).max(10000),
  missingInputs:z.array(z.string().max(2000)).max(100),
  outputFiles:z.array(z.object({path:z.string().min(1).max(250),visibility:z.enum(['client','internal']),mimeType:z.string().min(1).max(150)})).max(100),
  citations:z.array(z.object({source:z.string().min(1),location:z.string().min(1),quote:z.string().min(1)})).max(10000),
  reviewReports:z.array(z.object({checker:z.string(),runId:z.string(),checkedElementIds:z.array(z.string()),findings:z.array(z.object({severity:z.enum(['critical','major','minor']),kind:z.string(),location:z.string(),description:z.string()}))})).max(100),
});
export type StageResult=z.infer<typeof resultSchema>;
export function safeOutputPath(path:string):boolean {
  return /^outputs\/(client|internal)\/[A-Za-z0-9_. /-]+$/.test(path)&&!/[\r\n]/.test(path)&&!path.split('/').includes('..')&&!path.endsWith('/')&&!path.includes('\\');
}
export function needsIndependentReview(stageId:string):boolean {
  return ['W1-12','W1-13','W2-5','W3-7','W3-16','W3-17','W3-18','W3-20','W4-5','W4-12','W4-13','W4-14','W4-15','W4-16','W4-18','W4-19','W4-20','W4-21','W4-23','W5-3','W5-4','W5-6','W5-8','W5-10','W5-11','W6-7','W6-8','W6-9','W7-5','W7-6','W8-3','S1-3','S1-4','S1-6'].includes(stageId);
}
