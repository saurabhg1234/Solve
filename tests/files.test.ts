import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byteRange,cleanFilename,FILE_CHUNK,hashBytes } from '../lib/files';
import { emailAttachments } from '../lib/microsoft';

test('byte ranges reject large unbounded downloads, overrun, suffix and multipart requests',()=>{
  assert.deepEqual(byteRange('bytes=0-99',100),{start:0,end:99,partial:true});
  assert.throws(()=>byteRange('bytes=0-100',100));
  for(const header of ['bytes=-10','bytes=0-2,5-8',`bytes=0-${FILE_CHUNK}`])assert.throws(()=>byteRange(header,FILE_CHUNK+100));
  assert.throws(()=>byteRange(null,FILE_CHUNK+1));
  assert.equal(cleanFilename('../../unsafe\r\nname.pdf'),'unsafename.pdf');
});
test('email intake imports raw file bytes with hashes/provenance and excludes Jarvis',async()=>{
  const previous={mailbox:process.env.MS_ZORA_MAILBOX,folder:process.env.MS_ZORA_FOLDER_ID};
  process.env.MS_ZORA_MAILBOX='fixture@example.test';process.env.MS_ZORA_FOLDER_ID='fixture-folder';
  let bytesRead=0;const bytes=Buffer.from('%PDF-1.7\nSynthetic transport fixture');
  const io={json:async(path:string)=>path.includes('/attachments?')?{value:[{'@odata.type':'#microsoft.graph.fileAttachment',id:'attachment-1',name:'../sample.pdf',contentType:'application/pdf',size:bytes.length}]}:{parentFolderId:'fixture-folder',subject:'[ZORA] file request',categories:[]},bytes:async()=>{bytesRead++;return bytes;}};
  try{const files=await emailAttachments('fixture@example.test','message-1',io);assert.equal(files.length,1);assert.deepEqual(files[0].data,bytes);assert.equal(files[0].sha256,hashBytes(bytes));assert.equal(files[0].filename,'sample.pdf');assert.equal(files[0].provenance.attachmentId,'attachment-1');
    await assert.rejects(emailAttachments('fixture@example.test','message-2',{...io,json:async()=>({parentFolderId:'fixture-folder',subject:'[ZORA] [JARVIS] request',categories:[]})}));assert.equal(bytesRead,1);
    await assert.rejects(emailAttachments('other@example.test','message-3',io));
    await assert.rejects(emailAttachments('fixture@example.test','message-4',{...io,json:async(path:string)=>path.includes('/attachments?')?{value:[{'@odata.type':'#microsoft.graph.referenceAttachment',name:'linked.pdf'}]}:{parentFolderId:'fixture-folder',subject:'[ZORA] reference',categories:[]}}));
  }finally{if(previous.mailbox===undefined)delete process.env.MS_ZORA_MAILBOX;else process.env.MS_ZORA_MAILBOX=previous.mailbox;if(previous.folder===undefined)delete process.env.MS_ZORA_FOLDER_ID;else process.env.MS_ZORA_FOLDER_ID=previous.folder;}
});

// Source roles and artifact roles share the existing internal-review allocation.
import { canReadSource } from '../lib/files';
test('private sources require both pursuit access at the route and an internal review role',()=>{
  const user=(role:any)=>({email:'local@example.test',name:'Synthetic user',roles:[role]});
  for(const role of ['consultant','bid_owner','demo_builder']){assert.equal(canReadSource(user(role),'client'),true);assert.equal(canReadSource(user(role),'internal'),false);}
  for(const role of ['admin','architect','pricing_owner','delivery_lead'])assert.equal(canReadSource(user(role),'internal'),true);
  assert.equal(canReadSource(user('admin'),undefined),false);assert.equal(canReadSource(user('admin'),'unknown'),false);
});

test('email intake accepts a 13-file pilot pack and enforces the expanded file bound',async()=>{
  const previous={mailbox:process.env.MS_ZORA_MAILBOX,folder:process.env.MS_ZORA_FOLDER_ID};
  process.env.MS_ZORA_MAILBOX='fixture@example.test';process.env.MS_ZORA_FOLDER_ID='fixture-folder';
  let count=13,read=0;
  const io={json:async(path:string)=>path.includes('/attachments?')?{value:Array.from({length:count},(_,i)=>({'@odata.type':'#microsoft.graph.fileAttachment',id:`asset-${i}`,name:`asset-${i}.txt`,contentType:'text/plain',size:1}))}:{parentFolderId:'fixture-folder',subject:'Re: [ZORA] Pilot assets',categories:[]},bytes:async()=>{read++;return Buffer.from('x');}};
  try{
    assert.equal((await emailAttachments('fixture@example.test','pilot',io)).length,13);
    count=25;read=0;await assert.rejects(emailAttachments('fixture@example.test','too-many',io),/up to 24 files/);assert.equal(read,24);
    await assert.rejects(emailAttachments('fixture@example.test','empty',{...io,bytes:async()=>Buffer.alloc(0)}),/empty/);
  }finally{for(const [key,value] of Object.entries({MS_ZORA_MAILBOX:previous.mailbox,MS_ZORA_FOLDER_ID:previous.folder})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
