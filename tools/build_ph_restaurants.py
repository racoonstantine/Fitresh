"""Append evidence-labeled restaurant mixture estimates; preserve every prior row."""
import json,hashlib
from collections import Counter
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv
from expand_food_db import write_csv,normal
from resolve_food import FoodCatalog
from ph_restaurant_plans import INGREDIENTS,SOURCES,plans

BATCH='2026-09-17-ph-restaurant-estimates'
ASSUMPTIONS=('Model-assumed component masses in the exact linked source preparations. Final edible mass is their sum; no additional evaporation or nutrient loss modeled. '
 'Added oil, sugar and salt fully retained. Raw seasonings and food substitutes are proxies; this is not a manufacturer recipe or allergen declaration. '
 'Missing ingredient nutrients remain unknown. Weights define a calculation mixture, not a measured restaurant order. ')
LIMITATIONS=('Low confidence. Actual Philippine brand recipe, meat cut, retained oil, broth, sauce and serving mass are unverified. '
 'No US branded nutrition presented as Philippine nutrition. No official complete Philippine nutrition panel was obtained for this entry. '
 'Weigh edible finished food; no automatic bowl/piece/order conversion. Bones, sticks and unconsumed broth excluded from logged weight. '
 'Includes only components named in this identity; sides, rice and drinks excluded unless explicitly listed. Menu availability varies by branch/date.')

