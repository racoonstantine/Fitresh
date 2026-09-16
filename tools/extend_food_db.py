"""Append the reviewed variant/source batch; never regenerate existing values."""
import csv
import hashlib
import json
import math
from decimal import Decimal
from food_db_sources import DB, RESEARCH, FIELDS, load_sources, read_csv, fnri_url, usda_url

DATE = '2026-09-16'
BATCH = '2026-09-16-variants-v1'
FNRI_VARIANTS = {
    29: ['F113'], 39: ['F157'], 43: ['F223', 'F257', 'F258'],
    54: ['G103', 'G202', 'G203'], 57: ['G113', 'G117', 'G119'],
    59: ['G037', 'G040'], 66: ['D160', 'D162'],
    71: ['D232', 'D234', 'D236'], 72: ['D232', 'D234', 'D236'],
    73: ['D242'], 80: ['E051', 'E055', 'E057'],
    84: ['E031', 'E032'], 87: ['E004', 'E005'],
    95: ['J019', 'J020', 'J022', 'J023'], 15: ['A140'],
}
USDA_VARIANTS = {
    15: ['168919', '169762'], 34: ['174030', '174036', '171794', '171799'],
    40: ['167902', '167903'], 52: ['175156', '172005'],
    66: ['170390', '170391'], 97: ['170172', '170173'], 100: ['174531'],
}
EXPECTED_USDA = {
    '168919': 'Noodles, egg, cooked, enriched, with added salt',
    '169762': 'Noodles, egg, cooked, unenriched, with added salt',
    '174030': 'Beef, ground, 90% lean meat / 10% fat, raw',
    '174036': 'Beef, ground, 80% lean meat / 20% fat, raw',
    '171794': 'Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned',
    '171799': 'Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned',
    '167902': 'Pork, fresh, ground, raw', '167903': 'Pork, fresh, ground, cooked',
    '175156': 'Fish, tuna, fresh, skipjack, raw',
    '172005': 'Fish, tuna, skipjack, fresh, cooked, dry heat',
    '170390': 'Cabbage, chinese (pak-choi), raw',
    '170391': 'Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt',
    '170172': 'Nuts, coconut milk, raw (liquid expressed from grated meat and water)',
    '170173': 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)',
    '174531': 'Sauce, fish, ready-to-serve',
}

