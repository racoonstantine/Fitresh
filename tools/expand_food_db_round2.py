"""Second curated expansion: 400 FNRI records and 100 USDA gap records."""
import argparse
import hashlib
import json
import re
from collections import Counter
from food_db_sources import DB,RESEARCH,FIELDS,load_sources,read_csv,fnri_url,usda_url
from expand_food_db import normal,numeric,source_check,write_csv,CATEGORIES

BATCH='2026-09-17-expand-500'
QUOTAS={'A':75,'B':8,'C':25,'D':65,'E':35,'F':55,'G':37,'H':1,'J':3,'K':1,'M':25,'N':15,'P':5,'Q':20,'R':30}
PIN=set('''A033 A034 A035 A036 A037 A040 A043 A044 A046 A050 A052 A053 A054 A055 A057 A061 A065 A083 A084 A086 A087 A090 A091 A092 A093 A095 A097 A098 A103 A104 A106 A108 A109 A110 A111 A112 A113 A114 A115 A116 A124 A137 A141 A142 A144 A146 A151 A156 A157 A169 A170 A171 A172 A174 A176 A178 A180 A181 A182 A183 A184 A185 A186 A187 A189 A193 A194 A195 A197 A198 A202 A203 A204 A205
B018 B022 B023 B025 B032 B042
C003 C009 C010 C018 C022 C023 C024 C029 C030 C031 C032 C034 C037 C039 C040 C042 C045 C046 C047 C049 C052 C053 C054 C056 C057 C059 C060
D016 D017 D029 D047 D048 D052 D060 D063 D064 D065 D075 D085 D087 D096 D098 D100 D105 D113 D118 D119 D121 D122 D126 D130 D137 D138 D145 D159 D165 D170 D172 D173 D174 D175 D176 D177 D180 D181 D185 D193 D198 D199 D200 D203 D204 D205 D208 D213 D214 D221 D229 D230 D238 D259 D264 D265 D268 D269 D270 D274 D275 D276 D277 D278 D280 D281 D282 D283 D284 D286 D287 D289 D290 D292 D295 D297 D303
E018 E019 E020 E024 E025 E028 E035 E036 E037 E040 E042 E071 E074 E079 E080 E084 E087 E090 E091 E096 E097 E099 E100 E103 E104 E105 E107 E108 E109 E110 E113 E114 E115 E116 E117
F054 F059 F060 F065 F066 F067 F068 F071 F072 F075 F076 F077 F081 F082 F083 F085 F086 F087 F088 F090 F100 F101 F116 F118 F119 F120 F121 F122 F128 F129 F130 F132 F134 F135 F136 F137 F168 F169 F170 F188 F203 F208 F210 F219 F220 F221 F224 F225 F229 F231 F233 F234 F237 F238 F241 F243 F248 F251 F252 F256 F260 F262 F264 F272 F273
G025 G026 G027 G029 G033 G035 G043 G044 G049 G050 G051 G056 G057 G058 G059 G060 G061 G062 G064 G066 G067 G068 G069 G079 G083 G084 G087 G095 G097 G108 G122 G126 G128 G129 G148 G156 G184
H022 J013 J017 J026 K011
M013 M014 M016 M019 M020 M021 M022 M023 M025 M026 M027 M028 M031 M035 M037 M040 M042 M043 M044 M045 M046 M048 M049 M051 M052
Q002 Q003 Q004 Q009 Q016 Q019 Q020 Q021 Q043 Q044 Q045 Q046 Q048 Q049 Q050 Q051 Q053 Q054 Q059 Q062
R001 R006 R007 R008 R009 R010 R014 R015 R020 R021 R022 R023 R024 R025 R028 R029 R032 R033 R034 R035 R040 R042 R052 R054 R057 R058 R060 R062 R063 R072 R076 R079 R081'''.split())
USDA_IDS='''175167 175168 173686 171998 175136 173719 173691 173692 175138 172001 173690 173693
173717 173718 175154 175155 171955 171956 174191 175178 171964 174198 174199 173725 173726 174200 174201
174220 167742 174221 174208 174209
170379 169967 169969 169404 168462 168463 169288 170383 169971 169973 169205 168386 168388 168389 168390 169209 169387 169246 168426 169385
171711 173950 167755 168209 173946 171710 171722 171723 171697 173941 168153 174673 174676 171719 173954 169949
168874 168917 170688 170287 169699 169700 170284 170285 172420 172421 174284
170567 170158 170568 170186 170187 170184 170185 170182 170183 170581 170583 170554 169414
169330 169331 168510 168513 173957 173955 169968 169208'''.split()

