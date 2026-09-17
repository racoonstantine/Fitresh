"""Twenty requested identities: one analytical fish reference and 19 opt-in estimates."""
import json, hashlib
from decimal import Decimal, ROUND_HALF_UP
from food_db_sources import DB, RESEARCH, FIELDS, read_csv
from expand_food_db import write_csv
from resolve_food import FoodCatalog

DATE='2026-09-17'
BATCH='2026-09-17-personal-specials'
MARLIN='https://www.hawaii-seafood.org/wp-content/uploads/2023/01/6-Hawaii-Blue-Marlin-Nutrient-Label-Claims.pdf'
ATHLENE='https://athlene.com.ph/products/active-pure-isolate'
CHOC='https://athlene.com.ph/cdn/shop/products/Pure_Isolate_nutrition_facts_1.png?v=1580265813&width=1946'
STRAW='https://athlene.com.ph/cdn/shop/products/6_fb90b81d-d365-463a-b114-c288c2e6d216.png?v=1603087577&width=1946'
KENNY='https://www.foodpanda.ph/restaurant/jodo/kenny-rogers-roasters-banawe'
CHOOKS='https://superbrands.s3.amazonaws.com/AAA%20MASTER%202%20PAGE%20PDF%20Case%20Studies/Philippines/Philippines%20Edition%209/Philippines%20Edition%209%20Chooks-to-Go.pdf'
def rounded(value):return str(value.quantize(Decimal('0.0001'),rounding=ROUND_HALF_UP))

