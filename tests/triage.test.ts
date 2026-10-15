import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainText,proposeWorkflow,pursuitTitle } from '../lib/triage';

test('automatic intake proposes a workflow only from an explicit tag or unambiguous request wording',()=>{
  assert.deepEqual(proposeWorkflow('[ZORA] W4 Acme portal response','').workflow,'W4');
  assert.equal(proposeWorkflow('[ZORA] W4 Acme portal response','').basis,'explicit');
  assert.equal(proposeWorkflow('[ZORA] Acme','Please prepare our response to the attached RFP by Friday.').workflow,'W4');
  assert.equal(proposeWorkflow('[ZORA] Acme','Please draft an email to the client thanking them.').workflow,'W8');
  assert.equal(proposeWorkflow('[ZORA] Acme','Here is the call transcript; turn it into a proposal.').workflow,'W3');
  assert.equal(proposeWorkflow('[ZORA] Acme','List the clarification questions we should send before the pre-bid queries deadline.').workflow,'W5');
  for(const [subject,body] of [['[ZORA] W3 or W4?',''],['[ZORA] Hello','Can we talk tomorrow?'],['[ZORA] Acme','Read the RFP and draft an email.']]){
    const p=proposeWorkflow(subject,body);assert.equal(p.workflow,null,subject);assert.ok(p.reason.length>10);
  }
  // Words inside other words do not count.
  assert.equal(proposeWorkflow('[ZORA] Acme','Our thoughtful approach').workflow,null);
});
test('email bodies and subjects are normalised without inventing content',()=>{
  assert.equal(plainText('<p>Hello&nbsp;team</p><script>x()</script><p>Line&amp;two</p>'),'Hello team\n\nLine&two');
  assert.equal(pursuitTitle('RE: Fwd: [ZORA] W4 - Acme portal RFP','[ZORA]'),'Acme portal RFP');
  assert.equal(pursuitTitle('[zora]','[ZORA]'),'Email request');
});
