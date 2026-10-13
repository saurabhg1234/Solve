"""Bounded, non-model source extraction for a private native Codex workspace."""
from __future__ import annotations
import argparse, csv, hashlib, io, json, os, re, subprocess, sys, uuid
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
import pymupdf

LIMIT = 32 * 1024 * 1024
XML_PARSER = etree.XMLParser(resolve_entities=False, no_network=True)

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def child_path(root: Path, value: str) -> Path:
    path = (root / value).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Source path must be an existing file within the private workspace')
    return path

def office_parts(data: bytes):
    with ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if sum(e.file_size for e in entries) > 96 * 1024 * 1024 or any(e.file_size > 32 * 1024 * 1024 for e in entries):
            raise ValueError('Office archive exceeds extraction bounds')
        for entry in entries:
            if '/embeddings/' in entry.filename or 'vbaproject' in entry.filename.lower():
                raise ValueError('Embedded documents/programs need separate source files')
        for entry in sorted(entries, key=lambda e: [int(v) if v.isdigit() else v for v in re.split(r'(\d+)', e.filename)]):
            name = entry.filename
            if not re.match(r'(word/(document|header\d+|footer\d+|footnotes|endnotes)\.xml|ppt/(slides/slide\d+|notesSlides/notesSlide\d+)\.xml|xl/(workbook|sharedStrings|worksheets/sheet\d+)\.xml)$', name):
                continue
            xml = archive.read(entry)
            if b'<!DOCTYPE' in xml or b'<!ENTITY' in xml:
                raise ValueError('Office XML entities are not supported')
            yield name, etree.fromstring(xml, parser=XML_PARSER)

def extract(file: dict, data: bytes, target: Path, ocr_budget: list[int], language: str):
    records, holds = [], []
    def record(location, text, **metadata):
        if not text.strip(): return
        text = text.strip()
        records.append({'id':f"{file['id']}:e{len(records)+1}", 'sourceId':file['id'], 'sourceSha256':file['sha256'], 'filename':file['filename'], 'location':location, 'text':text, 'textSha256':digest(text.encode()), 'verified':False, **metadata})
    extension = Path(file['filename']).suffix.lower()
    mime = file.get('mime_type', '').split(';')[0]
    if extension == '.xlsx':
        parts=dict(office_parts(data))
        if 'xl/workbook.xml' not in parts: raise ValueError('No supported workbook parts')
        strings=[''.join(node.xpath('.//*[local-name()="t"]/text()')) for node in parts.get('xl/sharedStrings.xml',etree.Element('empty')).xpath('//*[local-name()="si"]')]
        for name,document in parts.items():
            if not name.startswith('xl/worksheets/'): continue
            for cell in document.xpath('//*[local-name()="c"]'):
                value=''.join(cell.xpath('./*[local-name()="v"]/text()'));kind=cell.get('t');formula=''.join(cell.xpath('./*[local-name()="f"]/text()'))
                if kind=='s': value=strings[int(value)]
                elif kind=='inlineStr': value=''.join(cell.xpath('.//*[local-name()="t"]/text()'))
                record(f"{name}:cell:{cell.get('r','unlabelled')}",value or ('Formula: '+formula if formula else ''),kind='table_cell',extraction='workbook_xml',**({'formula':formula,'formulaEvaluated':False} if formula else {}))
    elif extension in ('.docx', '.pptx'):
        parts = list(office_parts(data))
        if not parts: raise ValueError('No supported Office document parts')
        for name, xml in parts:
            for position, node in enumerate(xml.xpath('//*[local-name()="p"]'), 1):
                text = ''.join(node.xpath('.//*[local-name()="t"]/text()'))
                in_cell = any(etree.QName(parent).localname == 'tc' for parent in node.iterancestors())
                record(f'{name}:paragraph:{position}', text, kind='table_cell' if in_cell else 'paragraph', extraction='office_xml')
    elif extension == '.pdf' or mime == 'application/pdf':
        with pymupdf.open(stream=data, filetype='pdf') as pdf:
            if pdf.needs_pass: raise ValueError('Encrypted PDF requires an unencrypted source')
            if len(pdf) > 150: raise ValueError('Split PDFs longer than 150 pages into bounded source sections')
            for index, page in enumerate(pdf):
                text = page.get_text('text', sort=True)
                if len(text.strip()) >= 40:
                    for block_number, block in enumerate(page.get_text('blocks', sort=True), 1):
                        if block[6] == 0: record(f'page:{index+1}:block:{block_number}', block[4], page=index+1, bbox=list(block[:4]), extraction='pdf_text')
                else:
                    cache=target/f"{file['id']}-page-{index+1}.ocr.json"
                    if cache.is_symlink(): raise ValueError('OCR cache cannot be a symlink')
                    saved=json.loads(cache.read_text()) if cache.is_file() else None
                    cached=bool(saved and saved.get('sourceSha256')==file['sha256'] and saved.get('language')==language)
                    if not cached and ocr_budget[0] <= 0:
                        holds.append(f"{file['filename']}, page {index+1}: OCR batch limit reached; run the next batch explicitly")
                        continue
                    image = target / f"{file['id']}-page-{index+1}.png"
                    if image.is_symlink(): raise ValueError('OCR image cannot be a symlink')
                    if cached: lines=saved['lines']
                    else:
                        ocr_budget[0] -= 1
                        page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False).save(image);image.chmod(0o600)
                        result = subprocess.run(['tesseract', str(image), 'stdout', '-l', language, '--psm', '3', 'tsv'], capture_output=True, text=True, timeout=60, check=True)
                        groups = {}
                        for word in csv.DictReader(io.StringIO(result.stdout), delimiter='\t'):
                            if not word.get('text', '').strip(): continue
                            group = (word['block_num'], word['par_num'], word['line_num'])
                            groups.setdefault(group, []).append(word)
                        lines=list(groups.values());cache.write_text(json.dumps({'sourceSha256':file['sha256'],'language':language,'lines':lines}));cache.chmod(0o600)
                    for line_number, words in enumerate(lines, 1):
                        confidence = sum(float(word['conf']) for word in words) / len(words)
                        record(f'page:{index+1}:ocr-line:{line_number}', ' '.join(word['text'] for word in words), page=index+1, extraction='tesseract_ocr', confidence=round(confidence, 2), visual=str(image.name), needsVisualVerification=True)
                    if not lines: holds.append(f"{file['filename']}, page {index+1}: OCR returned no words")
                print(json.dumps({'sourceId':file['id'], 'page':index+1, 'pages':len(pdf)}), flush=True)
    elif mime.startswith('text/') or extension in ('.txt', '.md', '.csv', '.json'):
        text = data.decode('utf-8', errors='strict')
        if mime == 'text/html' or extension == '.html':
            from html.parser import HTMLParser
            class Text(HTMLParser):
                def __init__(self): super().__init__(); self.parts=[]; self.hidden=0
                def handle_starttag(self, tag, attrs):
                    if tag in ('script','style'): self.hidden += 1
                def handle_endtag(self, tag):
                    if tag in ('script','style'): self.hidden=max(0,self.hidden-1)
                def handle_data(self, text):
                    if not self.hidden: self.parts.append(text)
            parser=Text();parser.feed(text);text='\n'.join(parser.parts)
        for line, passage in enumerate(text.splitlines(), 1):
            timestamp = re.search(r'\b\d{1,2}:\d{2}(?::\d{2})?\b', passage)
            record(f'line:{line}', passage, extraction='plain_text', **({'timestamp':timestamp.group()} if timestamp else {}))
    elif mime.startswith(('audio/', 'video/')) or extension in ('.mp3', '.wav', '.mp4', '.m4a', '.webm'):
        holds.append(f"{file['filename']}: a verified speaker-labelled timestamped transcript is required; no speech recognition/model API is called")
    else:
        holds.append(f"{file['filename']}: unsupported source format; provide a supported review copy")
    if not records and not holds: holds.append(f"{file['filename']}: no usable text; original remains available for visual inspection")
    return records, holds

