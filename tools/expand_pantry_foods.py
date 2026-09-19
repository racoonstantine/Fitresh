"""Append label-derived and explicitly estimated pantry/cafe records, preserving all prior rows."""
import argparse,hashlib,json
from collections import Counter
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv,load_sources
from expand_food_db import write_csv,normal
from resolve_food import FoodCatalog
from pantry_food_plans import plans,drink_labels,SOURCES,WHEY_IMAGE,EXTRA_IDS,RESTAURANT_INGREDIENTS,REGIONAL_INGREDIENT_IDS,EXTRA_INGREDIENTS

DATE='2026-09-18';BATCH=DATE+'-pantry-cafes'
TARGETS=['foods.csv','aliases.csv','portions.csv','changes.csv','other_food_values.csv','food_estimates.csv','estimate_inputs.csv']
LIMITS='Low confidence; not verified brand nutrition. Exact formulation, yield and serving weight may differ. Use weighed edible grams and explicitly select this estimate. No automatic piece, pack, scoop, cup, can or ml conversion. Unknown nutrients are not zero. No allergen or caffeine assessment.'
def scaled(v,mass):return '' if v=='' else str((Decimal(str(v))*100/Decimal(str(mass))).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP))

def build(apply=False):
    marker=DB/(BATCH+'.json')
    if marker.exists():print('Batch already applied; no changes.');return
    baseline={n:(DB/n).read_bytes() for n in TARGETS};tables={n:read_csv(DB/n) for n in TARGETS}
    prior={n:list(rows) for n,rows in tables.items()};c=FoodCatalog();fnri,_=load_sources()
    assert len(c.foods)==2873,'Review changed baseline'
    names={normal(r['name']) for r in c.foods.values()};next_id=2874;members=[];components=[];labels=[];reviews=[]
    def new_food(name,group,url,status,source_id,note):
        nonlocal next_id
        assert normal(name) not in names,name;names.add(normal(name))
        fid=f'FC{next_id:06d}';next_id+=1;row={k:'' for k in prior['foods.csv'][0]}
        row.update(food_id=fid,name=name,category=group,basis='per 100 g edible portion',source_name='Published manufacturer label' if status=='OTHER_SOURCE_AVAILABLE' else 'Explicit label conversion or ingredient/proxy estimate',source_food_id=source_id,source_food_name=name,source_url=url,data_status=status,notes=note,active='True',verification_date=DATE,verification_notes='Retained FNRI catalog and existing identities checked first. '+('Exact manufacturer flavor and dry preparation only.' if status=='OTHER_SOURCE_AVAILABLE' else 'Nutrition estimate is not manufacturer-verified. Explicit selection required.'))
        return row
    def append(row,aliases=(),eid='',mass=''):
        fid=row['food_id'];tables['foods.csv'].append(row);c.foods[fid]=row
        for alias in dict.fromkeys([row['name'],*aliases]):tables['aliases.csv'].append(dict(food_id=fid,alias=alias,source_url=row['source_url'],data_status='SEARCH_ALIAS_REVIEWED',notes=BATCH+' discovery alias; preparation and brand remain distinct.'))
        tables['portions.csv'].append(dict(portion_id=fid+'_100G',food_id=fid,description='100 g reference basis',quantity='100',unit='g',edible_weight_g='100',edible_portion_pct='',source_url=row['source_url'],data_status='ESTIMATE_REFERENCE_BASIS' if eid else 'VERIFIED_REFERENCE_BASIS',notes='Reference basis, not household serving.'))
        for field,value in row.items():
            if value:tables['changes.csv'].append(dict(date=DATE,food_id=fid,field=field,old_value='',new_value=value,reason=BATCH+' new record; prior rows preserved.',source_url=row['source_url']))
        members.append(dict(food_id=fid,name=row['name'],group=row['category'],kind='estimate' if eid else 'manufacturer_label',estimate_id=eid,modeled_mass_g=str(mass),source_url=row['source_url']))
    # The manufacturer's chocolate panel has an explicit gram serving, unlike the existing isolate panel.
    whey=new_food('Athlene ACTIVE Whey Protein, Chocolate, dry powder','Whey protein',WHEY_IMAGE,'OTHER_SOURCE_AVAILABLE','ATHLENE_ACTIVE_WHEY_CHOCOLATE_32_4G','Official chocolate-flavor image read visually: 32.4 g, 124 kcal, protein 24 g, carbohydrate 3 g, fat 2 g, sugars 1 g, sodium 104 mg, cholesterol 58 mg. Fiber unlisted. Match pack/formulation; not ACTIVE Pure Isolate.')
    label_values=dict(zip(FIELDS,[124,24,3,2,'',1,104,58]))
    other={k:'' for k in prior['other_food_values.csv'][0]};other.update(other_source_id='LABEL_'+whey['food_id'],food_id=whey['food_id'],source_name='Athlene manufacturer nutrition panel',source_food_id=whey['source_food_id'],source_food_name=whey['name'],source_url=WHEY_IMAGE,accessed_date=DATE,source_release='Manufacturer image accessed '+DATE,data_status='REVIEWED_OTHER_SOURCE',match_status='MATCHED_FOOD_AND_PREPARATION',eligible_fields=';'.join(f for f,v in label_values.items() if v!=''),basis=whey['basis'],notes=whey['notes'],**{f:scaled(v,32.4) for f,v in label_values.items()})
    tables['other_food_values.csv'].append(other);c.other.append(other);append(whey,['Athlene whey chocolate','Active whey concentrate chocolate'])
    tables['portions.csv'].append(dict(portion_id=whey['food_id']+'_LABEL_32_4G',food_id=whey['food_id'],description='32.4 g published powder serving',quantity='1',unit='label serving',edible_weight_g='32.4',edible_portion_pct='',source_url=WHEY_IMAGE,data_status='OTHER_SOURCE_PORTION',notes='Published powder mass only; not a measured scoop volume.'))
    labels.append(dict(food_id=whey['food_id'],source_url=WHEY_IMAGE,serving_amount='32.4',serving_unit='g',nutrients_json=json.dumps(label_values),conversion='Published grams; nutrient / 32.4 * 100; fiber absent.',accessed_date=DATE))
    ingredients={k:f'FC{n:06d}' for k,n in {**REGIONAL_INGREDIENT_IDS,**EXTRA_IDS}.items()}
    for k,name in {**RESTAURANT_INGREDIENTS,**EXTRA_INGREDIENTS}.items():
        matches=[fid for fid,r in c.foods.items() if r['name']==name];assert len(matches)==1,(k,name);ingredients[k]=matches[0]
    ingredients['whey_label']=whey['food_id']
    def estimate(row,eid,values,urls,assumptions,method):
        e={k:'' for k in prior['food_estimates.csv'][0]}
        e.update(estimate_id=eid,food_id=row['food_id'],method=method,basis=row['basis'],**values,source_urls=';'.join(dict.fromkeys(urls)),estimated_date=DATE,model='Codex (GPT-6)',method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=assumptions,range_basis='No evidence-based error bounds available.',limitations=LIMITS)
        tables['food_estimates.csv'].append(e)
    for i,p in enumerate(plans(),1):
        eid=f'EST_PANTRY_20260918_{i:03d}_V1';parts=[];url=p['url'] or c.foods[p['source_food_id']]['source_url'];urls=[url]
        for key,grams in p['mixture'].items():
            fid=ingredients[key];s=c.resolve(fid);assert s['label'] not in ['Unavailable','Estimated'],(key,fid)
            part=dict(estimate_id=eid,ingredient_food_id=fid,ingredient_name=c.foods[fid]['name'],edible_grams=str(grams),**{f:'' if n['value_per_100g'] is None else str(n['value_per_100g']) for f,n in s['nutrients'].items()},nutrient_provenance_json=json.dumps(s['nutrients'],sort_keys=True))
            parts.append(part);components.append(part);urls.extend(n['source_url'] for n in s['nutrients'].values() if n['source_url'])
            tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='ingredient_edible_grams:'+fid,input_value=str(grams),unit='g in source preparation',source_food_id=fid,source_url=c.foods[fid]['source_url'],input_status='ASSUMED_RECIPE_WEIGHT',notes=p['notes']))
        mass=sum(Decimal(p['edible_grams']) for p in parts)
        values={f:'' if f in p.get('unknown_fields',[]) or any(part[f]=='' for part in parts) else str((sum(Decimal(part[f])*Decimal(part['edible_grams']) for part in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)) for f in FIELDS}
        assumptions=p['notes']+' All component masses are explicit model assumptions. Final mass equals their sum; no additional evaporation, absorption or nutrient losses modeled. Unknown-field exclusions: '+','.join(p.get('unknown_fields',[]))+'.'
        row=new_food(p['name'],p['group'],url,'ESTIMATE_ONLY',eid,assumptions+' '+LIMITS);row['aliases']=';'.join(p['aliases'])
        estimate(row,eid,values,urls,assumptions,'INGREDIENT_OR_CATEGORY_PROXY');append(row,p['aliases'],eid,mass)
        tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='modeled_final_edible_mass',input_value=str(mass),unit='g',source_food_id=eid,source_url=url,input_status='ASSUMED_MASS_BALANCE',notes='Calculation mixture, not a measured serving.'))
        reviews.append(dict(food_id=row['food_id'],name=row['name'],decision='Distinct brand/preparation/topping model. Generic FNRI components preferred; no exact branded nutrient match in retained FNRI. Existing foods preserved.',source_url=url))
    for i,(name,ml,kcal,carbs,sodium,brand) in enumerate(drink_labels(),1):
        eid=f'EST_DRINK_LABEL_20260918_{i:03d}_V1';url=SOURCES[brand]
        vals=dict(zip(FIELDS,[kcal,0,carbs,0,0,carbs,sodium,0]))
        note='PH manufacturer publishes per '+str(ml)+' mL serving. For this per-100-g estimate ONLY, density is ASSUMED 1.00 g/mL (not measured). Values divided by serving mL then multiplied by 100. This does not authorize ml-to-g portion conversion. Label rounding retained; zero is declared label zero, not analytical absence.'
        row=new_food(name+' Philippines, label-derived density approximation (estimate)','Cola and soft drinks',url,'ESTIMATE_ONLY',eid,note+' '+LIMITS)
        estimate(row,eid,{f:scaled(v,ml) for f,v in vals.items()},[url],note,'PUBLISHED_LABEL_ASSUMED_DENSITY');append(row,[name],eid,ml)
        labels.append(dict(food_id=row['food_id'],source_url=url,serving_amount=str(ml),serving_unit='mL',nutrients_json=json.dumps(vals),conversion=note,accessed_date=DATE))
        for key,value,unit,status in [('published_serving_volume',ml,'mL','PUBLISHED_LABEL'),('assumed_density',1,'g/mL','ASSUMED_DENSITY')]:
            tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name=key,input_value=str(value),unit=unit,source_food_id=row['food_id'],source_url=url,input_status=status,notes=note))
    for name in TARGETS:assert tables[name][:len(prior[name])]==prior[name]
    summary=dict(batch=BATCH,added=len(members),total_foods=len(tables['foods.csv']),manufacturer_labels=1,explicit_estimates=len(members)-1,by_group=dict(Counter(m['group'] for m in members)),baseline_sha256={n:hashlib.sha256(b).hexdigest() for n,b in baseline.items()},deployed=False)
    if not apply:print(json.dumps(summary,indent=2));return
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for n,b in baseline.items():
        assert (DB/n).read_bytes()==b,'Concurrent change: '+n
        dest=backup/n
        if dest.exists():assert dest.read_bytes()==b
        else:dest.write_bytes(b)
    for n,rows in tables.items():
        tmp=DB/(n+'.pantry.tmp');write_csv(tmp,rows);tmp.replace(DB/n)
    for name,rows in [('pantry-expansion.csv',members),('pantry-estimate-components.csv',components),('pantry-published-labels.csv',labels),('pantry-identity-review.csv',reviews)]:write_csv(DB/name,rows)
    write_csv(DB/'pantry-online-source-audit.csv',[dict(group=g,url=u,accessed_date=DATE,role='Published per-mL nutrition label; density assumed for gram estimates' if g in ['Coca-Cola','Sprite','Royal'] else 'Identity/category only; model quantities not published recipe',access='Search/open reviewed; Goldilocks search listing used after direct fetch denied.') for g,u in SOURCES.items()])
    marker.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');build(p.parse_args().apply)