def main():
    marker=DB/(BATCH+'.json')
    if marker.exists():print('Already applied.');return
    c=FoodCatalog();assert len(c.foods)==2209
    targets=['foods.csv','aliases.csv','portions.csv','changes.csv','food_estimates.csv','estimate_inputs.csv']
    baseline={n:(DB/n).read_bytes() for n in targets};tables={n:read_csv(DB/n) for n in targets}
    ingredient_ids={}
    for key,name in INGREDIENTS.items():
        matches=[r['food_id'] for r in c.foods.values() if r['name']==name]
        assert len(matches)==1,(key,name,matches)
        ingredient_ids[key]=matches[0]
    original_names={normal(r['name']) for r in c.foods.values()};manifest=[];components=[]
    for index,plan in enumerate(plans(),1):
        fid=f'FC{2209+index:06d}';eid=f'EST_PH_RESTAURANT_{index:03d}_V1'
        name=plan['brand']+' Philippines '+plan['menu_item']+' (estimate)'
        assert normal(name) not in original_names;original_names.add(normal(name))
        parts=[];urls=[plan['menu_url']]
        for key,grams in plan['mixture'].items():
            assert grams>0
            ingredient_id=ingredient_ids[key];source=c.resolve(ingredient_id)
            assert source['label'] not in ['Unavailable','Estimated']
            assert all(source['nutrients'][f]['value_per_100g'] is not None for f in list(FIELDS)[:4])
            part=dict(estimate_id=eid,ingredient_food_id=ingredient_id,ingredient_name=c.foods[ingredient_id]['name'],edible_grams=str(grams),weight_status='ASSUMED_REFERENCE_MIXTURE',**{f:'' if n['value_per_100g'] is None else str(n['value_per_100g']) for f,n in source['nutrients'].items()},nutrient_provenance_json=json.dumps(source['nutrients'],sort_keys=True))
            parts.append(part);components.append(part)
            urls.extend(n['source_url'] for n in source['nutrients'].values() if n['source_url'])
            tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='ingredient_edible_grams:'+ingredient_id,input_value=str(grams),unit='g in linked source preparation',source_food_id=ingredient_id,source_url=c.foods[ingredient_id]['source_url'],input_status='ASSUMED_RECIPE_WEIGHT',notes=plan['notes'] or 'Proxy composition; no official brand formulation.'))
        mass=sum(Decimal(p['edible_grams']) for p in parts)
        nutrients={f:'' if any(p[f]=='' for p in parts) else str((sum(Decimal(p[f])*Decimal(p['edible_grams']) for p in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)) for f in FIELDS}
        assert Decimal(nutrients['kcal_100g'])>0
        row={k:'' for k in tables['foods.csv'][0]}
        row.update(food_id=fid,name=name,aliases=plan['brand']+' '+plan['menu_item'],category='Philippine Restaurant Estimates',basis='per 100 g modeled edible mixture',source_name='Explicit ingredient/proxy estimate; menu identity checked',source_food_id=eid,source_food_name=plan['menu_item'],source_url=plan['menu_url'],data_status='ESTIMATE_ONLY',notes=plan['notes']+' '+LIMITATIONS,active='True',verification_date='2026-09-17',verification_notes='Menu identity reviewed; nutrition NOT manufacturer-verified. Explicit estimate selection required.')
        tables['foods.csv'].append(row)
        estimate={k:'' for k in tables['food_estimates.csv'][0]}
        estimate.update(estimate_id=eid,food_id=fid,method='BRANDED_MENU_PROXY',basis=row['basis'],**nutrients,source_urls=';'.join(dict.fromkeys(urls)),estimated_date='2026-09-17',model='Codex (GPT-6)',method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=ASSUMPTIONS+plan['notes']+' Modeled mass '+str(mass)+' g.',range_basis='Not quantified; no evidence-based error bounds available.',limitations=LIMITATIONS)
        tables['food_estimates.csv'].append(estimate)
        tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='modeled_final_edible_mass',input_value=str(mass),unit='g',source_food_id=eid,source_url=plan['menu_url'],input_status='ASSUMED_MASS_BALANCE',notes='Calculation mixture mass, never an official bowl, sandwich or order weight.'))
        for alias in [name,row['aliases']]:tables['aliases.csv'].append(dict(food_id=fid,alias=alias,source_url=plan['menu_url'],data_status='SEARCH_ALIAS_REVIEWED',notes='Qualified menu discovery; never automatically choose a recipe or portion.'))
        tables['portions.csv'].append(dict(portion_id=fid+'_100G_EST',food_id=fid,description='100 g modeled edible mixture',quantity='100',unit='g',edible_weight_g='100',edible_portion_pct='',source_url=plan['menu_url'],data_status='ESTIMATE_REFERENCE_BASIS',notes='Calculation reference only; no household serving weight claimed.'))
        for field,value in row.items():
            if value:tables['changes.csv'].append(dict(date='2026-09-17',food_id=fid,field=field,old_value='',new_value=value,reason=BATCH+' new identity; all preexisting food values preserved.',source_url=plan['menu_url']))
        manifest.append(dict(food_id=fid,estimate_id=eid,brand=plan['brand'],name=name,menu_item=plan['menu_item'],menu_source_url=plan['menu_url'],menu_source_role='IDENTITY_ONLY_NOT_NUTRITION',nutrition_status='MODEL_ASSUMPTIONS_NOT_BRAND_FACTS',confidence='Low',modeled_mass_g=str(mass),notes=plan['notes']))
    assert len(manifest)==110
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for n,raw in baseline.items():
        assert (DB/n).read_bytes()==raw
        p=backup/n
        if p.exists():assert p.read_bytes()==raw
        else:p.write_bytes(raw)
        assert tables[n][:len(read_csv(DB/n))]==read_csv(DB/n)
    for n,rows in tables.items():write_csv(DB/n,rows)
    write_csv(DB/'ph-restaurant-estimates.csv',manifest)
    write_csv(DB/'ph-restaurant-components.csv',components)
    evidence=[dict(brand=brand,url=url,reviewed_date='2026-09-17',scope='Menu identity and qualitative description only; no full PH nutrition panel obtained.',access_note='Official global overseas-menu description; not PH nutrition.' if brand=='Ramen Nagi' else 'Merchant branch delivery listing; official PH site separately checked.' if brand=="McDonald's" else 'Official menu search-index text available; direct fetch returned 403.' if brand=='KFC' else 'Official menu page reviewed.') for brand,url in SOURCES.items()]
    write_csv(DB/'ph-restaurant-source-audit.csv',evidence)
    summary=dict(added=len(manifest),total_foods=len(tables['foods.csv']),by_brand=dict(Counter(p['brand'] for p in manifest)),ingredients=len(components),status='All explicit opt-in Low-confidence estimates; no measured order weights.',prior_food_rows_preserved=2209)
    marker.write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
