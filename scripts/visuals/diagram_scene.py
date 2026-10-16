"""Semantic, print-first SVG scenes for proposals; no network or model calls.

Coordinates are explicit: authors design the route, this module checks it.
See THIRD_PARTY_NOTICES.md for the two user-selected design references.
"""
from dataclasses import dataclass
from html import escape
from pathlib import Path
import json
import math
import re
from proposal_diagrams import Diagram, ICON

INK = '#17365D'
MUTED = '#51647A'
RULE = '#CCD7E3'
BLUE = '#245EA8'
ACCENT = '#AF4C17'
GREEN = '#196B51'
PAPER = '#FFFFFF'
WASH = '#F3F6FA'
TREATMENTS = {
    'step': (PAPER, RULE, INK), 'source': ('#EFF5FC', BLUE, BLUE),
    'human': ('#FFF4EB', ACCENT, ACCENT), 'decision': ('#FFF4EB', ACCENT, ACCENT),
    'result': ('#ECF6F1', GREEN, GREEN), 'store': ('#EFF5FC', BLUE, BLUE),
    'external': (WASH, MUTED, MUTED), 'focal': ('#EBF2FC', BLUE, BLUE),
}


@dataclass
class Node:
    id: str
    x: float
    y: float
    w: float
    h: float
    kind: str

    def port(self, side, fraction=.5):
        if side == 'left': return (self.x, self.y + self.h * fraction)
        if side == 'right': return (self.x + self.w, self.y + self.h * fraction)
        if side == 'top': return (self.x + self.w * fraction, self.y)
        if side == 'bottom': return (self.x + self.w * fraction, self.y + self.h)
        raise ValueError(f'Unknown port: {side}')


def rounded_path(points, radius=8):
    """Round orthogonal corners without changing the source/target ports."""
    parts = [f'M {points[0][0]} {points[0][1]}']
    for i in range(1, len(points)-1):
        a,b,c = points[i-1:i+2]
        ab = math.dist(a,b); bc = math.dist(b,c)
        r = min(radius, ab/2, bc/2)
        before = tuple(b[k]+(a[k]-b[k])*r/ab for k in (0,1))
        after = tuple(b[k]+(c[k]-b[k])*r/bc for k in (0,1))
        parts.append(f'L {before[0]} {before[1]} Q {b[0]} {b[1]} {after[0]} {after[1]}')
    parts.append(f'L {points[-1][0]} {points[-1][1]}')
    return ' '.join(parts)


def intersects_box(a,b,box,inset=1):
    x,y,w,h=box; left=x+inset; right=x+w-inset; top=y+inset; bottom=y+h-inset
    if a[0] == b[0]: return left<a[0]<right and max(min(a[1],b[1]),top)<min(max(a[1],b[1]),bottom)
    if a[1] == b[1]: return top<a[1]<bottom and max(min(a[0],b[0]),left)<min(max(a[0],b[0]),right)
    raise ValueError('Connectors must be orthogonal')


