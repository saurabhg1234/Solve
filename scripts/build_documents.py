"""Edit/duplicate approved Office templates. No model or invented document layout."""
from __future__ import annotations
import argparse, copy, hashlib, io, json, os, posixpath, re, subprocess, sys, tempfile
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree
from PIL import Image

NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','rel':'http://schemas.openxmlformats.org/package/2006/relationships','ct':'http://schemas.openxmlformats.org/package/2006/content-types'}
PARSER=etree.XMLParser(resolve_entities=False,no_network=True)

def sha(data): return hashlib.sha256(data).hexdigest()
def xml(data):
    if b'<!DOCTYPE' in data or b'<!ENTITY' in data: raise ValueError('XML entities are not supported')
    return etree.fromstring(data,parser=PARSER)
def serial(node): return etree.tostring(node,xml_declaration=True,encoding='UTF-8',standalone=True)
def package(path):
    with ZipFile(path) as archive:
        members=archive.infolist()
        if sum(x.file_size for x in members)>96*1024*1024 or any(x.file_size>32*1024*1024 for x in members): raise ValueError('Template archive too large')
        if len({x.filename for x in members})!=len(members): raise ValueError('Duplicate template archive entries')
        if any(PurePosixPath(x.filename).is_absolute() or '..' in PurePosixPath(x.filename).parts for x in members): raise ValueError('Unsafe template archive paths')
        entries={x.filename:archive.read(x) for x in members}
    if any('vbaproject' in n.lower() or '/embeddings/' in n for n in entries): raise ValueError('Macro/embedded templates need a clean approved copy')
    for name,data in entries.items():
        if name.startswith('word/') and name.endswith('.xml') and any(etree.QName(n).namespace==NS['w'] and etree.QName(n).localname in ('ins','del','commentRangeStart','commentReference') for n in xml(data).iter()): raise ValueError('Word templates must have tracked changes and comments resolved')
        if name.endswith('.rels'):
            for relation in xml(data):
                if relation.get('TargetMode')=='External' and not relation.get('Type','').endswith('/hyperlink'): raise ValueError('Templates cannot load external assets')
    return entries
def text_parts(entries,kind):
    pattern=r'word/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$' if kind=='docx' else r'ppt/slides/slide\d+\.xml$'
    return {name:xml(data) for name,data in entries.items() if re.match(pattern,name)}
def nodes(document,kind): return document.findall('.//w:t' if kind=='docx' else './/a:t',NS)
def relationships_part(part): return str(PurePosixPath(part).parent/'_rels'/(PurePosixPath(part).name+'.rels'))
def raster(data):
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in ('PNG','JPEG') or image.width*image.height>25000000 or getattr(image,'n_frames',1)!=1: raise ValueError('Use a single PNG/JPEG image within 25 million pixels')
        result={'format':image.format,'width':image.width,'height':image.height};image.verify();return result
def image_inventory(entries,part,document):
    relations=xml(entries[relationships_part(part)]) if relationships_part(part) in entries else []
    mapping={r.get('Id'):r for r in relations};result=[]
    for index,blip in enumerate(document.findall('.//a:blip',NS)):
        rid=blip.get('{'+NS['r']+'}embed');relation=mapping.get(rid)
        target=posixpath.normpath(posixpath.join(posixpath.dirname(part),relation.get('Target',''))) if relation is not None else ''
        item={'index':index,'relationshipId':rid,'mediaPart':target,'replaceable':False}
        if relation is None or relation.get('TargetMode')=='External' or not relation.get('Type','').endswith('/image') or target not in entries: item['hold']='An embedded image relationship is required'
        else:
            item['sha256']=sha(entries[target])
            try:
                item.update(raster(entries[target]));item['replaceable']=True
                picture=next((n for n in blip.iterancestors() if etree.QName(n).localname=='pic'),None)
                if picture is None or blip.get('{'+NS['r']+'}link') or len(blip): raise ValueError('Only ordinary picture frames without linked/effect/fallback assets can be replaced')
                if picture.find('.//a:hlinkClick',NS) is not None or picture.find('.//a:hlinkHover',NS) is not None: raise ValueError('Use a picture frame without inherited interactive links')
                crop=picture.find('.//a:srcRect',NS)
                if crop is not None and any(value!='0' for value in crop.attrib.values()): raise ValueError('Use an uncropped approved picture frame for a complete diagram')
            except (ValueError, OSError, Image.DecompressionBombError): item['replaceable']=False;item['hold']='Use an uncropped ordinary PNG/JPEG picture without linked, interactive, animated, effect or fallback assets'
        result.append(item)
    return result
