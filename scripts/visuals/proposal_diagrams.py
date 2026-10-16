"""Reusable SVG diagram primitives for Mindmap proposals.

Creates new vector diagrams; does not modify supplied reference artwork.
All dimensions are SVG units. At 6.95in width, 18 units is about 9pt.
Client-specific labels/data belong in a private build script, outside Git.
"""
from html import escape
from pathlib import Path
from PIL import ImageFont

NAVY='#17365D';TEAL='#0D858C';BLUE='#2865AA';INDIGO='#424EA4';PURPLE='#7147AC'
ORANGE='#C65C19';GREEN='#21815D';GREY='#596578';MUTED='#65758B';LINE='#DCE4ED';PALE='#F4F7FA';WHITE='#FFFFFF'
PALETTE={'source':TEAL,'step':INDIGO,'decision':ORANGE,'human':ORANGE,'result':GREEN,'data':BLUE,'model':PURPLE,'ops':GREY}
ICON={
 'mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
 'doc':'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
 'check':'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
 'user':'<circle cx="10" cy="7" r="3"/><path d="M4 21v-4a6 6 0 0 1 12 0v4m1-10 2 2 4-5"/>',
 'search':'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 'branch':'<path d="M12 21V9M12 12 5 5M12 12l7-7M2 5h6M5 2v6M16 5h6M19 2v6"/>',
 'data':'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 'server':'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M6 6h1M6 17h1M11 6h6M11 17h6"/>',
 'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
 'shield':'<path d="m12 2 8 4v7c0 4-5 8-8 9-3-1-8-5-8-9V6zM8 12l3 3 5-6"/>',
 'box':'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7 4l9 5"/>',
 'link':'<path d="m9 8 3-3a5 5 0 0 1 7 7l-3 3M15 16l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8"/>',
 'scan':'<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7v10M10 7v10M14 7v10M17 7v10"/>',
 'cloud':'<path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12z"/>',
 'chart':'<path d="M3 3v18h18M7 17V9M12 17V5M17 17v-6"/>',
 'refresh':'<path d="M21 3v6h-6M3 21v-6h6M4 9a8 8 0 0 1 14-5l3 5M3 15l3 5a8 8 0 0 0 14-5"/>',
 'people':'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/>',
}

class Diagram:
 def __init__(self,width=1000,height=700):
  self.w,self.h=width,height;self.parts=[];self.boxes=[];self.text_blocks=[]
  self.rect(0,0,width,height,WHITE,WHITE,0)
 def rect(self,x,y,w,h,fill=WHITE,stroke=LINE,r=10,sw=1.5,dash=False):
  self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'+(' stroke-dasharray="8 5"' if dash else '')+'/>')
 def line(self,x1,y1,x2,y2,color=LINE,width=1.5,dash=False):
  self.parts.append(f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}"'+(' stroke-dasharray="7 5"' if dash else '')+'/>')
 def text(self,x,y,text,size=20,color=NAVY,bold=False,width=None,leading=None,anchor='start',maxheight=None):
  leading=leading or size*1.24
  fontpath='/usr/share/fonts/truetype/liberation2/LiberationSans'+('-Bold' if bold else '-Regular')+'.ttf'
  f=ImageFont.truetype(fontpath,round(size*4))
  lines=[]
  for paragraph in str(text).split('\n'):
   line=''
   for word in paragraph.split():
    if width and f.getlength(word)/4>width:raise ValueError(f'Word exceeds text width: {word}')
    nxt=(line+' '+word).strip()
    if width and f.getlength(nxt)/4>width and line:lines.append(line);line=word
    else:line=nxt
   lines.append(line)
  height=len(lines)*leading
  if maxheight is not None and height>maxheight+0.1:raise ValueError(f'Text exceeds box: {text[:70]} ({height}>{maxheight})')
  if y+height>self.h+2:raise ValueError(f'Text exceeds diagram: {text[:60]}')
  for i,line in enumerate(lines):
   self.parts.append(f'<text x="{x}" y="{y+i*leading+size*.83}" fill="{color}" font-family="Liberation Sans, Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{escape(line)}</text>')
  self.text_blocks.append({'text':str(text),'size':size,'x':x,'y':y,'width':width,'height':height})
  return height
 def icon(self,x,y,name='doc',color=INDIGO,size=30):
  self.rect(x,y,size,size,color,color,r=6)
  self.parts.append(f'<g transform="translate({x+size*.13} {y+size*.13}) scale({size*.74/24})" stroke="white" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{ICON.get(name,ICON["doc"])}</g>')
 def card(self,x,y,w,h,title,body='',kind='step',icon='doc',size=21):
  color=PALETTE.get(kind,kind)
  self.rect(x,y,w,h,'#F3FAF7' if kind=='result' else ('#FFF8F2' if kind=='decision' else WHITE),color if kind in ['decision','result'] else LINE,dash=kind=='decision',sw=2)
  if kind not in ['decision','result']:self.line(x+8,y+1,x+w-8,y+1,color,4)
  self.icon(x+12,y+14,icon,color,27)
  th=self.text(x+49,y+14,title,size,color=NAVY,bold=True,width=w-61,maxheight=h-24)
  if body:self.text(x+13,y+25+th,body,18,MUTED,width=w-26,maxheight=h-th-35)
  self.boxes.append((x,y,w,h));return (x,y,w,h)
 def arrow(self,points,color=GREY,label='',label_at=None,dash=False):
  pts=[(float(x),float(y)) for x,y in points]
  d='M'+' L'.join(f'{x} {y}' for x,y in pts)
  self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.5" stroke-linejoin="round"'+(' stroke-dasharray="7 5"' if dash else '')+'/>')
  import math
  x,y=pts[-1];px,py=pts[-2];a=math.atan2(y-py,x-px);length=10;half=5
  q=[(x,y),(x-length*math.cos(a)+half*math.sin(a),y-length*math.sin(a)-half*math.cos(a)),(x-length*math.cos(a)-half*math.sin(a),y-length*math.sin(a)+half*math.cos(a))]
  self.parts.append('<polygon points="'+' '.join(f'{a},{b}' for a,b in q)+f'" fill="{color}"/>')
  if label:
   lx,ly=label_at or pts[len(pts)//2];ww=len(label)*9+14
   self.rect(lx-ww/2,ly-11,ww,23,WHITE,WHITE,2)
   self.text(lx,ly-9,label,17,color,bold=True,anchor='middle')
 def legend(self,y):
  x=8
  for label,color,dash in [('Agent step',INDIGO,False),('Decision',ORANGE,True),('Human action',ORANGE,False),('Result',GREEN,False)]:
   self.rect(x,y+2,23,18,WHITE,color,3,2,dash);self.text(x+33,y,label,17,GREY);x+=220
  self.arrow([(x,y+11),(x+30,y+11)]);self.text(x+39,y,'Flow',17,GREY)
 def band(self,y,title,body,color=TEAL,h=76):
  self.rect(0,y,self.w,h,PALE,LINE,8);self.rect(0,y,6,h,color,color,0)
  self.text(20,y+13,title,21,color,bold=True,width=self.w-40)
  self.text(20,y+41,body,18,GREY,width=self.w-40,maxheight=h-44)
 def save(self,path):
  for x,y,w,h in self.boxes:
   if min(x,y)<0 or x+w>self.w or y+h>self.h:raise ValueError('Card outside diagram')
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">' + ''.join(self.parts)+'</svg>'
  Path(path).write_text(svg)
  return self