class Scene(Diagram):
    def __init__(self, slug, title, description, width=1000, height=800):
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*',slug): raise ValueError('Invalid scene identifier')
        super().__init__(width,height)
        self.slug,self.title,self.description=slug,title,description
        self.nodes={}; self.edges=[]; self.labels=[]; self.node_markup=[]; self.edge_markup=[]
        self.kind='architecture'

    def zone(self,x,y,w,h,label,dashed=False):
        self.rect(x,y,w,h,WASH,RULE,8,1.5,dashed)
        if label: self.text(x+16,y+12,label,18,MUTED,True,width=w-32)

    def lane(self,y,h,label,index):
        self.rect(0,y,self.w,h,PAPER if index%2==0 else WASH,PAPER,0)
        self.line(0,y,self.w,y,RULE,1)
        self.text(12,y+24,label,19,INK,True,width=132)
        self.line(156,y,156,y+h,RULE,1)

    def node(self,id,x,y,w,h,title,body='',kind='step',tag='',icon=None):
        if id in self.nodes: raise ValueError(f'Duplicate node: {id}')
        if any(v%4 for v in (x,y,w,h)): raise ValueError(f'Node off 4-unit grid: {id}')
        start=len(self.parts); fill,stroke,color=TREATMENTS[kind]
        if kind=='decision':
            cx=x+w/2; cy=y+h/2
            self.parts.append(f'<path d="M {cx} {y} L {x+w} {cy} L {cx} {y+h} L {x} {cy} Z" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
            self.text(cx,cy-24,title,21,color,True,width=w*.62,anchor='middle',maxheight=54)
        else:
            self.rect(x,y,w,h,fill,stroke,8,1.6,kind=='external')
            offset=14
            if tag:
                self.text(x+14,y+12,tag.upper(),17,color,True,width=w-28,maxheight=24)
                offset=38
            if icon:
                self.parts.append(f'<g transform="translate({x+w-36} {y+12})" stroke="{color}" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICON[icon]}</g>')
            th=self.text(x+14,y+offset,title,23,INK,True,width=w-28,maxheight=h-offset-8)
            if body: self.text(x+14,y+offset+th+8,body,19,MUTED,width=w-28,maxheight=h-offset-th-12)
        self.nodes[id]=Node(id,x,y,w,h,kind)
        self.node_markup.extend(self.parts[start:]);del self.parts[start:]
        return self.nodes[id]

    def edge(self,source,target,points,style='normal',label='',label_at=None):
        if source not in self.nodes or target not in self.nodes: raise ValueError('Unknown endpoint')
        points=[tuple(p) for p in points]
        if len(points)<2: raise ValueError('Connector needs two points')
        for a,b in zip(points,points[1:]):
            if a==b or (a[0]!=b[0] and a[1]!=b[1]): raise ValueError(f'Non-orthogonal/zero edge {source}>{target}')
        color=ACCENT if style=='exception' else (BLUE if style=='primary' else MUTED)
        dash=' stroke-dasharray="7 5"' if style in ('exception','return','optional') else ''
        start=len(self.parts)
        self.parts.append(f'<path d="{rounded_path(points)}" fill="none" stroke="{color}" stroke-width="2.2"{dash}/>')
        x,y=points[-1];px,py=points[-2];a=math.atan2(y-py,x-px)
        q=[(x,y),(x-10*math.cos(a)+4.5*math.sin(a),y-10*math.sin(a)-4.5*math.cos(a)),(x-10*math.cos(a)-4.5*math.sin(a),y-10*math.sin(a)+4.5*math.cos(a))]
        self.parts.append('<polygon points="'+' '.join(f'{a},{b}' for a,b in q)+f'" fill="{color}"/>')
        self.edge_markup.extend(self.parts[start:]);del self.parts[start:]
        self.edges.append({'source':source,'target':target,'points':points,'style':style})
        if label:
            if label_at is None: raise ValueError('Labels require an explicit clear position')
            lx,ly=label_at;lw=max(40,len(label)*10.3+12)
            self.labels.append({'text':label,'x':lx-lw/2,'y':ly,'w':lw,'h':24,'color':color})

    def legend(self,y):
        self.line(0,y,self.w,y,RULE)
        for x,label,kind in [(8,'System step','step'),(260,'Human action','human'),(540,'Verified result','result')]:
            fill,stroke,_=TREATMENTS[kind];self.rect(x,y+20,24,20,fill,stroke,4)
            self.text(x+34,y+18,label,18,MUTED)
        self.line(790,y+30,828,y+30,ACCENT,2,True);self.text(840,y+18,'Exception',18,MUTED)

    def validate(self):
        nodes=list(self.nodes.values())
        for i,n in enumerate(nodes):
            if n.x<0 or n.y<0 or n.x+n.w>self.w or n.y+n.h>self.h: raise ValueError(f'Out of bounds: {n.id}')
            for m in nodes[i+1:]:
                if max(n.x,m.x)<min(n.x+n.w,m.x+m.w) and max(n.y,m.y)<min(n.y+n.h,m.y+m.h): raise ValueError(f'Overlapping nodes: {n.id}/{m.id}')
        ports=[]
        for e in self.edges:
            for name,point,nextpoint in [(e['source'],e['points'][0],e['points'][1]),(e['target'],e['points'][-1],e['points'][-2])]:
                n=self.nodes[name];x,y=point
                boundary=(x in (n.x,n.x+n.w) and n.y<=y<=n.y+n.h) or (y in (n.y,n.y+n.h) and n.x<=x<=n.x+n.w)
                if not boundary: raise ValueError(f'Edge misses node boundary: {name} {point}')
                if n.kind!='decision' and ((x in (n.x,n.x+n.w) and nextpoint[0]==x) or (y in (n.y,n.y+n.h) and nextpoint[1]==y)):
                    raise ValueError(f'Edge tangential to node: {name}')
                if (name,point) in ports: raise ValueError(f'Shared port: {name} {point}')
                ports.append((name,point))
            for a,b in zip(e['points'],e['points'][1:]):
                if min(*a,*b)<0 or max(a[0],b[0])>self.w or max(a[1],b[1])>self.h: raise ValueError('Edge out of bounds')
                for n in nodes:
                    if intersects_box(a,b,(n.x,n.y,n.w,n.h)):
                        raise ValueError(f'Edge {e["source"]}>{e["target"]} crosses {n.id}')
        for label in self.labels:
            x,y,w,h=[label[k] for k in ('x','y','w','h')]
            if x<0 or y<0 or x+w>self.w or y+h>self.h: raise ValueError('Label out of bounds')
            for n in nodes:
                if max(x,n.x)<min(x+w,n.x+n.w) and max(y,n.y)<min(y+h,n.y+n.h): raise ValueError(f'Label overlaps {n.id}: {label["text"]}')
            for e in self.edges:
                for a,b in zip(e['points'],e['points'][1:]):
                    if intersects_box(a,b,(x-6,y-6,w+12,h+12),inset=0): raise ValueError(f'Label touches connector: {label["text"]}')
        for i,first in enumerate(self.edges):
            for second in self.edges[i+1:]:
                for a,b in zip(first['points'],first['points'][1:]):
                    for c,d in zip(second['points'],second['points'][1:]):
                        horizontal=a[1]==b[1]; other_horizontal=c[1]==d[1]
                        if horizontal==other_horizontal:
                            axis=0 if horizontal else 1; fixed=1-axis
                            if a[fixed]==c[fixed] and max(min(a[axis],b[axis]),min(c[axis],d[axis]))<min(max(a[axis],b[axis]),max(c[axis],d[axis])):
                                raise ValueError('Overlapping connector strokes; separate the routes')
                        else:
                            h1,h2,v1,v2=(a,b,c,d) if horizontal else (c,d,a,b)
                            if min(h1[0],h2[0])<v1[0]<max(h1[0],h2[0]) and min(v1[1],v2[1])<h1[1]<max(v1[1],v2[1]):
                                raise ValueError('Crossing connectors; reroute or split the figure')
        return {'nodes':len(nodes),'edges':len(self.edges),'labels':len(self.labels),'geometry':'passed'}

    def save(self,path):
        checks=self.validate(); parts=self.parts+self.edge_markup+self.node_markup
        for label in self.labels:
            start=len(self.parts);x,y,w,h=[label[k] for k in ('x','y','w','h')]
            self.rect(x,y,w,h,PAPER,PAPER,2)
            self.text(x+w/2,y+2,label['text'],18,label['color'],True,anchor='middle')
            parts.extend(self.parts[start:]);del self.parts[start:]
        titleid=self.slug+'-title';descid=self.slug+'-desc'
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="{titleid} {descid}"><title id="{titleid}">{escape(self.title)}</title><desc id="{descid}">{escape(self.description)}</desc>'+''.join(parts)+'</svg>'
        Path(path).write_text(svg)
        return {'id':self.slug,'title':self.title,'alt':self.description,'width':self.w,'height':self.h,'type':self.kind,'textBlocks':self.text_blocks,'nodes':[vars(n) for n in self.nodes.values()],'edges':self.edges,'checks':checks}


def build_from_spec(spec,output):
    """Portable JSON authoring contract; no execution of client-supplied code."""
    scene=Scene(spec['id'],spec['title'],spec['description'],spec.get('width',1000),spec.get('height',800))
    scene.kind=spec.get('type','architecture')
    for zone in spec.get('zones',[]): scene.zone(**zone)
    for lane in spec.get('lanes',[]): scene.lane(**lane)
    for node in spec['nodes']: scene.node(**node)
    for edge in spec.get('edges',[]): scene.edge(**edge)
    for note in spec.get('notes',[]): scene.text(**note)
    if 'legendY' in spec: scene.legend(spec['legendY'])
    return scene.save(output)


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();spec=json.loads(args.spec.read_text())
    result=build_from_spec(spec,args.output)
    args.output.with_suffix('.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result['checks']))
