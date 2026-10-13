import { z } from 'zod';
import { createHash } from 'node:crypto';

export const TRANSCRIPT_LIMIT = 2 * 1024 * 1024;
const text = z.string().trim().min(1).max(12000).refine(s => !/[\x00-\x08\x0b-\x1f\x7f]/u.test(s));
export const sourceTranscriptSchema = z.object({
  version: z.literal(1), status: z.literal('unverified'),
  sourceId: z.uuid(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pages: z.array(z.object({
    page: z.number().int().min(1).max(150),
    blocks: z.array(z.object({kind:z.enum(['paragraph','table_cell','caption']),text}).strict()).max(2000),
    noTextReason: text.optional(),
  }).strict().refine(p => p.blocks.length > 0 ? !p.noTextReason : !!p.noTextReason,
    'Provide transcribed blocks or an explicit explanation for a page without readable text')).min(1).max(150),
}).strict().refine(t => t.pages.every((p,i) => p.page === i + 1), 'Include every page once in original order');
export type SourceTranscript = z.infer<typeof sourceTranscriptSchema>;
export type TranscriptSource = {id:string;sha256:string;mime_type:string;filename:string;visibility?:string};
export function parseSourceTranscript(bytes:Buffer):SourceTranscript {
  if (!bytes.length || bytes.length > TRANSCRIPT_LIMIT) throw new Error('Source transcript exceeds its 2 MB bound');
  return sourceTranscriptSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export function matchTranscript(transcript:SourceTranscript,source:TranscriptSource,visibility?:string) {
  if (transcript.sourceId !== source.id || transcript.sourceSha256 !== source.sha256)
    throw new Error('Source transcript does not match the original source ID and SHA-256');
  if (source.mime_type.split(';')[0] !== 'application/pdf' && !/\.pdf$/i.test(source.filename))
    throw new Error('Source transcripts currently support PDF sources only');
  if (visibility !== undefined && (visibility !== source.visibility || !['client','internal'].includes(visibility)))
    throw new Error('Source transcript must retain the original source access classification');
}
export function transcriptHash(bytes:Buffer) { return createHash('sha256').update(bytes).digest('hex'); }
