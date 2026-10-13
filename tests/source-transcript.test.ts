import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,mkdir,writeFile,readFile,rm,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory } from '../lib/review-manifest';
import { parseSourceTranscript,matchTranscript,transcriptHash,TRANSCRIPT_LIMIT } from '../lib/source-transcript';
import { buildTranscript } from '../scripts/build_transcript';

export function syntheticPdf(){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 5 0 R >>',
    '<< /Length 26 >>\nstream\n0 0 1 rg 10 10 100 100 re f\nendstream'];
  let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
  const offset=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  return Buffer.from(pdf+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`);
}
const pdf=syntheticPdf(),source={id:randomUUID(),sha256:transcriptHash(pdf),filename:'synthetic.pdf',mime_type:'application/pdf',visibility:'internal'};
function plan(){return {version:1 as const,status:'unverified' as const,sourceId:source.id,sourceSha256:source.sha256,pages:[{page:1,blocks:[{kind:'paragraph' as const,text:'Synthetic transcription protocol fixture only.'}]},{page:2,blocks:[],noTextReason:'Synthetic blue rectangle contains no readable text.'}]};}
test('transcripts require exact IDs, hashes, classifications and ordered pages without approval claims',()=>{
  const valid=plan();assert.deepEqual(parseSourceTranscript(Buffer.from(JSON.stringify(valid))),valid);matchTranscript(valid,source,'internal');
  for(const bad of [{...valid,status:'verified'},{...valid,approved:true},{...valid,pages:[valid.pages[1],valid.pages[0]]},{...valid,pages:[valid.pages[0],valid.pages[0]]},{...valid,pages:[{page:1,blocks:[]}]},{...valid,pages:[{page:1,blocks:valid.pages[0].blocks,noTextReason:'Cannot claim both.'}]}])assert.throws(()=>parseSourceTranscript(Buffer.from(JSON.stringify(bad))));
  for(const changed of [{...source,id:randomUUID()},{...source,sha256:'0'.repeat(64)},{...source,filename:'not.pdfx',mime_type:'text/plain'},{...source,visibility:'client'}])assert.throws(()=>matchTranscript(valid,changed,'internal'));
  assert.throws(()=>parseSourceTranscript(Buffer.alloc(TRANSCRIPT_LIMIT+1)));assert.throws(()=>parseSourceTranscript(Buffer.from([255])));
});
test('transcripts preserve complete original-page visuals and independently inventoried words',async()=>{
  const file={...source,data:pdf,role:'source' as const};await assert.rejects(inventory(file),/OCR\/transcript/);
  const elements=await inventory(file,plan());assert.equal(elements.filter(e=>e.kind==='page').length,2);assert.equal(elements.filter(e=>e.kind==='diagram').length,2);
  assert.ok(elements.some(e=>e.kind==='word'&&e.text==='Synthetic'));assert.ok(elements.some(e=>e.kind==='transcript_no_text'));
  assert.ok(elements.some(e=>e.location.includes('PDF page 1, unverified transcript')));assert.equal(new Set(elements.map(e=>e.id)).size,elements.length);
  for(const role of ['draft','reference'] as const)await assert.rejects(inventory({...file,role},plan()),/cannot replace/);
  await assert.rejects(inventory(file,{...plan(),pages:plan().pages.slice(0,1)}),/every original PDF page/);
  await assert.rejects(inventory(file,{...plan(),sourceSha256:'0'.repeat(64)}),/does not match/);
});
test('native packaging checks actual bytes, page bounds and private paths without verifying content',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zora-transcript-'));
  try{
    await mkdir(join(root,'sources'));await writeFile(join(root,'sources/source.pdf'),pdf);
    await writeFile(join(root,'sources.json'),JSON.stringify([{...source,path:'sources/source.pdf'}]));await writeFile(join(root,'plan.json'),JSON.stringify(plan()));
    const result=await buildTranscript(root,'plan.json');assert.equal(result.status,'unverified');assert.equal(result.pages,2);assert.equal(result.outputFiles[0].visibility,'internal');assert.equal(result.outputFiles[0].purpose,'source_transcript');
    const output=await readFile(join(root,result.outputFiles[0].path));assert.deepEqual(parseSourceTranscript(output),plan());await assert.rejects(buildTranscript(root,'plan.json'),/EEXIST/);
    await writeFile(join(root,'bad.json'),JSON.stringify({...plan(),pages:plan().pages.slice(0,1)}));await assert.rejects(buildTranscript(root,'bad.json'),/every original PDF page/);
    await writeFile(join(root,'sources/source.pdf'),Buffer.from('Modified bytes'));await assert.rejects(buildTranscript(root,'plan.json'),/hash changed/);
    await symlink('/etc/hostname',join(root,'escaped'));await assert.rejects(buildTranscript(root,'escaped'),/escapes/);
  }finally{await rm(root,{recursive:true,force:true});}
});
