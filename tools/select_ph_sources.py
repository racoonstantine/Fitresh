"""Select 400 exact references, giving remaining Philippine sources first priority."""
import hashlib,re
from plan_ph_expansion import candidates,FNRI_PICKS
from food_db_sources import *
from expand_food_db import normal,numeric,source_check,CATEGORIES

def plan():
    fnri,usda,available=candidates();before=read_csv(DB/'foods.csv');assert len(before)==1809
    for s in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((DB.parents[1]/s['local_snapshot']).read_bytes()).hexdigest()==s['sha256']
    used={r['source_food_id'] for r in before+read_csv(DB/'other_food_values.csv')};names={normal(r['name']) for r in before}
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8');selected=[];excluded=[]
    for code in FNRI_PICKS:
        r=fnri[code];assert code not in used and normal(r['name']) not in names
        assert all(numeric(r['nutrients'].get(FIELDS[k][0],'')) for k in list(FIELDS)[:4])
        source_check(code,r,raw)
        selected.append(dict(source='FNRI',source_food_id=code,name=r['name'],category=CATEGORIES.get(code[0],'Sweets & Sweeteners'),source_url=fnri_url(r)));names.add(normal(r['name']))
    quotas={'19':100,'18':100,'23':60,'1':30,'4':20,'25':25,'6':400-len(selected)-335}
    categories={'19':'Sweets & Desserts','18':'Bread & Bakery','23':'Snacks','1':'Dairy & Spreads','4':'Spreads & Dressings','25':'Prepared Foods','6':'Soups & Sauces'}
    for cat,quota in quotas.items():
        pool=[r for r in available if r['category']==cat]
        pool.sort(key=lambda r:(bool(re.search(r'low|reduced|free|sugar substitute|saccharin|calcium propionate|unenriched|unbaked|dough,|rennin|halavah',r['name'],re.I)),len(r['name']),r['name']))
        count=0
        for r in pool:
            if normal(r['name']) in names:continue
            if count>=quota:
                excluded.append(dict(source='USDA',source_food_id=r['source_food_id'],name=r['name'],reason='Deferred after category quota; not discarded or represented as Philippine branded data.'));continue
            selected.append(dict(source='USDA',source_food_id=r['source_food_id'],name=r['name'],category=categories[cat],source_url=usda_url(r['source_food_id'])));names.add(normal(r['name']));count+=1
        assert count==quota,(cat,count,quota)
    assert len(selected)==400
    return selected,excluded,fnri,usda