def inspect(path,kind):
    entries=package(path);parts=text_parts(entries,kind)
    if not parts: raise ValueError('No supported template text parts')
    return {'format':kind,'templateSha256':sha(path.read_bytes()),'parts':[{'part':name,'texts':[{'index':i,'text':node.text or ''} for i,node in enumerate(nodes(doc,kind))],'images':image_inventory(entries,name,doc)} for name,doc in parts.items()]}

def replace_images(entries,part,document,spec,root,content):
    changes=spec.get('images',[]);retained=spec.get('retainedImages')
    if not isinstance(changes,list) or len(changes)>100 or (retained is not None and not isinstance(retained,list)): raise ValueError('Supply bounded image replacement/retention decisions')
    if not changes and retained is None: return []
    items=image_inventory(entries,part,document);blips=document.findall('.//a:blip',NS);used=set();report=[]
    relations=xml(entries[relationships_part(part)]) if relationships_part(part) in entries else etree.Element('{'+NS['rel']+'}Relationships')
    ids={r.get('Id') for r in relations}
    for change in changes:
        if not isinstance(change,dict) or set(change)!={'index','expectedSha256','path','sha256','altText','sourceNote'}: raise ValueError('Image replacements require explicit index, old/new hashes, private path, alt text and source note')
        index=change['index']
        if not isinstance(index,int) or isinstance(index,bool) or not 0<=index<len(items) or index in used: raise ValueError('Invalid or duplicate image index')
        item=items[index]
        if not item['replaceable'] or change['expectedSha256']!=item.get('sha256'): raise ValueError('Picture is unsupported or changed; re-inspect the approved template')
        path=(root/change['path']).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size>32*1024*1024: raise ValueError('Replacement image must be a bounded file inside the private workspace')
        data=path.read_bytes();fingerprint=sha(data)
        if fingerprint!=change['sha256']: raise ValueError('Replacement image SHA-256 does not match')
        details=raster(data)
        if details['width']*item['height']!=details['height']*item['width']: raise ValueError('Replacement image must preserve the original picture aspect ratio; no cropping/stretching is inferred')
        for name,minimum,maximum in [('altText',1,1000),('sourceNote',20,4000)]:
            value=change[name]
            if not isinstance(value,str) or not minimum<=len(value.strip())<=maximum or re.search(r'[\x00-\x08\x0b-\x1f\x7f]',value): raise ValueError('Provide bounded descriptive alt text and an actual source/build note')
        prefix='word' if part.startswith('word/') else 'ppt';extension='png' if details['format']=='PNG' else 'jpg'
        target=f"{prefix}/media/zoraImage-{sha((part+':'+str(index)+':'+fingerprint).encode())[:24]}.{extension}"
        if target in entries and entries[target]!=data: raise ValueError('Replacement asset name collision')
        entries[target]=data
        if sum(len(value) for name,value in entries.items() if '/media/zoraImage-' in name)>64*1024*1024: raise ValueError('Replacement media exceeds the 64 MB working bound; split the document')
        if not any(c.get('PartName')=='/'+target for c in content): etree.SubElement(content,'{'+NS['ct']+'}Override',PartName='/'+target,ContentType='image/png' if extension=='png' else 'image/jpeg')
        rid='zoraImage'+str(index+1)
        while rid in ids: rid+='x'
        ids.add(rid);etree.SubElement(relations,'{'+NS['rel']+'}Relationship',Id=rid,Type=NS['r']+'/image',Target=posixpath.relpath(target,posixpath.dirname(part)))
        blip=blips[index];old_rid=blip.get('{'+NS['r']+'}embed');blip.set('{'+NS['r']+'}embed',rid)
        # Clone the relationship per picture, never mutate a shared logo/image part.
        picture=next(n for n in blip.iterancestors() if etree.QName(n).localname=='pic')
        properties=[n for n in picture.iter() if etree.QName(n).localname=='cNvPr']
        drawing=next((n for n in picture.iterancestors() if etree.QName(n).localname in ('inline','anchor')),None)
        if drawing is not None: properties.extend(n for n in drawing if etree.QName(n).localname=='docPr')
        for node in properties: node.set('descr',change['altText'].strip());node.set('name','Zora image '+str(index+1));node.attrib.pop('title',None)
        # Remove only a relationship no longer used anywhere in this edited part.
        if not any(old_rid in [n.get('{'+NS['r']+'}embed'),n.get('{'+NS['r']+'}link'),n.get('{'+NS['r']+'}id')] for n in document.iter()):
            for relation in list(relations):
                if relation.get('Id')==old_rid: relations.remove(relation)
        used.add(index);report.append({'part':part,'index':index,'oldSha256':item['sha256'],'newSha256':fingerprint,'input':str(path.relative_to(root)),'mediaPart':target,'altText':change['altText'].strip(),'sourceNote':change['sourceNote'].strip(),'dimensions':details,'semanticReviewRequired':True})
    keep={}
    for item in retained or []:
        if not isinstance(item,dict) or set(item)!={'index','expectedSha256'} or not isinstance(item['index'],int) or isinstance(item['index'],bool) or item['index'] in keep: raise ValueError('Retained images need unique indices and exact hashes')
        keep[item['index']]=item['expectedSha256']
    if set(keep)&used or set(keep)-set(range(len(items))): raise ValueError('Image retention decisions do not match the template')
    for item in items:
        if item['index'] not in used and (not item.get('sha256') or keep.get(item['index'])!=item['sha256']): raise ValueError('Account for every retained picture when replacing images; hidden client artwork must not be assumed safe')
    entries[relationships_part(part)]=serial(relations)
    return report
