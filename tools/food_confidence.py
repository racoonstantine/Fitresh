"""Reference confidence, not a statistical accuracy score or meal-match guarantee."""
def classify(row, nutrients, chosen=None):
    missing=[k for k,n in nutrients.items() if n['value_per_100g'] is None]
    estimated=any(n['label']=='Estimated' for n in nutrients.values())
    if estimated:
        level='Medium' if chosen and chosen['method']=='LABEL_WEIGHT_UNIT_INFERENCE' else 'Low'
        reason='Manufacturer values; serving gram unit inferred, not printed.' if level=='Medium' else 'Modeled recipe, cooking yield or food proxy; actual composition and serving may differ.'
    elif row['data_status']=='ESTIMATE_ONLY':
        level='Low';reason='Estimate available only by explicit selection; default nutrition unavailable.'
    elif len(missing)==len(nutrients):
        level='Unrated';reason='Identity unresolved, source conflict, or no usable nutrition.'
    else:
        level='Medium' if missing else 'Good'
        reason='Matched reference source; some tracked nutrients are unknown.' if missing else 'Matched reference source with all tracked nutrients available.'
    return dict(level=level,reason=reason,policy_version='1.0',scope='Reference evidence and completeness; not an accuracy percentage or guarantee for your meal.',missing_fields=missing)
