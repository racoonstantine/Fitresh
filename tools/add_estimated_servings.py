"""Adds one clearly labelled "typical serving" to each home-style Filipino recipe estimate.

Why: these dishes are modeled mixtures with no measured household portion, so they used to open on
100 g. A serving here is the recipe's own modeled batch mass divided by an assumed number of servings
(SERVINGS below). It is an ASSUMPTION, stored with data_status ESTIMATED_SERVING and never mixed
with sourced OTHER_SOURCE_PORTION records. Restaurant and branded items are deliberately left alone:
this project does not infer branded serving masses.

Run once, then rebuild the search snapshot:  python tools/add_estimated_servings.py && python tools/build_food_search.py
Safe to re-run: existing rows are left as they are.
"""
import csv
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / 'data' / 'food-db'

# food_id -> servings the modeled batch is assumed to yield (grouped by dish type)
SERVINGS = {}
for ids, n in [
    (range(1260, 1267), 4),   # adobo viands
    (range(1267, 1269), 5),   # tinola
    (range(1269, 1274), 5),   # sinigang, nilaga
    (range(1274, 1278), 4),   # ginisang monggo
    (range(1278, 1284), 4),   # pinakbet, ginataan, laing
    (range(1284, 1289), 4),   # ginisang gulay
    (range(1289, 1291), 2),   # tortang talong
    (range(1291, 1294), 4),   # giniling, menudo
    (range(1294, 1299), 4),   # afritada, mechado, caldereta, kare-kare
    (range(1299, 1300), 4),   # bicol express
    (range(1300, 1304), 5),   # pancit
    (range(1304, 1307), 5),   # arroz caldo, goto, lugaw
    (range(1307, 1308), 4),   # tokwat baboy
    (range(1308, 1310), 1),   # silog plates are one plate
]:
    for i in ids:
        SERVINGS['FC%06d' % i] = n


def main():
    recipes = {r['food_id']: r for r in csv.DictReader(open(DB / 'filipino-recipes.csv', encoding='utf-8', newline=''))}
    path = DB / 'portions.csv'
    raw = path.read_bytes()
    newline = '\r\n' if b'\r\n' in raw else '\n'
    with open(path, encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)
    have = {r['portion_id'] for r in rows}
    added = 0
    for fid, n in SERVINGS.items():
        r = recipes.get(fid)
        if not r:
            raise SystemExit('No recipe row for ' + fid)
        pid = fid + '_SERVING_EST'
        if pid in have:
            continue
        mass = float(r['modeled_final_edible_mass_g'])
        grams = round(mass / n)
        rows.append(dict(
            portion_id=pid, food_id=fid, description='1 typical serving', quantity='1', unit='serving',
            edible_weight_g=str(grams), edible_portion_pct='', source_url='',
            data_status='ESTIMATED_SERVING',
            notes='Assumption, not a measurement: modeled batch of %g g divided into %d servings. '
                  'Real servings vary with the cook and the plate.' % (mass, n)))
        added += 1
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator=newline)
        w.writeheader()
        w.writerows(rows)
    print('estimated servings added:', added, 'of', len(SERVINGS))


if __name__ == '__main__':
    main()
