"""Targeted common foods and drinks; immutable prior food records and exact primary sources."""
import argparse
import hashlib
import json
import re
from collections import Counter
from food_db_sources import DB,RESEARCH,FIELDS,load_sources,read_csv,fnri_url,usda_url
from expand_food_db import normal,numeric,source_check,write_csv,CATEGORIES

BATCH='2026-09-17-personal-500'
TARGET_USDA=[]
FNRI_PICKS="""A009 A024 A025 A049 A062 A064 A069 A070 A071 A072 A076 A078 A080 A081 A082 A085 A088 A089 A096 A101 A117 A121 A122 A125 A126 A131 A132 A133 A159 A160 A161 A162 A163 A164 A165 A166 C059 C060 F243 D297""".split()
QUOTAS={'Meat & Poultry':80,'Fish & Seafood':35,'Milk & Dairy':39,'Eggs':1,'Rice, Grains & Bakery':65,'Legumes, Nuts & Seeds':35,'Vegetables':50,'Fruits':30,'Bread & Bakery':65,'Condiments':40}
PIN='172187 170392 170886 170887 170888 170901 170902 170905 170906 170907 169550 171448 171449 171170 169704'.split()

def group(name):
    lead=name.split(',')[0]
    if lead in ['Beef','Pork','Chicken','Turkey']:return 'Meat & Poultry'
    if lead in ['Fish','Crustaceans','Mollusks']:return 'Fish & Seafood'
    if lead=='Egg':return 'Eggs'
    if lead in ['Yogurt','Milk','Cheese','Cream','Creams','Kefir']:return 'Milk & Dairy'
    if lead in ['Rice','Pasta','Macaroni','Spaghetti','Cereals','Wheat flour','Oat flour','Buckwheat','Barley','Bulgur','Couscous','Millet','Quinoa','Rye flour','Corn flour','Cornmeal']:return 'Rice, Grains & Bakery'
    if lead in ['Beans','Peas','Lentils','Nuts','Seeds','Peanuts','Chickpeas (garbanzo beans','Soybeans','Tofu','Hummus']:return 'Legumes, Nuts & Seeds'
    if lead in ['Potatoes','Sweet potato','Tomatoes','Cabbage','Mushrooms','Carrots','Corn','Squash','Pumpkin','Onions','Peppers','Cucumber','Pickles','Radishes','Lettuce','Celery','Beets','Cauliflower','Okra','Turnips','Asparagus','Artichokes']:return 'Vegetables'
    if lead in ['Apples','Apricots','Peaches','Pears','Pineapple','Mango nectar','Orange juice','Grape juice','Prunes','Dates','Raisins','Figs','Olives','Grapefruit','Cherries','Plums','Strawberries','Blueberries','Blackberries','Raspberries','Cranberries','Nectarines']:return 'Fruits'
    if lead in ['Bread','Rolls','Muffins','Bagels','Tortillas','Crackers','Cookies','Pancakes','Waffles','English muffins','Biscuits']:return 'Bread & Bakery'
    if lead in ['Sauce','Gravy','Salad dressing','Spices','Vinegar','Syrups','Mustard','Catsup','Tomato products','Mayonnaise']:return 'Condiments'

