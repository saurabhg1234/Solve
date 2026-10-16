"""Regression checks for the failure modes that make exported diagrams misleading."""
import tempfile
import unittest
from pathlib import Path
from diagram_scene import Scene, build_from_spec
from build_diagram_atlas import safe_svg


class DiagramChecks(unittest.TestCase):
    def scene(self):
        d=Scene('sample','Sample flow','Two steps with a controlled hand-off.',800,400)
        d.node('a',40,40,200,100,'Source','Input record')
        d.node('b',400,40,200,100,'Result','Output record')
        return d

    def test_export_is_accessible_and_local(self):
        d=self.scene();d.edge('a','b',[(240,88),(400,88)])
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'sample.svg';record=d.save(p);raw=safe_svg(p)
            self.assertEqual(record['checks']['edges'],1)
            self.assertIn('aria-labelledby="sample-title sample-desc"',raw)
            self.assertIn('<title id="sample-title">Sample flow</title>',raw)

    def test_diagonal_is_rejected(self):
        with self.assertRaises(ValueError):self.scene().edge('a','b',[(240,88),(400,100)])

    def test_scene_identifier_cannot_inject_markup(self):
        with self.assertRaises(ValueError):Scene('x" onload="alert(1)','Title','Description')

    def test_overlapping_routes_are_rejected(self):
        d=self.scene()
        d.edge('a','b',[(240,88),(300,88),(300,200),(360,200),(360,88),(400,88)])
        d.edge('a','b',[(240,112),(280,112),(280,200),(380,200),(380,112),(400,112)])
        with self.assertRaisesRegex(ValueError,'Overlapping connector'):d.validate()

    def test_crossing_routes_are_rejected(self):
        d=self.scene();d.edge('a','b',[(240,88),(400,88)])
        d.edge('a','b',[(140,140),(140,200),(320,200),(320,60),(400,60)])
        with self.assertRaisesRegex(ValueError,'Crossing connectors'):d.validate()

    def test_missed_node_is_rejected(self):
        d=self.scene();d.edge('a','b',[(240,88),(396,88)])
        with self.assertRaisesRegex(ValueError,'misses'):d.validate()

    def test_transit_through_node_is_rejected(self):
        d=self.scene();d.node('middle',280,40,80,100,'X')
        d.edge('a','b',[(240,88),(400,88)])
        with self.assertRaisesRegex(ValueError,'crosses'):d.validate()

    def test_label_cannot_cover_a_node_or_stroke(self):
        for position in [(170,60),(320,80)]:
            d=self.scene();d.edge('a','b',[(240,88),(400,88)],label='TEST',label_at=position)
            with self.assertRaises(ValueError):d.validate()

    def test_shared_port_is_rejected(self):
        d=self.scene();d.edge('a','b',[(240,88),(400,88)]);d.edge('a','b',[(240,88),(280,88),(280,120),(400,120)])
        with self.assertRaisesRegex(ValueError,'Shared port'):d.validate()

    def test_node_overlap_is_rejected(self):
        d=self.scene();d.node('overlap',200,40,120,80,'X')
        with self.assertRaisesRegex(ValueError,'Overlapping nodes'):d.validate()

    def test_text_overflow_is_rejected(self):
        with self.assertRaises(ValueError):self.scene().node('tiny',20,240,80,40,'An overflowing label')

    def test_atlas_rejects_active_svg(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'bad.svg'
            for payload in ['<script>alert(1)</script>','<rect onclick="alert(1)"/>','<image href="https://example.com/x"/>']:
                p.write_text('<svg xmlns="http://www.w3.org/2000/svg">'+payload+'</svg>')
                with self.assertRaises(ValueError):safe_svg(p)

    def test_spec_does_not_execute_labels(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'example.svg'
            build_from_spec({'id':'example','title':'A < B','description':'Literal text','nodes':[{'id':'a','x':40,'y':40,'w':240,'h':120,'title':'<script>','body':'Literal label'}]},p)
            self.assertIn('&lt;script&gt;',p.read_text())


if __name__=='__main__':unittest.main()
