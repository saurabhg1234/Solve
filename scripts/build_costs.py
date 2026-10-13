"""S1 internal arithmetic/worksheet renderer. No business defaults or client price."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from decimal import Decimal, InvalidOperation, localcontext, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_DOWN
from pathlib import Path
import xlsxwriter

ROUNDINGS={'HALF_UP':ROUND_HALF_UP,'HALF_EVEN':ROUND_HALF_EVEN,'DOWN':ROUND_DOWN}
def sha(data): return hashlib.sha256(data).hexdigest()
def number(value,name,low=Decimal(0),high=Decimal('1000000000')):
    if isinstance(value,bool) or not isinstance(value,(str,int)) or not re.fullmatch(r'\d+(?:\.\d{1,8})?',str(value)): raise ValueError(f'{name} must be an explicit finite decimal string or integer')
    result=Decimal(str(value))
    if not low<=result<=high: raise ValueError(f'{name} is outside its explicit arithmetic bounds')
    return result
def words(value,name,limit=4000):
    if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError(f'{name} must be recorded within its text bound')
    return value.strip()
def loaded(root,kind,identity):
    files=json.loads((root/f'{kind}.json').read_text());matches=[file for file in files if file['id']==identity]
    if len(matches)!=1: raise ValueError('Select one actual policy source or effort artifact from the downloaded manifest')
    file=matches[0];path=(root/file['path']).resolve(strict=True)
    if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size>32*1024*1024: raise ValueError('Input file escapes its private workspace or bound')
    data=path.read_bytes()
    if sha(data)!=file['sha256']: raise ValueError('Input bytes do not match their stored SHA-256')
    return file,json.loads(data)
def build(plan,root):
    root=root.resolve(strict=True)
    if set(plan)-{'policySourceId','effortArtifactId','overhead','overheadReason','outputName'}: raise ValueError('This internal cost plan does not accept client pricing or unreviewed extra parameters')
    policy_file,policy=loaded(root,'sources',plan['policySourceId']);effort_file,effort=loaded(root,'artifacts',plan['effortArtifactId'])
    currency=policy.get('currency');minor=policy.get('minorUnits');rounding=policy.get('rounding')
    if not isinstance(currency,str) or not re.fullmatch(r'[A-Z]{3}',currency): raise ValueError('Explicit currency is required; no currency default is applied')
    if not isinstance(minor,int) or isinstance(minor,bool) or not 0<=minor<=4 or rounding not in ROUNDINGS: raise ValueError('Explicit minor units and rounding policy are required')
    rate=number(policy.get('blendedRate'),'Configured blended rate',Decimal('0.00000001'),Decimal('1000000'))
    bounds=policy.get('overheadRange',{});minimum=number(bounds.get('min'),'Configured overhead minimum',high=Decimal(1));maximum=number(bounds.get('max'),'Configured overhead maximum',high=Decimal(1))
    if minimum>maximum: raise ValueError('Configured overhead range is inconsistent')
    overhead=number(plan.get('overhead'),'Proposed overhead',minimum,maximum);overhead_reason=words(plan.get('overheadReason'),'Overhead basis')
    ranges=policy.get('aiReductionRanges')
    if not isinstance(ranges,dict) or not ranges: raise ValueError('Configured AI reduction ranges by task type are required')
    packages=effort.get('packages')
    if not isinstance(packages,list) or not 1<=len(packages)<=500: raise ValueError('Provide one to 500 baseline-mapped work packages')
    ids=set();rows=[]
    with localcontext() as context:
        context.prec=80
        for package in packages:
            identity=words(package.get('id'),'Package ID',80)
            if identity in ids: raise ValueError('Work package IDs must be unique')
            ids.add(identity);description=words(package.get('description'),'Work package description');role=words(package.get('role'),'Estimated role',100);hours=number(package.get('hours'),'Package hours',Decimal('0.00000001'),Decimal('1000000'))
            requirements=package.get('requirements')
            if not isinstance(requirements,list) or not requirements or len(requirements)>100 or any(not isinstance(item,str) or not item.strip() or len(item)>100 for item in requirements): raise ValueError('Every package must map to actual baseline requirement IDs')
            task=package.get('aiTaskType');configured=ranges.get(task)
            if not isinstance(configured,dict): raise ValueError('Each AI task type needs an explicit configured reduction range')
            low=number(configured.get('min'),'AI range minimum',high=Decimal(1));high=number(configured.get('max'),'AI range maximum',high=Decimal(1))
            if low>high: raise ValueError('Configured AI reduction range is inconsistent')
            reduction=number(package.get('aiReduction'),'Proposed package AI reduction',low,high);basis=words(package.get('aiBasis'),'AI acceleration tasks and reduction basis');assumptions=words(package.get('assumptions'),'Package assumptions')
            human=hours*rate;saving=human*reduction;after=human-saving
            rows.append({'id':identity,'description':description,'role':role,'requirements':requirements,'hours':hours,'aiTaskType':task,'aiReduction':reduction,'aiBasis':basis,'assumptions':assumptions,'humanCost':human,'aiSaving':saving,'afterAiCost':after,'overheadCost':after*overhead,'internalCost':after*(1+overhead)})
        hours=sum((row['hours'] for row in rows),Decimal(0));accelerated_hours=sum((row['hours']*row['aiReduction'] for row in rows),Decimal(0));weighted=accelerated_hours/hours
        human=hours*rate;saving=sum((row['aiSaving'] for row in rows),Decimal(0));after=human-saving;overhead_cost=after*overhead;internal=after+overhead_cost
        if after!=sum((row['afterAiCost'] for row in rows),Decimal(0)) or internal!=sum((row['internalCost'] for row in rows),Decimal(0)): raise ValueError('Package and total costs did not reconcile')
        quantum=Decimal(1).scaleb(-minor)
        def money(value): return format(value.quantize(quantum,rounding=ROUNDINGS[rounding]),'f')
        def decimal(value): return format(value,'f')
        adjustment=Decimal(money(internal))-sum((Decimal(money(row['internalCost'])) for row in rows),Decimal(0))
        report={'status':'draft','visibility':'internal','currency':currency,'minorUnits':minor,'rounding':rounding,'sourceHashes':{'policy':{'id':policy_file['id'],'sha256':policy_file['sha256']},'effort':{'id':effort_file['id'],'sha256':effort_file['sha256']}},'hours':decimal(hours),'blendedRate':decimal(rate),'hoursWeightedAiReduction':decimal(weighted),'aiReductionFraction':{'acceleratedHours':decimal(accelerated_hours),'totalHours':decimal(hours)},'humanCost':money(human),'aiSaving':money(saving),'afterAiCost':money(after),'overhead':decimal(overhead),'overheadReason':overhead_reason,'overheadCost':money(overhead_cost),'internalCost':money(internal),'exactInternalCost':decimal(internal),'displayRoundingAdjustment':money(adjustment),'packages':[{**row,**{key:decimal(value) for key,value in row.items() if isinstance(value,Decimal)}} for row in rows],'qcRequired':True,'pricingOwnerApprovalRecorded':False,'clientPriceGenerated':False,'note':'Arithmetic from provided inputs only. Source validity, baseline completeness, effort, AI reduction, overhead, Gantt reconciliation and Ganesh pricing approval remain external checks. Infrastructure actuals/revenue share/client price are not inferred.'}
        name=plan.get('outputName','internal-cost-build-up')
        if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',name): raise ValueError('Use a simple internal output name')
        target=(root/'outputs/internal').resolve()
        if not target.is_relative_to(root): raise ValueError('Internal cost outputs escape the private workspace')
        target.mkdir(parents=True,exist_ok=True,mode=0o700);workbook_path=target/(name+'.xlsx');json_path=target/(name+'.json')
        if workbook_path.is_symlink() or json_path.is_symlink(): raise ValueError('Cost outputs cannot be symlinks')
        book=xlsxwriter.Workbook(str(workbook_path),{'strings_to_formulas':False,'strings_to_urls':False});book.set_properties({'title':'Internal draft cost build-up','author':'Zora'})
        header=book.add_format({'bold':True,'bg_color':'#D62CA4','font_color':'white','text_wrap':True,'valign':'top'});cell=book.add_format({'text_wrap':True,'valign':'top','border':1,'border_color':'#E9DFE7'})
        def write(sheet,row,col,value,format_=cell):
            value=str(value)
            if len(value.encode('utf-16-le'))//2>32767 or sheet.write_string(row,col,value,format_)!=0: raise ValueError('Internal worksheet cell cannot be written without truncation')
        try:
            sheet=book.add_worksheet('Cost build-up');sheet.freeze_panes(1,2);sheet.set_column(0,0,18);sheet.set_column(1,1,50);sheet.set_column(2,12,22);sheet.set_column(13,15,55)
            headers=['Package','Description','Role','Requirement IDs','Input hours','AI task type','AI reduction','Human cost','AI saving','After AI','Overhead cost','Internal cost','Currency','AI basis','Assumptions','Rounding note']
            for col,value in enumerate(headers):write(sheet,0,col,value,header)
            for row,package in enumerate(rows,1):
                values=[package['id'],package['description'],package['role'],', '.join(package['requirements']),decimal(package['hours']),package['aiTaskType'],decimal(package['aiReduction']),money(package['humanCost']),money(package['aiSaving']),money(package['afterAiCost']),money(package['overheadCost']),money(package['internalCost']),currency,package['aiBasis'],package['assumptions'],'Package display rounds separately; authoritative total rounds the exact aggregate once.']
                for col,value in enumerate(values):write(sheet,row,col,value)
                sheet.set_row(row,85)
            sheet.autofilter(0,0,len(rows),len(headers)-1)
            summary=book.add_worksheet('Internal summary');summary.set_column(0,0,42);summary.set_column(1,1,110)
            values=[['DRAFT — INTERNAL ONLY','Never send hours, rates, overhead or internal cost to the buyer.'],['Currency',currency],['Total input hours',decimal(hours)],['Blended rate',decimal(rate)],['Hours-weighted AI reduction',decimal(weighted)],['Human cost',money(human)],['AI saving',money(saving)],['After AI',money(after)],['Overhead ratio',decimal(overhead)],['Overhead basis',overhead_reason],['Overhead cost',money(overhead_cost)],['Internal cost',money(internal)],['Package display rounding adjustment',money(adjustment)],['Exact internal cost',decimal(internal)],['Source policy SHA-256',policy_file['sha256']],['Source effort SHA-256',effort_file['sha256']],['Policy rounding',f'{rounding}; {minor} minor units'],['Client price','Not generated. Ganesh must approve/set price at S1-G2; no cost-plus margin default.'],['Infrastructure/revenue share','Not inferred. Architecture/volume/billing evidence and explicit configured models are required.'],['Independent QC','Required. Rendering this worksheet records no approval or independent pass.']]
            for row,pair in enumerate(values):
                for col,value in enumerate(pair):write(summary,row,col,value,header if row==0 else cell)
        finally:book.close()
        workbook_path.chmod(0o600);report['workbook']={'path':str(workbook_path.relative_to(root)),'sha256':sha(workbook_path.read_bytes())};json_path.write_text(json.dumps(report,indent=2));json_path.chmod(0o600)
        return {'status':'draft','visibility':'internal','output':str(json_path.relative_to(root)),'workbook':report['workbook'],'qcRequired':True,'clientPriceGenerated':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('workspace',type=Path);parser.add_argument('plan',type=Path);args=parser.parse_args()
    try:print(json.dumps(build(json.loads(args.plan.read_text()),args.workspace)))
    except Exception as error:print(json.dumps({'status':'blocked','error':type(error).__name__,'reason':str(error)}),file=sys.stderr);sys.exit(1)
