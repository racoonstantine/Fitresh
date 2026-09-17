"""Data integrity and fallback behavior checks; no network or database writes."""
import unittest
from decimal import Decimal
from food_db_sources import DB, RESEARCH, FIELDS, read_csv, load_sources
from resolve_food import FoodCatalog

class FoodDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fnri,cls.usda=load_sources()
    def setUp(self): self.catalog=FoodCatalog()
    def test_original_rows_unchanged(self):
        before=read_csv(RESEARCH/'2026-09-16-variants-v1/foods.csv')
        self.assertEqual(len(before),100)
        for row in before: self.assertEqual(row,self.catalog.foods[row['food_id']])
    def test_links_and_source_units_and_values(self):
        ids=set(self.catalog.foods)
        for v in self.catalog.variants:
            self.assertIn(v['parent_food_id'],ids); self.assertIn(v['variant_food_id'],ids)
        for r in self.catalog.other:
            self.assertIn(r['food_id'],ids)
            if r['source_food_id']=='HSC_BLUE_MARLIN_FRESH':
                label=next(x for x in read_csv(DB/'external-label-facts.csv') if x['food_id']==r['food_id'])
                for field in FIELDS:
                    self.assertAlmostEqual(float(r[field]),float(label[field])*100/113,places=4)
                continue
            for field,(_,nutrient_id,_) in FIELDS.items():
                self.assertEqual(r[field],self.usda[r['source_food_id']]['nutrients'].get(nutrient_id,{}).get('amount',''))
        for r in self.catalog.foods.values():
            if r['data_status'] in ['VERIFIED_FNRI','PARTIAL_VERIFIED_FNRI']:
                source=self.fnri[r['source_food_id']]
                for field,(label,_,_) in FIELDS.items():
                    if r[field]: self.assertEqual(Decimal(r[field]),Decimal(source['nutrients'][label]))
                if r['data_status']=='VERIFIED_FNRI': self.assertTrue(all(r[f]!='' for f in FIELDS))
    def test_primary_zero_beats_fallback_and_missing_uses_usda(self):
        result=self.catalog.resolve('FC000049')
        self.assertEqual(result['label'],'Other source')
        chol=result['nutrients']['cholesterol_mg_100g']
        self.assertEqual(chol['value_per_100g'],50)
        self.assertEqual(chol['label'],'Other source')
        zero=result['nutrients']['sugar_g_100g']
        self.assertEqual(zero['value_per_100g'],0); self.assertEqual(zero['label'],'Verified')
        self.assertEqual(result['nutrients']['protein_g_100g']['label'],'Verified')
    def test_estimate_requires_explicit_selection(self):
        field='sugar_g_100g'
        self.assertIsNone(self.catalog.resolve('FC000022')['nutrients'][field]['value_per_100g'])
        result=self.catalog.resolve('FC000022',estimate_id='EST_PEANUT_SUGAR_V1')
        self.assertEqual(result['label'],'Estimated'); self.assertEqual(result['nutrients'][field]['value_per_100g'],4.9)
        self.assertEqual(result['nutrients']['kcal_100g']['label'],'Verified')
        with self.assertRaises(ValueError): self.catalog.resolve('FC000001',estimate_id='EST_PEANUT_SUGAR_V1')
    def test_unresolved_parent_does_not_select_a_variant(self):
        result=self.catalog.resolve('FC000034')
        self.assertTrue(result['requires_identity_selection']); self.assertTrue(result['variants'])
        self.assertEqual(result['label'],'Unavailable')
        self.assertTrue(all(n['value_per_100g'] is None for n in result['nutrients'].values()))
    def test_cooked_yield_calculation_and_scaling(self):
        row=next(r for r in self.catalog.estimates if r['estimate_id']=='EST_CANTON_YIELD_V1')
        self.assertEqual(self.catalog.resolve(row['food_id'])['label'],'Unavailable')
        result=self.catalog.resolve(row['food_id'],estimate_id=row['estimate_id'],edible_grams=250)
        for field,(label,_,_) in FIELDS.items():
            if row[field]:
                expected=Decimal(self.fnri['A140']['nutrients'][label])/Decimal('2.5')
                self.assertAlmostEqual(float(row[field]),float(expected),places=2)
                self.assertAlmostEqual(result['nutrients'][field]['value_for_portion'],float(row[field])*2.5)
    def test_portion_quantity_is_not_applied_twice(self):
        p=next(p for p in self.catalog.portions if p['quantity']=='3' and p['data_status']=='OTHER_SOURCE_PORTION')
        self.assertEqual(self.catalog.portion_grams(p['food_id'],p['portion_id']),float(p['edible_weight_g']))
        self.assertEqual(self.catalog.portion_grams(p['food_id'],p['portion_id'],2),2*float(p['edible_weight_g']))
        with self.assertRaises(ValueError): self.catalog.portion_grams('FC000001',p['portion_id'])
    def test_invalid_weights_and_conflicting_candidates(self):
        for value in [0,-1,float('nan'),float('inf')]:
            with self.assertRaises(ValueError): self.catalog.resolve('FC000001',edible_grams=value)
        source=next(r for r in self.catalog.other if r['food_id']=='FC000049')
        self.catalog.other.append(dict(source))
        with self.assertRaises(ValueError): self.catalog.resolve('FC000049')
    def test_all_foods_and_explicit_estimates_resolve(self):
        for fid in self.catalog.foods: self.catalog.resolve(fid)
        for r in self.catalog.estimates: self.catalog.resolve(r['food_id'],estimate_id=r['estimate_id'])
    def test_new_food_fields_are_logged(self):
        changes=read_csv(DB/'changes.csv')
        logged={(r['food_id'],r['field'],r['new_value']) for r in changes}
        for fid,r in self.catalog.foods.items():
            if int(fid[2:])>100:
                for k,v in r.items():
                    if v: self.assertIn((fid,k,v),logged)

    def test_expansion_preserves_all_prior_records_and_adds_500_distinct_foods(self):
        from expand_food_db import normal
        from collections import Counter
        before=read_csv(RESEARCH/'2026-09-16-expand-500/foods.csv')
        self.assertEqual(len(before),147)
        for row in before: self.assertEqual(row,self.catalog.foods[row['food_id']])
        additions=read_csv(DB/'expansion-500.csv')
        self.assertEqual(len(additions),500)
        self.assertEqual(len({r['source_food_id'] for r in additions}),500)
        self.assertEqual(len({normal(r['name']) for r in additions}),500)
        self.assertEqual(sorted(Counter(r['batch_id'] for r in additions).values()),[100]*5)
        old_codes={r['source_food_id'] for r in before if 'FNRI' in r['source_name']}
        old_names={normal(n) for r in before for n in [r['name'],r['source_food_name']] if n}
        for entry in additions:
            self.assertNotIn(entry['source_food_id'],old_codes)
            self.assertNotIn(normal(entry['name']),old_names)
            row=self.catalog.foods[entry['food_id']]
            self.assertTrue(all(row[f]!='' for f in list(FIELDS)[:4]))
            self.assertIn(row['data_status'],['VERIFIED_FNRI','PARTIAL_VERIFIED_FNRI'])
        for name in ['aliases.csv','portions.csv','changes.csv','verification-evidence.csv']:
            old=read_csv(RESEARCH/'2026-09-16-expand-500'/name)
            self.assertEqual(read_csv(DB/name)[:len(old)],old)

    def test_expansion_has_evidence_aliases_and_portions_for_every_food(self):
        additions=read_csv(DB/'expansion-500.csv')
        evidence=read_csv(DB/'verification-evidence.csv')
        aliases=read_csv(DB/'aliases.csv')
        for entry in additions:
            fid=entry['food_id']
            fields=[e['field'] for e in evidence if e['food_id']==fid]
            self.assertEqual(sorted(fields),sorted(FIELDS))
            self.assertTrue(any(a['food_id']==fid and a['alias']==entry['name'] for a in aliases))
            self.assertTrue(any(p['food_id']==fid and p['edible_weight_g']=='100' for p in self.catalog.portions))

    def test_round2_preservation_and_distinct_sources(self):
        from collections import Counter
        from expand_food_db import normal
        before=read_csv(RESEARCH/'2026-09-17-expand-500/foods.csv')
        self.assertEqual(len(before),647)
        for row in before:self.assertEqual(row,self.catalog.foods[row['food_id']])
        additions=read_csv(DB/'expansion-round2.csv')
        self.assertEqual(len(additions),500)
        self.assertEqual(Counter(r['source'] for r in additions),{'FNRI':400,'USDA':100})
        self.assertEqual(sorted(Counter(r['batch_id'] for r in additions).values()),[100]*5)
        self.assertEqual(len({(r['source'],r['source_food_id']) for r in additions}),500)
        old_names={normal(n) for r in before for n in [r['name'],r['source_food_name']] if n}
        old_fnri={r['source_food_id'] for r in before if 'FNRI' in r['source_name']}
        old_usda={r['source_food_id'] for r in read_csv(RESEARCH/'2026-09-17-expand-500/other_food_values.csv')}
        for entry in additions:
            self.assertNotIn(normal(entry['name']),old_names)
            self.assertNotIn(entry['source_food_id'],old_fnri if entry['source']=='FNRI' else old_usda)
            result=self.catalog.resolve(entry['food_id'])
            for f in list(FIELDS)[:4]:self.assertIsNotNone(result['nutrients'][f]['value_per_100g'])
            self.assertNotEqual(result['label'],'Estimated')
        for name in ['aliases.csv','portions.csv','changes.csv','verification-evidence.csv','other_food_values.csv']:
            old=read_csv(RESEARCH/'2026-09-17-expand-500'/name)
            self.assertEqual(read_csv(DB/name)[:len(old)],old)

    def test_common_food_expansion_preserves_records_and_source_portions(self):
        old=read_csv(RESEARCH/'2026-09-17-common-foods-drinks/foods.csv')
        self.assertEqual(len(old),1147)
        for row in old:self.assertEqual(row,self.catalog.foods[row['food_id']])
        additions=read_csv(DB/'expansion-common-foods.csv')
        self.assertEqual(len(additions),112)
        self.assertEqual(len({(r['source'],r['source_food_id']) for r in additions}),112)
        blocked=[];count=0
        for entry in additions:
            fid=entry['food_id'];r=self.catalog.resolve(fid)
            if r['requires_identity_selection']:
                blocked.append(fid)
                self.assertTrue(all(n['value_per_100g'] is None for n in r['nutrients'].values()))
            else:
                for field in list(FIELDS)[:4]:self.assertIsNotNone(r['nutrients'][field]['value_per_100g'])
            if entry['source']=='USDA':
                source={p['id']:p for p in self.usda[entry['source_food_id']]['portions']}
                for p in self.catalog.portions:
                    if p['food_id']==fid and p['data_status']=='OTHER_SOURCE_PORTION':
                        original=source[p['portion_id'].split('_USDA_')[1]]
                        self.assertEqual(p['quantity'],original['amount'])
                        self.assertEqual(p['edible_weight_g'],original['gram_weight']);count+=1
        self.assertEqual(count,73)
        self.assertEqual(set(blocked),{r['food_id'] for r in read_csv(DB/'source-conflicts.csv')})
        for name in ['aliases.csv','portions.csv','other_food_values.csv','verification-evidence.csv']:
            original=read_csv(RESEARCH/'2026-09-17-common-foods-drinks'/name)
            self.assertEqual(read_csv(DB/name)[:len(original)],original)

    def test_display_labels_preserve_sources_and_gap_audit_keeps_unknowns(self):
        for row in read_csv(DB/'food-display-labels.csv'):
            self.assertEqual(row['source_name'],self.catalog.foods[row['food_id']]['name'])
            self.assertEqual(self.catalog.resolve(row['food_id'])['name'],row['display_name'])
        for row in read_csv(DB/'nutrient-gap-audit.csv'):
            self.assertEqual(self.catalog.foods[row['food_id']][row['field']],'')
            self.assertEqual(row['status'],'SOURCE_MISSING')
        self.assertIn('dry product',self.catalog.resolve('FC000645')['name'])

    def test_filipino_recipes_preserve_existing_records_and_require_opt_in(self):
        recipes=read_csv(DB/'filipino-recipes.csv')
        self.assertEqual(len(recipes),50)
        self.assertEqual(len({r['food_id'] for r in recipes}),50)
        for name in ['foods.csv','aliases.csv','portions.csv','food_estimates.csv','estimate_inputs.csv','changes.csv']:
            before=read_csv(RESEARCH/'2026-09-17-filipino-dishes'/name)
            self.assertEqual(read_csv(DB/name)[:len(before)],before)
        for recipe in recipes:
            result=self.catalog.resolve(recipe['food_id'])
            self.assertEqual(result['label'],'Unavailable')
            self.assertTrue(all(n['value_per_100g'] is None for n in result['nutrients'].values()))
            selected=self.catalog.resolve(recipe['food_id'],estimate_id=recipe['estimate_id'])
            self.assertEqual(selected['label'],'Estimated')
            for field in list(FIELDS)[:4]:self.assertIsNotNone(selected['nutrients'][field]['value_per_100g'])
            self.assertEqual(recipe['household_serving_weight_g'],'')

    def test_recipe_nutrients_recompute_from_frozen_source_inputs(self):
        from decimal import ROUND_HALF_UP
        components=read_csv(DB/'recipe-ingredients.csv')
        estimates={r['estimate_id']:r for r in self.catalog.estimates}
        for recipe in read_csv(DB/'filipino-recipes.csv'):
            parts=[r for r in components if r['recipe_id']==recipe['recipe_id']]
            mass=sum(Decimal(r['edible_grams']) for r in parts)
            self.assertEqual(mass,Decimal(recipe['modeled_final_edible_mass_g']))
            for part in parts:
                source=self.catalog.resolve(part['ingredient_food_id'])
                self.assertNotIn(source['label'],['Estimated','Unavailable'])
                for field in FIELDS:
                    value=source['nutrients'][field]['value_per_100g']
                    self.assertEqual(part[field],'' if value is None else str(value))
            estimate=estimates[recipe['estimate_id']]
            for field in FIELDS:
                if any(p[field]=='' for p in parts):self.assertEqual(estimate[field],'')
                else:
                    expected=(sum(Decimal(p[field])*Decimal(p['edible_grams']) for p in parts)/mass).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP)
                    self.assertEqual(Decimal(estimate[field]),expected)
            half=self.catalog.resolve(recipe['food_id'],estimate_id=recipe['estimate_id'],edible_grams=50)
            self.assertAlmostEqual(half['nutrients']['kcal_100g']['value_for_portion'],float(estimate['kcal_100g'])/2)

    def test_round2_usda_portions_match_original_quantity_and_weight(self):
        additions=[r for r in read_csv(DB/'expansion-round2.csv') if r['source']=='USDA']
        actual=0
        for entry in additions:
            original={p['id']:p for p in self.usda[entry['source_food_id']]['portions']}
            for p in self.catalog.portions:
                if p['food_id']==entry['food_id'] and p['data_status']=='OTHER_SOURCE_PORTION':
                    source=original[p['portion_id'].split('_USDA_')[1]]
                    self.assertEqual(p['quantity'],source['amount'])
                    self.assertEqual(p['edible_weight_g'],source['gram_weight'])
                    actual+=1
        self.assertEqual(actual,222)

    def test_personal_500_preserves_originals_and_separates_estimates(self):
        original=read_csv(RESEARCH/'2026-09-17-personal-500/foods.csv')
        self.assertEqual(len(original),1309)
        self.assertEqual(read_csv(DB/'foods.csv')[:1309],original)
        additions=read_csv(DB/'expansion-personal-sources.csv')+read_csv(DB/'expansion-personal-specials.csv')
        self.assertEqual(len(additions),500)
        self.assertEqual(len({r['food_id'] for r in additions}),500)
        for e in self.catalog.estimates:
            if not e['estimate_id'].startswith('EST_PERSONAL_'):continue
            r=self.catalog.resolve(e['food_id'])
            self.assertEqual(r['label'],'Unavailable')
            self.assertEqual(r['confidence']['level'],'Low')
            self.assertEqual(self.catalog.resolve(e['food_id'],estimate_id=e['estimate_id'])['confidence']['level'],'Medium' if e['method']=='LABEL_WEIGHT_UNIT_INFERENCE' else 'Low')

    def test_personal_estimate_arithmetic(self):
        import json
        parts=read_csv(DB/'personal-estimate-components.csv')
        labels={r['food_id']:r for r in read_csv(DB/'external-label-facts.csv')}
        for e in self.catalog.estimates:
            if not e['estimate_id'].startswith('EST_PERSONAL_'):continue
            mass=Decimal(next(r['input_value'] for r in read_csv(DB/'estimate_inputs.csv') if r['estimate_id']==e['estimate_id'] and r['input_name']=='modeled_final_edible_mass'))
            selected=[p for p in parts if p['estimate_id']==e['estimate_id']]
            for f in FIELDS:
                if e['food_id'] in labels:
                    value=labels[e['food_id']][f]
                    expected=None if value=='' else Decimal(value)*100/mass
                else:
                    vals=[(json.loads(p['nutrients_per_100g_json'])[f],Decimal(p['edible_grams'])) for p in selected]
                    expected=None if any(v is None for v,g in vals) else sum(Decimal(str(v))*g for v,g in vals)/mass
                if expected is None:self.assertEqual(e[f],'')
                else:self.assertAlmostEqual(float(e[f]),float(expected),places=4)
        cabbage=[p for p in parts if p['estimate_id']=='EST_PERSONAL_018_V1']
        self.assertIn('FC000285',[p['ingredient_food_id'] for p in cabbage])

if __name__=='__main__': unittest.main()
