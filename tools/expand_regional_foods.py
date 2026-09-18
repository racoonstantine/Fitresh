"""Append 500 foods with frozen sources, recipe assumptions and preservation checks."""
import argparse,hashlib,json
from collections import Counter
from decimal import Decimal,ROUND_HALF_UP
from food_db_sources import DB,RESEARCH,FIELDS,read_csv
from expand_food_db import write_csv,normal,numeric
from regional_food_sources import plan
from regional_food_plans import plans,SOURCES,RESTAURANT_INGREDIENTS,REGIONAL_INGREDIENT_IDS,EXTRA_INGREDIENTS
from resolve_food import FoodCatalog

DATE='2026-09-18'
BATCH=DATE+'-regional-foods-500'
TARGETS=['foods.csv','aliases.csv','portions.csv','changes.csv','verification-evidence.csv','other_food_values.csv','food_estimates.csv','estimate_inputs.csv']
ASSUMPTIONS=('Model-designed component quantities, not a published standardized recipe. Weights refer to the exact linked food preparation; cooked ingredients are combined with retained sauce/water. '
 'Final mass is the sum of components. No additional evaporation, absorption, draining or nutrient loss is modeled. Added oil/salt/sugar are fully retained. '
 'Raw aromatics, flour and vegetables are cooking proxies. Missing component nutrients remain unknown. ')
LIMITATIONS=('Low confidence. Recipe, yield and edible serving mass are unverified. Identity pages are not nutrition panels. '
 'No manufacturer nutrition or authentic regional formulation is claimed. No inferred bowl, piece, packet, cup or order weight. '
 'Log only weighed edible grams and explicitly select the estimate. Bones, wrappers used for serving, and uneaten broth are excluded. '
 'Sides, rice, sauces and drinks are excluded unless named in the mixture. Restaurant availability varies by location and date. ')

