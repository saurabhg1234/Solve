/** Local compiled UI fixture. Synthetic files only; no production calls. */
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const {chromium}=await import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const origin=new URL(process.env.ZORA_UI_TEST_ORIGIN||'http://127.0.0.1:3003');assert.equal(origin.hostname,'127.0.0.1');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const id=randomUUID(),now=new Date().toISOString(),bytes=Buffer.from('Synthetic corrected proposal. Formal independent QC is separate.'),hash=createHash('sha256').update(bytes).digest('hex');
  const file={id:randomUUID(),filename:'corrected-proposal.txt',mime_type:'text/plain',sha256:hash,size:bytes.length};
  const bad={...file,id:randomUUID(),filename:'bad-transfer.txt',sha256:'0'.repeat(64)};
  const c={id,title:'Delivered proposal fixture',client:'Synthetic',workflow:'W3',stageIndex:0,status:'queued',version:5,sourceRevision:3,requestedBy:'tester@mindmapdigital.ai',briefing:'Synthetic meeting notes.',qcPolicy:{cleanLoops:1,maxLoops:3},source:'manual',createdAt:now,updatedAt:now};
  const detail={case:c,sources:[],artifacts:[],team:[],canManage:true,canEditSources:true,canUploadInternal:false,availableTeam:[],sourceNotices:[],reviews:[],gateFeedback:[],events:[{type:'work.delivered',actor:'zora-native-session',created_at:now}],stages:[{id:'W3-1',title:'Discovery intake',kind:'task',approvers:[]}],progress:{executionMode:'on_request',reviewPurpose:'existing_draft',checkedAt:now,queuedAt:now,lastDispatcherAt:new Date(Date.now()-6*3600000).toISOString(),workers:[],reviewQueued:10,reviewCompleted:0,reviewTotal:10},deliveries:[{id:randomUUID(),title:'Corrected proposal and review record',summary:'Completed 11 corrections. <script>window.untrusted=true</script>',visibility:'client',case_version:5,source_revision:3,created_at:now,files:[file,bad]},{id:randomUUID(),title:'Earlier work',summary:'Preserved earlier revision.',visibility:'client',case_version:2,source_revision:1,created_at:now,files:[]}]};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/workspace')return route.fulfill({json:{configured:true,user:{name:'Fixture',email:c.requestedBy,roles:['consultant']}}});
    if(path==='/api/cases')return route.fulfill({json:{cases:[c]}});
    if(path==='/api/mailbox/status')return route.fulfill({json:{executionMode:'on_request',checkedAt:now,subscriptionExpiresAt:new Date(Date.now()+86400000).toISOString(),lastSyncAt:now,lastScheduledAt:now,scheduledOk:true,pendingMessages:0,intervalMinutes:5,lastDispatcherAt:new Date(Date.now()-6*3600000).toISOString()}});
    if(path==='/api/inbox')return route.fulfill({json:{messages:[]}});
    if(path===`/api/cases/${id}`)return route.fulfill({json:detail});
    if([file,bad].some(f=>path===`/api/cases/${id}/files/deliveries/${f.id}`))return route.fulfill({body:bytes,contentType:'text/plain'});
    throw Error('Unexpected local fixture request: '+path);
  });
  await page.goto(origin.href);await page.getByRole('button',{name:/Delivered proposal fixture/}).click();
  const section=page.getByRole('region',{name:'Completed work'});await section.waitFor();
  assert.ok((await section.innerText()).includes('Current source revision'));assert.ok((await section.innerText()).includes('Earlier source revision'));assert.equal(await page.evaluate(()=>window.untrusted),undefined);
  assert.ok((await page.locator('[aria-label="Pursuit progress"]').innerText()).includes('0 of 10 independent checks recorded'));assert.ok(!(await page.locator('[aria-label="Pursuit progress"]').innerText()).includes('dispatcher'));assert.equal(await page.getByRole('button',{name:'Approve this gate',exact:true}).count(),0);
  const event=page.waitForEvent('download');await section.getByRole('button',{name:/corrected-proposal.txt/}).click();const download=await event;const path=await download.path();assert.ok(path);assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash);
  await section.getByRole('button',{name:/bad-transfer.txt/}).click();await section.getByRole('alert').waitFor();assert.match(await section.getByRole('alert').innerText(),/did not match/);
  assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth));assert.ok(await page.locator('.detail-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await section.scrollIntoViewIfNeeded();await page.screenshot({path:`/workspace/solve-environment/zora-direct-delivery-${width}.png`});await page.getByRole('button',{name:'Close pursuit',exact:true}).click();await page.getByRole('button',{name:'Connections',exact:true}).click();await page.getByText('On request · active agent session',{exact:true}).waitFor();assert.equal(await page.getByText('Hourly dispatch',{exact:true}).count(),0);await context.close();
}assert.deepEqual(errors,[]);console.log('Compiled direct-work UI passed at 1440/390px: visible completed files, exact downloads, corrupt transfer rejection, inert summary, earlier-revision label, truthful QC counts, no stale-dispatcher prompt, no overflow/page errors.');}
finally{await browser.close();}