def edits(document,kind,changes,retained):
    texts=nodes(document,kind);used=set()
    for change in changes:
        index=change['index']
        if not isinstance(index,int) or not 0<=index<len(texts) or index in used: raise ValueError('Invalid or duplicate template text index')
        node=texts[index]
        if (node.text or '')!=change['expected']: raise ValueError('Template text changed; re-inspect before editing')
        replacement=change['text']
        if not isinstance(replacement,str) or len(replacement)>20000: raise ValueError('Invalid replacement text')
        node.text=replacement
        if kind=='docx': node.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
        used.add(index)
    keep={item['index']:item['expected'] for item in retained}
    if len(keep)!=len(retained): raise ValueError('Duplicate retained text declarations')
    for index,node in enumerate(texts):
        if index in used or not (node.text or '').strip(): continue
        if keep.get(index)!=(node.text or ''): raise ValueError('Every retained visible template text must be explicitly accounted for; client carryover is blocked')
    if set(keep)-set(range(len(texts))) or set(keep)&used: raise ValueError('Retained text declarations do not match the template')

def prune(entries):
    root=xml(entries['_rels/.rels'])
    for relation in list(root):
        if any(word in relation.get('Type','') for word in ('metadata/','extended-properties','custom-properties','thumbnail')): root.remove(relation)
    entries['_rels/.rels']=serial(root)
    visited=set();pending=['']
    while pending:
        part=pending.pop()
        if part in visited: continue
        if part: visited.add(part)
        rels='_rels/.rels' if not part else str(PurePosixPath(part).parent/'_rels'/(PurePosixPath(part).name+'.rels'))
        if rels not in entries: continue
        visited.add(rels)
        for relation in xml(entries[rels]):
            if relation.get('TargetMode')=='External': continue
            target=posixpath.normpath(posixpath.join(posixpath.dirname(part),relation.get('Target',''))).lstrip('/')
            if target.startswith('../') or target not in entries: raise ValueError('Generated package contains a broken or escaping relationship')
            pending.append(target)
    visited.add('[Content_Types].xml')
    return {name:data for name,data in entries.items() if name in visited}

def approved_template(spec,root,kind):
    template=Path(spec['template']).resolve(strict=True)
    if not template.is_relative_to(root) and not template.is_relative_to(Path(__file__).resolve().parents[1]/'AI_Solutioning_Agent_BRD_v1.0/02_Templates'): raise ValueError('Template must be in the private workspace or approved template library')
    fingerprint=sha(template.read_bytes())
    if spec.get('templateSha256')!=fingerprint: raise ValueError('Approved template hash is required and must match')
    if spec.get('approvedTemplate') is not True: raise ValueError('An explicitly approved template is required')
    brd=json.loads((Path(__file__).resolve().parents[1]/'data/brd-index.json').read_text())
    if kind=='docx' and fingerprint==brd['source_sha256']: raise ValueError('The BRD is not an approved proposal template')
    return package(template)

