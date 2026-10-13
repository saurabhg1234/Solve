'use client';
import { useState,type FormEvent } from 'react';
import type { CaseRecord } from '@/lib/catalogue';
import type { GateFeedback as Feedback } from '@/lib/gate-feedback';
import type { PursuitFile } from './case-files';

type Issue={artifactId:string;location:string;severity:string;scope:string;description:string;evidence:string};
const blank=():Issue=>({artifactId:'',location:'',severity:'',scope:'document',description:'',evidence:''});
export function GateFeedback({pursuit,stageId,feedback,artifacts,canManage,canReject,refresh,onBusy}:{pursuit:CaseRecord;stageId?:string;feedback:Feedback[];artifacts:PursuitFile[];canManage:boolean;canReject:boolean;refresh:()=>Promise<void>;onBusy:(v:boolean)=>void}){
  const documentGate=['W3-G3','W3-G4','W4-G3','W4-G4'].includes(stageId||'');
  const [note,setNote]=useState(''),[issues,setIssues]=useState<Issue[]>(documentGate?[blank()]:[]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const files=artifacts.filter(f=>f.source_revision===pursuit.sourceRevision&&f.state==='completed'&&['draft','reference','rfi_review'].includes(f.purpose||''));
  const edit=(index:number,field:keyof Issue,value:string)=>setIssues(items=>items.map((item,i)=>i===index?{...item,[field]:value}:item));
  async function send(path:string,body:unknown){
    setBusy(true);onBusy(true);setError('');
    try{const r=await fetch(`/api/cases/${pursuit.id}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Feedback was not saved');}finally{setBusy(false);onBusy(false);}
  }
  async function reject(e:FormEvent){e.preventDefault();await send('decision',{version:pursuit.version,action:'reject',note,findings:issues});}
  if(!feedback.length&&!canReject)return null;
  return <section className="gate-feedback"><h3>Human review feedback</h3>
    {feedback.map(item=><article className="feedback-record" key={item.id}>
      <div className="files-heading"><strong>{item.stage_id} · Version {item.case_version}</strong><span className="status-pill">{item.escalation_required?'Trust reset required':item.state==='reworking'?'Correction in progress':item.state==='addressed'?'Approved after correction':item.state==='superseded'?'Earlier revision':'Correction requested'}</span></div>
      <small>{item.created_by} · {new Date(item.created_at).toLocaleDateString('en-GB')}</small>
      {item.note===null?<p>Detailed feedback is restricted to assigned internal reviewers.</p>:<><p className="feedback-note">{item.note}</p>{item.findings?.map((finding,index)=><blockquote key={index}><strong>{finding.severity} · {finding.filename} · {finding.location}</strong><p>{finding.description}</p><p>{finding.evidence}</p><small>{finding.qcEscape?'New issue not recorded by QC':'Linked to the exact existing QC finding'} · {finding.scope==='commercials'?'Commercials only':'Document content'} · File hash {finding.sha256.slice(0,12)}</small></blockquote>)}</>}
      {item.escalation_required&&<div className="escalation-explanations"><p><strong>Drafter explanations: {item.explanationCount} of {item.findingCount} recorded.</strong> Fresh whole-document re-evaluation and independent checks are still required.</p>{item.explanations?.map(explanation=><details key={explanation.findingIndex}><summary>Issue {explanation.findingIndex+1} · {explanation.cause.replaceAll('_',' ')} · Drafter explanation</summary><p><strong>Root cause:</strong> {explanation.rootCause}</p><p><strong>Why checks missed it:</strong> {explanation.whyChecksMissedIt}</p><p><strong>Planned correction:</strong> {explanation.correctionPlan}</p><small>Recorded {new Date(explanation.recordedAt).toLocaleString('en-GB')} · File hash {explanation.sha256.slice(0,12)}</small></details>)}{item.explanationCount>0&&item.explanations===null&&<p>Explanation details are available to assigned internal reviewers.</p>}</div>}
      {item.escalation_required?<p className="feedback-hold">{item.explanationCount===item.findingCount&&item.findingCount>0?'A fresh whole-document re-evaluation is still required':'An explanation and a fresh whole-document re-evaluation are required'}, followed by independent checks from {item.return_stage}. Ordinary rework or opening a revision does not resolve this escalation.</p>:<p>Correction route: {item.return_stage}. Later checks and human approvals run again.</p>}
      {canManage&&!item.escalation_required&&item.state==='open'&&pursuit.status==='blocked'&&item.stage_id===stageId&&item.source_revision===pursuit.sourceRevision&&item.case_version<pursuit.version&&<button className="button secondary" disabled={busy} onClick={()=>void send('revision',{version:pursuit.version,action:'rework',feedbackId:item.id,note:'Start the correction recorded in this human gate feedback.'})}>Start correction</button>}
    </article>)}
    {canReject&&<details className="gate-feedback-form"><summary>Request revision</summary><form onSubmit={e=>void reject(e)}>
      <p>{documentGate?'Record the exact file and location for every document issue. Major, critical or previously unlogged issues require a trust reset.':'Explain the correction needed. Add file-specific issues where useful.'}</p>
      <label>Revision note<textarea required maxLength={5000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What should change before you can approve?"/></label>
      {issues.map((issue,index)=><fieldset key={index}><legend>Issue {index+1}</legend>
        <label htmlFor={`feedback-file-${index}`}>File</label><select id={`feedback-file-${index}`} required value={issue.artifactId} onChange={e=>edit(index,'artifactId',e.target.value)}><option value="">Select a current review file</option>{files.map(f=><option key={f.id} value={f.id}>{f.filename} · {f.stage_id} · Version {f.case_version}</option>)}</select>
        <label>Page, slide or section<input required maxLength={500} value={issue.location} onChange={e=>edit(index,'location',e.target.value)} placeholder="For example: slide 8, data sources"/></label>
        <div className="feedback-fields"><div><label htmlFor={`feedback-severity-${index}`}>Severity</label><select id={`feedback-severity-${index}`} required value={issue.severity} onChange={e=>edit(index,'severity',e.target.value)}><option value="">Select severity</option><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></div><div><label htmlFor={`feedback-impact-${index}`}>Impact</label><select id={`feedback-impact-${index}`} value={issue.scope} onChange={e=>edit(index,'scope',e.target.value)}><option value="document">Document content</option><option value="commercials">Commercials only</option></select></div></div>
        <label>Issue description<textarea required minLength={10} maxLength={2000} value={issue.description} onChange={e=>edit(index,'description',e.target.value)}/></label>
        <label>Evidence or expected correction<textarea required minLength={5} maxLength={4000} value={issue.evidence} onChange={e=>edit(index,'evidence',e.target.value)}/></label>
        {(!documentGate||issues.length>1)&&<button type="button" className="text-button" onClick={()=>setIssues(items=>items.filter((_,i)=>i!==index))}>Remove issue</button>}
      </fieldset>)}
      <div className="detail-actions"><button type="button" className="button secondary" disabled={busy||issues.length>=20} onClick={()=>setIssues(items=>[...items,blank()])}>Add issue</button><button type="submit" className="button primary" disabled={busy}>Save revision request</button></div>
    </form></details>}
    {error&&<p role="alert" className="error-message">{error}</p>}
  </section>;
}
