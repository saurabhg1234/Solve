/** Compiled browser contract fixture. All API calls are intercepted; no production data or sends. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const {chromium}=await import(process.env.ZORA_PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const origin=new URL(process.env.ZORA_UI_TEST_ORIGIN||'http://127.0.0.1:3003');assert.equal(origin.hostname,'127.0.0.1');
const browser=await chromium.launch({executablePath:process.env.ZORA_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const id=randomUUID(),draftId=randomUUID(),sourceId=randomUUID(),reportId=randomUUID(),now=new Date().toISOString();let posted=0,cancelled=0;
  const pursuit={id,title:'Existing proposal fixture',client:'Synthetic only',workflow:'W3',stageIndex:0,status:'blocked',version:4,sourceRevision:3,requestedBy:'tester@mindmapdigital.ai',briefing:'Meeting notes: invoice reconciliation needs human exception approval.',qcPolicy:{cleanLoops:1,maxLoops:3},source:'manual',createdAt:now,updatedAt:now};
  const sources=[{id:draftId,filename:'proposal.docx'},{id:sourceId,filename:'buyer-notes.txt'},{id:reportId,filename:'earlier-review.txt'}].map(f=>({...f,mime_type:'text/plain',size:100,sha256:'a'.repeat(64),visibility:'client',active:true}));let reviews=[];
  const progress={checkedAt:now,queuedAt:null,lastDispatcherAt:new Date(Date.now()-3*3600000).toISOString(),workers:[],reviewQueued:0,reviewCompleted:0,reviewTotal:0};
  const detail=()=>({case:pursuit,sources,artifacts:[],team:[],canManage:true,canEditSources:true,canUploadInternal:false,availableTeam:[],sourceNotices:[],reviews,gateFeedback:[],events:[],stages:[{id:'W3-1',title:'Discovery input intake',kind:'task',approvers:[]},{id:'W3-G1',title:'Confirm requirements',kind:'gate',approvers:['consultant']}],progress});
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    const reply=(json,status=200)=>route.fulfill({json,status});
    if(path==='/api/workspace')return reply({configured:true,user:{name:'Fixture',email:'tester@mindmapdigital.ai',roles:['consultant']}});
    if(path==='/api/cases')return reply({cases:[pursuit]});
    if(path===`/api/cases/${id}`)return reply(detail());
    if(path===`/api/cases/${id}/existing-review`){
      const body=request.postDataJSON();assert.equal(body.version,pursuit.version);
      if(request.method()==='POST'){
        assert.deepEqual(body.draftSourceIds,[draftId]);assert.deepEqual(body.sourceIds,[sourceId]);assert.equal(body.brief,pursuit.briefing);posted++;
        const runId=randomUUID();reviews=[{id:runId,purpose:'existing_draft',caseVersion:5,sourceRevision:3,stageId:'EXISTING-PROPOSAL',state:'reviewing',loop:1,cleanStreak:0,elementCount:100,restricted:false,missingInputs:[],passes:['D1','D1','D2','D3','D3','D4','D5','D6','D7','D8'].map((checker,i)=>({checker,pass_number:i===1||i===4?2:1,loop_number:1,state:'queued',checked:0,findingCount:0}))}];pursuit.version++;pursuit.status='queued';Object.assign(progress,{reviewPurpose:'existing_draft',queuedAt:now,reviewQueued:10,reviewTotal:10});return reply({runId,passes:10},201);
      }
      assert.equal(request.method(),'DELETE');assert.equal(body.runId,reviews[0].id);cancelled++;pursuit.status='blocked';pursuit.version++;reviews[0].state='blocked';reviews[0].missingInputs=['Cancelled by pursuit manager'];Object.assign(progress,{reviewPurpose:null,reviewQueued:0,reviewTotal:0});return reply({cancelled:true});
    }
    throw Error(`Unexpected fixture request ${request.method()} ${path}`);
  });
  await page.goto(origin.href);await page.getByRole('button',{name:/Existing proposal fixture/}).click();
  await page.getByText('Choose a proposal and its supporting notes',{exact:true}).click();
  const start=page.getByRole('button',{name:'Start existing proposal review',exact:true});assert.equal(await start.isDisabled(),true);
  await page.getByLabel('Review role for proposal.docx',{exact:true}).selectOption('draft');
  await page.getByLabel('Review role for buyer-notes.txt',{exact:true}).selectOption('source');
  assert.equal(await page.getByLabel('Review role for earlier-review.txt',{exact:true}).inputValue(),'excluded');
  assert.equal(await start.isEnabled(),true);await start.click();
  await page.getByText('Waiting for independent reviewers',{exact:true}).waitFor();
  assert.equal(posted,1);await page.getByText('Existing proposal diagnostic',{exact:true}).waitFor();
  assert.ok((await page.locator('[aria-label="Pursuit progress"]').innerText()).includes('dispatcher check is overdue'));
  assert.ok((await page.locator('[aria-label="Pursuit progress"]').innerText()).includes('Existing proposal review'));
  assert.equal(await page.getByRole('button',{name:'Approve this gate',exact:true}).count(),0);
  assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth));
  await page.locator('.existing-draft-review').scrollIntoViewIfNeeded();await page.screenshot({path:`/workspace/solve-environment/zora-existing-draft-${width}.png`});
  await page.getByRole('button',{name:'Cancel existing proposal review',exact:true}).click();await page.getByText('Cancelled by pursuit manager',{exact:true}).waitFor();assert.equal(cancelled,1);
  await context.close();
}assert.deepEqual(errors,[]);console.log('Compiled existing-proposal UI passed at 1440px and 390px: explicit file roles, excluded prior report, exact notes, queued ten-pass progress, overdue dispatcher, cancellation, no approval button, zero overflow/page errors.');}
finally{await browser.close();}