def prepare(root: Path, max_ocr_pages=10, language='eng'):
    root = root.resolve(strict=True)
    output = root / 'prepared'
    if output.is_symlink(): raise ValueError('Prepared output cannot be a symlink')
    output.mkdir(exist_ok=True, mode=0o700)
    files = json.loads((root/'sources.json').read_text())
    if not isinstance(files,list) or len(files)>64 or len({file['id'] for file in files})!=len(files): raise ValueError('Prepare at most 64 distinct source files in one bounded workspace')
    if sum(child_path(root,file['path']).stat().st_size for file in files)>256*1024*1024: raise ValueError('Split source workspaces larger than 256 MB into bounded sections')
    all_records, holds, sources, budget = [], [] if files else ['No source files are available'], [], [max_ocr_pages]
    for file in files:
        if str(uuid.UUID(file['id']))!=file['id']: raise ValueError('Source IDs must be canonical UUIDs')
        path = child_path(root, file['path'])
        if path.stat().st_size > LIMIT: raise ValueError('Source exceeds 32 MB')
        data = path.read_bytes()
        if digest(data) != file['sha256']: raise ValueError('Source SHA-256 does not match the manifest')
        try: records, missing = extract(file, data, output, budget, language)
        except Exception as error:
            records=[];missing=[f"{file['filename']}: extraction failed ({type(error).__name__}); original source retained"]
        all_records.extend(records);holds.extend(missing)
        sources.append({'id':file['id'], 'sha256':file['sha256'], 'filename':file['filename'], 'records':len(records), 'holds':missing})
    report={'version':1, 'status':'blocked' if holds else 'prepared', 'sources':sources, 'evidence':all_records, 'missingInputs':holds, 'note':'Extraction is unverified evidence, not requirement understanding, an approved baseline, QC or release. OCR always needs visual verification.'}
    path=output/'evidence.json';text=output/'source-text.txt'
    if path.is_symlink() or text.is_symlink(): raise ValueError('Prepared evidence outputs cannot be symlinks')
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False));path.chmod(0o600)
    text.write_text('\n\n'.join(f"[{r['id']}] {r['filename']} / {r['location']}\n{r['text']}" for r in all_records));text.chmod(0o600)
    return {'status':report['status'], 'sources':len(sources), 'evidenceRecords':len(all_records), 'missingInputs':len(holds), 'output':'prepared/evidence.json'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('workspace', type=Path);parser.add_argument('--max-ocr-pages', type=int, default=10);parser.add_argument('--language', default='eng');args=parser.parse_args()
    if not 0 <= args.max_ocr_pages <= 30 or not re.fullmatch(r'[a-z_+]+', args.language): parser.error('Use a bounded OCR batch and installed language identifiers')
    try: print(json.dumps(prepare(args.workspace,args.max_ocr_pages,args.language)))
    except Exception as error: print(json.dumps({'status':'failed','error':type(error).__name__}),file=sys.stderr);sys.exit(1)
