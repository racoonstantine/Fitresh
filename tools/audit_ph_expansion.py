"""Flag source contradictions and add qualified Philippine discovery aliases."""
import json,re
from collections import Counter
from food_db_sources import DB,read_csv
from expand_food_db import write_csv

def main():
    foods=read_csv(DB/'foods.csv');changes=read_csv(DB/'changes.csv');conflicts=[]
    for r in foods:
        if not 1809<int(r['food_id'][2:])<=2209:continue
        if r['carbs_g_100g'] and r['sugar_g_100g'] and float(r['sugar_g_100g'])>float(r['carbs_g_100g'])+.1:
            note='Published source reports sugar above total carbohydrate. Original numbers retained; blocked from resolution/logging pending source clarification.'
            for field,value in [('data_status','SOURCE_CONFLICT_REVIEW_REQUIRED'),('verification_notes',note)]:
                if r[field]!=value:
                    changes.append(dict(date='2026-09-17',food_id=r['food_id'],field=field,old_value=r[field],new_value=value,reason='New-batch source validation; no nutrient value changed.',source_url=r['source_url']));r[field]=value
            conflicts.append(dict(food_id=r['food_id'],name=r['name'],carbs_g_100g=r['carbs_g_100g'],sugar_g_100g=r['sugar_g_100g'],source_url=r['source_url'],status=r['data_status'],next_action='Verify against a clarified source; do not cap sugar or invent carbohydrate.'))
    assert len(conflicts)==2
    write_csv(DB/'foods.csv',foods);write_csv(DB/'changes.csv',changes);write_csv(DB/'ph-source-conflicts.csv',conflicts)
    aliases=read_csv(DB/'aliases.csv');log=read_csv(DB/'alias-changes.csv')
    # A jelly-filled cake is not itself a spread. Remove only this batch's alias.
    bad=[r for r in aliases if r['alias']=='palaman Cake, jelly roll']
    for r in bad:
        assert r['notes']=='Broad Filipino spread discovery; do not merge or automatically select a formulation.'
        log.append(dict(food_id=r['food_id'],alias=r['alias'],source_url=r['source_url'],reason='Removed new-batch overbroad palaman alias: jelly roll is a cake, not a spread.',date='2026-09-17'))
    aliases=[r for r in aliases if r not in bad]
    seen={(r['food_id'],r['alias'].casefold()) for r in aliases}
    def add(fid,alias,url,reason):
        if (fid,alias.casefold()) in seen:return
        seen.add((fid,alias.casefold()));aliases.append(dict(food_id=fid,alias=alias,source_url=url,data_status='SEARCH_ALIAS_REVIEWED',notes=reason));log.append(dict(food_id=fid,alias=alias,source_url=url,reason=reason,date='2026-09-17'))
    for r in read_csv(DB/'ph-restaurant-estimates.csv'):
        for brand in {"McDonald's":['McDo','McDonalds'],'Ramen Nagi':['Ramenagi','RamenNagi'],'Mang Inasal':['Manginasal'],'Jollibee':['Jabee']}.get(r['brand'],[]):
            add(r['food_id'],brand+' '+r['menu_item'],r['menu_source_url'],'Brand spelling discovery only; exact variant and explicit estimate selection still required.')
    for r in foods:
        if re.search(r'spread|\bjam$|^Jams|^Jell(?:y|ies)(?:,|$)|^Marmalade|^Peanut butter',r['name'],re.I):
            add(r['food_id'],'palaman '+r['name'],r['source_url'],'Broad Filipino spread discovery; do not merge or automatically select a formulation.')
    write_csv(DB/'aliases.csv',aliases);write_csv(DB/'alias-changes.csv',log)
    sources=read_csv(DB/'expansion-ph-restaurants-sources.csv');menus=read_csv(DB/'ph-restaurant-estimates.csv')
    summary=dict(batch='2026-09-17-ph-foods-510',added_food_identities=len(sources)+len(menus),source_references=len(sources),source_references_eligible=398,source_conflicts=2,restaurant_estimates=len(menus),prior_food_rows_preserved=1809,total_foods=len(foods),by_brand=dict(Counter(r['brand'] for r in menus)),source_categories=dict(Counter(r['category'] for r in sources)),household_portions_added=738,policy='FNRI first, exact other sources second, explicit Low-confidence restaurant models third. No actual branded serving mass inferred.',deployed=False)
    (DB/'2026-09-17-ph-foods-510.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
