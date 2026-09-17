"""Targeted common foods and drinks; immutable prior food records and exact primary sources."""
import argparse
import hashlib
import json
import re
from collections import Counter
from food_db_sources import DB,RESEARCH,FIELDS,load_sources,read_csv,fnri_url,usda_url
from expand_food_db import normal,numeric,source_check,write_csv,CATEGORIES

BATCH='2026-09-17-common-foods-drinks'
TARGET_USDA="""171889 171890 171891 174130 174125 174119 171880 173647 174158 174832 168751 174116 174831 171269 171267 170872 170894 170903 171304 171284 171869 174842 174846 175099 174850 174851 174853 174120 174156 174871""".split()

def plan():
    fnri,usda=load_sources();before=read_csv(DB/'foods.csv')
    assert len(before)==1147
    for source in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((RESEARCH.parent.parent/source['local_snapshot']).read_bytes()).hexdigest()==source['sha256']
    used={r['source_food_id'] for r in before}; used.update(r['source_food_id'] for r in read_csv(DB/'other_food_values.csv'))
    names={normal(n) for r in before for n in [r['name'],r['source_food_name']] if n}
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8')
    selected=[];excluded=[]
    candidates="""Q001 Q005 Q006 Q007 Q017 Q018 Q022 Q023 Q025 Q026 Q027 Q028 Q029 Q030 Q031 Q032 Q033 Q034 Q035 Q036 Q037 Q038 Q039 Q040 Q041 Q042 Q047 Q052 Q055 Q056 Q057 Q058 Q060 Q061
A026 A027 A056 A058 A063 A066 A067 A068 A073 A074 A075 A077 A079 A099 A100 A102 A105 A107 A119 A143 A155 A158 A199
M002 M004 M005 M006 M009 M012 M033 M038 M039 M041 N030 N031 R026 R030 R036 R037 R039 R041 R065 R067 R069 R070 R076 R079 R081 R108""".split()
    for code in candidates:
        r=fnri[code]
        if code in used or normal(r['name']) in names: continue
        reason=''
        if any(not numeric(r['nutrients'].get(FIELDS[k][0],'')) for k in list(FIELDS)[:4]):reason='Core macro missing'
        elif numeric(r['nutrients'].get('Sugars, total (g)','')) and float(r['nutrients']['Sugars, total (g)'])>float(r['nutrients']['Carbohydrate, total (g)'])+.1:reason='Sugar exceeds carbohydrate'
        if reason:excluded.append(dict(source='FNRI',source_food_id=code,name=r['name'],reason=reason));continue
        source_check(code,r,raw)
        selected.append(dict(source='FNRI',source_food_id=code,name=r['name'],category=CATEGORIES.get(code[0],{'M':'Sweets & Sweeteners'}.get(code[0])),source_url=fnri_url(r)))
        names.add(normal(r['name']))
    for code in TARGET_USDA:
        r=usda[code];assert code not in used and normal(r['description']) not in names
        assert all(numeric(r['nutrients'].get(FIELDS[k][1],{}).get('amount','')) for k in list(FIELDS)[:4])
        # FNRI has no exact brewed/decaf, fat/fortification-specific dairy or these distinct beverage preparations.
        selected.append(dict(source='USDA',source_food_id=code,name=r['description'],category='Milk & Dairy' if r['description'].startswith(('Milk,','Yogurt,')) else 'Beverages',source_url=usda_url(code)))
        names.add(normal(r['description']))
    assert 100<=len(selected)<=150
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
            foods=tables['foods.csv'];assert foods[:1147]==original
            assert len({r['food_id'] for r in foods})==len(foods)
            checks.append(dict(batch_id=group,added=100,source=entry['source'],preservation='PASS',distinct_ids='PASS'))
    assert len(tables['foods.csv'])==1147+len(selected)
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for n,content in baseline.items():
        p=backup/n
        if p.exists():assert p.read_bytes()==content
        else:p.write_bytes(content)
    tables['expansion-common-foods.csv']=members;tables['expansion-common-foods-exclusions.csv']=excluded
    for n,rows in tables.items():
        if n in baseline:assert (DB/n).read_bytes()==baseline[n]
        else:assert not (DB/n).exists()
    for n,rows in tables.items():
        temp=DB/(n+'.tmp');write_csv(temp,rows);temp.replace(DB/n)
    summary=dict(expansion_id=BATCH,added=len(selected),fnri=sum(e['source']=='FNRI' for e in selected),usda=len(TARGET_USDA),total=len(tables['foods.csv']),original_records_preserved=1147,
        household_portions_added=household,estimates_added=0,
        added_fnri_statuses=dict(Counter(r['data_status'] for r in tables['foods.csv'][1147:] if 'FNRI' in r['source_name'])))
    (DB/(BATCH+'.json')).write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if (DB/(BATCH+'.json')).exists():print('Batch already applied. No changes.')
    else:
        selected,excluded,fnri,usda=plan()
        if args.apply:apply(selected,excluded,fnri,usda)
        else:
            print(json.dumps(dict(selected=len(selected),fnri=sum(e['source']=='FNRI' for e in selected),excluded=excluded),indent=2))
