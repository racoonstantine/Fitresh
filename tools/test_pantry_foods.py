"""Independent preservation, label arithmetic and estimate provenance checks."""
import hashlib,json,unittest
from collections import defaultdict
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv
from resolve_food import FoodCatalog

class PantryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=FoodCatalog();cls.rows=read_csv(DB/'pantry-expansion.csv')
        cls.labels=read_csv(DB/'pantry-published-labels.csv')
        cls.parts=defaultdict(list)
        for p in read_csv(DB/'pantry-estimate-components.csv'):cls.parts[p['estimate_id']].append(p)
    def test_prior_records_preserved(self):
        summary=json.loads((DB/'2026-09-18-pantry-cafes.json').read_text())
        for name,digest in summary['baseline_sha256'].items():
            path=RESEARCH/summary['batch']/name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
            old=read_csv(path);self.assertEqual(read_csv(DB/name)[:len(old)],old)
        self.assertEqual(len(self.rows),68)
        self.assertEqual(len({r['food_id'] for r in self.rows}),68)
    def test_official_label_units_and_values(self):
        whey=self.labels[0];self.assertEqual(whey['serving_unit'],'g');self.assertEqual(whey['serving_amount'],'32.4')
        self.assertEqual(list(json.loads(whey['nutrients_json']).values()),[124,24,3,2,'',1,104,58])
        resolved=self.c.resolve(whey['food_id']);self.assertEqual(resolved['label'],'Other source')
        self.assertIsNone(resolved['nutrients']['fiber_g_100g']['value_per_100g'])
        for label in self.labels:
            values=json.loads(label['nutrients_json']);mass=Decimal(label['serving_amount'])
            m=next(r for r in self.rows if r['food_id']==label['food_id'])
            r=self.c.resolve(label['food_id'],estimate_id=m['estimate_id'] or None)
            if label['serving_unit']=='mL':
                self.assertEqual(r['label'],'Estimated');self.assertIn('ASSUMED 1.00 g/mL',label['conversion'])
            for f,v in values.items():
                expected=None if v=='' else float((Decimal(str(v))*100/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP))
                self.assertEqual(r['nutrients'][f]['value_per_100g'],expected)
    def test_estimates_and_unknowns(self):
        for m in self.rows:
            if not m['estimate_id']:continue
            self.assertEqual(self.c.resolve(m['food_id'])['label'],'Unavailable')
            r=self.c.resolve(m['food_id'],estimate_id=m['estimate_id'])
            self.assertEqual(r['confidence']['level'],'Low')
            parts=self.parts[m['estimate_id']]
            if not parts:continue
            mass=sum(Decimal(p['edible_grams']) for p in parts)
            self.assertEqual(mass,Decimal(m['modeled_mass_g']))
            for p in parts:self.assertEqual(json.loads(p['nutrient_provenance_json']),self.c.resolve(p['ingredient_food_id'])['nutrients'])
            for f in FIELDS:
                if m['group']=='Energy and sweet drinks' and m['name'].startswith(('Cobra','Sting')) and f in ['protein_g_100g','fat_g_100g','fiber_g_100g','sodium_mg_100g','cholesterol_mg_100g']:
                    self.assertIsNone(r['nutrients'][f]['value_per_100g']);continue
                expected=None if any(p[f]=='' for p in parts) else float((sum(Decimal(p[f])*Decimal(p['edible_grams']) for p in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP))
                self.assertEqual(r['nutrients'][f]['value_per_100g'],expected)
            self.assertFalse(any(p['food_id']==m['food_id'] and p['unit']!='g' for p in self.c.portions))

if __name__=='__main__':unittest.main()