def plan():
    fnri,usda=load_sources();before=read_csv(DB/'foods.csv');assert len(before)==1309
    for source in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((RESEARCH.parent.parent/source['local_snapshot']).read_bytes()).hexdigest()==source['sha256']
    used={r['source_food_id'] for r in before};used.update(r['source_food_id'] for r in read_csv(DB/'other_food_values.csv'))
    names={normal(n) for r in before for n in [r['name'],r['source_food_name']] if n}
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8');selected=[];excluded=[]
    for code in FNRI_PICKS:
        r=fnri[code];assert code not in used and normal(r['name']) not in names
        assert all(numeric(r['nutrients'].get(FIELDS[k][0],'')) for k in list(FIELDS)[:4])
        source_check(code,r,raw)
        selected.append(dict(source='FNRI',source_food_id=code,name=r['name'],category=CATEGORIES[code[0]],source_url=fnri_url(r)));names.add(normal(r['name']))
    for category,quota in QUOTAS.items():
        candidates=[]
        for code,r in usda.items():
            name=r['description']
            if code in used or normal(name) in names or group(name)!=category:continue
            reason=''
            if code not in PIN and (re.search(r'\b[A-Z]{3,}\b',name) or re.search(r'infant|babyfood|brain|spleen|blood|giblets|liver|kidney|neck|feet|tongue|gizzard|tripe|pate|game hen|suckling',name,re.I)):reason='Outside generic everyday-food focus; branded legacy formulations not current Philippine labels.'
            if category=='Meat & Poultry' and code not in PIN and re.search(r'choice|select|prime|grass-fed|imported|New Zealand|Australian',name,re.I):reason='Avoid multiplying grade/origin variants; prefer all-grades generic cuts.'
            if category in ['Vegetables','Fruits'] and code not in PIN and not re.search(r'canned|frozen|dried|juice|pickl|kimchi|mashed|baked|fried|roasted|dehydrated|sauce',name,re.I):reason='Prefer preparation gaps over duplicating existing fresh/boiled produce.'
            n={field:r['nutrients'].get(nid,{}).get('amount','') for field,(_,nid,_) in FIELDS.items()}
            if any(not numeric(n[k]) for k in list(FIELDS)[:4]):reason='Missing core macro'
            if numeric(n['sugar_g_100g']) and numeric(n['carbs_g_100g']) and float(n['sugar_g_100g'])>float(n['carbs_g_100g'])+.1:reason='Source sugar exceeds carbohydrate; exclude rather than cap.'
            if reason:excluded.append(dict(source='USDA',source_food_id=code,name=name,reason=reason));continue
            candidates.append(code)
        candidates.sort(key=lambda code:(code not in PIN,'cooked' not in usda[code]['description'],len(usda[code]['description']),usda[code]['description']))
        assert len(candidates)>=quota,(category,len(candidates),quota)
        for code in candidates[:quota]:
            r=usda[code];selected.append(dict(source='USDA',source_food_id=code,name=r['description'],category=category,source_url=usda_url(code)));names.add(normal(r['description']))
    assert len(selected)==480
    assert all(code in used or any(e['source_food_id']==code for e in selected) for code in PIN)
    return selected,excluded,fnri,usda