def main():
    manifest = DB / (BATCH + '.json')
    if manifest.exists():
        print('Batch already applied. No files changed.'); return
    fnri, usda = load_sources()
    for key, name in EXPECTED_USDA.items():
        assert usda[key]['description'] == name, key
    names = ['foods.csv', 'aliases.csv', 'portions.csv', 'changes.csv', 'verification-evidence.csv', 'review-queue.csv']
    tables = {name: read_csv(DB / name) for name in names}
    baseline = {name: (DB / name).read_bytes() for name in names}
    foods = tables['foods.csv']; headers = list(foods[0]); original = {r['food_id']: dict(r) for r in foods}
    aliases = tables['aliases.csv']; portions = tables['portions.csv']; changes = tables['changes.csv']
    evidence = tables['verification-evidence.csv']
    variants = []; other = []; estimates = []; estimate_inputs = []; source_checks = []
    used = {r['food_id'] for r in foods}; next_id = max(int(i[2:]) for i in used) + 1

    def blank_food(parent, name, status):
        nonlocal next_id
        row = {h: '' for h in headers}
        row.update(food_id=f'FC{next_id:06d}', name=name, category=original[parent]['category'],
                   basis='per 100 g edible portion', data_status=status, active='True',
                   verification_date=DATE, notes='Specific variant. Do not substitute automatically for its broad parent.')
        next_id += 1
        return row

    def link(parent, row, note):
        variants.append(dict(parent_food_id=parent, variant_food_id=row['food_id'],
                             selection_label=row['name'], relationship='EXPLICIT_SELECTION_REQUIRED', notes=note))

    def reference_portion(row, source):
        portions.append(dict(portion_id=row['food_id']+'_100G_EP',food_id=row['food_id'],
            description='100 g edible portion',quantity='100',unit='g',edible_weight_g='100',
            edible_portion_pct=row['edible_portion_pct'],source_url=source,
            data_status='VERIFIED_REFERENCE_BASIS',notes='Mass reference only; does not verify nutrient values or a household serving.'))

    def add(row):
        foods.append(row)
        for field, value in row.items():
            if value:
                changes.append(dict(date=DATE,food_id=row['food_id'],field=field,old_value='',new_value=value,
                    reason='Add explicitly named variant; '+BATCH,source_url=row['source_url']))
        for a in dict.fromkeys([row['name']] + [x.strip() for x in row['aliases'].split(';') if x.strip()]):
            aliases.append(dict(food_id=row['food_id'],alias=a,source_url=row['source_url'],
                data_status='SEARCH_ALIAS_REVIEWED',notes='Explicit variant; preserve preparation and type qualifiers.'))
        reference_portion(row, row['source_url'])

    fnri_rows = {}
    for parent_num, codes in FNRI_VARIANTS.items():
        parent = f'FC{parent_num:06d}'
        for code in codes:
            if code not in fnri_rows:
                source = fnri[code]; row = blank_food(parent,source['name'],'')
                row.update(source_name='DOST-FNRI PhilFCT',source_food_id=code,source_url=fnri_url(source),
                    source_food_name=source['name'],edible_portion_pct=source['meta'][3].rstrip('%'),
                    verification_notes='Official FNRI snapshot checked; use the exact source description. Unqualified preparation is as listed by FNRI.')
                common = source['meta'][2]
                row['aliases'] = common if common not in ['', '-', 'N/A'] else ''
                for field, (label, _, _) in FIELDS.items():
                    value=source['nutrients'].get(label,'')
                    try:
                        if math.isfinite(float(value)) and float(value)>=0: row[field]=value
                    except ValueError: pass
                    evidence.append(dict(food_id=row['food_id'],source_food_id=code,field=field,
                        source_value=value,source_url=row['source_url'],accessed_date=DATE))
                row['data_status']='VERIFIED_FNRI' if all(row[k] for k in FIELDS) else 'PARTIAL_VERIFIED_FNRI'
                if code=='A140': row['verification_notes'] += ' Dry noodles; not interchangeable with cooked egg noodles.'
                add(row); fnri_rows[code]=row
            link(parent,fnri_rows[code],'Choose the source preparation, cut, cultivar or plant part. Parent remains unresolved.')

    def other_row(food_id, code, eligible):
        source=usda[code]
        r=dict(other_source_id='USDA_'+food_id+'_'+code,food_id=food_id,
            source_name='USDA FoodData Central SR Legacy',source_food_id=code,source_food_name=source['description'],
            source_url=usda_url(code),accessed_date=DATE,source_release='SR Legacy April 2018; FDC publication '+source['publication_date'],
            data_status='REVIEWED_OTHER_SOURCE',match_status='MATCHED_FOOD_AND_PREPARATION',
            eligible_fields=';'.join(eligible),basis='per 100 g edible portion')
        for field, (_, nutrient_id, _) in FIELDS.items(): r[field]=source['nutrients'].get(nutrient_id,{}).get('amount','')
        r['notes']='Official reference composition, not a measurement of the user\'s food. Missing source nutrients remain blank.'
        other.append(r)
        return r

    def household_portions(row, code):
        for p in usda[code]['portions']:
            if not p['amount'] or not p['gram_weight'] or float(p['gram_weight'])<=0: continue
            description=p['modifier'] or p['portion_description']
            if not description: continue
            portions.append(dict(portion_id=row['food_id']+'_USDA_'+p['id'],food_id=row['food_id'],
                description=p['amount']+' '+description,quantity=p['amount'],unit=description,
                edible_weight_g=p['gram_weight'],edible_portion_pct='',source_url=usda_url(code),
                data_status='OTHER_SOURCE_PORTION',notes='USDA SR Legacy portion ID '+p['id']+'. Gram weight applies to the entire stated quantity, not one unit. Applies only to '+usda[code]['description']+'. Food size varies.'))

    for parent_num,codes in USDA_VARIANTS.items():
        parent=f'FC{parent_num:06d}'
        for code in codes:
            source=usda[code]; row=blank_food(parent,source['description'],'OTHER_SOURCE_AVAILABLE')
            row.update(source_name='USDA FoodData Central SR Legacy',source_food_id=code,
                source_food_name=source['description'],source_url=usda_url(code),
                verification_notes='Nutrients live in other_food_values.csv; no USDA values labeled as FNRI.')
            add(row); other_row(row['food_id'],code,list(FIELDS)); household_portions(row,code)
            link(parent,row,'Explicit USDA variant. Cooked egg noodles are not asserted to be Filipino canton. Generic ground pork is the USDA reference composition, not a known fat percentage.')

    # Limit supplemental values to the exact reviewed nutrient; retain every FNRI value.
    for food_id,code in [('FC000049','175176'),('FC000053','175159')]:
        r=other_row(food_id,code,['cholesterol_mg_100g'])
        r['notes']+=' Raw tilapia / yellowfin match. Only cholesterol is eligible; other USDA fields are evidence, not replacements.'
        source_checks.append(dict(food_id=food_id,source_food_id=code,source_url=usda_url(code),
            outcome='ACCEPT_CHOLESTEROL_ONLY',reason=r['notes'],reviewed_date=DATE))

    # Evidence-based estimates. Explicit selection is required; none are a parent default.
    def estimate(food_id, estimate_id, method, assumptions, source_urls):
        r=dict(estimate_id=estimate_id,food_id=food_id,method=method,
            basis='per 100 g edible portion',**{k:'' for k in FIELDS},
            source_urls=source_urls,estimated_date=DATE,model='Codex (GPT-6)',
            method_version='1.0',review_status='AI_REVIEWED_NOT_HUMAN_VERIFIED',
            selection_policy='EXPLICIT_ESTIMATE_SELECTION',assumptions=assumptions,
            range_low_json='',range_high_json='',range_basis='Not quantified; no evidence-based uncertainty bounds available.',
            limitations='Estimate, not a laboratory or manufacturer value.')
        estimates.append(r); return r
    proxy=estimate('FC000022','EST_PEANUT_SUGAR_V1','COMPARABLE_FOOD',
        'Use USDA unsalted dry-roasted peanuts as a sugar proxy for FNRI roasted skinless peanuts. Roast method and skin inclusion differ; only sugar is estimated.',usda_url('173806'))
    proxy['sugar_g_100g']=usda['173806']['nutrients']['2000']['amount']
    estimate_inputs.append(dict(estimate_id=proxy['estimate_id'],input_name='sugar_g_100g',input_value=proxy['sugar_g_100g'],unit='g per 100 g',source_food_id='173806',source_url=usda_url('173806'),input_status='USDA_COMPARABLE_FOOD',notes='Direct proxy; not an exact preparation match.'))

    row=blank_food('FC000015','Canton noodles, cooked in water, 2.5x dry-weight yield (estimate)','ESTIMATE_ONLY')
    row.update(source_name='AI-assisted calculation from DOST-FNRI A140',source_food_id='A140',
        source_url=fnri_url(fnri['A140']),source_food_name=fnri['A140']['name'],
        verification_notes='Assumed cooked yield. Select EST_CANTON_YIELD_V1 explicitly; weigh dry and final cooked food for a meal-specific result.')
    add(row); link('FC000015',row,'Assumed-yield wheat canton estimate; not an exact egg-noodle identity match.')
    calculated=estimate(row['food_id'],'EST_CANTON_YIELD_V1','COOKED_YIELD_CALCULATION',
        '100 g FNRI A140 dry wheat canton plus retained cooking water produces 250 g edible cooked noodles. No oil or sauce. Assume 100% nutrient retention. Yield and retention are assumptions, not measured values.',row['source_url'])
    calculated['limitations']+=' Draining can remove soluble nutrients; actual water uptake varies. Do not use for stir-fried canton or noodles with seasonings.'
    for field,(label,_,_) in FIELDS.items():
        source_value=fnri_rows['A140'][field]
        if source_value:
            calculated[field]=str((Decimal(source_value)/Decimal('2.5')).quantize(Decimal('0.01')))
            estimate_inputs.append(dict(estimate_id=calculated['estimate_id'],input_name=field,input_value=source_value,
                unit='per 100 g dry edible noodles',source_food_id='A140',source_url=row['source_url'],input_status='VERIFIED_FNRI',notes=label))
    for key,value,unit in [('dry_edible_weight','100','g'),('final_cooked_edible_weight','250','g'),('nutrient_retention','1','fraction')]:
        estimate_inputs.append(dict(estimate_id=calculated['estimate_id'],input_name=key,input_value=value,unit=unit,
            source_food_id='',source_url='',input_status='AI_ASSUMPTION',notes='Not a measured or externally verified yield/retention.'))

    for food_id,code,reason in [
        ('FC000100','174531','Rejected sugar fallback: USDA sugar 3.64 g exceeds FNRI total carbohydrate 0.9 g. Formulation mismatch. Added a separate USDA variant.'),
        ('FC000097','170172','Water dilution is unspecified in FNRI coconut milk. Added explicit USDA fresh/canned variants instead of filling sugar.'),
        ('FC000023','170590','USDA dried pili also lacks fiber and sugars. Drying status differs; no missing values filled.'),
        ('FC000022','173806','Roast method and skin inclusion differ. Sugar retained only as an explicitly selected estimate.')]:
        source_checks.append(dict(food_id=food_id,source_food_id=code,source_url=usda_url(code),outcome='NO_AUTOMATIC_FALLBACK',reason=reason,reviewed_date=DATE))
    for q in tables['review-queue.csv']:
        ids=[v['variant_food_id'] for v in variants if v['parent_food_id']==q['food_id']]
        q.update(available_variant_ids=';'.join(ids),next_action='Select an explicit variant; broad entry remains unresolved.' if ids else 'Specify species and preparation; no matching dried-herring record established.')
    tables.update({'food_variants.csv':variants,'other_food_values.csv':other,'food_estimates.csv':estimates,
        'estimate_inputs.csv':estimate_inputs,'other-source-review.csv':source_checks})
    registry=[]
    for key,name,url,path,release in [
        ('FNRI_20260916','DOST-FNRI PhilFCT','https://i.fnri.dost.gov.ph/fct/library/search_item',RESEARCH/'fnri-search-2026-09-16.html','PhilFCT official catalog snapshot'),
        ('USDA_SR_2018','USDA FoodData Central SR Legacy','https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',RESEARCH/'usda-sr-legacy-2018.zip','April 2018 SR Legacy')]:
        registry.append(dict(source_id=key,source_name=name,source_url=url,accessed_date=DATE,release=release,
            local_snapshot=str(path.relative_to(DB.parent.parent)).replace('\\','/'),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    tables['sources.csv']=registry
    assert all(next(r for r in foods if r['food_id']==fid)==r for fid,r in original.items())
    assert len({r['food_id'] for r in foods})==len(foods)
    for name in tables:
        if name not in baseline: assert not (DB/name).exists(), 'Refuse to overwrite '+name
    # Preflight complete before writing. Preserve exact pre-batch inputs for audit/recovery.
    backup=RESEARCH/BATCH; backup.mkdir(exist_ok=True)
    for name,content in baseline.items():
        target=backup/name
        if target.exists(): assert target.read_bytes()==content
        else: target.write_bytes(content)
    for name,records in tables.items():
        if name in baseline: assert (DB/name).read_bytes()==baseline[name], 'Input changed during run: '+name
        temp=DB/(name+'.tmp')
        with temp.open('w',encoding='utf-8',newline='') as f:
            w=csv.DictWriter(f,fieldnames=list(records[0])); w.writeheader(); w.writerows(records)
        temp.replace(DB/name)
    result=dict(batch=BATCH,original_foods_preserved=len(original),new_foods=len(foods)-len(original),
        fnri_variants=len(fnri_rows),usda_variants=sum(map(len,USDA_VARIANTS.values())),
        estimates=len(estimates),other_source_rows=len(other),variant_links=len(variants),
        household_portions=sum(p['data_status']=='OTHER_SOURCE_PORTION' for p in portions),
        automatic_nutrient_gaps_filled=2,broad_foods_left_unresolved=len(tables['review-queue.csv']))
    manifest.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8'); print(json.dumps(result,indent=2))

if __name__=='__main__': main()
