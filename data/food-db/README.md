# Food database verification

Reviewed 2026-09-16 against the official DOST-FNRI PhilFCT catalog:
https://i.fnri.dost.gov.ph/fct/library/search_item

The requested directory was absent. This database continues the 100-row starter
at `Food_DB/foods.csv`. That original CSV and its review workbook are unchanged.
The workbook is a historical starter, not a synchronized view of this directory.

## Current coverage

The 500-food expansion is complete: **647 food identities total**. All 147
pre-expansion records are preserved, along with their aliases, portions,
change history and nutrient evidence. No AI estimates count toward the 500.

Five reviewed batches add 100 foods each:

| Batch | Added | All 8 nutrients | Partial nutrients |
| --- | ---: | ---: | ---: |
| Staples, grains, bakery, roots, legumes and nuts | 100 | 95 | 5 |
| Vegetables and their preparations | 100 | 85 | 15 |
| Meat, poultry and eggs | 100 | 74 | 26 |
| Fish and seafood | 100 | 54 | 46 |
| Fruit, dairy, condiments, prepared foods, oils and beverages | 100 | 78 | 22 |
| Total new foods | 500 | 386 | 114 |

Every addition has numeric energy, protein, total carbohydrate and fat from
FNRI. Other missing nutrients stay blank. All additions were reconciled to the
retained official HTML snapshot using a second parser. The source access date
and snapshot hash remain attached to the evidence; no fresh laboratory analysis
is implied. USDA supplementation was unnecessary for this batch.

Current source statuses: 477 fully verified FNRI, 135 partially verified FNRI,
19 unresolved broad names, 15 other-source identities and one estimate-only.
Default resolution supplies some nutrients for 627 foods and all eight for 490.
The two existing opt-in estimates and 23 USDA household portions are unchanged.
The expansion adds 500 reference portions of 100 g edible food, not invented
household serving weights.

`expansion-500.csv` identifies every addition and batch. `expansion-500-exclusions.csv`
lists 12 excluded candidates: eight records with duplicate official descriptions
and four with sugar exceeding total carbohydrate. They were not counted toward
the 500. `2026-09-16-expand-500.json` records batch checks and counts.
Selection prioritizes common food families and useful preparation variants;
it is an editorial selection, not a measured top-500 consumption ranking.
Preserve qualifiers such as canned, uncooked, drained and skin removed.
For example, canned adobo is not a verified recipe for home-cooked adobo.

The prior 147-row inputs are retained under `Food_DB/research/2026-09-16-expand-500/`.
`tools/expand_food_db.py` applies the expansion only once and refuses to overwrite
an applied batch. Current catalog/coverage exports have been rebuilt.

## Second-pass history (before the 500-food expansion)

The second pass adds explicit variants without choosing defaults for broad names.
That pass produced 147 food identities: the original 100 unchanged, plus 31 FNRI
variants, 15 USDA variants and one assumed-yield cooked-canton variant.
The 19 broad entries remain unresolved as requested. Eighteen have linked
alternatives; dried herring still needs a species/preparation match.

The original/source status counts are 91 fully verified FNRI, 21 partially
verified FNRI, 19 unresolved, 15 with other-source data and one estimate-only.
The default resolver supplies at least some nutrients for 127 foods and all
eight nutrients for 104. It fills two original cholesterol gaps from USDA
(raw tilapia and raw yellowfin), without writing over the FNRI table.

New files:

- `food_variants.csv`: explicit choices linked to broad parent IDs. Shared sitaw alternatives use one variant ID each.
- `other_food_values.csv`: 17 USDA reference records, including 15 named variants and two nutrient-specific supplements.
- `food_estimates.csv`: two AI-assisted estimates, with methods, assumptions, model/version, dates and review status.
- `estimate_inputs.csv`: source values and assumptions used to reproduce each estimate.
- `other-source-review.csv`: accepted and rejected supplemental matches and reasons.
- `sources.csv`: source releases, URLs, access dates, snapshot paths and SHA-256 hashes.
- `coverage.csv`: current missing nutrients and available variant/estimate choices for every food.
- `food_catalog.json`: generated application data, with a source and label for every nutrient, portions, variant links and explicitly separate estimate results.
- `coverage-summary.json`: current coverage counts. `verification-summary.json` remains the historical first-pass summary.
- `2026-09-16-variants-v1.json`: second-pass change counts. Pre-batch CSVs are retained under `Food_DB/research/2026-09-16-variants-v1/`.

`portions.csv` now also contains 23 USDA portion weights, attached only to the
specific USDA variants. The amount and modifier are preserved together: a
portion labeled **3 oz** has the source's weight for all 3 oz, not for one oz.
Weights such as cups, fillets and heads are reference measures; actual sizes vary.

## First-pass results and original files

- `foods.csv`: 67 fully verified, 14 partially verified, 19 needing food identity clarification.
- `aliases.csv`: 312 canonical names and search aliases, keyed by food ID.
- `portions.csv`: 81 verified 100 g edible reference weights. These are not household serving estimates.
- `changes.csv`: field-level old/new values, reasons, dates and source URLs.
- `verification-evidence.csv`: all eight source nutrient values for each matched food, including original missing-value markers.
- `review-queue.csv`: specific identity questions for the 19 unresolved foods.
- `verification-summary.json`: counts and hashes of the starter and official source snapshot.

