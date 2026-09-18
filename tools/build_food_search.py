"""Audit aliases and build a deployable, immutable catalog search snapshot."""
import csv
import hashlib
import json
import re
import unicodedata
import argparse
from datetime import date
from collections import defaultdict
from food_db_sources import DB, ROOT, RESEARCH, read_csv
from resolve_food import FoodCatalog

def normalize(text):
    text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()
    return ' '.join(re.sub(r'[^a-z0-9]+',' ',text).split())

def write_csv(path,rows,fields=None):
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)

def main(review_date=None):
    review_date=date.fromisoformat(review_date).isoformat() if review_date else date.today().isoformat()
    catalog=FoodCatalog(); aliases=read_csv(DB/'aliases.csv')
    before=(DB/'aliases.csv').read_bytes()
    backup=RESEARCH/'aliases-before-search-audit.csv'
    if not backup.exists(): backup.write_bytes(before)
    original_count=len(aliases)
    seen={(a['food_id'],normalize(a['alias'])) for a in aliases}
    additions=[]
    def add(fid,alias,url,reason):
        key=(fid,normalize(alias))
        if not key[1] or key in seen:return
        seen.add(key)
        aliases.append(dict(food_id=fid,alias=alias,source_url=url,data_status='SEARCH_ALIAS_REVIEWED',notes=reason))
        additions.append(dict(food_id=fid,alias=alias,source_url=url,reason=reason,date=review_date))
    fnri=json.loads((RESEARCH/'catalog.json').read_text(encoding='utf-8'))
    official_names={}
    for fid,row in catalog.foods.items():
        add(fid,row['name'],row['source_url'],'Canonical name; preparation retained.')
        if fid in catalog.display_names:
            add(fid,catalog.display_names[fid],row['source_url'],'Reviewed display label; original source name remains unchanged in foods.csv and food-display-labels.csv.')
        source=fnri.get(row['source_food_id']) if 'FNRI' in row['source_name'] else None
        common=source['meta'][2] if source else ''
        official_names[fid]=common if common not in ['N/A','-'] else ''
        if official_names[fid]:
            for name in common.split('/'):
                add(fid,name.strip(),row['source_url'],'Separate slash-delimited official common names; retain comma-qualified preparation and plant part.')
            # A broad discovery term may match several preparations. The result
            # always retains the complete source identity; never auto-select it.
            local=common.split('/')[0].strip()
            root=local.split(',')[0].strip()
            if root!=local:
                add(fid,root,row['source_url'],'Source common-name discovery without comma qualifiers; display full preparation and never auto-select.')
    # Spellings supported by the starter's own munggo/monggo aliases. Apply the
    # token change only to actual munggo aliases, keeping all qualifiers intact.
    for a in list(aliases):
        expanded=a['alias']
        for short,long in {'lvs':'leaves','ckd':'cooked','cnd':'canned','pwdr':'powder','drnd':'drained','unckd':'uncooked','flvr':'flavor','inst':'instant'}.items():
            expanded=re.sub(r'\b'+short+r'\b',long,expanded,flags=re.I)
        add(a['food_id'],expanded,a['source_url'],'Expand source abbreviations for search only.')
        if re.search(r'\bmunggo\b',a['alias'],re.I):
            add(a['food_id'],re.sub(r'\bmunggo\b','Monggo',a['alias'],flags=re.I),a['source_url'],'Munggo/monggo spelling pair already documented in starter aliases; preserve qualifiers.')
    by_food=defaultdict(list)
    for a in aliases: by_food[a['food_id']].append(a)
    for relation in catalog.variants:
        for a in by_food[relation['parent_food_id']]:
            add(relation['variant_food_id'],a['alias'],a['source_url'],
                'Discovery alias inherited from broad parent '+relation['parent_food_id']+'. Display the exact variant; never choose it automatically.')
    if additions:
        assert (DB/'aliases.csv').read_bytes()==before,'Alias file changed during audit'
        write_csv(DB/'aliases.csv',aliases)
        log=DB/'alias-changes.csv'
        write_csv(log,(read_csv(log) if log.exists() else [])+additions)
    by_food=defaultdict(list);collisions=defaultdict(set)
    for a in aliases:
        assert a['food_id'] in catalog.foods
        by_food[a['food_id']].append(a['alias']);collisions[normalize(a['alias'])].add(a['food_id'])
    audit=[]
    for fid,row in catalog.foods.items():
        audit.append(dict(food_id=fid,name=row['name'],alias_count=len(by_food[fid]),
            official_common_names=official_names[fid],
            common_name_status='SOURCE_COMMON_NAMES_AVAILABLE' if official_names[fid] else 'NO_FNRI_COMMON_NAME_FOR_THIS_RECORD',
            review_note='Canonical search covered. No unsupported regional translation added.'))
    write_csv(DB/'alias-audit.csv',audit)
    collision_rows=[dict(normalized_alias=a,food_ids=';'.join(sorted(ids)),handling='Show separate labeled choices; never merge or auto-select.') for a,ids in sorted(collisions.items()) if len(ids)>1]
    write_csv(DB/'alias-collisions.csv',collision_rows)
    codes={'kcal_100g':'ENERC_KCAL','protein_g_100g':'PROCNT','fat_g_100g':'FAT','carbs_g_100g':'CHOCDF','fiber_g_100g':'FIBTG','sugar_g_100g':'SUGAR','sodium_mg_100g':'NA','cholesterol_mg_100g':'CHOLE'}
    foods={}
    for fid in catalog.foods:
        resolved=catalog.resolve(fid)
        if resolved['requires_identity_selection'] or any(resolved['nutrients'][f]['value_per_100g'] is None for f in ['kcal_100g','protein_g_100g','fat_g_100g','carbs_g_100g']):continue
        foods[fid]=dict(food_id=fid,name=resolved['name'],source='catalog',brand=None,canonical_amount=100,canonical_unit='g',
            local_name=(official_names[fid].split('/')[0].strip() if official_names[fid] else None),
            label=resolved['label'],complete=resolved['complete'],confidence=resolved['confidence'],
            aliases=list(dict.fromkeys(by_food[fid])),
            portions=[p for p in catalog.portions if p['food_id']==fid and p['data_status']=='OTHER_SOURCE_PORTION' and float(p['edible_weight_g'] or 0)>0],
            nutrients={code:resolved['nutrients'][field]['value_per_100g'] for field,code in codes.items()},
            nutrient_provenance={code:resolved['nutrients'][field] for field,code in codes.items()})
    payload=dict(schema_version=1,foods=foods)
    encoded=json.dumps(payload,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
    version=hashlib.sha256(encoded).hexdigest()[:24]
    history=ROOT/'api/catalog-history';history.mkdir(exist_ok=True)
    snapshot=history/(version+'.json')
    if snapshot.exists():assert snapshot.read_bytes()==encoded
    else:snapshot.write_bytes(encoded)
    (ROOT/'api/catalog-active.json').write_text(json.dumps({'version':version})+'\n',encoding='utf-8')
    summary=dict(foods_audited=len(audit),foods_with_official_common_names=sum(bool(r['official_common_names']) for r in audit),
        total_alias_rows=len(aliases),shared_aliases=len(collision_rows),searchable_foods=len(foods),snapshot_version=version)
    (DB/'alias-audit-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(summary,added_this_run=len(aliases)-original_count),indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--review-date',help='ISO date for newly added aliases; defaults to today')
    main(parser.parse_args().review_date)
