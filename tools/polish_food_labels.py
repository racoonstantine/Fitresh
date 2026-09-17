"""Add a sourced presentation layer; never rewrite original food or nutrient rows."""
import re
from collections import Counter
from food_db_sources import DB, FIELDS, load_sources, read_csv
from expand_food_db import write_csv, numeric

def main():
    fnri, _ = load_sources()
    foods = read_csv(DB/'foods.csv')
    labels = []
    for row in foods:
        if row['category'] not in ['Beverages','Milk & Dairy']: continue
        name = row['name']
        for short, long in {'jce':'juice','drnk':'drink','flvr':'flavor','flvrd':'flavored','pwdr':'powder','prep':'prepared','conc':'concentrate','sweetn':'sweetened','unsweetn':'unsweetened','choc':'chocolate','recon':'reconstituted','cnd':'canned','inst':'instant','cond':'condensed','lvs':'leaves','btl':'bottled'}.items():
            name = re.sub(r'\b'+short+r'\b',long,name,flags=re.I)
        name = name.replace('w/','with ').replace('w/o','without ')
        reason = 'Expand source abbreviations only; preserve packaging, preparation and sweetening qualifiers.'
        if row['source_food_id'] in ['Q011','Q012','Q013'] and 'FNRI' in row['source_name']:
            source = fnri[row['source_food_id']]
            name += ' (dry product)'
            reason += ' Dry-state interpretation supported by source water '+source['nutrients']['Water (g)']+' g/100 g and energy '+source['nutrients']['Energy, calculated (kcal)']+' kcal/100 g. Do not use for a brewed cup; no dilution assumed.'
        if name != row['name']:
            labels.append(dict(food_id=row['food_id'],source_name=row['name'],display_name=name,source_url=row['source_url'],data_status='REVIEWED_DISPLAY_LABEL',notes=reason))
    write_csv(DB/'food-display-labels.csv',labels)
    gaps=[]
    for row in foods:
        if 'FNRI' not in row['source_name'] or row['data_status'] not in ['VERIFIED_FNRI','PARTIAL_VERIFIED_FNRI']:continue
        source=fnri[row['source_food_id']]
        for field,(label,_,_) in FIELDS.items():
            if row[field]!='':continue
            value=source['nutrients'].get(label,'')
            # A populated source value must be reviewed explicitly, never silently patched here.
            gaps.append(dict(food_id=row['food_id'],name=row['name'],field=field,source_value=value,source_url=row['source_url'],status='SOURCE_VALUE_REQUIRES_REVIEW' if numeric(value) else 'SOURCE_MISSING',next_action='Review matching source before filling.' if numeric(value) else 'Keep blank; no exact source value in retained FNRI snapshot.'))
    write_csv(DB/'nutrient-gap-audit.csv',gaps)
    print(dict(display_labels=len(labels),missing_fields=dict(Counter(r['status'] for r in gaps))))

if __name__=='__main__':main()
