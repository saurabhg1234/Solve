'use client';
import {useState} from 'react';
import type {CaseRecord} from '@/lib/catalogue';
import type {PursuitFile} from './case-files';
import type {QcRun} from './case-review';

export function ExistingDraftReview({pursuit,sources,runs,canManage,refresh,onBusy}:{pursuit:CaseRecord;sources:PursuitFile[];runs:QcRun[];canManage:boolean;refresh:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
  const [roles,setRoles]=useState<Record<string,string>>({}),[brief,setBrief]=useState(pursuit.briefing),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=runs.find(r=>r.purpose==='existing_draft'&&r.state==='reviewing');
  if(!canManage||!['W3','W4'].includes(pursuit.workflow))return null;
  const eligible=pursuit.stageIndex===0&&['awaiting_confirmation','blocked'].includes(pursuit.status);
  if(!eligible&&!active)return null;
  async function submit(cancel=false){
    setBusy(true);onBusy(true);setError('');
    try{
      const response=await fetch(`/api/cases/${pursuit.id}/existing-review`,{method:cancel?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cancel?{version:pursuit.version,runId:active!.id}:{version:pursuit.version,brief,draftSourceIds:Object.keys(roles).filter(id=>roles[id]==='draft'),sourceIds:Object.keys(roles).filter(id=>roles[id]==='source')})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Review could not be saved');}finally{setBusy(false);onBusy(false);}
  }
  return <section className="existing-draft-review"><h3>Review an existing proposal</h3>
    {active?<><p>The selected proposal and notes are queued for ten independent checks. The normal workflow stays at its current position.</p><button className="button secondary" disabled={busy} onClick={()=>void submit(true)}>Cancel existing proposal review</button></>:<details><summary>Choose a proposal and its supporting notes</summary>
      <p>Use this when a proposal is already drafted. Select each file’s role; leave prior reviews and working notes excluded. A proposal cannot prove its own claims.</p>
      <label>Meeting notes or requirements for this review<textarea rows={5} maxLength={20000} value={brief} onChange={e=>setBrief(e.target.value)}/></label>
      <p className="subtle-note">Keep original requirements and meeting notes here. Remove earlier review findings or agent reasoning. A meeting transcript is optional.</p>
      <div className="existing-review-files">{sources.filter(f=>f.active!==false).map(file=><label key={file.id}><span>{file.filename}{file.visibility==='internal'?' · Internal':''}</span><select aria-label={`Review role for ${file.filename}`} value={roles[file.id]||'excluded'} onChange={e=>setRoles(current=>({...current,[file.id]:e.target.value}))}><option value="excluded">Exclude from review</option><option value="draft">Proposal to review</option><option value="source">Supporting source</option></select></label>)}</div>
      {!sources.some(f=>f.active!==false)&&<p>Upload your existing proposal in Source files above.</p>}
      <p className="subtle-note">Ten fresh passes cover D1–D8, with separate second passes for D1 and D3. Findings do not stop the other checks. This diagnostic review does not approve requirements, prices or release, or replace later workflow QC.</p>
      <button className="button primary" disabled={busy||brief.trim().length<10||!Object.values(roles).includes('draft')} onClick={()=>void submit()}>{busy?'Preparing review…':'Start existing proposal review'}</button>
    </details>}
    {error&&<div className="error-message" role="alert">{error}</div>}
  </section>;
}
