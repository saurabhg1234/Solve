"""Synthetic template-picture fixtures. No client architecture or approved Word layout."""
import copy, hashlib, json, sys, tempfile, unittest
from pathlib import Path
from zipfile import ZipFile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_documents import build, inspect, xml, NS
from docx import Document
from docx.shared import Inches as WordInches
from pptx import Presentation
from pptx.util import Inches
from PIL import Image
import pymupdf

def sha(data): return hashlib.sha256(data).hexdigest()
class DocumentImages(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='zora-picture-');self.root=Path(self.temp.name)
        self.old=self.root/'old.png';self.new=self.root/'new.jpg'
        Image.new('RGB',(400,200),(0,0,255)).save(self.old);Image.new('RGB',(800,400),(255,0,0)).save(self.new)
    def tearDown(self):self.temp.cleanup()
    def ppt(self,name='template.pptx',count=2):
        path=self.root/name;p=Presentation();slide=p.slides.add_slide(p.slide_layouts[6]);slide.shapes.add_textbox(Inches(.5),Inches(.2),Inches(6),Inches(.5)).text='Synthetic picture verification only'
        for n in range(count):slide.shapes.add_picture(str(self.old),Inches(.5+4*n),Inches(1),width=Inches(3))
        p.save(path);return path
    def plan(self,path,kind):
        details=inspect(path,kind)
        return {'format':kind,'template':str(path),'templateSha256':details['templateSha256'],'approvedTemplate':True,'output':'outputs/internal/image-verification.'+kind},details
    def changes(self,part,index=0):
        return {'images':[{'index':index,'expectedSha256':part['images'][index]['sha256'],'path':self.new.name,'sha256':sha(self.new.read_bytes()),'altText':'Synthetic red source picture, not a client architecture.','sourceNote':'Synthetic test image built locally to verify exact picture-byte replacement only.'}], 'retainedImages':[{'index':i['index'],'expectedSha256':i['sha256']} for i in part['images'] if i['index']!=index]}
    def slide(self,part,**extra):return {'sourceSlide':1,'edits':[],'retained':[{'index':x['index'],'expected':x['text']} for x in part['texts']],**extra}
    def test_ppt_shared_images_clone_relationships_and_preserve_frames_and_pdf(self):
        path=self.ppt();plan,details=self.plan(path,'pptx');part=details['parts'][0];self.assertEqual(part['images'][0]['relationshipId'],part['images'][1]['relationshipId']);self.assertTrue(part['images'][0]['replaceable'])
        plan.update(slides=[self.slide(part,**self.changes(part)),self.slide(part)],pdf=True);report=build(plan,self.root);after=Presentation(self.root/report['output']);before=Presentation(path)
        pictures=[s for s in after.slides[0].shapes if s.shape_type==13];self.assertEqual(pictures[0].image.blob,self.new.read_bytes());self.assertEqual(pictures[1].image.blob,self.old.read_bytes());self.assertEqual(pictures[0].image.ext,'jpg')
        for a,b in zip([s for s in before.slides[0].shapes if s.shape_type==13],pictures):self.assertEqual((a.left,a.top,a.width,a.height),(b.left,b.top,b.width,b.height))
        self.assertTrue(all(s.image.blob==self.old.read_bytes() for s in after.slides[1].shapes if s.shape_type==13));self.assertEqual(report['imageReplacements'][0]['newSha256'],sha(self.new.read_bytes()));self.assertTrue(report['imageReplacements'][0]['semanticReviewRequired'])
        with ZipFile(path) as old,ZipFile(self.root/report['output']) as new:self.assertEqual(old.read('ppt/theme/theme1.xml'),new.read('ppt/theme/theme1.xml'));self.assertIn(self.old.read_bytes(),[new.read(n) for n in new.namelist() if '/media/' in n])
        with pymupdf.open(self.root/report['pdf']['output']) as pdf:
            self.assertEqual(len(pdf),2);page=pdf[0].get_pixmap();image=Image.frombytes('RGB',(page.width,page.height),page.samples);colors=image.getcolors(page.width*page.height);self.assertTrue(any(n>500 and r>220 and g<30 and b<30 for n,(r,g,b) in colors));self.assertTrue(any(n>500 and r<30 and g<30 and b>220 for n,(r,g,b) in colors))
    def test_word_replacement_preserves_other_picture_styles_and_removes_old_alt_metadata(self):
        path=self.root/'synthetic-word.docx';doc=Document();doc.add_paragraph('Synthetic template only').runs[0].bold=True
        for _ in range(2):doc.add_picture(str(self.old),width=WordInches(3))
        doc.inline_shapes[0]._inline.docPr.set('title','Old client title');doc.inline_shapes[0]._inline.docPr.set('descr','Old client description');doc.save(path)
        plan,details=self.plan(path,'docx');plan['parts']=[{'part':p['part'],'edits':[],'retained':[{'index':x['index'],'expected':x['text']} for x in p['texts']],**self.changes(p)} for p in details['parts']]
        report=build(plan,self.root);after=Document(self.root/report['output']);self.assertTrue(after.paragraphs[0].runs[0].bold);self.assertEqual(after.inline_shapes[0].width,doc.inline_shapes[0].width);self.assertEqual(after.inline_shapes[0]._inline.docPr.get('descr'),'Synthetic red source picture, not a client architecture.');self.assertIsNone(after.inline_shapes[0]._inline.docPr.get('title'))
        with ZipFile(path) as old,ZipFile(self.root/report['output']) as new:self.assertEqual(old.read('word/styles.xml'),new.read('word/styles.xml'));self.assertIn(self.old.read_bytes(),[new.read(n) for n in new.namelist() if '/media/' in n]);self.assertIn(self.new.read_bytes(),[new.read(n) for n in new.namelist() if '/media/' in n])
    def test_replacement_guards_reject_stale_hash_missing_decisions_mismatch_and_outside_files(self):
        plan,details=self.plan(self.ppt(),'pptx');part=details['parts'][0];plan['slides']=[self.slide(part,**self.changes(part))]
        variants=[]
        for key,value in [('expectedSha256','0'*64),('sha256','0'*64),('altText',''),('sourceNote','short')]:
            variant=copy.deepcopy(plan);variant['slides'][0]['images'][0][key]=value;variants.append(variant)
        variant=copy.deepcopy(plan);variant['slides'][0]['retainedImages']=[];variants.append(variant)
        for variant in variants:self.assertRaises(ValueError,build,variant,self.root)
        Image.new('RGB',(400,400),'red').save(self.new);plan['slides'][0]['images'][0]['sha256']=sha(self.new.read_bytes());self.assertRaises(ValueError,build,plan,self.root)
        with tempfile.TemporaryDirectory() as directory:
            outside=Path(directory)/'replacement.jpg';Image.new('RGB',(400,200),'red').save(outside);variant=copy.deepcopy(plan);variant['slides'][0]['images'][0].update(path=str(outside),sha256=sha(outside.read_bytes()));self.assertRaises(ValueError,build,variant,self.root)
    def test_cropped_pictures_hold_and_unused_old_bytes_are_pruned(self):
        path=self.ppt(count=1);p=Presentation(path);picture=next(s for s in p.slides[0].shapes if s.shape_type==13);picture.crop_left=.1;p.save(path)
        plan,details=self.plan(path,'pptx');part=details['parts'][0];self.assertFalse(part['images'][0]['replaceable']);plan['slides']=[self.slide(part,**self.changes(part))];self.assertRaises(ValueError,build,plan,self.root)
        linked=self.ppt(name='linked.pptx',count=1);p=Presentation(linked);next(s for s in p.slides[0].shapes if s.shape_type==13).click_action.hyperlink.address='https://example.test/old-client';p.save(linked);self.assertFalse(inspect(linked,'pptx')['parts'][0]['images'][0]['replaceable'])
        path=self.ppt(name='uncropped.pptx',count=1);plan,details=self.plan(path,'pptx');part=details['parts'][0];plan['slides']=[self.slide(part,**self.changes(part))];report=build(plan,self.root)
        with ZipFile(self.root/report['output']) as package:self.assertNotIn(self.old.read_bytes(),[package.read(n) for n in package.namelist() if '/media/' in n]);self.assertIn(self.new.read_bytes(),[package.read(n) for n in package.namelist() if '/media/' in n])
    def test_additional_template_namespace_keeps_original_artwork_and_new_media_independent(self):
        base=self.ppt('base.pptx');other=self.ppt('second.pptx');plan,details=self.plan(base,'pptx');other_plan,other_details=self.plan(other,'pptx');part=other_details['parts'][0]
        plan['templates']=[{key:other_plan[key] for key in ('template','templateSha256','approvedTemplate')}|{'key':'second'}];plan['slides']=[self.slide(details['parts'][0]),self.slide(part,templateKey='second',**self.changes(part))];report=build(plan,self.root)
        output=Presentation(self.root/report['output']);self.assertTrue(all(s.image.blob==self.old.read_bytes() for s in output.slides[0].shapes if s.shape_type==13));pictures=[s for s in output.slides[1].shapes if s.shape_type==13];self.assertEqual(pictures[0].image.blob,self.new.read_bytes());self.assertEqual(pictures[1].image.blob,self.old.read_bytes())
        with ZipFile(other) as original,ZipFile(self.root/report['output']) as generated:self.assertEqual(original.read('ppt/theme/theme1.xml'),generated.read('ppt/zoraTemplate1/theme/theme1.xml'))

    def test_real_supplied_template_picture_replacement_keeps_its_source_layout(self):
        path=Path(__file__).resolve().parents[1]/'AI_Solutioning_Agent_BRD_v1.0/02_Templates/Slide templates/4_Engagement_Methodology.pptx'
        plan,details=self.plan(path,'pptx');part=details['parts'][0];picture=next(i for i in part['images'] if i['replaceable'])
        Image.new('RGB',(picture['width'],picture['height']),'red').save(self.new)
        plan['slides']=[self.slide(part,**self.changes(part,picture['index']))];report=build(plan,self.root)
        with ZipFile(path) as source,ZipFile(self.root/report['output']) as output:
            for name in source.namelist():
                if name.startswith(('ppt/theme/','ppt/slideMasters/','ppt/slideLayouts/')) and name in output.namelist():self.assertEqual(source.read(name),output.read(name))
        self.assertEqual(report['imageReplacements'][0]['newSha256'],sha(self.new.read_bytes()))
        self.assertEqual(len(Presentation(self.root/report['output']).slides),1)

if __name__=='__main__':unittest.main()
