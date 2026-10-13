/** Native page transcript packaging; never marks OCR or business claims verified. */
import { constants } from 'node:fs';
import { open,realpath,mkdir,lstat,writeFile } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { z } from 'zod';
import { sourceTranscriptSchema,parseSourceTranscript,matchTranscript,transcriptHash,TRANSCRIPT_LIMIT } from '../lib/source-transcript';
import { inventory } from '../lib/review-manifest';

export async function buildTranscript(workspace:string,planPath:string){
  const root=await realpath(workspace);
  async function read(path:string,max:number){
    const actual=await realpath(resolve(root,path));if(!actual.startsWith(root+sep))throw new Error('Input escapes workspace');
    const handle=await open(actual,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{const stat=await handle.stat();if(!stat.isFile()||stat.size<1||stat.size>max)throw new Error('Input bound');return await handle.readFile();}finally{await handle.close();}
  }
  const plan=parseSourceTranscript(await read(planPath,TRANSCRIPT_LIMIT));
  const manifest=z.array(z.object({id:z.uuid(),filename:z.string(),mime_type:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),path:z.string(),visibility:z.enum(['client','internal'])}).passthrough()).max(64).parse(JSON.parse((await read('sources.json',1024*1024)).toString('utf8')));
  if(new Set(manifest.map(s=>s.id)).size!==manifest.length)throw new Error('Duplicate source IDs');
  const source=manifest.find(s=>s.id===plan.sourceId);if(!source)throw new Error('Source is not in this claimed packet');
  matchTranscript(plan,source,source.visibility);
  const data=await read(source.path,32*1024*1024);if(transcriptHash(data)!==source.sha256)throw new Error('Source hash changed');
  const elements=await inventory({...source,data,role:'source'},plan);
  const path=`outputs/${source.visibility}/source-transcript-${source.id}.json`;
  const target=join(root,path),parent=resolve(target,'..');await mkdir(parent,{recursive:true,mode:0o700});
  if(await realpath(parent)!==parent)throw new Error('Output directory cannot be a symlink');
  try{if((await lstat(target)).isSymbolicLink())throw new Error('Output cannot be a symlink');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  // Exclusive creation keeps an already declared output immutable. Use a new stage/plan
  // before packaging a corrected transcript; never silently replace a stored artifact.
  const bytes=Buffer.from(JSON.stringify(sourceTranscriptSchema.parse(plan),null,2)+'\n');
  if(bytes.length>TRANSCRIPT_LIMIT)throw new Error('Formatted transcript exceeds 2 MB');
  await writeFile(target,bytes,{mode:0o600,flag:'wx'});
  return {status:'unverified',pages:plan.pages.length,sourceElements:elements.length,outputFiles:[{path,visibility:source.visibility,mimeType:'application/json',purpose:'source_transcript'}],note:'Original PDF and transcript require a fresh SOURCE_TRANSCRIPT check before ordinary QC. No claims are approved.'};
}
if(process.argv[1]?.endsWith('build_transcript.ts')){
  const [workspace,plan]=process.argv.slice(2);
  buildTranscript(workspace,plan).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Source transcript held: check source hash, exact page coverage, private paths and explicit transcription. No source or credential values are logged.');process.exitCode=1;});
}