def main():
    if (DB/(BATCH+'.json')).exists():print('Already applied.');return
    c=FoodCatalog();assert len(c.foods)==1789
    names=['foods.csv','aliases.csv','portions.csv','changes.csv','other_food_values.csv','food_estimates.csv','estimate_inputs.csv']
    tables={n:read_csv(DB/n) for n in names};baseline={n:(DB/n).read_bytes() for n in names}
    label_rows=[];inputs=[];manifest=[]
    # Published label is per 113 g FRESH fish, not per 100 g and not cooked.
    marlin_values=dict(zip(FIELDS,['120','29','0','0.5','0','0','45','35']))
    def food(name,status,source,source_id,url,notes):
        fid=f"FC{len(tables['foods.csv'])+1:06d}"
        r={k:'' for k in tables['foods.csv'][0]}
        r.update(food_id=fid,name=name,category='Requested Foods & Brands',basis='per 100 g edible portion',source_name=source,source_food_id=source_id,source_food_name=name,source_url=url,data_status=status,notes=notes,active='True',verification_date=DATE,verification_notes=notes)
        tables['foods.csv'].append(r)
        tables['aliases.csv'].append(dict(food_id=fid,alias=name,source_url=url,data_status='SEARCH_ALIAS_REVIEWED',notes='Exact qualified identity; estimates remain explicit.'))
        for field,value in r.items():
            if value:tables['changes.csv'].append(dict(date=DATE,food_id=fid,field=field,old_value='',new_value=value,reason=BATCH+' addition; no previous record modified.',source_url=url))
        manifest.append(dict(food_id=fid,name=name,status=status,source_url=url))
        return fid
    fid=food('Blue marlin (Makaira nigricans), Hawaii-caught, fresh','OTHER_SOURCE_AVAILABLE','Hawaii Seafood Council / NOAA-supported nutrient analysis','HSC_BLUE_MARLIN_FRESH',MARLIN,'Published fresh-fish label per 113 g; scaled arithmetically to 100 g. Regional sample, not a Philippine catch analysis. Not swordfish; no seared values claimed.')
    assert fid=='FC001790'
    other={k:'' for k in tables['other_food_values.csv'][0]}
    other.update(other_source_id='HSC_BLUE_MARLIN_FRESH_113G',food_id=fid,source_name='Hawaii Seafood Council / NOAA-supported nutrient analysis',source_food_id='HSC_BLUE_MARLIN_FRESH',source_food_name='Hawaii Blue Marlin (Makaira nigricans), fresh',source_url=MARLIN,accessed_date=DATE,source_release='PDF hosted January 2023; analysis date unspecified; reviewed 2026-09-17',data_status='REVIEWED_OTHER_SOURCE',match_status='MATCHED_FOOD_AND_PREPARATION',eligible_fields=';'.join(FIELDS),basis='per 100 g edible portion',notes='Exact label values preserved in external-label-facts.csv. Scale factor 100/113; fresh fish only.')
    other.update({f:rounded(Decimal(v)*100/113) for f,v in marlin_values.items()});tables['other_food_values.csv'].append(other)
    label_rows.append(dict(food_id=fid,product='Hawaii blue marlin, fresh',serving_mass='113',mass_unit_status='EXPLICIT_GRAMS',source_url=MARLIN,**marlin_values))
    tables['portions.csv'].append(dict(portion_id=fid+'_HSC_113G',food_id=fid,description='4 ounces fresh fish (source label: 113 g)',quantity='1',unit='label serving',edible_weight_g='113',edible_portion_pct='',source_url=MARLIN,data_status='OTHER_SOURCE_PORTION',notes='Use the source label weight, not an additional ounce multiplier. Fresh fish only.'))

    def estimate(name,parts,notes,url,method='INGREDIENT_MIXTURE_CALCULATION',yield_g=None,label=None):
        eid=f'EST_PERSONAL_{len(manifest):03d}_V1'
        fid=food(name+' (estimate)','ESTIMATE_ONLY','Explicit requested-food estimate',eid,url,notes+' Explicit selection required; not a verified branded value.')
        totals={f:Decimal(0) for f in FIELDS};mass=Decimal(0);source_urls=[url]
        if label:
            mass=Decimal(label['mass']);vals=label['values']
            totals={f:None if vals.get(f,'')=='' else Decimal(vals[f]) for f in FIELDS}
            label_rows.append(dict(food_id=fid,product=name,serving_mass=str(mass),mass_unit_status='GRAMS_INFERRED_NOT_PRINTED',source_url=url,**{f:vals.get(f,'') for f in FIELDS}))
            inputs.append(dict(estimate_id=eid,ingredient_food_id='',edible_grams=str(mass),input_type='PUBLISHED_LABEL_SERVING_WITH_INFERRED_GRAM_UNIT',nutrients_per_100g_json='',source_url=url,notes=notes))
            for f,v in vals.items():tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name=f,input_value=v,unit='per manufacturer serving',source_food_id=eid,source_url=url,input_status='PUBLISHED_LABEL_VALUE',notes='Serving gram unit inferred; original panel omits unit.'))
        else:
            for ingredient_id,grams in parts:
                if ingredient_id=='FC001790':
                    vals={f:other[f] for f in FIELDS};provenance=MARLIN
                else:
                    r=c.resolve(ingredient_id);assert r['label'] not in ['Unavailable','Estimated']
                    vals={f:r['nutrients'][f]['value_per_100g'] for f in FIELDS};provenance=c.foods[ingredient_id]['source_url']
                mass+=Decimal(str(grams));source_urls.append(provenance)
                for f in FIELDS:
                    if vals[f] is None or vals[f]=='':totals[f]=None
                    elif totals[f] is not None:totals[f]+=Decimal(str(vals[f]))*Decimal(str(grams))/100
                inputs.append(dict(estimate_id=eid,ingredient_food_id=ingredient_id,edible_grams=str(grams),input_type='ASSUMED_COMPONENT_WEIGHT',nutrients_per_100g_json=json.dumps(vals,sort_keys=True),source_url=provenance,notes='Component is in its exact source state; weight/model match is assumed.'))
                tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='ingredient_edible_grams:'+ingredient_id,input_value=str(grams),unit='g',source_food_id=ingredient_id,source_url=provenance,input_status='ASSUMED_RECIPE_WEIGHT',notes=notes))
        final_mass=Decimal(str(yield_g)) if yield_g is not None else mass
        e={k:'' for k in tables['food_estimates.csv'][0]}
        e.update(estimate_id=eid,food_id=fid,method=method,basis='per 100 g modeled edible food',**{f:'' if v is None else rounded(v*100/final_mass) for f,v in totals.items()},source_urls=';'.join(dict.fromkeys(source_urls)),estimated_date=DATE,model='Codex (GPT-6)',method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=notes+' Input mass '+str(mass)+' g; modeled final mass '+str(final_mass)+' g. All listed nutrients retained; no measured household serving weight.',range_basis='Not quantified; no evidence-based error range.',limitations='Brand recipes, retained oil, salt, sauce and portion weights can differ. Do not use as an official nutrition panel. Unknown inputs remain unknown; no bone/shell mass included.')
        tables['food_estimates.csv'].append(e)
        tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='modeled_final_edible_mass',input_value=str(final_mass),unit='g',source_food_id=eid,source_url=url,input_status='ASSUMED_MASS_OR_LABEL_UNIT',notes=notes))
        tables['portions.csv'].append(dict(portion_id=fid+'_100G_EST',food_id=fid,description='100 g modeled edible food',quantity='100',unit='g',edible_weight_g='100',edible_portion_pct='',source_url=url,data_status='ESTIMATE_REFERENCE_BASIS',notes='Calculation basis only, not a sourced cup, scoop, bowl or restaurant serving.'))
    for flavor,mass,cal,sodium,url in [('Chocolate','29.84','108','103',CHOC),('Strawberry Milkshake','29.08','105','101',STRAW)]:
        estimate('Athlene ACTIVE Pure Isolate, '+flavor+', dry powder',[],
            'Manufacturer panel checked visually. It prints serving size '+mass+' without a unit; grams inferred from dry powder and 1 lb pack / printed servings. Fiber is unlisted, not zero. Match your actual pack; flavor-specific numbers are not interchangeable.',url,method='LABEL_WEIGHT_UNIT_INFERENCE',label=dict(mass=mass,values=dict(kcal_100g=cal,protein_g_100g='25',carbs_g_100g='1',fat_g_100g='0',sugar_g_100g='0',sodium_mg_100g=sodium,cholesterol_mg_100g='1')))
    estimate('Seared sirloin steak, 100 g pan-fried meat plus 5 g butter',[('FC001352',100),('FC000096',5)],'USDA pan-fried sirloin with lean and fat proxies seared steak. Five grams additional butter retained; cut/doneness matter.','https://fdc.nal.usda.gov/food-details/169550/nutrients')
    estimate('Seared Atlantic farmed salmon, 100 g cooked fish plus 5 g oil',[('FC001049',100),('FC000642',5)],'Cooked dry-heat Atlantic farmed salmon proxies searing; 5 g retained oil. No sauce or extra salt.','https://fdc.nal.usda.gov/food-details/175168/nutrients')
    estimate('Seared blue marlin, fresh-fish yield model with oil',[('FC001790',113),('FC000642',5)],'113 g fresh Hawaii blue marlin assumed to yield 90 g cooked fish plus 5 g retained oil. No nutrient loss except water mass. Cooking yield unmeasured; species is blue marlin, not swordfish.',MARLIN,method='COOKED_YIELD_CALCULATION',yield_g=95)
    estimate('Home-fried chicken Pinoy-style, white meat, soy-calamansi',[('FC000383',100),('FC000099',5),('FC000085',10)],'FNRI already-fried white meat plus assumed retained soy/calamansi marinade. No additional frying oil beyond source fried chicken. Not a measured home recipe.','https://i.fnri.dost.gov.ph/fct/library/search_item')
    estimate('Home-fried chicken Pinoy-style, flour-coated meat and skin',[('FC001350',100),('FC000099',5),('FC000085',10)],'USDA flour-fried chicken, meat and skin, plus assumed soy/calamansi marinade. Flour and frying oil already in chicken proxy.','https://fdc.nal.usda.gov/food-details/171449/nutrients')
    estimate('Chooks-to-Go Sweet Roast, edible meat and skin, no extra sauce',[('FC000348',100),('FC000969',5)],'Generic FNRI seasoned roast chicken plus assumed 5 g sugar per 100 g edible chicken; not Chooks laboratory data. Sweet Roast identity documented; proprietary marinade unknown.',CHOOKS,method='BRANDED_MENU_PROXY')
    estimate('Chooks-to-Go Pepper Roast, edible meat and skin, no extra sauce',[('FC000348',100)],'Generic FNRI seasoned roast chicken proxy. Pepper Roast identity documented; actual marinade/salt and piece weights unknown.',CHOOKS,method='BRANDED_MENU_PROXY')
    kenny=[
      ('Classic Roasted Chicken, edible meat and skin',[('FC000348',100)],'Generic seasoned-roast chicken proxy; bones and any side dishes excluded.'),
      ('Classic Roasted Chicken, skin and visible fat removed',[('FC000349',100)],'Skin/visible-fat-removed FNRI roast proxy, not an official skinless menu nutrition value.'),
      ('Grilled Salmon, fish and lemon-butter-style sauce only',[('FC001049',100),('FC000096',10),('FC000085',5),('FC000642',3)],'Atlantic farmed cooked salmon and assumed sauce; calamansi proxies citrus. Menu plate rice and muffin excluded.'),
      ('Burger Steak, patty and mushroom gravy only',[('FC000137',150),('FC001750',50)],'Cooked 80/20 ground-beef patty and canned mushroom gravy proxy. Rice/muffin excluded; 200 g is modeled mixture, not measured order weight.'),
      ('Spinach Mashed Potato side',[('FC000199',150),('FC001085',30),('FC000093',30),('FC000096',10)],'Assumed potato, cooked spinach, milk and butter mixture; restaurant recipe and side weight unknown.'),
      ('Macaroni and Cheese side',[('FC001518',150),('FC000593',40),('FC000093',40),('FC000096',10)],'Assumed cooked enriched pasta, processed cheddar, milk and butter; exact restaurant recipe unknown.'),
      ('Corn and Carrots side',[('FC000005',70),('FC000324',30)],'Assumed 70/30 cooked edible corn kernels and carrots; no butter added to this reference mixture.'),
      ('Steamed Vegetables side',[('FC001081',40),('FC000324',30),('FC000253',30)],'Boiled broccoli/carrot/cauliflower proxy, 40/30/30 mixture; actual vegetables/seasoning may differ.'),
      ('Coleslaw side',[('FC000285',70),('FC000067',15),('FC000641',15)],'Assumed green cabbage, raw carrot and mayonnaise. Actual dressing unknown.'),
      ('Corn Muffin',[('FC001749',100)],'Generic USDA toaster-type corn muffin proxy, not an exact match for Kenny recipe; no piece weight assumed.'),
    ]
    for name,parts,notes in kenny:estimate('Kenny Rogers Philippines '+name,parts,notes,KENNY,method='BRANDED_MENU_PROXY')
    assert len(manifest)==20 and len(tables['foods.csv'])==1809
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for name,data in baseline.items():
        assert (DB/name).read_bytes()==data
        p=backup/name
        if p.exists():assert p.read_bytes()==data
        else:p.write_bytes(data)
    for name,rows in tables.items():
        assert rows[:len(read_csv(DB/name))]==read_csv(DB/name)
        write_csv(DB/name,rows)
    write_csv(DB/'external-label-facts.csv',label_rows)
    write_csv(DB/'personal-estimate-components.csv',inputs)
    write_csv(DB/'expansion-personal-specials.csv',manifest)
    sources=[dict(source_url=url,local_snapshot='Food_DB/research/'+filename,sha256=hashlib.sha256((RESEARCH/filename).read_bytes()).hexdigest(),reviewed_date=DATE) for url,filename in [(MARLIN,'blue-marlin-label.pdf'),(CHOC,'athlene-isolate-nutrition.png'),(STRAW,'athlene-isolate-label-6.png')]]
    (DB/'personal-online-source-evidence.json').write_text(json.dumps(dict(nutrient_label_sources=sources,menu_identity_sources=[KENNY,CHOOKS,'https://kennyrogersdelivery.com.ph/'],notes='Restaurant menu sources verify identities only; no third-party restaurant calorie tables imported.'),indent=2)+'\n')
    (DB/(BATCH+'.json')).write_text(json.dumps(dict(added=20,source_reference=1,explicit_estimates=19,total=1809),indent=2)+'\n')
    print('Added 1 analytical reference and 19 opt-in estimates; total 1809.')

if __name__=='__main__':main()
