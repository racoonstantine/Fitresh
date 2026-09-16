"""Read primary-source snapshots without network access or inferred nutrients."""
import csv
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data/food-db'
RESEARCH = ROOT / 'Food_DB/research'
FIELDS = {
    'kcal_100g': ('Energy, calculated (kcal)', '1008', 'KCAL'),
    'protein_g_100g': ('Protein (g)', '1003', 'G'),
    'carbs_g_100g': ('Carbohydrate, total (g)', '1005', 'G'),
    'fat_g_100g': ('Total Fat (g)', '1004', 'G'),
    'fiber_g_100g': ('Fiber, total dietary (g)', '1079', 'G'),
    'sugar_g_100g': ('Sugars, total (g)', '2000', 'G'),
    'sodium_mg_100g': ('Sodium, Na (mg)', '1093', 'MG'),
    'cholesterol_mg_100g': ('Cholesterol (mg)', '1253', 'MG'),
}

def read_csv(path):
    with Path(path).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def load_sources():
    fnri = json.loads((RESEARCH / 'catalog.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(RESEARCH / 'usda-sr-legacy-2018.zip') as z:
        def table(name):
            member = next(n for n in z.namelist() if n.endswith('/' + name))
            with z.open(member) as f:
                return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig')))
        usda = {r['fdc_id']: dict(r, nutrients={}, portions=[]) for r in table('food.csv')}
        definitions = {r['id']: r for r in table('nutrient.csv')}
        for _, nutrient_id, unit in FIELDS.values():
            assert definitions[nutrient_id]['unit_name'].upper() == unit
        wanted = {n for _, n, _ in FIELDS.values()}
        for r in table('food_nutrient.csv'):
            if r['nutrient_id'] in wanted:
                food = usda[r['fdc_id']]
                assert r['nutrient_id'] not in food['nutrients']
                food['nutrients'][r['nutrient_id']] = r
        for r in table('food_portion.csv'):
            usda[r['fdc_id']]['portions'].append(r)
    return fnri, usda

def fnri_url(record):
    return 'https://i.fnri.dost.gov.ph/fct/library/report/' + record['report']

def usda_url(fdc_id):
    return 'https://fdc.nal.usda.gov/food-details/' + fdc_id + '/nutrients'
