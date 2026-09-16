"""Plan/apply 500 distinct FNRI records in five audited batches."""
import argparse
import csv
import hashlib
import html
import json
import re
import unicodedata
from collections import Counter
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from food_db_sources import DB, RESEARCH, FIELDS, read_csv, fnri_url

BATCH='2026-09-16-expand-500'
DATE='2026-09-16'
GROUPS=[
    ('01-staples', {'A':50,'B':25,'C':25}),
    ('02-vegetables', {'D':100}),
    ('03-meat-eggs', {'F':90,'H':10}),
    ('04-seafood', {'G':100}),
    ('05-fruit-dairy-prepared', {'E':45,'J':15,'N':10,'R':20,'K':5,'Q':5}),
]
CATEGORIES={'A':'Rice, Grains & Bakery','B':'Root Crops','C':'Legumes, Nuts & Seeds',
    'D':'Vegetables','E':'Fruits','F':'Meat & Poultry','G':'Fish & Seafood','H':'Eggs',
    'J':'Milk & Dairy','N':'Condiments','R':'Prepared Foods','K':'Fats & Oils','Q':'Beverages'}
PREFERRED={
    'A':r'^(Rice|Noodles|Oat|Pasta|Corn grits|Corn on cob|Cornmeal|Wheat flour|Spring roll wrapper)|hopya|bicho|karyoka',
    'B':r'cassava|potato|taro|purple|tapioca',
    'C':r'cashew|chickpea|coconut|kidney bean|mung bean|peanut|soybean|sesame|green pea',
    'D':r'bamboo|banana heart|bitter melon|bottle gourd|cabbage|carrot|cauliflower|celery|chayote|coriander|cucumber|eggplant|garlic|horseradish|hyacinth|jackfruit|jute|leek|lettuce lvs|mung bean sprout|mushroom|mustard|okra|onion|pako|papaya fruit|parsley|pechay|pepper|radish|snap bean|snow/sugar|sponge gourd|squash|string/yard|swamp cabbage|sweet potato|taro|tomato|yam bean|winged bean|ginger|turmeric|basil',
    'F':r'^(Chicken|Pork|Beef|Bacon|Corned beef|Embotido|Ham|Luncheon meat|Meat loaf|Sausage)',
    'G':r'anchovy|catfish|clam, (halaan|freshwater|imbao)|crab|grouper|mackerel|milkfish|mussel|oyster|sardine|scad|shrimp|squid|tilapia|tuna|fish ball|quekiam|red snapper|sea bass',
    'E':r'apple|banana|grape|guava|jackfruit|lanzon|lychee|mango|mangosteen|melon|orange|papaya|passion|pear|pineapple|pomelo|rambutan|santol|soursop|star apple|strawberry|tamarind|dragon',
    'J':r'cheese|cream|cultured|evaporated|sweetn|recombined',
    'N':r'catsup|fish paste|lechon|lemon grass|pepper|salt|shrimp paste|vinegar',
    'R':r'steamed bun|rice gruel|buko pie|egg pie|halu-halo|pork.*adobo|caldereta|kare-kare|soup, mungbean|spring roll, Shanghai|pork blood stew|cheese sandwich|cheeseburger|pork & beans',
    'K':r'margarine|mayonnaise|oil, corn|fat, pork',
    'Q':r'coconut water|coffee|tea|cocoa',
}
# Reviewed essentials prevent alphabetic tie-breaking from displacing useful
# foods with numerous cultivars or preparation variants of one ingredient.
ESSENTIALS=set('''A031 A032 A039 A051 A059 A094 A127 A128 A129 A134 A135 A145 A147 A148 A149 A150 A152 A153 A154 A167 A168 A173 A175 A177 A179 A188 A190 A191 A192 A200 A201
C002 C004 C005 C006 C007 C008 C020 C021 C027 C035 C036 C043 C044 C048 C051 C055 C058 C061 C062 C065 C066 C067 C068 C069
D010 D011 D013 D014 D019 D025 D026 D035 D036 D045 D046 D051 D055 D069 D074 D095 D102 D103 D104 D107 D108 D115 D131 D132 D133 D134 D135 D139 D140 D147 D149 D150 D154 D161 D163 D164 D167 D169 D183 D184 D196 D206 D207 D211 D212 D219 D220 D223 D226 D227 D228 D233 D235 D237 D243 D244 D245 D246 D247 D253 D254 D255 D256 D258 D260 D272 D273 D279 D288 D293 D300 D304 D305
F213 F222 F226 F227 F228 F232 F235 F240 F242 F246 F249 F250 F253 F254 F255 F259 F261 F265 F266 F267 F269 F270
H002 H005 H010 H011 H015 H016 H020 H021
G013 G014 G021 G022 G038 G041 G063 G070 G071 G072 G076 G081 G082 G086 G088 G089 G094 G098 G100 G104 G106 G114 G115 G120 G132 G136 G146 G161 G162 G163 G183 G207 G208 G217 G222 G226 G227
N004 N005 N007 N013 N019 N020 N021 N023 N024 N025 N027
Q010 Q011 Q012 Q013'''.split())

