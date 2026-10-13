import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { gateFindingSchema,gateReturnStage,needsGateEscalation } from '../lib/gate-feedback';
import { stagesFor } from '../lib/engine';

test('document gate escalation follows severity and prior-QC evidence, not workflow-wide contradictions',()=>{
  for(const stage of ['W3-G3','W3-G4','W4-G3','W4-G4']){
    assert.equal(needsGateEscalation(stage,[{severity:'minor',qcEscape:true}]),true);
    assert.equal(needsGateEscalation(stage,[{severity:'minor',qcEscape:false}]),false);
    for(const severity of ['major','critical'] as const)assert.equal(needsGateEscalation(stage,[{severity,qcEscape:false}]),true);
  }
  for(const stage of ['W1-G2','W3-G1','W4-G1','W8-G1','S1-G2'])assert.equal(needsGateEscalation(stage,[{severity:'critical',qcEscape:true}]),false);
});
test('document gate return points preserve the BRD commercial/document distinction',()=>{
  assert.equal(gateReturnStage('W3','W3-G3',[]),'W3-17');assert.equal(gateReturnStage('W4','W4-G3',[]),'W4-18');
  for(const workflow of ['W3','W4'] as const){
    assert.equal(gateReturnStage(workflow,workflow+'-G4',[{scope:'commercials'}]),workflow==='W3'?'W3-20':'W4-23');
    for(const findings of [[],[{scope:'document' as const}],[{scope:'commercials' as const},{scope:'document' as const}]])assert.equal(gateReturnStage(workflow,workflow+'-G4',findings),workflow==='W3'?'W3-17':'W4-18');
  }
});
test('each human gate correction returns to an earlier task and therefore repeats downstream gates',()=>{
  for(const policy of ['brd','mindmap-pilot'] as const)for(const workflow of ['W1','W2','W3','W4','W5','W6','W7','W8'] as const){
    const stages=stagesFor(workflow,policy);
    for(const [index,gate] of stages.entries())if(gate.kind==='gate'){
      const target=stages.findIndex(s=>s.id===gateReturnStage(workflow,gate.id,[])&&s.kind==='task');assert.ok(target>=0&&target<index,gate.id);
    }
  }
  assert.throws(()=>gateReturnStage('W8','invented-gate',[]));
});
test('file-linked findings reject missing evidence, invented severity and client-supplied QC escape flags',()=>{
  const valid={artifactId:randomUUID(),location:'Slide 4, assumptions',severity:'minor',scope:'document',description:'A source requirement is omitted.',evidence:'The source explicitly requires the missing item.'};
  assert.equal(gateFindingSchema.safeParse(valid).success,true);
  for(const changed of [{...valid,evidence:''},{...valid,artifactId:'other-file'},{...valid,severity:'cosmetic'},{...valid,location:''},{...valid,qcEscape:false},{...valid,previousFinding:{reviewId:randomUUID(),index:-1}}])assert.equal(gateFindingSchema.safeParse(changed).success,false);
});
