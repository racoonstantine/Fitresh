"""Independent integrity checks for the 2026-09-18 expansion."""
import hashlib,json,unittest
from collections import Counter,defaultdict
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv,load_sources
from resolve_food import FoodCatalog

class RegionalExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=FoodCatalog();cls.fnri,cls.usda=load_sources()
        cls.manifest=read_csv(DB/'regional-expansion-500.csv')
        cls.summary=json.loads((DB/'2026-09-18-regional-foods-500.json').read_text())
        cls.parts=defaultdict(list)
        for r in read_csv(DB/'regional-estimate-components.csv'):cls.parts[r['estimate_id']].append(r)

    def test_all_existing_tables_preserved(self):
        for name,digest in self.summary['baseline_sha256'].items():
            path=RESEARCH/self.summary['batch']/name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
            old=read_csv(path);self.assertEqual(read_csv(DB/name)[:len(old)],old,name)

    def test_500_distinct_new_identities(self):
        self.assertEqual(len(self.manifest),500)
        self.assertEqual(Counter(r['kind'] for r in self.manifest),{'reference':400,'regional':30,'restaurant':70})
        old=read_csv(RESEARCH/self.summary['batch']/'foods.csv');old_names={r['name'].casefold() for r in old}
        old_sources={(r['source_name'],r['source_food_id']) for r in old}
        ids={r['food_id'] for r in self.manifest};self.assertEqual(len(ids),500)
        self.assertEqual(len({r['name'].casefold() for r in self.manifest}),500)
        self.assertFalse(ids.intersection(r['food_id'] for r in old))
        for m in self.manifest:
            self.assertNotIn(m['name'].casefold(),old_names)
            r=self.c.foods[m['food_id']];self.assertNotIn((r['source_name'],r['source_food_id']),old_sources)

    def test_primary_reference_values_and_portions(self):
        other={r['food_id']:r for r in self.c.other};count=0
        for m in self.manifest:
            if m['kind']!='reference':continue
            row=self.c.foods[m['food_id']];resolved=self.c.resolve(m['food_id'])
            self.assertFalse(resolved['requires_identity_selection'])
            self.assertTrue(all(resolved['nutrients'][f]['value_per_100g'] is not None for f in list(FIELDS)[:4]))
            for f,(label,nid,_) in FIELDS.items():
                if m['group']=='FNRI':
                    v=self.fnri[m['source_food_id']]['nutrients'].get(label,'')
                    if row[f]!='':self.assertEqual(row[f],v)
                else:self.assertEqual(other[m['food_id']][f],self.usda[m['source_food_id']]['nutrients'].get(nid,{}).get('amount',''))
            if m['group']=='USDA':
                originals={p['id']:p for p in self.usda[m['source_food_id']]['portions']}
                for p in self.c.portions:
                    if p['food_id']==m['food_id'] and p['data_status']=='OTHER_SOURCE_PORTION':
                        src=originals[p['portion_id'].split('_USDA_')[1]]
                        self.assertEqual(p['quantity'],src['amount']);self.assertEqual(p['edible_weight_g'],src['gram_weight']);count+=1
        self.assertEqual(count,234)

    def test_estimates_recompute_and_require_explicit_selection(self):
        estimates={r['estimate_id']:r for r in self.c.estimates}
        for m in self.manifest:
            if not m['estimate_id']:continue
            self.assertEqual(self.c.resolve(m['food_id'])['label'],'Unavailable')
            resolved=self.c.resolve(m['food_id'],estimate_id=m['estimate_id'])
            self.assertEqual(resolved['confidence']['level'],'Low')
            parts=self.parts[m['estimate_id']];mass=sum(Decimal(p['edible_grams']) for p in parts)
            self.assertEqual(mass,Decimal(m['modeled_mass_g']))
            for p in parts:
                source=self.c.resolve(p['ingredient_food_id'])
                self.assertEqual(p['ingredient_name'],self.c.foods[p['ingredient_food_id']]['name'])
                self.assertEqual(json.loads(p['nutrient_provenance_json']),source['nutrients'])
                for f in FIELDS:
                    v=source['nutrients'][f]['value_per_100g'];self.assertEqual(p[f],'' if v is None else str(v))
            for f in FIELDS:
                expected='' if any(p[f]=='' for p in parts) else str((sum(Decimal(p[f])*Decimal(p['edible_grams']) for p in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP))
                self.assertEqual(estimates[m['estimate_id']][f],expected)
            self.assertFalse(any(p['food_id']==m['food_id'] and p['data_status']=='OTHER_SOURCE_PORTION' for p in self.c.portions))

    def test_search_and_aliases_keep_estimates_opt_in(self):
        root=DB.parents[1];version=json.loads((root/'api/catalog-active.json').read_text())['version']
        search=json.loads((root/'api/catalog-history'/(version+'.json')).read_text(encoding='utf-8'))['foods']
        for m in self.manifest:self.assertEqual(m['food_id'] in search,m['kind']=='reference')
        aliases=read_csv(DB/'aliases.csv')
        for term in ['pokipoki','pancit batil patong','pater chicken','Maranao palapa','Gerrys Grill Calamares','Maxs Sizzling Tofu','Giligans Chopsuey']:
            self.assertTrue(any(r['alias']==term for r in aliases),term)

if __name__=='__main__':unittest.main()
