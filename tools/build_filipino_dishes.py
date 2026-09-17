"""Append 50 opt-in reference-mixture estimates without changing existing data."""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from food_db_sources import DB, RESEARCH, FIELDS, read_csv
from expand_food_db import write_csv
from resolve_food import FoodCatalog
from filipino_recipe_plans import INGREDIENTS, PLANS

BATCH='2026-09-17-filipino-dishes'
ASSUMPTIONS=('Model-designed reference mixture, not an FNRI dish analysis or a published standardized recipe. '
 'Ingredient grams refer to edible components in each linked source preparation, mostly already cooked. '
 'Final mass is the sum of component masses including retained water; no further evaporation, draining or nutrient loss is modeled. '
 'All added oil, salt and sauce are retained. Raw garlic, ginger and chili are cooking proxies; '
 'boiled whole egg plus separately listed oil approximates cooked egg in omelettes/silog. '
 'Tamarind entry approximates retained souring ingredient, not measured strained extract. '
 'No bones, shells or uneaten broth are included. Missing ingredient nutrients propagate to unknown dish nutrients.')
LIMITATIONS=('Recipe proportions, cooking proxies, retention and yield are assumptions, not measurements. '
 'Use only as an explicitly selected estimate for this variant. Actual recipes and portions vary. '
 'No standard cup, bowl, plate or piece weight is asserted; weigh the edible finished food. '
 'Canned source dishes are not substituted for homemade dishes.')