def plan():
    fnri,usda=load_sources();before=read_csv(DB/'foods.csv')
    assert len(before)==647,'Re-review this plan if the input catalog changed.'
    sources=read_csv(DB/'sources.csv')
    for s in sources:
        p=RESEARCH.parent.parent/s['local_snapshot']
        assert hashlib.sha256(p.read_bytes()).hexdigest()==s['sha256']
    used_fnri={r['source_food_id'] for r in before if 'FNRI' in r['source_name']}
    used_usda={r['source_food_id'] for r in read_csv(DB/'other_food_values.csv')}
    names={normal(n) for r in before for n in [r['name'],r['source_food_name']] if n}
    frequencies=Counter(normal(r['name']) for r in fnri.values());selected=[];excluded=[]
    raw=(RESEARCH/'fnri-search-2026-09-16.html').read_text(encoding='utf-8')
    for prefix,count in QUOTAS.items():
        candidates=[]
        for code,r in fnri.items():
            if code[0]!=prefix or code in used_fnri or normal(r['name']) in names:continue
            n=r['nutrients'];reason=''
            if frequencies[normal(r['name'])]>1:reason='Duplicate source descriptions; identity unresolved.'
            elif '\ufffd' in r['name']:reason='Source description has undecodable character.'
            elif any(not numeric(n.get(FIELDS[k][0],'')) for k in list(FIELDS)[:4]):reason='Core macro missing.'
            elif numeric(n.get('Sugars, total (g)','')) and float(n['Sugars, total (g)'])>float(n['Carbohydrate, total (g)'])+.1:reason='Sugar exceeds total carbohydrate.'
            elif re.search(r'uterus|spleen|brain|mammary|suckling|moor hen|snipe|human|infant|MLP|yacon',r['name'],re.I) and code not in PIN:reason='Outside the common-food focus for this batch.'
            if reason:excluded.append(dict(source='FNRI',source_food_id=code,name=r['name'],reason=reason));continue
            candidates.append(code)
        candidates.sort(key=lambda code:(code not in PIN,code))
        assert len(candidates)>=count,(prefix,count,len(candidates))
        for code in candidates[:count]:
            r=fnri[code];source_check(code,r,raw)
            selected.append(dict(source='FNRI',source_food_id=code,name=r['name'],category=CATEGORIES.get(prefix,{'M':'Sweets & Sweeteners','P':'Alcoholic Beverages'}.get(prefix)),source_url=fnri_url(r)))
            names.add(normal(r['name']))
    assert len(selected)==400,len(selected)
    assert len(USDA_IDS)==100 and len(set(USDA_IDS))==100,len(USDA_IDS)
    for code in USDA_IDS:
        r=usda[code];assert code not in used_usda
        assert normal(r['description']) not in names,(code,r['description'])
        assert all(numeric(r['nutrients'].get(FIELDS[k][1],{}).get('amount','')) for k in list(FIELDS)[:4]),code
        name=r['description'];category='Grains, Legumes & Nuts'
        if name.startswith(('Fish,','Mollusks,','Crustaceans,')):category='Fish & Seafood'
        elif name.startswith(('Broccoli','Spinach','Brussels','Artichokes','Asparagus','Arugula','Leeks','Fennel')):category='Vegetables'
        elif name.startswith(('Blueberries','Raspberries','Blackberries','Cranberries','Apricots','Kiwifruit','Grapefruit','Cherries','Plums')):category='Fruits'
        selected.append(dict(source='USDA',source_food_id=code,name=name,category=category,source_url=usda_url(code)))
        names.add(normal(name))
    assert len(selected)==500
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
            foods=tables['foods.csv'];assert foods[:647]==original
            assert len({r['food_id'] for r in foods})==len(foods)
            checks.append(dict(batch_id=group,added=100,source=entry['source'],preservation='PASS',distinct_ids='PASS'))
    assert len(tables['foods.csv'])==1147
    backup=RESEARCH/BATCH;backup.mkdir(exist_ok=True)
    for n,content in baseline.items():
        p=backup/n
        if p.exists():assert p.read_bytes()==content
        else:p.write_bytes(content)
    tables['expansion-round2.csv']=members;tables['expansion-round2-exclusions.csv']=excluded
    for n,rows in tables.items():
        if n in baseline:assert (DB/n).read_bytes()==baseline[n]
        else:assert not (DB/n).exists()
    for n,rows in tables.items():
        temp=DB/(n+'.tmp');write_csv(temp,rows);temp.replace(DB/n)
    summary=dict(expansion_id=BATCH,added=500,fnri=400,usda=100,total=1147,original_records_preserved=647,
        household_portions_added=household,estimates_added=0,batches=checks,
        added_fnri_statuses=dict(Counter(r['data_status'] for r in tables['foods.csv'][647:1047])))
    (DB/(BATCH+'.json')).write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if (DB/(BATCH+'.json')).exists():print('Batch already applied. No changes.')
    else:
        selected,excluded,fnri,usda=plan()
        if args.apply:apply(selected,excluded,fnri,usda)
        else:
            write_csv(RESEARCH/'expansion-round2-plan.csv',selected)
            for i in range(5):print('\nBatch',i+1,' | '.join(r['source_food_id']+' '+r['name'] for r in selected[i*100:(i+1)*100]))
