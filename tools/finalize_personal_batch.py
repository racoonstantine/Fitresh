"""Audit and materialize confidence and requested-food coverage."""
import json
from decimal import Decimal
from food_db_sources import DB,FIELDS,read_csv,load_sources
from expand_food_db import write_csv
from resolve_food import FoodCatalog

def main():
    c=FoodCatalog()
    # Correct an authoring error in this new estimate; log every changed value.
    components=read_csv(DB/'personal-estimate-components.csv')
    bad=[r for r in components if r['ingredient_food_id']=='FC000287']
    if bad:
        assert len(bad)==1
        part=bad[0];eid=part['estimate_id']
        assert c.foods['FC000285']['name']=='Cabbage, green'
        part.update(ingredient_food_id='FC000285',nutrients_per_100g_json=json.dumps({f:n['value_per_100g'] for f,n in c.resolve('FC000285')['nutrients'].items()},sort_keys=True),source_url=c.foods['FC000285']['source_url'])
        estimates=read_csv(DB/'food_estimates.csv');changes=read_csv(DB/'changes.csv')
        e=next(r for r in estimates if r['estimate_id']==eid)
        for field in FIELDS:
            vals=[(json.loads(p['nutrients_per_100g_json'])[field],Decimal(p['edible_grams'])) for p in components if p['estimate_id']==eid]
            value='' if any(v is None for v,g in vals) else str((sum(Decimal(str(v))*g for v,g in vals)/sum(g for v,g in vals)).quantize(Decimal('0.0001')))
            changes.append(dict(date='2026-09-17',food_id=e['food_id'],field=eid+':'+field,old_value=e[field],new_value=value,reason='Correct new coleslaw model ingredient: cucumber FC000287 to green cabbage FC000285. No manually verified value changed.',source_url=part['source_url']))
            e[field]=value
        e['source_urls']=';'.join(dict.fromkeys([e['source_urls'].split(';')[0]]+[p['source_url'] for p in components if p['estimate_id']==eid]))
        inputs=read_csv(DB/'estimate_inputs.csv')
        for r in inputs:
            if r['estimate_id']==eid and r['source_food_id']=='FC000287':r.update(input_name='ingredient_edible_grams:FC000285',source_food_id='FC000285',source_url=part['source_url'])
        for filename,rows in [('personal-estimate-components.csv',components),('food_estimates.csv',estimates),('estimate_inputs.csv',inputs),('changes.csv',changes)]:write_csv(DB/filename,rows)
    c=FoodCatalog()
    def confidence_row(fid,eid=None):
        r=c.resolve(fid,estimate_id=eid);info=r['confidence']
        return dict(food_id=fid,estimate_id=eid or '',name=r['name'],level=info['level'],reason=info['reason'],policy_version=info['policy_version'],scope=info['scope'],missing_fields=';'.join(info['missing_fields']))
    write_csv(DB/'food-confidence.csv',[confidence_row(fid) for fid in c.foods])
    write_csv(DB/'estimate-confidence.csv',[confidence_row(e['food_id'],e['estimate_id']) for e in c.estimates])
    requested={'chia seeds':['FC001138'],'Greek yogurt':['FC001246','FC001247','FC001248'],'regular yogurt':['FC001249','FC001465','FC001466'],'okra boiled':['FC000262'],'broccoli boiled':['FC001081'],'talong boiled':['FC000256'],'repolyo boiled':['FC000252'],'kimchi':['FC001605'],'scrambled eggs':['FC001504']}
    audit=[]
    for query,ids in requested.items():
        for fid in ids:audit.append(dict(request=query,food_id=fid,name=c.foods[fid]['name'],decision='Reused existing qualified identity' if int(fid[2:])<=1309 else 'New source-backed identity',notes='Match preparation and fat/flavor; no broad-name automatic selection.'))
    for r in read_csv(DB/'expansion-personal-specials.csv'):audit.append(dict(request=r['name'],food_id=r['food_id'],name=r['name'],decision='Added qualified identity',notes='Explicit selection required for estimate-only rows.'))
    audit.append(dict(request='thick yogurt',food_id='',name='',decision='Unresolved description',notes='Thickness alone does not establish Greek style, fat, sugar or brand. Choose a qualified yogurt.'))
    write_csv(DB/'personal-food-coverage.csv',audit)
    _,usda=load_sources();raw=usda['171287']['portions'];cooked=usda['172187']['portions']
    large=next(p for p in raw if p['modifier']=='large')
    cooked_large=next(p for p in cooked if p['modifier']=='large')
    sizes=[]
    for p in raw:
        if p['modifier'] not in ['small','medium','large','extra large','jumbo']:continue
        sizes.append(dict(food_id='FC001504',description='1 '+p['modifier']+' scrambled egg equivalent',edible_weight_g=str(round(float(cooked_large['gram_weight'])*float(p['gram_weight'])/float(large['gram_weight']),2)),confidence='Good' if p['modifier']=='large' else 'Low',status='SOURCE_PORTION' if p['modifier']=='large' else 'ESTIMATED_SIZE_EQUIVALENT',source_url='https://fdc.nal.usda.gov/food-details/172187/nutrients;https://fdc.nal.usda.gov/food-details/171287/nutrients',notes='Large cooked source weight; other sizes scale by raw egg mass ratio. Not measured cooked weights. Oil/milk recipe can differ.'))
    assert len(sizes)==5
    write_csv(DB/'estimated-egg-portions.csv',sizes)
    (DB/'egg-size-source-evidence.json').write_text(json.dumps(dict(raw=raw,scrambled=cooked),indent=2)+'\n')
    aliases=read_csv(DB/'aliases.csv')
    for fid,alias in [('FC001081','brocolli boiled'),('FC001605','kimchi'),('FC001504','scrambled eggs')]:
        if not any(r['food_id']==fid and r['alias']==alias for r in aliases):aliases.append(dict(food_id=fid,alias=alias,source_url=c.foods[fid]['source_url'],data_status='SEARCH_ALIAS_REVIEWED',notes='User spelling/discovery alias; display exact source preparation.'))
    write_csv(DB/'aliases.csv',aliases)
    print('Confidence, coverage and egg-size audit materialized.')

if __name__=='__main__':main()
