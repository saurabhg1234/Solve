'use client';
import {useState} from 'react';
import {ArrowDownToLine,FileCheck2,Play} from 'lucide-react';
import {DEMO_CASE_ID} from '@/lib/demos/reconciliation';

type DeliveryFile={id:string;filename:string;mime_type:string;sha256:string;size:number};
export type DirectDelivery={id:string;title:string;summary:string;visibility:string;case_version:number;source_revision:number;created_at:string;files:DeliveryFile[]};
export function DirectDeliveries({caseId,sourceRevision,deliveries}:{caseId:string;sourceRevision:number;deliveries:DirectDelivery[]}){
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
  if(!deliveries.length)return null;
  async function download(file:DeliveryFile){
    setBusy(file.id);setError('');
    try{
      const r=await fetch(`/api/cases/${caseId}/files/deliveries/${file.id}`);if(!r.ok)throw new Error('The file could not be downloaded.');
      const bytes=await r.arrayBuffer();if(bytes.byteLength!==file.size)throw new Error('The download was incomplete.');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw new Error('The downloaded file did not match the saved version.');
      const url=URL.createObjectURL(new Blob([bytes],{type:file.mime_type})),a=document.createElement('a');a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e instanceof Error?e.message:'Download failed.');}finally{setBusy(null);}
  }
  return <section className="direct-deliveries" aria-label="Completed work"><h3><FileCheck2 size={20}/> Completed work</h3>{caseId===DEMO_CASE_ID&&<p><a className="button secondary" href="/demos/pentagon" target="_blank" rel="noopener noreferrer"><Play size={16}/> Open invoice reconciliation demo</a></p>}<p className="subtle-note">Open the delivered files below. These are drafts and review notes; independent QC and release approval are shown separately.</p>{deliveries.map(delivery=><article key={delivery.id}><div className="files-heading"><h4>{delivery.title}</h4><span className="small-label">{delivery.source_revision===sourceRevision?'Current source revision':'Earlier source revision'}</span></div><p className="delivery-summary">{delivery.summary}</p><small>{new Date(delivery.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} Dubai · {delivery.visibility==='internal'?'Private work':'Shared with pursuit team'}</small><div className="delivery-downloads">{delivery.files.map(file=><button className="button secondary" key={file.id} disabled={busy!==null} onClick={()=>void download(file)}><ArrowDownToLine size={16}/><span>{file.filename}<small>{Math.ceil(file.size/1024)} KB{busy===file.id?' · Downloading…':''}</small></span></button>)}</div></article>)}{error&&<p role="alert" className="error-message">{error}</p>}</section>;
}