559 previously blank nutrient cells were filled. Every previously populated
nutrient value was preserved exactly, including its precision. All food IDs,
categories, original notes and active flags were preserved. Source URLs were
reconciled to the official catalog's record links and all changes were logged.
In particular, the starter hard-curd tofu URL pointed at a lime report; the
updated URL follows C064 in the official catalog.

## Interpretation

All nutrient columns are per 100 g edible portion, in the units named in their
headers. Blank is unknown, never zero. A dash or absent nutrient in FNRI stays
blank. `VERIFIED_FNRI` means all eight nutrient fields agree with the official
catalog. `PARTIAL_VERIFIED_FNRI` means available values agree, but one or more
nutrients are missing. `NEEDS_FOOD_IDENTITY_VERIFICATION` means no sufficiently
specific match was established. Verification date records the review date;
it does not imply the underlying laboratory data are new.

Use `source_food_name` to retain the exact food description, including skin,
plant part and preparation. Dry rice must not be used as cooked rice. Generic
foods were not silently assigned a species, cultivar, cut, fat level or recipe.
Broad identities must be resolved before assigning nutrients. Partial records
still require further evidence for their missing nutrients, except the two
reviewed USDA cholesterol supplements available through the resolver.

`edible_portion_pct` is the edible fraction of as-purchased weight, not a serving
size. Nutrients for weighed edible food scale by edible grams / 100. Only when
starting from an appropriate as-purchased weight should edible grams be obtained
by multiplying by edible_portion_pct / 100. No cups, pieces or tablespoons were
invented. The second pass adds documented USDA household weights for explicit
variants only. Further household weights require a source or measurement.

Aliases are search aids, not guarantees of identical food identity. Commas in
official common names retain preparation qualifiers. Existing aliases were
preserved except two documented identity corrections: Tulingan belongs to
frigate tuna, and Bataw belongs to hyacinth bean. Generic `tuna` was also removed
from the unresolved skipjack entry. Sitaw entries remain separate IDs pending
clarification; do not silently merge them or select the first alias match.

## Evidence and future edits

The official HTML snapshot and parsed catalog are under `Food_DB/research/`.
The inspection script extracts explicit labels and numbers without calculating
missing nutrients. The build script refuses to overwrite an existing reviewed
database. It checks stable IDs, portion references and preservation of all
existing nutrient values. Hashes in the summary identify the exact inputs.

For future edits, compare by food ID. Fill blanks only from an identity-matched
source. Before replacing a manually verified value, append the old value, new
value, evidence, reason and date to the change log. If evidence conflicts and
the intended variant is unresolved, retain the value and flag the conflict.
Keep source missing-value markers in the evidence file. Do not regenerate this
database from the older starter over later manual edits.

## Fallback policy and estimates

The resolver in `tools/resolve_food.py` applies the priority **per nutrient**:

1. A populated verified/manual value in `foods.csv`, including a real zero.
2. A reviewed other-source value for the same food/preparation and explicitly eligible nutrient.
3. A selected estimate belonging to that exact food ID.
4. Unknown (`null` in JSON, blank in CSV).

An unresolved parent never inherits a child's numbers. Select a variant ID.
Competing eligible sources require review instead of taking the first row.
Incomplete results keep their missing nutrients visible. The overall result
label is `Estimated` if any field is estimated, otherwise `Other source` if any
field comes from that tier, otherwise `Verified`. Completeness is a separate
flag: `Verified` does not imply all eight nutrients are available.

Current estimates are explicitly **AI reviewed, not human verified**:

- `EST_PEANUT_SUGAR_V1`: 4.9 g sugar per 100 g from USDA unsalted dry-roasted
  peanuts, offered only as a proxy for FNRI roasted skinless peanuts. Roast
  method and skin inclusion differ. All other nutrients remain FNRI values.
- `EST_CANTON_YIELD_V1`: FNRI A140 dry canton nutrients divided by 2.5, assuming
  100 g dry noodles yields 250 g cooked edible noodles with water alone and
  100% nutrient retention. Neither yield nor retention is measured. Draining,
  seasonings and oil can materially change the result. This is a named scenario,
  not a generic default for egg noodles or pancit canton.

No statistical confidence or plausible ranges were invented. Range fields are
blank because supporting uncertainty data are unavailable. Recipe/yield inputs
marked `AI_ASSUMPTION` must not be presented as facts from FNRI or USDA.

Fish-sauce sugar was rejected as a fallback because the USDA value exceeds the
FNRI entry's total carbohydrates, indicating an incompatible formulation.
Coconut-milk dilution is unspecified, so USDA fresh/canned variants are separate.
USDA dried pili also lacks fiber and sugars; these gaps remain unknown.

## Rebuilding and validation

Run `tools/test_food_db.py` for preservation, source reconciliation, precedence,
zero/blank handling, explicit estimate selection, variant isolation, portions
and invalid-input checks. `tools/export_food_catalog.py` rebuilds only derived
catalog/coverage files from the curated CSVs. `tools/extend_food_db.py` applies
this append-only batch once, then exits without changes on subsequent runs.

The JSON is prepared for application integration. This batch does not change
the current PHP food search, logging screens or live database. Any integration
must preserve per-nutrient provenance and require explicit variant/estimate
selection; do not flatten a mixed result into a fully verified record.
