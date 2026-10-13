/** Import only the supplied repository assets as drafts. Never grants human approval. */
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve,join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';

const assets=[
  ['02_Templates/Slide templates/1_Periodic_Table.pptx','slide_template','Periodic table slide template'],
  ['02_Templates/Slide templates/2_Problems.pptx','slide_template','Problems slide template'],
  ['02_Templates/Slide templates/3_Agents_Slide.pptx','slide_template','Agents slide template'],
  ['02_Templates/Slide templates/4_Engagement_Methodology.pptx','slide_template','Engagement methodology slide template'],
  ['02_Templates/Slide templates/5_Offerings.pptx','slide_template','Offerings slide template'],
  ['02_Templates/Reference deck/Reference_Deck_Slides.pptx','slide_template','Mindmap reference slide deck'],
  ['02_Templates/Architecture formats/Solution_Architecture_Format.png','architecture_format','Solution architecture format'],
  ['02_Templates/Architecture formats/Technical_Architecture_Format.png','architecture_format','Technical architecture format'],
  ['MindMap AI Business Deck Oct 2026.pdf','reference','Mindmap business deck — October 2026'],
];
function identity(value:string){let hex=createHash('sha256').update('mindmap-supplied-asset:'+value).digest('hex').slice(0,32);hex=hex.slice(0,12)+'5'+hex.slice(13,16)+'8'+hex.slice(17);return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
async function main(){
  const connection=process.env.DATABASE_URL;if(!connection)throw new Error('Database binding missing');const host=new URL(connection).hostname;
  if(!host.endsWith('.neon.tech')&&!['127.0.0.1','localhost'].includes(host))throw new Error('Use the known Neon production or owned local database');
  const repo=resolve('.');if(repo!=='/workspace/Solve')throw new Error('Run from the existing Solve checkout');
  const paths=assets.map(([path])=>'AI_Solutioning_Agent_BRD_v1.0/'+path);
  execFileSync('git',['diff','--quiet','HEAD','--',...paths],{stdio:'pipe'});const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const pool=host.endsWith('.neon.tech')?null:new Pool({connectionString:connection});const http=pool?null:neon(connection);
  async function query(sql:string,parameters:unknown[]=[]):Promise<any[]>{return pool?(await pool.query(sql,parameters)).rows:await http!.query(sql,parameters);}
  async function atomic(statements:{sql:string;parameters:unknown[]}[]){
    if(!pool){await http!.transaction(statements.map(item=>http!.query(item.sql,item.parameters)));return;}
    const client=await pool.connect();try{await client.query('BEGIN');for(const item of statements)await client.query(item.sql,item.parameters);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  const receipt:{id:string;entryId:string;filename:string;sha256:string;bytes:number;status:string;reused:boolean}[]=[];
  try{
    for(const [path,kind,title] of assets){
      const relative='AI_Solutioning_Agent_BRD_v1.0/'+path;const data=await readFile(join(repo,relative));if(!data.length||data.length>32*1024*1024)throw new Error('Supplied asset exceeds its file bound');
      const hash=createHash('sha256').update(data).digest('hex');const entry=identity(relative);const id=identity(relative+':'+hash);const filename=path.split('/').at(-1)!;const mime=path.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':path.endsWith('.pdf')?'application/pdf':'image/png';
      const prior=(await query("SELECT id,status,ingestion_complete,sha256,octet_length(data)::int AS bytes,encode(sha256(data),'hex') AS stored_hash FROM zora_knowledge_versions WHERE id=$1",[id]))[0];
      if(prior?.ingestion_complete){if(prior.sha256!==hash||prior.stored_hash!==hash||prior.bytes!==data.length)throw new Error('Existing supplied-asset version does not match its source');receipt.push({id,entryId:entry,filename,sha256:hash,bytes:data.length,status:prior.status,reused:true});console.log(JSON.stringify({asset:filename,reused:true,bytes:data.length}));continue;}
      const origin={kind:'supplied_repository_asset',repository:'saurabhg1234/Solve',commit,path:relative,sha256:hash};
      const notes=kind==='slide_template'?'Original user-supplied layout. Duplicate and edit its text while preserving fonts, formatting, themes and artwork. Review client carryover and fit before reuse.':kind==='architecture_format'?'Original user-supplied architecture reference. Verify system names, flows and source evidence in each pursuit.':'Latest user-supplied business-facing deck. Its pages are scanned; company numbers, certifications and client claims need exact visual verification and approved profile entries. This is not a Word proposal template.';
      if(!prior){
        await atomic([
          {sql:'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',parameters:[entry]},
          {sql:"INSERT INTO zora_knowledge_versions(id,entry_id,version,kind,title,notes,filename,mime_type,data,sha256,source_origin,ingestion_complete,owner_email,created_by) SELECT $1::uuid,$2::uuid,coalesce(max(version),0)+1,$3,$4,$5,$6,$7,''::bytea,$8,$9,false,'system:zora','zora:repository-source-import' FROM zora_knowledge_versions WHERE entry_id=$2::uuid ON CONFLICT(id) DO NOTHING",parameters:[id,entry,kind,title,notes,filename,mime,hash,JSON.stringify(origin)]},
        ]);
      }
      const offset=(await query('SELECT octet_length(data)::int AS bytes,status,ingestion_complete FROM zora_knowledge_versions WHERE id=$1',[id]))[0];if(offset.status!=='draft'||offset.ingestion_complete)throw new Error('Only an incomplete source draft can receive import bytes');
      const prefix=(await query("SELECT encode(sha256(data),'hex') AS hash FROM zora_knowledge_versions WHERE id=$1",[id]))[0].hash;if(prefix!==createHash('sha256').update(data.subarray(0,offset.bytes)).digest('hex'))throw new Error('Interrupted import prefix does not match the supplied file');
      const chunk=512*1024;
      for(let start=offset.bytes;start<data.length;start+=chunk){
        const saved=await query("UPDATE zora_knowledge_versions SET data=data||$2::bytea WHERE id=$1 AND status='draft' AND NOT ingestion_complete AND octet_length(data)=$3 RETURNING id",[id,'\\x'+data.subarray(start,start+chunk).toString('hex'),start]);if(saved.length!==1)throw new Error('Source import offset changed; retry from verified stored bytes');
      }
      const verified=await query("UPDATE zora_knowledge_versions SET ingestion_complete=true WHERE id=$1 AND status='draft' AND NOT ingestion_complete AND octet_length(data)=$2 AND encode(sha256(data),'hex')=$3 RETURNING id",[id,data.length,hash]);if(verified.length!==1)throw new Error('Source import did not finish with matching bytes and SHA-256');
      await query("INSERT INTO zora_events(case_id,type,actor,data) VALUES(null,'knowledge.supplied_asset_imported','zora:repository-source-import',$1)",[JSON.stringify({entryId:entry,versionId:id,filename,sha256:hash,source:origin})]);
      receipt.push({id,entryId:entry,filename,sha256:hash,bytes:data.length,status:'draft',reused:false});console.log(JSON.stringify({asset:filename,imported:true,bytes:data.length,status:'draft',humanApproval:false}));
    }
    const saved={importedAt:new Date().toISOString(),sourceCommit:commit,assets:receipt,totalBytes:receipt.reduce((sum,item)=>sum+item.bytes,0),humanApprovalsCreated:0,clientPursuitsCreated:0};
    const target=host.endsWith('.neon.tech')?'/workspace/solve-environment/zora-supplied-assets-receipt.json':'/workspace/solve-environment/zora-local-supplied-assets-receipt.json';await writeFile(target,JSON.stringify(saved,null,2),{mode:0o600});console.log(JSON.stringify({sources:receipt.length,verifiedBytes:saved.totalBytes,humanApprovalsCreated:0,clientPursuitsCreated:0}));
  }finally{await pool?.end();}
}
main().catch(error=>{console.error(JSON.stringify({sourceImport:'failed',error:error instanceof Error?error.name:'unknown',code:error?.code,routine:error?.routine,position:error?.position,note:'No human approval or client release is recorded.'}));process.exitCode=1;});
