/** Compiled UI test with synthetic routed API responses; never sends requests to production. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
const {chromium}=await import(process.env.ZORA_PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const origin=new URL(process.env.ZORA_UI_TEST_ORIGIN||'http://127.0.0.1:3003');assert.equal(origin.hostname,'127.0.0.1');
const browser=await chromium.launch({executablePath:process.env.ZORA_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const now=new Date().toISOString(),caseId=randomUUID();let polls=0;
 const pursuit={id:caseId,title:'Synthetic source context request',client:'Local fixture',workflow:'W3',status:'awaiting_confirmation',stageIndex:0,version:1,sourceRevision:1,source:'manual',createdAt:now,updatedAt:now,requestedBy:'tester@mindmapdigital.ai',briefing:'Synthetic UI test only, no real client data.',qcPolicy:{cleanLoops:null,maxLoops:null}};
 const stages=[{id:'W3-1',title:'Recording intake',kind:'task',approvers:[]},{id:'W3-G1',title:'Confirm requirements',kind:'gate',approvers:['consultant']}];
 const progress={checkedAt:now,queuedAt:null,lastDispatcherAt:new Date(Date.now()-2*3600000).toISOString(),workers:[],reviewQueued:0,reviewCompleted:0,reviewTotal:0};
 const sources=[],uploads=new Map();
 function detail(){return {case:pursuit,stages,progress:{...progress,checkedAt:new Date().toISOString()},sources,artifacts:[],team:[],canManage:true,canEditSources:true,canUploadInternal:false,availableTeam:[],reviews:[],gateFeedback:[],events:[],sourceNotices:[]};}
 await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
   const reply=(body,status=200)=>route.fulfill({json:body,status});
   if(path==='/api/workspace')return reply({configured:true,user:{name:'Synthetic tester',email:'tester@mindmapdigital.ai',roles:['consultant']}});
   if(path==='/api/cases')return reply({cases:[pursuit]});
   if(path===`/api/cases/${caseId}`){polls++;return reply(detail());}
   if(path.endsWith('/uploads')){const data=req.postDataJSON();assert.equal(data.version,pursuit.version);const id=randomUUID();uploads.set(id,{...data,chunks:[]});return reply({id,chunkSize:2097152,nextOffset:0},201);}
   if(path.includes('/uploads/')){const id=path.split('/').at(-1),upload=uploads.get(id);assert.ok(upload);if(method==='PUT'){upload.chunks.push(req.postDataBuffer());return reply({nextOffset:Buffer.concat(upload.chunks).length});}
     const bytes=Buffer.concat(upload.chunks);assert.equal(createHash('sha256').update(bytes).digest('hex'),upload.sha256);const {sourceContext}=req.postDataJSON();sources.push({id,filename:upload.filename,mime_type:upload.mimeType,sha256:upload.sha256,size:bytes.length,visibility:upload.visibility,active:true,provenance:{context:sourceContext}});pursuit.version++;pursuit.sourceRevision++;return reply({id,version:pursuit.version});}
   if(path.includes('/sources/')&&method==='PATCH'){const file=sources.find(f=>f.id===path.split('/').at(-1));assert.ok(file);const body=req.postDataJSON();assert.equal(body.version,pursuit.version);file.provenance.context=body.sourceContext;pursuit.version++;pursuit.sourceRevision++;return reply({saved:true,version:pursuit.version});}
   if(path.endsWith('/decision')){pursuit.version++;pursuit.status='queued';progress.queuedAt=now;return reply({saved:true});}
   throw new Error(`Unexpected fixture request: ${method} ${path}`);
 });
 await page.goto(origin.href);await page.getByRole('button',{name:/Synthetic source context request/}).click();
 await page.getByRole('region',{name:'Pursuit progress'}).waitFor().catch(()=>page.locator('[aria-label="Pursuit progress"]').waitFor());
 const picker=page.getByLabel('Choose source files');assert.equal(await picker.getAttribute('multiple'),'');
 await picker.setInputFiles([{name:'buyer-answers.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic buyer answers.')},{name:'call-notes.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic call transcript.')}]);
 await page.getByRole('heading',{name:'2 files selected'}).waitFor();
 await page.getByLabel('buyer-answers.txt file type').selectOption('answers');await page.getByLabel('buyer-answers.txt label',{exact:true}).fill('Latest buyer answers');
 await page.getByLabel('buyer-answers.txt context',{exact:true}).fill('Use these answers before asking more questions.');
 await page.getByLabel('call-notes.txt file type').selectOption('transcript');await page.getByLabel('call-notes.txt context',{exact:true}).fill('Customer call notes; <script>window.contextInjected=true</script>');
 await page.getByRole('button',{name:'Upload 2 files',exact:true}).click();await page.getByText('2 files saved in this batch.',{exact:false}).waitFor();
 assert.equal(sources.length,2);assert.equal(sources[0].provenance.context.label,'Latest buyer answers');assert.equal(sources[1].provenance.context.category,'transcript');assert.equal(await page.evaluate(()=>window.contextInjected),undefined);
 await page.getByRole('button',{name:'Edit context',exact:true}).first().click();await page.getByLabel('buyer-answers.txt context',{exact:true}).fill('Updated context supplied by the submitter.');await page.getByRole('button',{name:'Save context',exact:true}).click();await page.getByText('Source context saved for the next agent session.',{exact:true}).waitFor();
 assert.equal(sources[0].provenance.context.notes,'Updated context supplied by the submitter.');
 await page.getByRole('button',{name:'Confirm workflow',exact:true}).click();await page.getByText('Queued — dispatcher check overdue',{exact:true}).waitFor();
 assert.equal(await page.getByText('Waiting for Codex',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Edit context',exact:true}).count(),0);
 pursuit.status='running';progress.workers=[{kind:'stage',name:'fixture-worker',leaseExpiresAt:new Date(Date.now()+300000).toISOString()}];
 const before=polls;await page.waitForFunction(()=>document.body.textContent.includes('Zora is working on this step'),{timeout:22000});assert.ok(polls>before);
 await page.getByText('fixture-worker',{exact:true}).waitFor();
 assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Body must fit the viewport');
 assert.ok(await page.locator('.detail-modal').evaluate(el=>el.scrollWidth<=el.clientWidth),'Modal must fit the viewport');
 await page.locator('.detail-modal').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`/workspace/solve-environment/zora-source-progress-${width}.png`,fullPage:true});await context.close();
 }assert.deepEqual(errors,[]);console.log('Compiled desktop/mobile UI passed: two-file selection, per-file context, upload persistence, context editing, safe text, overdue/active status, live polling and no overflow/page errors.');
}finally{await browser.close();}