def normal(name):
    return re.sub(r'[^\w]+',' ',unicodedata.normalize('NFKC',name).casefold()).strip()

def numeric(v):
    try:
        d=Decimal(v)
        return d.is_finite() and d>=0
    except InvalidOperation: return False

def priority(code,record):
    name=record['name']; preferred=bool(re.search(PREFERRED.get(code[0],'.'),name,re.I))
    rare=bool(re.search(r'uterus|spleen|brain|mammary|suckling|pullet|head|blood|intestine|lung|reticulum|omasum',name,re.I))
    cooked=bool(re.search(r'boiled|broiled|fried|roasted|steamed|ckd',name,re.I))
    if code=='H001': rare=True
    return (code not in ESSENTIALS,not preferred,rare,not cooked,code)

class NutrientParser(HTMLParser):
    """Independent check of the HTML modal's nutrient rows."""
    def __init__(self):
        super().__init__(); self.capture=None; self.parts=[]; self.label=None; self.values={};self.title=''
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='li': self.label=None
        if tag=='h3' or (tag=='div' and attrs.get('class')=='col-md-9') or tag=='strong':
            self.capture=tag;self.parts=[]
    def handle_data(self,data):
        if self.capture: self.parts.append(data)
    def handle_endtag(self,tag):
        if tag==self.capture:
            text=''.join(self.parts).strip()
            if tag=='h3': self.title=text
            elif tag=='div': self.label=text
            elif tag=='strong' and self.label:
                if self.label in self.values: raise ValueError('Duplicate source nutrient label')
                self.values[self.label]=text
            self.capture=None

def source_check(code,record,raw):
    start=raw.index('id="'+code+'_data"')
    end=raw.find('<td class=',start)
    modal=raw[start:end if end!=-1 else len(raw)]
    parser=NutrientParser();parser.feed(modal)
    assert parser.title==record['name'],code
    for field,(label,_,_) in FIELDS.items():
        assert parser.values.get(label,'')==record['nutrients'].get(label,''),(code,field)
    preceding=raw[max(0,start-1200):start]
    assert 'less_load('+record['report']+')' in preceding,code

def plan():
    catalog=json.loads((RESEARCH/'catalog.json').read_text(encoding='utf-8'))
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8')
    source=next(r for r in read_csv(DB/'sources.csv') if r['source_id']=='FNRI_20260916')
    assert hashlib.sha256((RESEARCH/'fnri-search-2026-09-16.html').read_bytes()).hexdigest()==source['sha256']
    existing=read_csv(DB/'foods.csv')
    used={r['source_food_id'] for r in existing if 'FNRI' in r['source_name']}
    used_names={normal(n) for r in existing for n in [r['name'],r['source_food_name']] if n}
    # An ambiguous duplicate description in FNRI is not counted as two foods.
    counts=Counter(normal(r['name']) for r in catalog.values())
    selected=[];excluded=[]
    for group,quotas in GROUPS:
        for prefix,count in quotas.items():
            candidates=[]
            for code,r in catalog.items():
                if code[0]!=prefix or code in used or normal(r['name']) in used_names: continue
                reason=''
                if counts[normal(r['name'])]>1: reason='Duplicate official descriptions; identity needs disambiguation.'
                elif any(not numeric(r['nutrients'].get(FIELDS[f][0],'')) for f in list(FIELDS)[:4]): reason='At least one core macro missing.'
                else:
                    sugar=r['nutrients'].get(FIELDS['sugar_g_100g'][0],'')
                    if numeric(sugar) and Decimal(sugar)>Decimal(r['nutrients'][FIELDS['carbs_g_100g'][0]])+Decimal('.1'):
                        reason='Source sugar exceeds total carbohydrate; requires review.'
                if reason:
                    excluded.append(dict(source_food_id=code,name=r['name'],reason=reason));continue
                candidates.append(code)
            candidates.sort(key=lambda c:priority(c,catalog[c]))
            assert len(candidates)>=count,(prefix,len(candidates),count)
            for code in candidates[:count]:
                record=catalog[code];source_check(code,record,raw)
                selected.append(dict(batch_id=group,source_food_id=code,name=record['name'],category=CATEGORIES[prefix],
                    source_url=fnri_url(record),selection_reason='FNRI primary record; prioritized common food family and preparation. This is editorial prioritization, not a consumption-frequency ranking.'))
                used.add(code);used_names.add(normal(record['name']))
    assert len(selected)==500
    return selected,excluded,catalog

def write_csv(path,rows):
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