def apply(selected,excluded,fnri,usda):
    targets=['foods.csv','aliases.csv','portions.csv','changes.csv','verification-evidence.csv','other_food_values.csv']
    baseline={n:(DB/n).read_bytes() for n in targets};tables={n:read_csv(DB/n) for n in targets}
    original=[dict(r) for r in tables['foods.csv']];next_id=max(int(r['food_id'][2:]) for r in original)+1
    members=[];checks=[];household=0
    for i,entry in enumerate(selected):
        code=entry['source_food_id'];group='batch-'+str(i//100+1);is_fnri=entry['source']=='FNRI'
        row={k:'' for k in original[0]}
        row.update(food_id=f'FC{next_id:06d}',name=entry['name'],category=entry['category'],basis='per 100 g edible portion',
            source_food_id=code,source_food_name=entry['name'],source_url=entry['source_url'],active='True',verification_date='2026-09-17',
            notes='Exact source preparation and edible part apply. Unknown nutrients remain blank.',
            verification_notes='Reviewed retained primary-source snapshot; '+BATCH+'/'+group+'.')
        next_id+=1
        if is_fnri:
            s=fnri[code];row['source_name']='DOST-FNRI PhilFCT';row['edible_portion_pct']=s['meta'][3].rstrip('%')
            row['aliases']='' if s['meta'][2] in ['','-','N/A'] else s['meta'][2]
            for field,(label,_,_) in FIELDS.items():
                value=s['nutrients'].get(label,'')
                if numeric(value):row[field]=value
                tables['verification-evidence.csv'].append(dict(food_id=row['food_id'],source_food_id=code,field=field,source_value=value,source_url=row['source_url'],accessed_date='2026-09-16'))
            row['data_status']='VERIFIED_FNRI' if all(row[f] for f in FIELDS) else 'PARTIAL_VERIFIED_FNRI'
        else:
            s=usda[code];row['source_name']='USDA FoodData Central SR Legacy';row['data_status']='OTHER_SOURCE_AVAILABLE'
            row['verification_notes']+=' Nutrients remain in other_food_values.csv. Imported to fill ingredient/preparation gaps, not to replace a FNRI record.'
            other={k:'' for k in tables['other_food_values.csv'][0]}
            other.update(other_source_id='USDA_'+row['food_id']+'_'+code,food_id=row['food_id'],source_name=row['source_name'],source_food_id=code,
                source_food_name=row['name'],source_url=row['source_url'],accessed_date='2026-09-16',source_release='SR Legacy April 2018; FDC publication '+s['publication_date'],
                data_status='REVIEWED_OTHER_SOURCE',match_status='MATCHED_FOOD_AND_PREPARATION',eligible_fields=';'.join(FIELDS),basis=row['basis'],
                notes='Distinct reference identity; retain species, preparation, salt, and drained qualifiers. Not a measurement of an individual meal.')
            for field,(_,nutrient_id,_) in FIELDS.items():other[field]=s['nutrients'].get(nutrient_id,{}).get('amount','')
            if other['sugar_g_100g'] and other['carbs_g_100g'] and float(other['sugar_g_100g'])>float(other['carbs_g_100g'])+.1:
                row['data_status']='SOURCE_CONFLICT_REVIEW_REQUIRED'
                row['verification_notes']+=' Source sugar exceeds total carbohydrate; block logging pending review. Preserve source values.'
            tables['other_food_values.csv'].append(other)
            for p in s['portions']:
                description=p['modifier'] or p['portion_description']
                if not description or not numeric(p['amount']) or not numeric(p['gram_weight']) or float(p['gram_weight'])<=0:continue
                tables['portions.csv'].append(dict(portion_id=row['food_id']+'_USDA_'+p['id'],food_id=row['food_id'],description=p['amount']+' '+description,
                    quantity=p['amount'],unit=description,edible_weight_g=p['gram_weight'],edible_portion_pct='',source_url=row['source_url'],data_status='OTHER_SOURCE_PORTION',
                    notes='USDA portion '+p['id']+'. Weight covers the entire stated quantity. Only for '+row['name']+'.'))
                household+=1
        tables['foods.csv'].append(row)
        for alias in dict.fromkeys([row['name']]+([row['aliases']] if row['aliases'] else [])):
            tables['aliases.csv'].append(dict(food_id=row['food_id'],alias=alias,source_url=row['source_url'],data_status='SEARCH_ALIAS_REVIEWED',notes='Official identity/common name. Preserve all qualifiers.'))
        tables['portions.csv'].append(dict(portion_id=row['food_id']+'_100G_EP',food_id=row['food_id'],description='100 g edible portion',quantity='100',unit='g',edible_weight_g='100',
            edible_portion_pct=row['edible_portion_pct'],source_url=row['source_url'],data_status='VERIFIED_REFERENCE_BASIS',notes='Reference weight, not a household serving.'))
        for field,value in row.items():
            if value:tables['changes.csv'].append(dict(date='2026-09-17',food_id=row['food_id'],field=field,old_value='',new_value=value,reason='Add new source-backed identity; '+BATCH+'/'+group,source_url=row['source_url']))
        members.append(dict(food_id=row['food_id'],batch_id=group,**entry))
        if (i+1)%100==0:
            foods=tables['foods.csv'];assert foods[:1309]==original
            assert len({r['food_id'] for r in foods})==len(foods)
            checks.append(dict(batch_id=group,added=100,source=entry['source'],preservation='PASS',distinct_ids='PASS'))
    assert len(tables['foods.csv'])==1309+len(selected)
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for n,content in baseline.items():
        p=backup/n
        if p.exists():assert p.read_bytes()==content
        else:p.write_bytes(content)
    tables['expansion-personal-sources.csv']=members;tables['expansion-personal-exclusions.csv']=excluded
    for n,rows in tables.items():
        if n in baseline:assert (DB/n).read_bytes()==baseline[n]
        else:assert not (DB/n).exists()
    for n,rows in tables.items():
        temp=DB/(n+'.tmp');write_csv(temp,rows);temp.replace(DB/n)
    summary=dict(expansion_id=BATCH,added=len(selected),fnri=sum(e['source']=='FNRI' for e in selected),usda=sum(e['source']=='USDA' for e in selected),total=len(tables['foods.csv']),original_records_preserved=1309,
        household_portions_added=household,estimates_added=0,
        added_fnri_statuses=dict(Counter(r['data_status'] for r in tables['foods.csv'][1309:] if 'FNRI' in r['source_name'])))
    (DB/(BATCH+'.json')).write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if (DB/(BATCH+'.json')).exists():print('Batch already applied. No changes.')
    else:
        selected,excluded,fnri,usda=plan()
        if args.apply:apply(selected,excluded,fnri,usda)
        else:
            print(json.dumps(dict(selected=len(selected),fnri=sum(e['source']=='FNRI' for e in selected),excluded=excluded),indent=2))
