"""Select 400 unused exact reference foods, prioritizing PhilFCT."""
import hashlib,re
from collections import Counter
from food_db_sources import *
from expand_food_db import normal,numeric,source_check,CATEGORIES

def plan():
    fnri,usda=load_sources();before=read_csv(DB/'foods.csv')
    used={r['source_food_id'] for r in before+read_csv(DB/'other_food_values.csv')}
    names={normal(r['name']) for r in before};counts=Counter(normal(r['name']) for r in fnri.values())
    for s in read_csv(DB/'sources.csv'):
        assert hashlib.sha256((DB.parents[1]/s['local_snapshot']).read_bytes()).hexdigest()==s['sha256']
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8')
    selected=[];excluded=[]
    # Defer infant foods, unusual wild meats, and plants requiring a separate
    # preparation/safety identity review. A composition record is not eating advice.
    defer=re.compile(r'white spot arum|yam, nami|jack-bean|velvet bean|yam bean, pod|human|infant|moor hen|snipe|venison|wild,|azolla|chlorella',re.I)
    order='DEGRCBFHQKT'
    for code,r in sorted(fnri.items(),key=lambda p:(order.find(p[0][0]) if p[0][0] in order else 99,'boiled' not in p[1]['name'],p[0])):
        if code in used or normal(r['name']) in names:continue
        reason=''
        if code[0] not in order or defer.search(r['name']):reason='Outside this batch; separate preparation/identity review needed.'
        elif counts[normal(r['name'])]>1:reason='Duplicate source descriptions; do not count ambiguous identities twice.'
        elif not all(numeric(r['nutrients'].get(FIELDS[f][0],'')) for f in list(FIELDS)[:4]):reason='Core nutrient missing.'
        elif numeric(r['nutrients'].get(FIELDS['sugar_g_100g'][0],'')) and float(r['nutrients'][FIELDS['sugar_g_100g'][0]])>float(r['nutrients'][FIELDS['carbs_g_100g'][0]])+.1:reason='Source sugar exceeds carbohydrate; defer without altering source.'
        if reason:excluded.append(dict(source='FNRI',source_food_id=code,name=r['name'],reason=reason));continue
        if len(selected)>=250:continue
        source_check(code,r,raw)
        selected.append(dict(source='FNRI',source_food_id=code,name=r['name'],category=CATEGORIES.get(code[0],'Other Foods'),source_url=fnri_url(r)))
        names.add(normal(r['name']))
    assert len(selected)==250,len(selected)
    categories={'11':'Vegetables','9':'Fruits','15':'Fish & Seafood','16':'Legumes, Nuts & Seeds','20':'Rice, Grains & Bakery','12':'Legumes, Nuts & Seeds'}
    pools={k:[] for k in categories}
    for code,r in usda.items():
        name=r['description'];cat=r['food_category_id']
        if cat not in pools or code in used or normal(name) in names:continue
        if re.search(r'\b[A-Z]{3,}\b|babyfood|infant|alaska native|school lunch|formula|supplement',name):continue
        v={f:r['nutrients'].get(nid,{}).get('amount','') for f,(_,nid,_) in FIELDS.items()}
        if not all(numeric(v[f]) for f in list(FIELDS)[:4]):continue
        if numeric(v['sugar_g_100g']) and float(v['sugar_g_100g'])>float(v['carbs_g_100g'])+.1:continue
        pools[cat].append(dict(source='USDA',source_food_id=code,name=name,category=categories[cat],source_url=usda_url(code)))
    preferred=re.compile(r'amaranth|bamboo|balsam|cabbage|carrot|cassava|cauliflower|celery|chayote|cucumber|eggplant|garlic|ginger|mushroom|okra|onion|pepper|potato|radish|squash|taro|tomato|spinach|banana|mango|pineapple|papaya|guava|jackfruit|durian|melon|orange|grape|apple|coconut|peanut|cashew|sesame|sunflower|pumpkin|mung|soy|tofu|chickpea|kidney|rice|noodle|oat|corn|wheat|crab|shrimp|tilapia|tuna|mackerel|sardine|milkfish|salmon|squid|octopus|clam|mussel|oyster',re.I)
    for pool in pools.values():pool.sort(key=lambda r:(not bool(preferred.search(r['name'])),'cooked' not in r['name'],r['name'],r['source_food_id']))
    while len(selected)<400:
        progress=False
        for pool in pools.values():
            while pool and normal(pool[0]['name']) in names:pool.pop(0)
            if pool and len(selected)<400:
                r=pool.pop(0);selected.append(r);names.add(normal(r['name']));progress=True
        assert progress,'Not enough suitable references'
    return selected,excluded,fnri,usda

if __name__=='__main__':
    selected,excluded,_,_=plan();print(Counter(r['source'] for r in selected));print(Counter(r['category'] for r in selected))
    print('\n'.join(r['source']+' '+r['source_food_id']+' '+r['name'] for r in selected))
