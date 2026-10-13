import { createHash } from 'node:crypto';
import { unzipSync,strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import { parse } from 'parse5';

export type ReviewFile={id:string;filename:string;mime_type:string;sha256:string;data:Buffer;role:'source'|'reference'|'draft'};
export type ReviewElement={id:string;fileId:string;kind:string;location:string;text?:string};
export const MAX_REVIEW_ELEMENTS=40000;
export class ReviewInputError extends Error {}
export async function inventory(file:ReviewFile):Promise<ReviewElement[]> {
  if(createHash('sha256').update(file.data).digest('hex')!==file.sha256)throw new ReviewInputError('Stored review file failed its hash check');
  const elements:ReviewElement[]=[];
  function add(kind:string,location:string,text?:string){
    const id=`${file.id}/${elements.length+1}`;
    elements.push({id,fileId:file.id,kind,location,...(text?{text}:{} )});
    if(elements.length>MAX_REVIEW_ELEMENTS)throw new ReviewInputError('Review packet exceeds the element limit; split the documents into bounded review sections');
    if(text&&kind!=='word')for(const word of text.match(/\S+/gu)||[])add('word',`${location} word ${elements.length+1}`,word);
  }
  const mime=file.mime_type.split(';')[0],extension=file.filename.split('.').at(-1)?.toLowerCase();
  if(mime==='text/html'||extension==='html'){
    const document=parse(file.data.toString('utf8'));
    function visit(node:any,path:string){
      if(node.nodeName==='#text'&&node.value.trim())add('paragraph',path,node.value.trim());
      if(node.tagName==='img')add('image',path,(node.attrs||[]).find((a:any)=>a.name==='alt')?.value);
      if(node.tagName==='td'||node.tagName==='th')add('table_cell',path);
      if(node.tagName==='figcaption')add('caption',path);
      for(const [index,child] of (node.childNodes||[]).entries())visit(child,`${path}/${index+1}`);
    }
    visit(document,'HTML');
  }else if(['docx','pptx','xlsx'].includes(extension||'')){
    let expanded=0;
    const entries=unzipSync(file.data,{filter:entry=>{
      expanded+=entry.originalSize;
      if(entry.originalSize>32*1024*1024||expanded>96*1024*1024)throw new ReviewInputError('Office archive exceeds the safe expanded-size limit');
      if(/(?:vbaProject|\/embeddings\/)/i.test(entry.name))throw new ReviewInputError('Embedded programs/documents need separate source files and review');
      if(/^xl\/externalLinks\//.test(entry.name))throw new ReviewInputError('External workbook links need separate source files and review');
      return /^(word|ppt|xl)\//.test(entry.name)&&/\.(xml|png|jpe?g|gif|svg|emf|wmf|webp)$/i.test(entry.name);
    }});
    const parts=Object.keys(entries).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    if(!parts.some(p=>p=== 'word/document.xml'||p==='xl/workbook.xml'||/^ppt\/slides\/slide\d+\.xml$/.test(p)))throw new ReviewInputError('Invalid Office document');
    function officeXml(part:string){const source=strFromU8(entries[part]);if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new ReviewInputError('Office XML entities are not supported');let invalid=false;const document=new DOMParser({onError:()=>{invalid=true;}}).parseFromString(source,'application/xml');if(invalid)throw new ReviewInputError('Malformed Office XML');return document;}
    const sharedStrings:string[]=entries['xl/sharedStrings.xml']?Array.from(officeXml('xl/sharedStrings.xml').getElementsByTagNameNS('*','si') as ArrayLike<any>).map(node=>Array.from(node.getElementsByTagNameNS('*','t') as ArrayLike<any>).map((n:any)=>n.textContent||'').join('')):[];
    for(const part of parts){
      if(/\/media\//.test(part)){add('image',part);continue;}
      if(/^xl\/worksheets\/sheet\d+\.xml$/.test(part)){
        const document=officeXml(part);
        for(const node of Array.from(document.getElementsByTagNameNS('*','c') as ArrayLike<any>)){
          const where=`${part} cell ${node.getAttribute('r')||'unlabelled'}`;const type=node.getAttribute('t');const value=node.getElementsByTagNameNS('*','v')[0]?.textContent||'';let text=value;
          if(type==='s'){if(!/^\d+$/.test(value)||sharedStrings[Number(value)]===undefined)throw new ReviewInputError('Workbook cell references a missing shared string');text=sharedStrings[Number(value)];}
          if(type==='inlineStr')text=Array.from(node.getElementsByTagNameNS('*','t') as ArrayLike<any>).map((n:any)=>n.textContent||'').join('');
          add('table_cell',where,text||undefined);const formula=node.getElementsByTagNameNS('*','f')[0]?.textContent;if(formula)add('formula',where,formula);
        }
        continue;
      }
      if(/^xl\/(drawings|charts|comments)/.test(part)){const document=officeXml(part);add('diagram',part,document.documentElement?.textContent||undefined);continue;}
      if(!/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$|^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$|^ppt\/(?:zoraTemplate\d+\/)?(slideMasters\/slideMaster\d+|slideLayouts\/slideLayout\d+)\.xml$|\/(charts|diagrams)\//.test(part))continue;
      const xml=strFromU8(entries[part]);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new ReviewInputError('Office XML entities are not supported');
      let invalid=false;
      const document=new DOMParser({onError:()=>{invalid=true;}}).parseFromString(xml,'application/xml');
      if(invalid)throw new ReviewInputError('Malformed Office XML');
      let position=0;
      function visit(node:any){
        if(node.nodeType===1){
          position++;const local=node.localName,where=`${part} element ${position}`;
          if(local==='p'){
            const text=Array.from(node.getElementsByTagNameNS('*','t') as ArrayLike<any>).map(n=>n.textContent||'').join('');
            add('paragraph',where,text||undefined);
            if(Array.from(node.getElementsByTagNameNS('*','pStyle') as ArrayLike<any>).some((n:any)=>n.getAttribute('w:val')==='Caption'))add('caption',where,text||undefined);
          }else if(local==='cNvPr'||local==='docPr'){
            for(const attribute of ['descr','title'])if(node.getAttribute(attribute)?.trim())add('caption',`${where} ${attribute}`,node.getAttribute(attribute));
          }else if(local==='tc')add('table_cell',where);
          else if(['drawing','graphicFrame','sp','pic'].includes(local))add(local==='pic'?'image':'diagram',where);
        }
        for(let child=node.firstChild;child;child=child.nextSibling)visit(child);
      }
      visit(document);
      if(/\/(charts|diagrams)\//.test(part))add('diagram',part,document.documentElement?.textContent||undefined);
    }
  }else if(mime==='application/pdf'||extension==='pdf'){
    const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task=getDocument({data:new Uint8Array(file.data),useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,useWasm:false});
    try{
      const document=await task.promise;
      if(document.numPages>150)throw new ReviewInputError('PDF exceeds 150 pages; split it into bounded review sections');
      for(let number=1;number<=document.numPages;number++){
        const page=await document.getPage(number);add('page',`PDF page ${number}`);
        const content=await page.getTextContent();let text=0;
        for(const [index,item] of content.items.entries())if('str' in item&&item.str.trim()){add('paragraph',`PDF page ${number}, text ${index+1}`,item.str);text++;}
        const operators=await page.getOperatorList();
        for(const [index,operator] of operators.fnArray.entries())if([OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject,OPS.paintFormXObjectBegin].includes(operator))add('image',`PDF page ${number}, visual operator ${index+1}`);
        // The original PDF is retained for visual/diagram review; text alone never verifies a page.
        add('diagram',`PDF page ${number}, complete rendered page`);
        if(!text)throw new ReviewInputError(`PDF page ${number} has no extractable text; supply a verified OCR/transcript copy before word-level QC`);
        const structure=await page.getStructTree();
        if(file.role==='draft'&&!structure)throw new ReviewInputError(`PDF draft page ${number} has no structural element IDs; provide a tagged PDF or a verified editable review copy for cell/caption-level QC`);
        function structureElements(node:any,path:string){if(!node)return;if(['TD','TH'].includes(node.role))add('table_cell',path);if(node.role==='Caption')add('caption',path);if(node.role==='Figure')add('image',path);for(const [index,child] of (node.children||[]).entries())structureElements(child,`${path}/${index+1}`);}
        structureElements(structure,`PDF page ${number} structure`);
        page.cleanup();
      }
    }finally{await task.destroy();}
  }else if(mime.startsWith('text/')||mime==='application/json'||['txt','md','json','csv','ts','tsx','js','py'].includes(extension||'')){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(file.data);
    for(const [index,line] of text.split(/\r?\n/).entries())if(line.trim())add('paragraph',`Line ${index+1}`,line);
  }else if(mime.startsWith('image/'))add('image','Complete image');
  else throw new ReviewInputError(`Word-level review inventory is not implemented for ${file.filename}; provide a supported review copy`);
  if(!elements.length)throw new ReviewInputError('Review document has no countable elements');return elements;
}