def slide_targets(entries):
    presentation=xml(entries['ppt/presentation.xml']);relations=xml(entries['ppt/_rels/presentation.xml.rels'])
    mapping={r.get('Id'):r for r in relations};slides=presentation.find('p:sldIdLst',NS)
    if slides is None: raise ValueError('Template contains no slides')
    targets=[]
    for slide in slides:
        target=mapping[slide.get('{'+NS['r']+'}id')].get('Target')
        if not re.fullmatch(r'slides/slide\d+\.xml',target): raise ValueError('Unsupported template slide relationship')
        targets.append('ppt/'+target)
    return targets

def compose_slides(plan,entries,root):
    # Import each selected slide's full relationship graph under a distinct namespace.
    # Masters, layouts, themes and images are never recreated or merged by appearance.
    packages={'base':dict(entries)};specifications={'base':plan};namespaces={};preserved={}
    if len(plan.get('templates',[]))>10: raise ValueError('Split builds with more than ten additional templates into bounded decks')
    for position,spec in enumerate(plan.get('templates',[]),1):
        key=spec.get('key')
        if not isinstance(key,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,40}',key) or key in packages: raise ValueError('Template keys must be unique')
        packages[key]=approved_template(spec,root,'pptx');specifications[key]=spec;namespaces[key]=f'ppt/zoraTemplate{position}/'
        if sum(len(data) for package_ in packages.values() for data in package_.values())>160*1024*1024: raise ValueError('Combined template assets exceed the 160 MB working bound')
    presentation=xml(entries['ppt/presentation.xml']);rels=xml(entries['ppt/_rels/presentation.xml.rels']);content=xml(entries['[Content_Types].xml'])
    size=presentation.find('p:sldSz',NS)
    for package_ in packages.values():
        other=xml(package_['ppt/presentation.xml']).find('p:sldSz',NS)
        if size is None or other is None or (size.get('cx'),size.get('cy'))!=(other.get('cx'),other.get('cy')): raise ValueError('Template slide dimensions differ; scaling original layouts is not allowed')
    slide_list=presentation.find('p:sldIdLst',NS)
    for slide in list(slide_list): slide_list.remove(slide)
    for relation in list(rels):
        if relation.get('Type','').endswith(('/slide','/commentAuthors')): rels.remove(relation)
    specs=plan.get('slides',[])
    if not 1<=len(specs)<=100: raise ValueError('Declare one to 100 template-duplicate slides')
    next_number=max(int(re.search(r'slide(\d+)\.xml$',name).group(1)) for name in entries if re.fullmatch(r'ppt/slides/slide\d+\.xml',name))+1
    relation_ids={r.get('Id') for r in rels};imported={};masters=set();changes=[];image_changes=[]
    def override(destination,source,key):
        source_content=xml(packages[key]['[Content_Types].xml'])
        matching=next((c for c in source_content if c.get('PartName')=='/'+source),None)
        if matching is not None:
            etree.SubElement(content,'{'+NS['ct']+'}Override',PartName='/'+destination,ContentType=matching.get('ContentType'))
        else:
            extension=PurePosixPath(source).suffix.lstrip('.')
            default=next((c for c in source_content if c.get('Extension')==extension),None)
            existing=next((c for c in content if c.get('Extension')==extension),None)
            if default is None: raise ValueError('Imported template part has no content type')
            if existing is None: content.append(copy.deepcopy(default))
            elif existing.get('ContentType')!=default.get('ContentType'): raise ValueError('Conflicting template asset types')
    def import_part(key,source):
        if key=='base': return source
        lookup=(key,source)
        if lookup in imported: return imported[lookup]
        if source not in packages[key] or not source.startswith('ppt/'): raise ValueError('Unsupported imported template dependency')
        destination=namespaces[key]+source[4:];imported[lookup]=destination
        data=packages[key][source];entries[destination]=data;override(destination,source,key)
        preserved[destination]=sha(data)
        if source.startswith('ppt/slideMasters/') and source.endswith('.xml'): masters.add(destination)
        copy_relations(key,source,destination)
        return destination
    def copy_relations(key,source,destination):
        source_rels=str(PurePosixPath(source).parent/'_rels'/(PurePosixPath(source).name+'.rels'))
        if source_rels not in packages[key]: return
        copied=xml(packages[key][source_rels])
        for relation in list(copied):
            if relation.get('Type','').endswith(('/notesSlide','/comments','/commentAuthors')): copied.remove(relation);continue
            if relation.get('TargetMode')=='External': continue
            target=posixpath.normpath(posixpath.join(posixpath.dirname(source),relation.get('Target','')))
            if target.startswith('../') or target.startswith('/'): raise ValueError('Imported template relationship escapes its package')
            mapped=import_part(key,target);relation.set('Target',posixpath.relpath(mapped,posixpath.dirname(destination)))
        entries[str(PurePosixPath(destination).parent/'_rels'/(PurePosixPath(destination).name+'.rels'))]=serial(copied)
    for index,spec in enumerate(specs):
        key=spec.get('templateKey','base')
        if key not in packages: raise ValueError('Unknown approved template key')
        targets=slide_targets(packages[key]);number=spec['sourceSlide']
        if not isinstance(number,int) or not 1<=number<=len(targets): raise ValueError('Missing template slide; a new slide layout will not be invented')
        source=targets[number-1];document=xml(packages[key][source]);edits(document,'pptx',spec.get('edits',[]),spec.get('retained',[]));changes.extend(spec.get('edits',[]))
        destination=f'ppt/slides/slide{next_number+index}.xml';copy_relations(key,source,destination)
        image_changes.extend(replace_images(entries,destination,document,spec,root,content));entries[destination]=serial(document)
        rid='zoraSlide'+str(index+1)
        while rid in relation_ids: rid+='x'
        relation_ids.add(rid);etree.SubElement(rels,'{'+NS['rel']+'}Relationship',Id=rid,Type=NS['r']+'/slide',Target='slides/'+PurePosixPath(destination).name)
        etree.SubElement(slide_list,'{'+NS['p']+'}sldId',id=str(256+index),**{'{'+NS['r']+'}id':rid})
        override(destination,source,key)
    master_list=presentation.find('p:sldMasterIdLst',NS)
    if master_list is None: master_list=etree.Element('{'+NS['p']+'}sldMasterIdLst');presentation.insert(0,master_list)
    master_id=max([int(m.get('id')) for m in master_list]+[2147483647])+1
    for index,master in enumerate(sorted(masters)):
        rid=f'zoraMaster{index+1}'
        while rid in relation_ids: rid+='x'
        relation_ids.add(rid);etree.SubElement(rels,'{'+NS['rel']+'}Relationship',Id=rid,Type=NS['r']+'/slideMaster',Target=posixpath.relpath(master,'ppt'))
        etree.SubElement(master_list,'{'+NS['p']+'}sldMasterId',id=str(master_id+index),**{'{'+NS['r']+'}id':rid})
    for name in list(entries):
        if re.fullmatch(r'ppt/slides/slide\d+\.xml',name) and int(re.search(r'slide(\d+)',name).group(1))<next_number: del entries[name]
        elif name.startswith(('ppt/notesSlides/','ppt/comments/')): del entries[name]
        elif re.fullmatch(r'ppt/slides/_rels/slide\d+\.xml.rels',name) and int(re.search(r'slide(\d+)',name).group(1))<next_number: del entries[name]
    for node in list(presentation):
        if etree.QName(node).localname in ('custShowLst','extLst'): presentation.remove(node)
    entries['ppt/presentation.xml']=serial(presentation);entries['ppt/_rels/presentation.xml.rels']=serial(rels);entries['[Content_Types].xml']=serial(content)
    return changes,preserved,{key:spec['templateSha256'] for key,spec in specifications.items()},image_changes

