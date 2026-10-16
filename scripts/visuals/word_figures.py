"""Embed a generated SVG in Word with a PNG fallback and useful alt text."""
from pathlib import Path
from lxml import etree
from docx.opc.part import Part
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml.ns import qn
from docx.shared import Inches

def add_vector_figure(document,paragraph,svg_path,png_path,width_inches,description,title):
    svg_bytes=Path(svg_path).read_bytes()
    # Local generated vector artwork only: no scripts or external dependencies.
    root=etree.fromstring(svg_bytes,etree.XMLParser(resolve_entities=False,no_network=True))
    for element in root.iter():
        if etree.QName(element).localname in {'script','foreignObject'}:
            raise ValueError('Figure contains active content')
        if any(etree.QName(k).localname in {'href','src'} and not v.startswith('#') for k,v in element.attrib.items()):
            raise ValueError('Figure contains an external reference')
    picture=paragraph.add_run().add_picture(str(png_path),width=Inches(width_inches))
    picture._inline.docPr.set('descr',description);picture._inline.docPr.set('title',title)
    package=document.part.package
    part=Part(package.next_partname('/word/media/figure%d.svg'),'image/svg+xml',svg_bytes,package)
    relationship=document.part.relate_to(part,RT.IMAGE)
    blip=picture._inline.xpath('.//a:blip')[0]
    ext_list=etree.SubElement(blip,qn('a:extLst'))
    ext=etree.SubElement(ext_list,qn('a:ext'));ext.set('uri','{96DAC541-7B7A-43D3-8B79-37D633B846F1}')
    svg=etree.SubElement(ext,'{http://schemas.microsoft.com/office/drawing/2016/SVG/main}svgBlip',nsmap={'asvg':'http://schemas.microsoft.com/office/drawing/2016/SVG/main'})
    svg.set(qn('r:embed'),relationship)
    return picture
