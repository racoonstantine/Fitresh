"""Exact unused references for world cuisines; FNRI identities reviewed first."""
import hashlib
from food_db_sources import *
from expand_food_db import normal,numeric

IDS='167675 168084 168905 168906 168908 169392 169712 169735 169890 171167 171821 171845 172454 172455 172816 172890 174077 174288 174289 174807'.split()

def plan():
    fnri,usda=load_sources()
    for s in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((DB.parents[1]/s['local_snapshot']).read_bytes()).hexdigest()==s['sha256']
    rows=read_csv(DB/'foods.csv');others=read_csv(DB/'other_food_values.csv')
    used={r['source_food_id'] for r in rows+others};names={normal(r['name']) for r in rows}
    fnri_names={normal(r['name']) for r in fnri.values()};selected=[];reviews=[]
    for code in IDS:
        s=usda[code];name=s['description']
        assert code not in used and normal(name) not in names,(code,name,'already present')
        assert normal(name) not in fnri_names,(code,'Exact FNRI identity requires preference')
        values={f:s['nutrients'].get(nid,{}).get('amount','') for f,(_,nid,_) in FIELDS.items()}
        assert all(numeric(values[f]) for f in list(FIELDS)[:4]),name
        assert not numeric(values['sugar_g_100g']) or float(values['sugar_g_100g'])<=float(values['carbs_g_100g'])+.1,name
        selected.append(dict(source='USDA',source_food_id=code,name=name,category='World Cuisine Reference Foods',source_url=usda_url(code)))
        reviews.append(dict(source='USDA',source_food_id=code,name=name,reason='Full retained FNRI catalog checked; exact source identity absent. Historical US reference retained as named; not Philippine restaurant nutrition.'))
    return selected,reviews,fnri,usda