def build(plan,root):
    root=root.resolve(strict=True);kind=plan['format']
    if kind not in ('docx','pptx'): raise ValueError('Use DOCX or PPTX')
    output=PurePosixPath(plan['output'])
    if output.is_absolute() or '..' in output.parts or output.parts[:2] not in [('outputs','client'),('outputs','internal')] or output.suffix!='.'+kind: raise ValueError('Output must be an Office file within outputs/client or outputs/internal')
    destination=(root/str(output)).resolve()
    if not destination.is_relative_to(root): raise ValueError('Output escapes workspace')
    entries=approved_template(plan,root,kind);original={name:sha(data) for name,data in entries.items()};changes=[];image_changes=[];imported_styles={};template_hashes={'base':plan['templateSha256']}
    if kind=='docx':
        documents=text_parts(entries,kind);specs=plan.get('parts',[])
        if set(documents)!=set(item['part'] for item in specs): raise ValueError('Account for every Word body/header/footer text part')
        content=xml(entries['[Content_Types].xml'])
        for spec in specs:
            document=documents[spec['part']];edits(document,kind,spec.get('edits',[]),spec.get('retained',[]));image_changes.extend(replace_images(entries,spec['part'],document,spec,root,content));entries[spec['part']]=serial(document);changes.extend(spec.get('edits',[]))
        entries['[Content_Types].xml']=serial(content)
    else:
        changes,imported_styles,template_hashes,image_changes=compose_slides(plan,entries,root)
    entries=prune(entries)
    content=xml(entries['[Content_Types].xml'])
    for override in list(content):
        if override.get('PartName') and override.get('PartName').lstrip('/') not in entries: content.remove(override)
    entries['[Content_Types].xml']=serial(content)
    # Hidden/unselected slides cannot be left in the exported package.
    destination.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
        for name,data in entries.items(): archive.writestr(name,data)
    destination.chmod(0o600)
    if destination.stat().st_size>32*1024*1024: raise ValueError('Generated Office file exceeds the 32 MB artifact bound; split the document')
    preserved=[name for name in original if name in entries and name.startswith(('ppt/theme/','ppt/slideMasters/','ppt/slideLayouts/','ppt/media/','word/styles','word/media/'))]
    if any(sha(entries[name])!=original[name] for name in preserved) or any(name in entries and sha(entries[name])!=fingerprint for name,fingerprint in imported_styles.items()): raise ValueError('Template branding/styles/media changed unexpectedly')
    report={'status':'draft','output':str(output),'sha256':sha(destination.read_bytes()),'templateSha256':plan['templateSha256'],'templateHashes':template_hashes,'textEdits':len(changes),'imageReplacements':image_changes,'preservedStyleParts':len(preserved)+sum(name in entries for name in imported_styles),'qcRequired':True,'note':'Template styles/layouts and unedited artwork are retained; image replacements have explicit hashes. Text fit, figures, sources, legal/commercial content and human release still require review.'}
    if plan.get('pdf'):
        pdf=destination.with_suffix('.pdf');pdf.unlink(missing_ok=True)
        with tempfile.TemporaryDirectory(prefix='zora-office-') as profile:
            pdf_filter='impress_pdf_Export' if kind=='pptx' else 'writer_pdf_Export'
            result=subprocess.run(['soffice','-env:UserInstallation='+Path(profile).as_uri(),'--headless','--convert-to','pdf:'+pdf_filter+':{"UseTaggedPDF":{"type":"boolean","value":"true"}}','--outdir',str(destination.parent),str(destination)],capture_output=True,text=True,timeout=120)
            if result.returncode or not pdf.is_file(): raise ValueError('PDF conversion did not produce a current output')
        pdf.chmod(0o600);report['pdf']={'output':str(pdf.relative_to(root)),'sha256':sha(pdf.read_bytes())}
    report_path=(root/'outputs/internal'/(destination.name+'.build.json')).resolve()
    if not report_path.is_relative_to(root): raise ValueError('Build report escapes workspace')
    report_path.parent.mkdir(parents=True,exist_ok=True,mode=0o700);report['buildReport']=str(report_path.relative_to(root));report_path.write_text(json.dumps(report,indent=2));report_path.chmod(0o600)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();sub=parser.add_subparsers(dest='action',required=True)
    inspect_parser=sub.add_parser('inspect');inspect_parser.add_argument('template',type=Path);inspect_parser.add_argument('--format',choices=['docx','pptx'],required=True)
    build_parser=sub.add_parser('build');build_parser.add_argument('workspace',type=Path);build_parser.add_argument('plan',type=Path)
    args=parser.parse_args()
    try: print(json.dumps(inspect(args.template,args.format) if args.action=='inspect' else build(json.loads(args.plan.read_text()),args.workspace),ensure_ascii=False))
    except Exception as error: print(json.dumps({'status':'blocked','error':type(error).__name__,'reason':str(error)}),file=sys.stderr);sys.exit(1)