def apply(selected,excluded,catalog):
    manifest=DB/(BATCH+'.json')
    assert not manifest.exists(),'Expansion already applied.'
    names=['foods.csv','aliases.csv','portions.csv','changes.csv','verification-evidence.csv']
    baseline={n:(DB/n).read_bytes() for n in names}
    tables={n:read_csv(DB/n) for n in names}
    foods=tables['foods.csv']; original=[dict(r) for r in foods]
    assert len(foods)==147,'Review plan against the current catalog before expanding.'
    next_id=max(int(r['food_id'][2:]) for r in foods)+1
    membership=[];checks=[]
    for group,_ in GROUPS:
        batch_rows=[]
        for entry in [r for r in selected if r['batch_id']==group]:
            code=entry['source_food_id'];s=catalog[code]
            row={k:'' for k in foods[0]}
            common=s['meta'][2]
            row.update(food_id=f'FC{next_id:06d}',name=s['name'],aliases='' if common in ['','-','N/A'] else common,
                category=entry['category'],basis='per 100 g edible portion',source_name='DOST-FNRI PhilFCT',
                source_food_id=code,source_url=fnri_url(s),source_food_name=s['name'],verification_date=DATE,
                edible_portion_pct=s['meta'][3].rstrip('%'),active='True',
                notes='Blank nutrients are unknown, not zero. Use the exact preparation, edible part and formulation in the source description.',
                verification_notes='Checked against retained official FNRI HTML snapshot and independently parsed nutrient labels. '+BATCH+'/'+group+'.')
            next_id+=1
            for field,(label,_,_) in FIELDS.items():
                value=s['nutrients'].get(label,'')
                if numeric(value): row[field]=value
                tables['verification-evidence.csv'].append(dict(food_id=row['food_id'],source_food_id=code,
                    field=field,source_value=value,source_url=row['source_url'],accessed_date=DATE))
            row['data_status']='VERIFIED_FNRI' if all(row[k] for k in FIELDS) else 'PARTIAL_VERIFIED_FNRI'
            batch_rows.append(row)
            for k,v in row.items():
                if v: tables['changes.csv'].append(dict(date=DATE,food_id=row['food_id'],field=k,old_value='',new_value=v,
                    reason='Add new distinct FNRI food; '+BATCH+'/'+group,source_url=row['source_url']))
            alias_values=[row['name']]
            # Keep full qualified native names intact; splitting on commas/slashes can lose the preparation.
            if row['aliases'] and normal(row['aliases'])!=normal(row['name']): alias_values.append(row['aliases'])
            for a in alias_values:
                tables['aliases.csv'].append(dict(food_id=row['food_id'],alias=a,source_url=row['source_url'],
                    data_status='SEARCH_ALIAS_REVIEWED',notes='Official name/common name, including preparation qualifiers. Search aid only.'))
            tables['portions.csv'].append(dict(portion_id=row['food_id']+'_100G_EP',food_id=row['food_id'],
                description='100 g edible portion',quantity='100',unit='g',edible_weight_g='100',edible_portion_pct=row['edible_portion_pct'],
                source_url=row['source_url'],data_status='VERIFIED_REFERENCE_BASIS',notes='Reference mass, not a household serving. Do not apply the edible percentage twice to weighed edible food.'))
            membership.append(dict(food_id=row['food_id'],**entry))
        assert len(batch_rows)==100
        foods.extend(batch_rows)
        assert len({r['food_id'] for r in foods})==len(foods)
        new=foods[len(original):]
        assert len({r['source_food_id'] for r in new})==len(new)
        assert len({normal(r['name']) for r in new})==len(new)
        assert foods[:len(original)]==original
        checks.append(dict(batch_id=group,added=100,full=sum(r['data_status']=='VERIFIED_FNRI' for r in batch_rows),
            partial=sum(r['data_status']=='PARTIAL_VERIFIED_FNRI' for r in batch_rows),
            checks='PASS: original rows preserved; distinct IDs/descriptions; all 4 core macros present; 8 fields reconciled to primary HTML.'))
    assert len(foods)==647
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for name,content in baseline.items():
        p=backup/name
        if p.exists(): assert p.read_bytes()==content
        else: p.write_bytes(content)
    tables['expansion-500.csv']=membership
    tables['expansion-500-exclusions.csv']=excluded
    for name,rows in tables.items():
        if name in baseline: assert (DB/name).read_bytes()==baseline[name],'Concurrent edit: '+name
        else: assert not (DB/name).exists(),'Refuse to overwrite '+name
    for name,rows in tables.items():
        temp=DB/(name+'.tmp');write_csv(temp,rows);temp.replace(DB/name)
    summary=dict(expansion_id=BATCH,added_foods=500,total_foods=647,source='DOST-FNRI PhilFCT',
        source_snapshot_sha256=hashlib.sha256((RESEARCH/'fnri-search-2026-09-16.html').read_bytes()).hexdigest(),
        original_records_preserved=147,household_portions_added=0,edible_reference_portions_added=500,
        estimates_added=0,batches=checks,excluded_candidates=len(excluded))
    manifest.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if (DB/(BATCH+'.json')).exists(): print('Expansion already applied. No changes.')
    else:
        selected,excluded,catalog=plan()
        if args.apply: apply(selected,excluded,catalog)
        else:
            write_csv(RESEARCH/'expansion-500-plan.csv',selected)
            for group,_ in GROUPS:
                print('\n'+group)
                print(' | '.join(r['source_food_id']+' '+r['name'] for r in selected if r['batch_id']==group))
            print('\nExcluded:',excluded)
