"""Resolve one food without mutating curated data. Estimates require selection."""
import argparse
import json
import math
from pathlib import Path
from food_db_sources import DB, FIELDS, read_csv
from food_confidence import classify

PRIMARY_STATUSES = {'VERIFIED_FNRI', 'PARTIAL_VERIFIED_FNRI', 'MANUALLY_VERIFIED'}

def number(value):
    if value is None or value == '': return None
    result = float(value)
    if not math.isfinite(result) or result < 0: raise ValueError('Nutrients must be finite and nonnegative')
    return result

class FoodCatalog:
    def __init__(self, directory=DB):
        self.directory = Path(directory)
        foods = read_csv(self.directory/'foods.csv')
        self.foods = {r['food_id']: r for r in foods}
        if len(self.foods) != len(foods): raise ValueError('Duplicate food IDs')
        self.other = read_csv(self.directory/'other_food_values.csv')
        self.estimates = read_csv(self.directory/'food_estimates.csv')
        self.variants = read_csv(self.directory/'food_variants.csv')
        self.portions = read_csv(self.directory/'portions.csv')
        labels = self.directory/'food-display-labels.csv'
        self.display_names = {r['food_id']:r['display_name'] for r in read_csv(labels)} if labels.exists() else {}

    def resolve(self, food_id, *, estimate_id=None, edible_grams=100):
        grams = number(edible_grams)
        if grams is None or grams <= 0: raise ValueError('Edible grams must be positive and finite')
        row = self.foods[food_id]
        if row['active'].lower() != 'true': raise ValueError('Food is inactive')
        options = [v for v in self.variants if v['parent_food_id']==food_id]
        blocked = row['data_status'] in {'NEEDS_FOOD_IDENTITY_VERIFICATION', 'SOURCE_CONFLICT_REVIEW_REQUIRED'}
        chosen = None
        if estimate_id:
            candidates = [r for r in self.estimates if r['estimate_id']==estimate_id and r['food_id']==food_id]
            if len(candidates)!=1: raise ValueError('Select exactly one estimate belonging to this food')
            chosen=candidates[0]
            if blocked: raise ValueError('Resolve food identity or source conflict before selecting an estimate')
            if chosen['review_status'] not in {'AI_REVIEWED_NOT_HUMAN_VERIFIED','HUMAN_REVIEWED_ESTIMATE'}:
                raise ValueError('Estimate is not eligible for use')
            if chosen['selection_policy']!='EXPLICIT_ESTIMATE_SELECTION': raise ValueError('Unknown estimate policy')
        nutrients={}
        for field in FIELDS:
            value=None; tier=None; source_url=None; source_record_id=None; source_name=None
            if not blocked and row['data_status'] in PRIMARY_STATUSES:
                value=number(row[field])
                if value is not None:
                    tier='Verified'; source_url=row['source_url']; source_record_id=row['source_food_id']; source_name=row['source_name']
            if value is None and not blocked:
                candidates=[r for r in self.other if r['food_id']==food_id
                    and r['data_status']=='REVIEWED_OTHER_SOURCE'
                    and r['match_status']=='MATCHED_FOOD_AND_PREPARATION'
                    and field in r['eligible_fields'].split(';') and r[field]!='']
                if len(candidates)>1: raise ValueError('Conflicting other-source candidates for '+field)
                if candidates:
                    source=candidates[0]; value=number(source[field]); tier='Other source'
                    source_url=source['source_url']; source_record_id=source['other_source_id']; source_name=source['source_name']
            if value is None and chosen:
                value=number(chosen[field])
                if value is not None:
                    tier='Estimated'; source_url=chosen['source_urls']; source_record_id=chosen['estimate_id']; source_name=chosen['method']
            nutrients[field]=dict(value_per_100g=value, value_for_portion=None if value is None else value*grams/100,
                label=tier or 'Unknown',source_url=source_url,source_record_id=source_record_id,source_name=source_name)
        levels={n['label'] for n in nutrients.values() if n['value_per_100g'] is not None}
        label=next((s for s in ['Estimated','Other source','Verified'] if s in levels),'Unavailable')
        # Reject an internally impossible blend rather than silently capping a source value.
        carbs=nutrients['carbs_g_100g']['value_per_100g']; sugar=nutrients['sugar_g_100g']['value_per_100g']
        if carbs is not None and sugar is not None and sugar > carbs + .1:
            raise ValueError('Source blend reports more sugar than total carbohydrate; review the food match')
        return dict(food_id=food_id,name=self.display_names.get(food_id,row['name']),edible_grams=grams,label=label,
            complete=all(n['value_per_100g'] is not None for n in nutrients.values()),
            confidence=classify(row,nutrients,chosen),
            requires_identity_selection=blocked,variants=options,nutrients=nutrients,
            estimate=None if not chosen else {k:chosen[k] for k in ['estimate_id','method','assumptions','limitations','review_status','model','method_version','estimated_date','range_basis']})

    def portion_grams(self, food_id, portion_id, count=1):
        count=number(count)
        if count is None or count<=0: raise ValueError('Portion count must be positive')
        matches=[p for p in self.portions if p['food_id']==food_id and p['portion_id']==portion_id]
        if len(matches)!=1: raise ValueError('Select a portion belonging to this food')
        grams=number(matches[0]['edible_weight_g'])
        if grams is None or grams<=0: raise ValueError('Portion weight is unavailable')
        # One portion means the entire labeled measure (e.g. 3 oz), not one oz.
        return grams*count

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('food_id'); parser.add_argument('--estimate-id')
    parser.add_argument('--edible-grams',type=float,default=100)
    args=parser.parse_args()
    try: print(json.dumps(FoodCatalog().resolve(args.food_id,estimate_id=args.estimate_id,edible_grams=args.edible_grams),indent=2,allow_nan=False))
    except (ValueError,KeyError) as e: parser.exit(2,str(e)+'\n')

if __name__=='__main__': main()
