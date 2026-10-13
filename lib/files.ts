import { createHash } from 'node:crypto';
import { HttpError } from './auth';
import type { Actor } from './auth';

export const FILE_LIMIT = 32 * 1024 * 1024;
export const FILE_CHUNK = 2 * 1024 * 1024;
export function hashBytes(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
export async function readUploadChunk(request:Request):Promise<Buffer>{
  if(Number(request.headers.get('content-length'))>FILE_CHUNK)throw new HttpError(413,'Upload chunks must be at most 2 MB');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Provide an upload chunk');let size=0;const chunks:Buffer[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>FILE_CHUNK){await reader.cancel();throw new HttpError(413,'Upload chunks must be at most 2 MB');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks);
}
export function cleanFilename(value: string): string {
  const name = value.replace(/\\/g,'/').split('/').at(-1)?.replace(/[\x00-\x1f\x7f]/g,'').trim();
  if (!name || name==='.' || name==='..' || name.length>250) throw new HttpError(400,'Provide a valid filename');
  return name;
}
export function canReadInternal(user: Actor): boolean {
  return user.roles.some(role=>['admin','architect','delivery_lead','pricing_owner'].includes(role));
}
export function byteRange(header: string | null, size: number): {start:number;end:number;partial:boolean} {
  if (!header) {
    if (size>FILE_CHUNK) throw new HttpError(413,'Download this file in byte ranges');
    return {start:0,end:Math.max(0,size-1),partial:false};
  }
  const match=/^bytes=(\d+)-(\d+)$/.exec(header);
  const start=Number(match?.[1]),end=Number(match?.[2]);
  if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || end<start || end>=size || end-start+1>FILE_CHUNK) throw new HttpError(416,'Invalid file byte range');
  return {start,end,partial:true};
}
export function fileResponse(bytes: Uint8Array, file: {filename:string;mime_type:string;sha256:string;size:number}, range: {start:number;end:number;partial:boolean}): Response {
  return new Response(new Uint8Array(bytes),{status:range.partial?206:200,headers:{
    'Content-Type':file.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(cleanFilename(file.filename)).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,
    'Content-Length':String(bytes.length),'Accept-Ranges':'bytes','X-Zora-Sha256':file.sha256,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    ...(range.partial?{'Content-Range':`bytes ${range.start}-${range.end}/${file.size}`}:{})
  }});
}