def build(apply=False):
    marker=DB/(BATCH+'.json')
    if marker.exists():print('Batch already applied; no changes.');return
    baseline={n:(DB/n).read_bytes() for n in TARGETS}
    tables={n:read_csv(DB/n) for n in TARGETS};prior={n:list(rows) for n,rows in tables.items()}
    assert len(tables['foods.csv'])==2319,'Review changed baseline before applying'
    references,excluded,fnri,usda=plan();catalog=FoodCatalog()
    next_id=max(int(r['food_id'][2:]) for r in tables['foods.csv'])+1
    names={normal(r['name']) for r in tables['foods.csv']};members=[];components=[];review=[];household=0
    def food_id():
        nonlocal next_id
        fid=f'FC{next_id:06d}';next_id+=1;return fid
    def append_food(row,terms,portion_status):
        assert normal(row['name']) not in names,row['name'];names.add(normal(row['name']))
        tables['foods.csv'].append(row)
        for term in dict.fromkeys([row['name']]+terms):
            if term:tables['aliases.csv'].append(dict(food_id=row['food_id'],alias=term,source_url=row['source_url'],data_status='SEARCH_ALIAS_REVIEWED',notes='Qualified discovery only; keep recipe, species and preparation separate. '+BATCH))
        tables['portions.csv'].append(dict(portion_id=row['food_id']+'_100G_'+('EST' if portion_status.startswith('ESTIMATE') else 'EP'),food_id=row['food_id'],description='100 g '+('modeled edible mixture' if portion_status.startswith('ESTIMATE') else 'edible portion'),quantity='100',unit='g',edible_weight_g='100',edible_portion_pct=row['edible_portion_pct'],source_url=row['source_url'],data_status=portion_status,notes='Reference basis only, not a measured household serving.'))
        for field,value in row.items():
            if value:tables['changes.csv'].append(dict(date=DATE,food_id=row['food_id'],field=field,old_value='',new_value=value,reason=BATCH+' new identity; existing rows preserved.',source_url=row['source_url']))
    for entry in references:
        code=entry['source_food_id'];fid=food_id();is_fnri=entry['source']=='FNRI'
        row={k:'' for k in prior['foods.csv'][0]}
        row.update(food_id=fid,name=entry['name'],category=entry['category'],basis='per 100 g edible portion',source_food_id=code,source_food_name=entry['name'],source_url=entry['source_url'],active='True',verification_date=DATE,
            notes='Exact species, edible part and preparation apply. Composition reference, not preparation instructions. Unknown nutrients remain blank.',verification_notes='Reviewed retained primary snapshot accessed 2026-09-16; '+BATCH+'.')
        if is_fnri:
            s=fnri[code];row['source_name']='DOST-FNRI PhilFCT';row['edible_portion_pct']=s['meta'][3].rstrip('%')
            row['aliases']='' if s['meta'][2] in ['','-','N/A'] else s['meta'][2]
            for field,(label,_,_) in FIELDS.items():
                v=s['nutrients'].get(label,'')
                if numeric(v):row[field]=v
                tables['verification-evidence.csv'].append(dict(food_id=fid,source_food_id=code,field=field,source_value=v,source_url=row['source_url'],accessed_date='2026-09-16'))
            row['data_status']='VERIFIED_FNRI' if all(row[f] for f in FIELDS) else 'PARTIAL_VERIFIED_FNRI'
        else:
            s=usda[code];row['source_name']='USDA FoodData Central SR Legacy';row['data_status']='OTHER_SOURCE_AVAILABLE'
            row['verification_notes']+=' Distinct exact historical reference; no Philippine dish or restaurant equivalence. Values in other_food_values.csv.'
            other={k:'' for k in prior['other_food_values.csv'][0]}
            other.update(other_source_id='USDA_'+fid+'_'+code,food_id=fid,source_name=row['source_name'],source_food_id=code,source_food_name=row['name'],source_url=row['source_url'],accessed_date='2026-09-16',source_release='SR Legacy April 2018; FDC publication '+s['publication_date'],data_status='REVIEWED_OTHER_SOURCE',match_status='MATCHED_FOOD_AND_PREPARATION',eligible_fields=';'.join(FIELDS),basis=row['basis'],notes='Source-qualified reference; never a substitute for an exact FNRI or brand recipe.')
            for f,(_,nid,_) in FIELDS.items():other[f]=s['nutrients'].get(nid,{}).get('amount','')
            tables['other_food_values.csv'].append(other)
            for p in s['portions']:
                description=p['modifier'] or p['portion_description']
                if not description or not numeric(p['amount']) or not numeric(p['gram_weight']) or float(p['amount'])<=0 or float(p['gram_weight'])<=0:continue
                tables['portions.csv'].append(dict(portion_id=fid+'_USDA_'+p['id'],food_id=fid,description=p['amount']+' '+description,quantity=p['amount'],unit=description,edible_weight_g=p['gram_weight'],edible_portion_pct='',source_url=row['source_url'],data_status='OTHER_SOURCE_PORTION',notes='Source portion '+p['id']+'; weight covers entire stated quantity. Only for '+row['name']+'.'))
                household+=1
        append_food(row,[row['aliases']], 'VERIFIED_REFERENCE_BASIS')
        members.append(dict(food_id=fid,kind='reference',group=entry['source'],name=row['name'],source_food_id=code,source_url=row['source_url'],estimate_id='',modeled_mass_g=''))
    # Bind ingredients by exact existing identity, then freeze nutrient provenance.
    ingredient_ids={k:f'FC{n:06d}' for k,n in REGIONAL_INGREDIENT_IDS.items()}
    for key,name in {**RESTAURANT_INGREDIENTS,**EXTRA_INGREDIENTS}.items():
        hits=[r['food_id'] for r in catalog.foods.values() if r['name']==name]
        assert len(hits)==1,(key,name,hits);ingredient_ids[key]=hits[0]
    for index,p in enumerate(plans(),1):
        fid=food_id();eid=f'EST_REGIONAL_20260918_{index:03d}_V1';parts=[];urls=[p['url']]
        for key,grams in p['mixture'].items():
            source_id=ingredient_ids[key];source=catalog.resolve(source_id)
            assert source['label'] not in ['Unavailable','Estimated'],(key,source_id)
            assert all(source['nutrients'][f]['value_per_100g'] is not None for f in list(FIELDS)[:4])
            assert grams>0
            part=dict(estimate_id=eid,ingredient_food_id=source_id,ingredient_name=catalog.foods[source_id]['name'],edible_grams=str(grams),weight_status='ASSUMED_REFERENCE_MIXTURE',**{f:'' if n['value_per_100g'] is None else str(n['value_per_100g']) for f,n in source['nutrients'].items()},nutrient_provenance_json=json.dumps(source['nutrients'],sort_keys=True))
            parts.append(part);components.append(part)
            urls.extend(n['source_url'] for n in source['nutrients'].values() if n['source_url'])
            tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='ingredient_edible_grams:'+source_id,input_value=str(grams),unit='g in linked source preparation',source_food_id=source_id,source_url=catalog.foods[source_id]['source_url'],input_status='ASSUMED_RECIPE_WEIGHT',notes=p['notes'] or 'Model-assumed proportions, not published recipe weights.'))
        mass=sum(Decimal(r['edible_grams']) for r in parts)
        nutrients={f:'' if any(r[f]=='' for r in parts) else str((sum(Decimal(r[f])*Decimal(r['edible_grams']) for r in parts)/mass).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)) for f in FIELDS}
        assert Decimal(nutrients['kcal_100g'])>0
        row={k:'' for k in prior['foods.csv'][0]};restaurant=p['kind']=='restaurant'
        name=(p['group']+' Philippines '+p['item'] if restaurant else p['item']+' ('+p['group']+')')+' (estimate)'
        row.update(food_id=fid,name=name,aliases=';'.join(p['aliases']),category='Philippine Restaurant Estimates' if restaurant else 'Philippine Regional Dish Estimates',basis='per 100 g modeled edible mixture',source_name='Explicit ingredient/proxy estimate; identity source reviewed',source_food_id=eid,source_food_name=p['item'],source_url=p['url'],data_status='ESTIMATE_ONLY',notes=p['notes']+' '+LIMITATIONS,active='True',verification_date=DATE,verification_notes='Identity source only; nutrition is NOT verified. Full retained FNRI catalog checked before modeling. Explicit estimate selection required.')
        terms=[p['group']+' '+p['item']] if restaurant else [p['item']]+p['aliases']
        if restaurant:
            spelling={"Gerry's Grill":['Gerrys Grill',"Gerry's"],"Max's Restaurant":['Maxs',"Max's"],"Giligan's":['Giligans']}[p['group']]
            terms.extend(brand+' '+p['item'] for brand in spelling)
        append_food(row,terms,'ESTIMATE_REFERENCE_BASIS')
        est={k:'' for k in prior['food_estimates.csv'][0]}
        est.update(estimate_id=eid,food_id=fid,method='BRANDED_MENU_PROXY' if restaurant else 'INGREDIENT_MIXTURE_CALCULATION',basis=row['basis'],**nutrients,source_urls=';'.join(dict.fromkeys(urls)),estimated_date=DATE,model='Codex (GPT-6)',method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=ASSUMPTIONS+p['notes']+' Modeled final mass '+str(mass)+' g.',range_basis='Not quantified; no evidence-based error bounds available.',limitations=LIMITATIONS)
        tables['food_estimates.csv'].append(est)
        tables['estimate_inputs.csv'].append(dict(estimate_id=eid,input_name='modeled_final_edible_mass',input_value=str(mass),unit='g',source_food_id=eid,source_url=p['url'],input_status='ASSUMED_MASS_BALANCE',notes='Calculation mass only; never a measured order or household portion.'))
        members.append(dict(food_id=fid,kind=p['kind'],group=p['group'],name=name,source_food_id=eid,source_url=p['url'],estimate_id=eid,modeled_mass_g=str(mass)))
        base=p['item'].split(',')[0]
        related=[r['food_id'] for r in catalog.foods.values() if normal(base) in normal(r['name']+' '+r['aliases'])]
        fnri_matches=[k for k,r in fnri.items() if normal(base) in normal(r['name']+' '+str(r['meta']))]
        review.append(dict(food_id=fid,name=name,fnri_related_ids=';'.join(fnri_matches),existing_related_food_ids=';'.join(related),decision='Distinct brand or specified regional recipe model; existing source-qualified foods remain unchanged.',nutrition_status='NOT_VERIFIED_EXPLICIT_ESTIMATE',identity_source_url=p['url']))
    assert len(members)==500 and len(tables['foods.csv'])==2819
    assert len({r['food_id'] for r in tables['foods.csv']})==2819
    for n,rows in tables.items():assert rows[:len(prior[n])]==prior[n],n
    summary=dict(batch=BATCH,added=500,total_foods=2819,prior_food_rows_preserved=2319,fnri=250,usda=150,regional_estimates=30,restaurant_estimates=70,by_group=dict(Counter(r['group'] for r in members)),household_portions_added=household,ingredient_rows=len(components),baseline_sha256={n:hashlib.sha256(raw).hexdigest() for n,raw in baseline.items()},deployed=False)
    if not apply:print(json.dumps(summary,indent=2));return
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    # Check every original before writing any table. Baselines are immutable.
    for n,raw in baseline.items():
        assert (DB/n).read_bytes()==raw,'Concurrent edit: '+n
        path=backup/n
        if path.exists():assert path.read_bytes()==raw
        else:path.write_bytes(raw)
    for n,rows in tables.items():
        temp=DB/(n+'.regional.tmp');write_csv(temp,rows);temp.replace(DB/n)
    write_csv(DB/'regional-expansion-500.csv',members)
    write_csv(DB/'regional-estimate-components.csv',components)
    write_csv(DB/'regional-identity-review.csv',review)
    write_csv(DB/'regional-source-exclusions.csv',excluded)
    audit=[dict(group=g,url=url,reviewed_date=DATE,role='IDENTITY_ONLY_NOT_NUTRITION',access_note='Official delivery search-index listing reviewed; direct open failed.' if g=="Max's Restaurant" else 'Primary identity page reviewed via browser search/open. Historic descriptions may not establish current menu availability.',nutrition_policy='Ingredient masses assumed; no measured branded/regional nutrition or household weight.') for g,url in SOURCES.items()]
    write_csv(DB/'regional-online-source-audit.csv',audit)
    marker.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');build(parser.parse_args().apply)
