"""Preservation, source fidelity, arithmetic and opt-in checks for world foods."""
import hashlib,json,unittest
from collections import Counter,defaultdict
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv,load_sources
from resolve_food import FoodCatalog

class WorldFoodTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=FoodCatalog();cls.fnri,cls.usda=load_sources()
        cls.members=read_csv(DB/'world-expansion-54.csv')
        cls.summary=json.loads((DB/'2026-09-18-world-foods-54.json').read_text())
        cls.parts=defaultdict(list)
        for r in read_csv(DB/'world-estimate-components.csv'):cls.parts[r['estimate_id']].append(r)

    def test_preservation_and_distinct_ids(self):
        for name,digest in self.summary['baseline_sha256'].items():
            path=RESEARCH/self.summary['batch']/name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
            old=read_csv(path);self.assertEqual(read_csv(DB/name)[:len(old)],old,name)
        self.assertEqual(len(self.members),54)
        self.assertEqual(len({m['food_id'] for m in self.members}),54)
        self.assertEqual(Counter(m['kind'] for m in self.members),{'reference':20,'dish':10,'restaurant':24})
        old=read_csv(RESEARCH/self.summary['batch']/'foods.csv')
        old_names={r['name'].casefold() for r in old};old_ids={r['food_id'] for r in old}
        for m in self.members:
            self.assertNotIn(m['name'].casefold(),old_names);self.assertNotIn(m['food_id'],old_ids)

    def test_reference_nutrients_and_servings(self):
        other={r['food_id']:r for r in self.c.other};portion_count=0
        for m in self.members:
            if m['kind']!='reference':continue
            source=self.usda[m['source_food_id']];r=other[m['food_id']]
            self.assertEqual(m['name'],source['description'])
            for f,(_,nid,_) in FIELDS.items():
                self.assertEqual(r[f],source['nutrients'].get(nid,{}).get('amount',''))
                self.assertEqual(self.c.foods[m['food_id']][f],'')
            originals={p['id']:p for p in source['portions']}
            for p in self.c.portions:
                if p['food_id']!=m['food_id'] or p['data_status']!='OTHER_SOURCE_PORTION':continue
                original=originals[p['portion_id'].split('_USDA_')[1]]
                self.assertEqual(p['quantity'],original['amount']);self.assertEqual(p['edible_weight_g'],original['gram_weight']);portion_count+=1
        self.assertEqual(portion_count,28)

    def test_estimate_arithmetic_and_provenance(self):
        estimates={r['estimate_id']:r for r in self.c.estimates}
        for m in self.members:
            if not m['estimate_id']:continue
            est=estimates[m['estimate_id']];parts=self.parts[m['estimate_id']]
            self.assertEqual(self.c.resolve(m['food_id'])['label'],'Unavailable')
            selected=self.c.resolve(m['food_id'],estimate_id=m['estimate_id'])
            self.assertEqual(selected['confidence']['level'],'Low')
            self.assertTrue(all(self.c.foods[m['food_id']][f]=='' for f in FIELDS))
            mass=sum(Decimal(p['edible_grams']) for p in parts)
            self.assertEqual(mass,Decimal(m['modeled_mass_g']))
            for p in parts:
                source=self.c.resolve(p['ingredient_food_id'])
                self.assertNotIn(source['label'],['Unavailable','Estimated'])
                self.assertEqual(json.loads(p['nutrient_provenance_json']),source['nutrients'])
                for f in FIELDS:
                    v=source['nutrients'][f]['value_per_100g'];self.assertEqual(p[f],'' if v is None else str(v))
            for f in FIELDS:
                expected='' if any(p[f]=='' for p in parts) else str((sum(Decimal(p[f])*Decimal(p['edible_grams']) for p in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP))
                self.assertEqual(est[f],expected)

    def test_search_exclusions_aliases_and_portion_safety(self):
        root=DB.parents[1];version=json.loads((root/'api/catalog-active.json').read_text())['version']
        search=json.loads((root/'api/catalog-history'/(version+'.json')).read_text(encoding='utf-8'))['foods']
        for m in self.members:
            self.assertEqual(m['food_id'] in search,m['kind']=='reference')
            if m['kind']!='reference':
                portions=[p for p in self.c.portions if p['food_id']==m['food_id']]
                self.assertEqual(len(portions),1);self.assertEqual(portions[0]['unit'],'g')
        terms={r['alias'] for r in read_csv(DB/'aliases.csv')}
        for term in ['RICH butter chicken','Mister Kebab shawarma','chicken biriyani','chicken kafta','garbanzos curry','Singapore laksa']:self.assertIn(term,terms)

if __name__=='__main__':unittest.main()