def main():
    marker=DB/(BATCH+'.json')
    if marker.exists(): print('Already applied; no changes.');return
    c=FoodCatalog(); assert len(c.foods)==1259 and len(PLANS)==50
    assert len({name for name,_,_ in PLANS})==50
    for s in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((DB.parents[1]/s['local_snapshot']).read_bytes()).hexdigest()==s['sha256']
    targets=['foods.csv','aliases.csv','portions.csv','changes.csv','food_estimates.csv','estimate_inputs.csv']
    baseline={n:(DB/n).read_bytes() for n in targets}
    tables={n:read_csv(DB/n) for n in targets}
    ingredients=dict(INGREDIENTS)
    # Exact published water identity, not an inferred zero-nutrient placeholder.
    water=next(r for r in c.foods.values() if r['source_food_id']=='173647')
    ingredients['water']=int(water['food_id'][2:])
    components=[];recipes=[];audit=[]
    for index,(name,alias,mixture) in enumerate(PLANS,1):
        fid=f'FC{1259+index:06d}';eid=f'EST_PH_DISH_{index:03d}_V1';rid=f'PH_DISH_{index:03d}'
        full_name=name+' (recipe estimate)'
        result=[];urls=[]
        for key,grams in mixture.items():
            ingredient_id=f'FC{ingredients[key]:06d}';resolved=c.resolve(ingredient_id)
            assert resolved['label'] not in ['Unavailable','Estimated']
            assert all(resolved['nutrients'][f]['value_per_100g'] is not None for f in list(FIELDS)[:4])
            row=dict(recipe_id=rid,estimate_id=eid,ingredient_food_id=ingredient_id,ingredient_name=c.foods[ingredient_id]['name'],edible_grams=str(grams),weight_status='ASSUMED_REFERENCE_MIXTURE')
            row.update({f: '' if resolved['nutrients'][f]['value_per_100g'] is None else str(resolved['nutrients'][f]['value_per_100g']) for f in FIELDS})
            row['nutrient_provenance_json']=json.dumps(resolved['nutrients'],ensure_ascii=False,separators=(',',':'))
            components.append(row);result.append(row)
            urls.extend(n['source_url'] for n in resolved['nutrients'].values() if n['source_url'])
            tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='ingredient_edible_grams:'+ingredient_id,input_value=str(grams),unit='g edible component in linked preparation',source_food_id=ingredient_id,source_url=c.foods[ingredient_id]['source_url'],input_status='ASSUMED_RECIPE_WEIGHT',notes='Weight is model-assumed; nutrient values are source-backed. See recipe-ingredients.csv for frozen nutrient inputs.'))
        mass=sum(Decimal(r['edible_grams']) for r in result)
        nutrient_values={}
        for field in FIELDS:
            nutrient_values[field]='' if any(r[field]=='' for r in result) else str((sum(Decimal(r['edible_grams'])*Decimal(r[field])/100 for r in result)*100/mass).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP))
        source_urls=';'.join(dict.fromkeys(urls))
        row={k:'' for k in tables['foods.csv'][0]}
        row.update(food_id=fid,name=full_name,aliases=alias,category='Prepared Foods',basis='per 100 g modeled edible mixture',source_name='Ingredient-based recipe estimate',source_food_id=rid,source_food_name=name,source_url=source_urls,data_status='ESTIMATE_ONLY',notes=LIMITATIONS,active='True',verification_date='2026-09-17',verification_notes='AI-reviewed reference formulation; not manually or laboratory verified. Explicit estimate selection required.')
        tables['foods.csv'].append(row)
        estimate={k:'' for k in tables['food_estimates.csv'][0]}
        estimate.update(estimate_id=eid,food_id=fid,method='INGREDIENT_MIXTURE_CALCULATION',basis=row['basis'],**nutrient_values,source_urls=source_urls,estimated_date='2026-09-17',model='Codex (GPT-6)',method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=ASSUMPTIONS+' Modeled final mass: '+str(mass)+' g.',range_basis='Not quantified; no evidence-based uncertainty bounds available.',limitations=LIMITATIONS)
        tables['food_estimates.csv'].append(estimate)
        tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='modeled_final_edible_mass',input_value=str(mass),unit='g',source_food_id=rid,source_url='',input_status='ASSUMED_MASS_BALANCE',notes='Sum of the stated component masses; no measured cooking yield or household portion.'))
        for term in [full_name,name,alias]:
            tables['aliases.csv'].append(dict(food_id=fid,alias=term,source_url=source_urls,data_status='ESTIMATE_DISCOVERY_ALIAS',notes='Recipe estimate discovery only; no automatic verified-food match.'))
        tables['portions.csv'].append(dict(portion_id=fid+'_100G_EST',food_id=fid,description='100 g modeled edible mixture',quantity='100',unit='g',edible_weight_g='100',edible_portion_pct='',source_url=source_urls,data_status='ESTIMATE_REFERENCE_BASIS',notes='Calculation reference only; not a measured household portion. Explicit estimate required.'))
        for field,value in row.items():
            if value:tables['changes.csv'].append(dict(date='2026-09-17',food_id=fid,field=field,old_value='',new_value=value,reason='Add opt-in modeled Filipino recipe variant; '+BATCH,source_url=source_urls))
        recipes.append(dict(recipe_id=rid,food_id=fid,estimate_id=eid,name=full_name,family_alias=alias,modeled_final_edible_mass_g=str(mass),yield_status='ASSUMED_SUM_OF_COMPONENT_MASSES',ingredient_count=len(result),missing_nutrients=';'.join(f for f,v in nutrient_values.items() if v==''),household_serving_weight_g='',notes=ASSUMPTIONS))
        matches=[r for r in c.foods.values() if alias.lower() in (r['name']+' '+r['aliases']).lower()]
        audit.append(dict(recipe_id=rid,variant=name,fnri_review='Full retained PhilFCT catalog reviewed; no exact home-prepared formulation with these ingredient weights. Canned/specialized versions remain distinct.',existing_related_food_ids=';'.join(r['food_id'] for r in matches),decision='Explicit ingredient estimate; do not overwrite or inherit a related record.'))
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for name,content in baseline.items():
        assert (DB/name).read_bytes()==content
        p=backup/name
        if p.exists():assert p.read_bytes()==content
        else:p.write_bytes(content)
    for name,rows in tables.items():
        assert rows[:len(read_csv(DB/name))]==read_csv(DB/name)
        write_csv(DB/name,rows)
    write_csv(DB/'filipino-recipes.csv',recipes)
    write_csv(DB/'recipe-ingredients.csv',components)
    write_csv(DB/'filipino-dish-source-audit.csv',audit)
    summary=dict(batch=BATCH,added=50,verified_dishes_added=0,explicit_recipe_estimates_added=50,total_food_identities=1309,prior_food_rows_preserved=1259,ingredient_rows=len(components),documented_household_weights_added=0,policy='Estimates are unavailable by default and require explicit estimate_id; all original foods, portions and estimates preserved.')
    marker.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
