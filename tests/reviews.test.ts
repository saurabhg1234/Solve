import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { zipSync,strToU8 } from 'fflate';
import { inventory } from '../lib/review-manifest';
import { reviewPlan,reviewResultSchema } from '../lib/review-plan';
import { needsIndependentReview } from '../lib/result';
import { stagesFor } from '../lib/engine';
import { canReadArtifact } from '../lib/files';
import type { Role } from '../lib/catalogue';

function file(filename:string,data:Buffer){return {id:'00000000-0000-4000-8000-000000000001',filename,mime_type:'application/octet-stream',data,sha256:createHash('sha256').update(data).digest('hex'),role:'draft' as const};}
function untaggedPdf(){
  const stream='BT /F1 12 Tf 40 200 Td (Synthetic untagged PDF text.) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];for(const [index,value] of objects.entries()){offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${value}\nendobj\n`;}
  const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');pdf+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf);
}
test('every independent checkpoint has an explicit BRD reviewer plan',()=>{
  for(const workflow of ['W1','W2','W3','W4','W5','W6','W7','W8'] as const)for(const stage of stagesFor(workflow,'mindmap-pilot'))if(needsIndependentReview(stage.id))assert.ok(reviewPlan(stage.id),stage.id);
  assert.deepEqual(reviewPlan('W3-16')!.passes.map(p=>p.checker),['D1','D1','D2','D3','D3','D4','D5','D8']);
  assert.equal(new Set(reviewPlan('W4-5')!.passes.map(p=>p.method)).size,3);
  assert.equal(needsIndependentReview('W1-13'),false,'A follow-on suggestion is not an independent QC checkpoint');
});
test('Office inventory counts paragraphs, words, cells, captions and visuals from bytes',async()=>{
  const xml='<w:document xmlns:w="urn:word"><w:body><w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Two words</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell value</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:drawing/></w:body></w:document>';
  const bytes=Buffer.from(zipSync({'word/document.xml':strToU8(xml),'word/media/image1.png':new Uint8Array([1])}));const input=file('fixture.docx',bytes);const elements=await inventory(input);
  for(const kind of ['paragraph','word','table_cell','caption','diagram','image'])assert.ok(elements.some(e=>e.kind===kind),kind);
  assert.equal(new Set(elements.map(e=>e.id)).size,elements.length);assert.deepEqual(await inventory(input),elements);
  await assert.rejects(inventory({...input,sha256:'0'.repeat(64)}));
});
test('malformed, embedded and entity-bearing documents fail rather than claiming coverage',async()=>{
  for(const xml of ['<!DOCTYPE x [<!ENTITY a SYSTEM "https://outside.example/secret">]><w:document xmlns:w="urn:word">&a;</w:document>','<w:document xmlns:w="urn:word"><w:body></wrong>'])await assert.rejects(inventory(file('bad.docx',Buffer.from(zipSync({'word/document.xml':strToU8(xml)})))));
  await assert.rejects(inventory(file('embedded.docx',Buffer.from(zipSync({'word/document.xml':strToU8('<document/>'),'word/embeddings/embedded.bin':new Uint8Array([1])})))));
  await assert.rejects(inventory(file('empty.txt',Buffer.from('   '))));
  await assert.rejects(inventory(file('binary.txt',Buffer.from([255,255]))));
});
test('workbook inventory reconciles shared strings, inline text, cell values and inert formulas',async()=>{
  const bytes=Buffer.from(zipSync({'xl/workbook.xml':strToU8('<workbook/>'),'xl/sharedStrings.xml':strToU8('<sst><si><t>Buyer question</t></si></sst>'),'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Exact source location</t></is></c><c r="C1"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>')}));
  const elements=await inventory(file('questions.xlsx',bytes));assert.equal(elements.filter(e=>e.kind==='table_cell').length,3);assert.ok(elements.some(e=>e.text==='Buyer question'));assert.ok(elements.some(e=>e.text==='Exact source location'));assert.ok(elements.some(e=>e.kind==='formula'&&e.text==='1+2'));
  await assert.rejects(inventory(file('missing-string.xlsx',Buffer.from(zipSync({'xl/workbook.xml':strToU8('<workbook/>'),'xl/worksheets/sheet1.xml':strToU8('<worksheet><c r="A1" t="s"><v>7</v></c></worksheet>')})))),/missing shared string/);
  await assert.rejects(inventory(file('external.xlsx',Buffer.from(zipSync({'xl/workbook.xml':strToU8('<workbook/>'),'xl/externalLinks/externalLink1.xml':strToU8('<externalLink/>')})))),/External workbook links/);
});
test('RFI review permission is limited to the exact internal W5 cross-check class',()=>{
  const file={visibility:'internal',purpose:'rfi_review',workflow:'W5',stage_id:'W5-11'};
  function user(role:Role){return {email:'synthetic@example.test',name:'Local role fixture',roles:[role]};}
  for(const role of ['consultant','bid_owner'] as const){assert.equal(canReadArtifact(user(role),file),true);for(const changed of [{...file,purpose:'workpaper'},{...file,purpose:'draft'},{...file,workflow:'W1'},{...file,stage_id:'W5-10'},{...file,visibility:undefined}])assert.equal(canReadArtifact(user(role),changed),false);}
  assert.equal(canReadArtifact(user('demo_builder'),file),false);assert.equal(canReadArtifact(user('admin'),file),true);
});
test('HTML inventory is inert and includes words, image and table elements',async()=>{
  const items=await inventory({...file('email.html',Buffer.from('<!doctype html><html><body><p>Hello client</p><table><tr><td>One cell</td></tr></table><img alt="Zora orb"><script>untrusted command</script></body></html>')),mime_type:'text/html'});
  assert.ok(items.some(e=>e.kind==='image'));assert.ok(items.some(e=>e.kind==='table_cell'));assert.ok(items.some(e=>e.text==='untrusted command'));
  assert.equal(reviewResultSchema.safeParse({packetHash:'0'.repeat(64),checkedElementIds:[],summary:'A fabricated empty pass',findings:[],missingInputs:[]}).success,false);
});
test('real supplied PPT/PDF inventory works and an image-only PDF requires OCR',async()=>{
  for(const name of ['AI_Solutioning_Agent_BRD_v1.0/02_Templates/Slide templates/2_Problems.pptx','AI_Solutioning_Agent_BRD_v1.0/02_Templates/Reference deck/Reference_Deck_Slides.pptx','AI_Solutioning_Agent_BRD_v1.0/00_READ_ME_FIRST.pdf']){const items=await inventory({...file(name,await readFile(name)),role:'source'});assert.ok(items.length>100);assert.ok(items.some(e=>e.kind==='word'));}
  const untagged=file('synthetic-untagged.pdf',untaggedPdf());assert.ok((await inventory({...untagged,role:'source'})).length>0);await assert.rejects(inventory(untagged),/structural element IDs/);
  const scanned='AI_Solutioning_Agent_BRD_v1.0/MindMap AI Business Deck Oct 2026.pdf';await assert.rejects(inventory(file(scanned,await readFile(scanned))),/OCR\/transcript/);
});

test('Office image descriptions and titles enter word-level review inventory',async()=>{
  const source='<p:sld xmlns:p="urn:ppt" xmlns:a="urn:drawing"><p:pic><p:nvPicPr><p:cNvPr id="1" name="Picture" descr="Actual diagram description" title="Earlier client title"/></p:nvPicPr></p:pic></p:sld>';
  const bytes=Buffer.from(zipSync({'ppt/slides/slide1.xml':strToU8(source)}));const elements=await inventory(file('picture.pptx',bytes));
  for(const text of ['Actual diagram description','Earlier client title'])assert.ok(elements.some(e=>e.kind==='caption'&&e.text===text));
  assert.ok(elements.some(e=>e.kind==='word'&&e.text==='Earlier'));
});
