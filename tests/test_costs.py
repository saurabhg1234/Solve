"""Synthetic arithmetic and privacy fixtures; no production pricing is configured."""
import copy, hashlib, json, sys, tempfile, unittest, uuid
from pathlib import Path
from zipfile import ZipFile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_costs import build

class Costs(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='zora-costs-');self.root=Path(self.temp.name)
        self.policy={'currency':'XXX','minorUnits':2,'rounding':'HALF_UP','blendedRate':'100','overheadRange':{'min':'0.2','max':'0.3'},'aiReductionRanges':{'engineering':{'min':'0','max':'0.5'}}}
        def package(identity,hours,reduction):return {'id':identity,'description':'Synthetic work package only','role':'Engineering','requirements':['SYNTHETIC-R1'],'hours':hours,'aiTaskType':'engineering','aiReduction':reduction,'aiBasis':'Synthetic fixture: explicit task-based reduction, not a company rate.','assumptions':'Synthetic scope only; no real client or delivery estimate.'}
        self.effort={'packages':[package('P1','1','0.1'),package('P2','9','0.2')]}
        self.policy_id=str(uuid.uuid4());self.effort_id=str(uuid.uuid4());self.plan={'policySourceId':self.policy_id,'effortArtifactId':self.effort_id,'overhead':'0.2','overheadReason':'Synthetic governance/travel load for calculation testing only.'};self.save()
    def tearDown(self):self.temp.cleanup()
    def save(self):
        for kind,identity,content in [('sources',self.policy_id,self.policy),('artifacts',self.effort_id,self.effort)]:
            path=self.root/(kind+'.source');path.write_text(json.dumps(content));(self.root/(kind+'.json')).write_text(json.dumps([{'id':identity,'filename':'synthetic-'+kind+'.json','path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}]))
    def report(self):build(self.plan,self.root);return json.loads((self.root/'outputs/internal/internal-cost-build-up.json').read_text())
    def test_hours_weighted_reduction_and_operation_order(self):
        report=self.report();self.assertEqual(report['hours'],'10');self.assertEqual(report['hoursWeightedAiReduction'],'0.19');self.assertEqual(report['humanCost'],'1000.00');self.assertEqual(report['aiSaving'],'190.00');self.assertEqual(report['afterAiCost'],'810.00');self.assertEqual(report['overheadCost'],'162.00');self.assertEqual(report['internalCost'],'972.00');self.assertFalse(report['clientPriceGenerated']);self.assertFalse(report['pricingOwnerApprovalRecorded']);self.assertTrue(report['qcRequired'])
    def test_aggregate_rounding_is_reconciled_and_currency_precision_is_explicit(self):
        self.policy['blendedRate']='1';self.effort['packages'][0]['hours']='1';self.effort['packages'][1]['hours']='1'
        for package in self.effort['packages']:package['aiReduction']='0.005'
        self.save();report=self.report();self.assertEqual(report['internalCost'],'2.39');self.assertEqual(report['displayRoundingAdjustment'],'0.01')
        self.policy['minorUnits']=0;self.save();self.assertEqual(self.report()['internalCost'],'2')
    def test_missing_policies_out_of_range_values_and_float_inputs_hold(self):
        original=copy.deepcopy(self.policy)
        for key in ['currency','minorUnits','rounding','blendedRate','overheadRange','aiReductionRanges']:
            self.policy=copy.deepcopy(original);del self.policy[key];self.save();self.assertRaises((ValueError,KeyError),build,self.plan,self.root)
        self.policy=original;self.save();self.assertRaises(ValueError,build,{**self.plan,'overhead':'0.4'},self.root)
        self.effort['packages'][0]['aiReduction']='0.6';self.save();self.assertRaises(ValueError,build,self.plan,self.root)
        self.effort['packages'][0]['aiReduction']=0.1;self.save();self.assertRaises(ValueError,build,self.plan,self.root)
        self.assertRaises(ValueError,build,{**self.plan,'clientPrice':'5000'},self.root)
    def test_baseline_mapping_duplicates_hashes_and_internal_literal_outputs(self):
        self.effort['packages'][0]['description']='=HYPERLINK("https://example.test")';self.save();report=self.report();self.assertTrue(report['workbook']['path'].startswith('outputs/internal/'))
        with ZipFile(self.root/report['workbook']['path']) as package:self.assertIn('HYPERLINK',package.read('xl/sharedStrings.xml').decode());self.assertFalse(any('<f>' in package.read(name).decode() for name in package.namelist() if name.startswith('xl/worksheets/') and name.endswith('.xml')))
        self.effort['packages'][1]['id']='P1';self.save();self.assertRaises(ValueError,build,self.plan,self.root)
        self.effort['packages'][1]['id']='P2';self.effort['packages'][0]['requirements']=[];self.save();self.assertRaises(ValueError,build,self.plan,self.root)
        self.effort['packages'][0]['requirements']=['SYNTHETIC-R1'];self.save();(self.root/'sources.source').write_text('{}');self.assertRaises(ValueError,build,self.plan,self.root)

if __name__=='__main__':unittest.main()
