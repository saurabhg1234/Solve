"""Render Codex-authored W5 questions into separate buyer and internal workbooks."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path
import xlsxwriter
from prepare_sources import prepare

def sha(data): return hashlib.sha256(data).hexdigest()
def text(value,name,limit=8000):
    if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError(f'{name} is required and must fit its explicit bound')
    return value.strip()
def literal(sheet,row,col,value,format_):
    if not isinstance(value,str) or len(value.encode('utf-16-le'))//2>32767: raise ValueError('Workbook cell exceeds Excel text bounds; split its evidence into bounded passages instead of truncating it')
    if sheet.write_string(row,col,value,format_)!=0: raise ValueError('Workbook cell could not be written completely')

def build(plan,root):
    root=root.resolve(strict=True)
    if plan.get('buyerTemplateRequired') is not False: raise ValueError('Buyer template mapping is pending; explicitly confirm no buyer template is required before using the standard two-column sheet')
    cap=plan.get('questionCap')
    if not isinstance(cap,int) or isinstance(cap,bool) or not 1<=cap<=200: raise ValueError('An explicitly configured question cap is required; no business default is applied')
    if not isinstance(plan.get('anonymised'),bool): raise ValueError('Specify whether the buyer Q&A is anonymised')
    prepare(root,max_ocr_pages=0)
    prepared=json.loads((root/'prepared/evidence.json').read_text())
    if prepared['missingInputs']: raise ValueError('Resolve source extraction/transcript holds before preparing questions')
    evidence={r['id']:r for r in prepared['evidence']}
    questions=plan.get('questions')
    if not isinstance(questions,list) or not 1<=len(questions)<=cap: raise ValueError('Questions must be nonempty and within the explicit cap')
    ids=set();wordings=set();rows=[]
    for position,question in enumerate(questions,1):
        identity=text(question.get('id'),'question id',80)
        if identity in ids or question.get('rank')!=position: raise ValueError('Question IDs must be unique and ranks consecutive in impact order')
        ids.add(identity);simple=text(question.get('simple'),'simple question');complex_=text(question.get('complex'),'complex question')
        normalized=re.sub(r'\W+',' ',simple.casefold()).strip()
        if normalized in wordings: raise ValueError('Exact duplicate questions must be merged before export')
        wordings.add(normalized)
        if question.get('answerState')!='not_found': raise ValueError('An already-answered or unchecked question cannot enter the buyer sheet')
        impacts=question.get('impacts',[])
        if not impacts or any(x not in ['design','effort','price','compliance','risk'] for x in impacts): raise ValueError('Every question needs a concrete design/effort/price/compliance/risk impact')
        reason=text(question.get('impactReason'),'impact reason')
        searched=question.get('searchedEvidenceIds',[])
        if not searched or len(set(searched))!=len(searched) or any(x not in evidence for x in searched): raise ValueError('Record actual unique source sections searched for an existing answer')
        citations=question.get('citations',[]);quoted=[]
        for citation in citations:
            record=evidence.get(citation.get('evidenceId'));quote=text(citation.get('quote'),'exact cited passage')
            if not record or quote not in record['text']: raise ValueError('Citations must quote an actual source passage word for word')
            if record.get('needsVisualVerification'): raise ValueError('OCR citations require a verified source copy before buyer question export')
            quoted.append({'record':record,'quote':quote})
        simulation=question.get('simulationGap','')
        if not isinstance(simulation,str) or len(simulation)>8000: raise ValueError('Simulation gap must be a bounded text description')
        if not quoted and (not isinstance(simulation,str) or len(simulation.strip())<20): raise ValueError('A question needs exact quoted evidence or a described simulation stuck point with searched sections')
        references='; '.join(f"{c['record']['filename']} / {c['record']['location']}" for c in quoted) if quoted else 'Simulation gap; searched: '+'; '.join(f"{evidence[e]['filename']} / {evidence[e]['location']}" for e in searched)
        buyer_complex=complex_+'\nReference: '+references
        if plan['anonymised'] and re.search(r'\bmind\s*map(?:\s+digital)?\b',simple+' '+buyer_complex,re.I): raise ValueError('Anonymised buyer questions and references must not name Mindmap; use we/our and neutral source filenames')
        closest=question.get('closestAnswerEvidenceId')
        if closest is not None and closest not in evidence: raise ValueError('Closest answer must reference an actual source passage')
        rows.append({'id':identity,'simple':simple,'complex':buyer_complex,'impacts':', '.join(impacts),'impactReason':reason,'quotes':quoted,'simulationGap':simulation,'searched':searched,'closest':closest})
    dropped=plan.get('dropped',[])
    if not isinstance(dropped,list) or len(dropped)>1000: raise ValueError('Keep a bounded internal list of excluded questions')
    for item in dropped:
        text(item.get('question'),'excluded question');text(item.get('reason'),'exclusion reason')
        if item.get('disposition') not in ['answered','irrelevant','duplicate','cap','contradiction']: raise ValueError('Record why an excluded question was dropped')
    paths={'buyer':'outputs/client/clarification-questions.xlsx','tracker':'outputs/internal/rfi-tracker.xlsx'}
    for value in paths.values():
        path=(root/value).resolve()
        if not path.is_relative_to(root): raise ValueError('Workbook output escapes the private workspace')
        path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    def workbook(path):
        book=xlsxwriter.Workbook(str(path),{'strings_to_formulas':False,'strings_to_urls':False});book.set_properties({'title':'Draft clarification questions','author':'' if plan['anonymised'] else 'Zora','company':''})
        heading=book.add_format({'bold':True,'font_color':'#FFFFFF','bg_color':'#D62CA4','text_wrap':True,'valign':'vcenter','font_size':11})
        cell=book.add_format({'text_wrap':True,'valign':'top','font_size':11,'border':1,'border_color':'#E9DFE7'})
        return book,heading,cell
    buyer=root/paths['buyer'];book,heading,cell=workbook(buyer)
    try:
        sheet=book.add_worksheet('Questions');sheet.freeze_panes(1,0);sheet.set_column(0,0,60);sheet.set_column(1,1,90);sheet.set_row(0,34)
        for col,value in enumerate(['Simple question','Detailed question and document reference']): literal(sheet,0,col,value,heading)
        for row,item in enumerate(rows,1):
            literal(sheet,row,0,item['simple'],cell);literal(sheet,row,1,item['complex'],cell);sheet.set_row(row,min(180,45+12*(len(item['complex'])//110)))
        sheet.autofilter(0,0,len(rows),1);sheet.set_landscape();sheet.fit_to_pages(1,0);sheet.repeat_rows(0);sheet.set_header('&CClarification questions — draft');sheet.set_footer('&CPage &P of &N')
    finally: book.close()
    tracker=root/paths['tracker'];book,heading,cell=workbook(tracker)
    try:
        sheet=book.add_worksheet('Cross-check');headers=['Question ID','Simple question','Detailed question / reference','Decision impact','Impact reason','Exact cited passage','Simulation stuck point','Closest answering passage','Sections searched','Source hashes']
        for col,value in enumerate(headers): literal(sheet,0,col,value,heading)
        sheet.freeze_panes(1,2);sheet.set_column(0,0,18);sheet.set_column(1,9,52)
        for row,item in enumerate(rows,1):
            closest=evidence[item['closest']] if item['closest'] else None
            values=[item['id'],item['simple'],item['complex'],item['impacts'],item['impactReason'],'\n\n'.join(c['quote'] for c in item['quotes']),item['simulationGap'],f"{closest['filename']} / {closest['location']}\n{closest['text']}" if closest else 'None recorded; semantic search still requires independent review.','\n'.join(f"{evidence[e]['filename']} / {evidence[e]['location']}" for e in item['searched']),'\n'.join(sorted({evidence[e]['sourceId']+' / '+evidence[e]['sourceSha256'] for e in item['searched']}))]
            for col,value in enumerate(values): literal(sheet,row,col,str(value),cell)
            sheet.set_row(row,130)
        sheet.autofilter(0,0,len(rows),len(headers)-1)
        exclusions=book.add_worksheet('Excluded questions');exclusions.set_column(0,2,60)
        for col,value in enumerate(['Question','Disposition','Reason']): literal(exclusions,0,col,value,heading)
        for row,item in enumerate(dropped,1):
            for col,value in enumerate([item['question'],item['disposition'],item['reason']]): literal(exclusions,row,col,value,cell)
        notes=book.add_worksheet('Review notes');notes.set_column(0,0,110)
        for row,value in enumerate(['INTERNAL — never send this tracker to the buyer.','Draft export only. Answer search, relevance, simulation, exact section verification, simplification, semantic deduplication, anonymity and fresh independent QC remain required.','Configured question cap: '+str(cap),'Source extraction is unverified evidence; exporting does not record a human decision.','A consultant or bid owner must review every kept and capped question at W5-G1.']): literal(notes,row,0,value,cell)
    finally: book.close()
    for value in paths.values(): (root/value).chmod(0o600)
    report={'status':'draft','questions':len(rows),'dropped':len(dropped),'questionCap':cap,'anonymised':plan['anonymised'],'qcRequired':True,'outputs':[{'path':value,'sha256':sha((root/value).read_bytes()),'visibility':'client' if key=='buyer' else 'internal'} for key,value in paths.items()]}
    report_path=root/'outputs/internal/rfi-build.json'
    if report_path.is_symlink(): raise ValueError('RFI build report cannot be a symlink')
    report_path.write_text(json.dumps(report,indent=2));report_path.chmod(0o600)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('workspace',type=Path);parser.add_argument('plan',type=Path);args=parser.parse_args()
    try: print(json.dumps(build(json.loads(args.plan.read_text()),args.workspace)))
    except Exception as error: print(json.dumps({'status':'blocked','error':type(error).__name__,'reason':str(error)}),file=sys.stderr);sys.exit(1)
