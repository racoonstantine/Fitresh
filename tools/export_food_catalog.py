"""Materialize read-only application data with per-nutrient provenance."""
import csv
import json
from collections import Counter
from food_db_sources import DB
from resolve_food import FoodCatalog
from expand_food_db import write_csv

def main():
    catalog=FoodCatalog(); foods=[]; coverage=[]
    for food_id in catalog.foods:
        resolved=catalog.resolve(food_id)
        resolved['portions']=[p for p in catalog.portions if p['food_id']==food_id]
        resolved['available_estimates']=[dict(estimate_id=e['estimate_id'],method=e['method'],assumptions=e['assumptions']) for e in catalog.estimates if e['food_id']==food_id]
        foods.append(resolved)
        coverage.append(dict(food_id=food_id,name=resolved['name'],default_label=resolved['label'],
            default_complete=resolved['complete'],verified_fields=sum(n['label']=='Verified' for n in resolved['nutrients'].values()),
            other_source_fields=sum(n['label']=='Other source' for n in resolved['nutrients'].values()),
            missing_fields=';'.join(k for k,n in resolved['nutrients'].items() if n['value_per_100g'] is None),
            available_estimate_ids=';'.join(e['estimate_id'] for e in resolved['available_estimates']),
            available_variant_ids=';'.join(v['variant_food_id'] for v in resolved['variants'])))
    payload=dict(schema_version=1,policy='Verified then reviewed other source, per nutrient. Estimates require explicit estimate_id selection. Broad parents never inherit variant values.',
        foods=foods,explicit_estimates={e['estimate_id']:catalog.resolve(e['food_id'],estimate_id=e['estimate_id']) for e in catalog.estimates})
    (DB/'food_catalog.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    def confidence_row(r):
        info=r['confidence']
        return dict(food_id=r['food_id'],estimate_id=r['estimate']['estimate_id'] if r['estimate'] else '',name=r['name'],level=info['level'],reason=info['reason'],policy_version=info['policy_version'],scope=info['scope'],missing_fields=';'.join(info['missing_fields']))
    write_csv(DB/'food-confidence.csv',[confidence_row(r) for r in foods])
    write_csv(DB/'estimate-confidence.csv',[confidence_row(r) for r in payload['explicit_estimates'].values()])
    with (DB/'coverage.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(coverage[0]));w.writeheader();w.writerows(coverage)
    summary=dict(foods=len(foods),default_labels=dict(Counter(r['label'] for r in foods)),
        confidence_levels=dict(Counter(r['confidence']['level'] for r in foods)),
        default_complete=sum(r['complete'] for r in foods),explicit_estimates=len(catalog.estimates),
        household_portions=sum(p['data_status']=='OTHER_SOURCE_PORTION' for p in catalog.portions),
        source_status_counts=dict(Counter(r['data_status'] for r in catalog.foods.values())))
    (DB/'coverage-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
