import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflows } from '../lib/catalogue';
import { stagesFor,approvalComplete,canApprove,validateCoverage,constantTimeEqual,requirementCount } from '../lib/engine';
import { brandedEmail,ownsMessage } from '../lib/email';
import { safeOutputPath,resultSchema,needsIndependentReview } from '../lib/result';
import { safeGraphUrl } from '../lib/microsoft';
import { notificationUrl } from '../lib/config';

test('all eight workflows retain unique BRD stages and human gates',()=>{
  assert.equal(workflows.length,8);assert.equal(requirementCount,272);
  for(const workflow of workflows){const stages=stagesFor(workflow.id);assert.ok(stages.length>0);assert.equal(new Set(stages.map(s=>s.id)).size,stages.length);assert.ok(stages.some(s=>s.kind==='gate'));}
});
test('proposal commercials occur after human proofreading, with both S1 gates before deep QC',()=>{
  for(const workflow of ['W3','W4'] as const){const s=stagesFor(workflow).map(s=>s.id);assert.ok(s.indexOf(`${workflow}-G3`)<s.indexOf('S1-1'));assert.ok(s.indexOf('S1-G1')<s.indexOf('S1-G2'));assert.ok(s.indexOf('S1-10')<s.indexOf(`${workflow}-${workflow==='W3'?'20':'23'}`));assert.equal(s.at(-1),`${workflow}-G4`);}
});
test('an admin role does not bypass technical or pricing approval',()=>{
  const s=stagesFor('W3','brd');assert.equal(canApprove(s.find(s=>s.id==='W3-G2')!,['admin']),false);assert.equal(canApprove(s.find(s=>s.id==='S1-G2')!,['consultant']),false);assert.equal(canApprove(s.find(s=>s.id==='S1-G2')!,['pricing_owner']),true);
});
test('joint effort approval needs architect and delivery lead',()=>{
  const gate=stagesFor('W3','brd').find(s=>s.id==='S1-G1')!;assert.equal(approvalComplete(gate,['architect']),false);assert.equal(approvalComplete(gate,['architect','delivery_lead']),true);
});
test('demo readiness requires domain owner, consultant and demo builder',()=>{
  const gate=stagesFor('W6','brd').find(s=>s.id==='W6-G2')!;assert.equal(approvalComplete(gate,['domain_owner','consultant']),false);assert.equal(approvalComplete(gate,['domain_owner','consultant','demo_builder']),true);
});
test('pilot delegates technical reviews to Codex without granting it human approval roles',()=>{
  for(const workflow of ['W3','W4','W6'] as const){
    const stages=stagesFor(workflow,'mindmap-pilot');
    for(const stage of stages.filter(s=>['W3-G2','W4-G2','S1-G1','W6-G1'].includes(s.id))){
      assert.equal(stage.kind,'task');assert.deepEqual(stage.approvers,[]);assert.equal(needsIndependentReview(stage.id),true);assert.equal(canApprove(stage,['admin','architect','domain_owner']),false);
    }
    assert.ok(stages.filter(s=>s.kind==='gate').every(s=>!s.approvers.some(r=>['architect','domain_owner','delivery_lead'].includes(r))));
    if(workflow!=='W6')assert.equal(stages.at(-1)?.kind,'gate');
    else assert.equal(stages.find(s=>s.id==='W6-G2')?.kind,'gate');
  }
  const demo=stagesFor('W6','mindmap-pilot').find(s=>s.id==='W6-G2')!;
  assert.equal(approvalComplete(demo,['consultant']),false);assert.equal(approvalComplete(demo,['consultant','demo_builder']),true);
  const price=stagesFor('W3','mindmap-pilot').find(s=>s.id==='S1-G2')!;
  assert.equal(canApprove(price,['consultant','admin']),false);assert.equal(canApprove(price,['pricing_owner']),true);
});
test('empty, duplicate, incomplete or extra QC coverage cannot pass',()=>{
  assert.equal(validateCoverage({expectedElementIds:[],checkedElementIds:[]}),false);
  assert.equal(validateCoverage({expectedElementIds:['p1','p2'],checkedElementIds:['p1']}),false);
  assert.equal(validateCoverage({expectedElementIds:['p1','p2'],checkedElementIds:['p1','p1']}),false);
  assert.equal(validateCoverage({expectedElementIds:['p1'],checkedElementIds:['p1','fake']}),false);
  assert.equal(validateCoverage({expectedElementIds:['p1','p2'],checkedElementIds:['p2','p1']}),true);
});
test('Zora ownership is explicit and a Jarvis category prevents processing',()=>{
  assert.equal(ownsMessage('Please prepare a proposal'),false);assert.equal(ownsMessage('[zora] W4 Response'),true);assert.equal(ownsMessage('[ZORA] [JARVIS] proposal',['Jarvis']),false);assert.equal(ownsMessage('[ZORA] [JARVIS] proposal'),false);assert.equal(ownsMessage('[JARVIS] Request'),false);
});
test('magenta email stripe is present and source text cannot inject HTML',()=>{
  const html=brandedEmail('Hello,\n\n<script>alert(1)</script> & proposal');assert.ok(html.includes('background:#d62ca4'));assert.ok(html.indexOf('height="6"')<html.indexOf('for Mindmap Digital'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Prepared by Zora'));
});
test('worker output paths reject traversal, absolute paths and Windows separators',()=>{
  assert.equal(safeOutputPath('outputs/client/proposal.docx'),true);for(const p of ['../../secret','/etc/passwd','outputs/client/../../secret','outputs\\client\\file','outputs/client/file\n'])assert.equal(safeOutputPath(p),false);
});
test('Microsoft continuation links cannot send credentials to another host',()=>{
  assert.equal(safeGraphUrl('users/test/mailFolders/f/messages'),'https://graph.microsoft.com/v1.0/users/test/mailFolders/f/messages');for(const url of ['https://evil.example/v1.0/messages','http://graph.microsoft.com/v1.0/messages','https://graph.microsoft.com.evil.example/v1.0/messages'])assert.throws(()=>safeGraphUrl(url));
});
test('worker result cannot claim release or omit evidence fields',()=>{
  assert.equal(resultSchema.safeParse({status:'released',summary:'Looks good',outputFiles:[]}).success,false);assert.equal(resultSchema.safeParse({status:'blocked',summary:'The Word template is missing.',missingInputs:['Word template'],outputFiles:[],citations:[],reviewReports:[]}).success,true);for(const stage of ['W1-12','W2-5','W3-16','W4-16','W5-10','W6-9','W7-6','W8-3'])assert.equal(needsIndependentReview(stage),true);
});
test('authentication comparisons reject missing or mismatched values',()=>{assert.equal(constantTimeEqual('abc','abc'),true);assert.equal(constantTimeEqual('abc','abd'),false);assert.equal(constantTimeEqual('abc',''),false);});
test('protected-hosting callback retains only its own path and encoded automation bypass',()=>{
  const plain=notificationUrl('https://zora.example','');assert.equal(plain,'https://zora.example/api/microsoft/notifications');
  const url=new URL(notificationUrl('https://zora.example','synthetic+bypass&value'));assert.equal(url.pathname,'/api/microsoft/notifications');assert.equal(url.searchParams.get('x-vercel-protection-bypass'),'synthetic+bypass&value');assert.equal([...url.searchParams.keys()].length,1);
});
