# Food database verification

Reviewed 2026-09-16 against the official DOST-FNRI PhilFCT catalog:
https://i.fnri.dost.gov.ph/fct/library/search_item

The requested directory was absent. This database continues the 100-row starter
at `Food_DB/foods.csv`. That original CSV and its review workbook are unchanged.
The workbook is a historical starter, not a synchronized view of this directory.

## Current coverage

The **2026-09-18 world-cuisine batch adds 54 identities**, bringing the catalog
to **2,873 foods**, **2,534 default-searchable references**, **315 explicit
estimates**, and **6,079 aliases**. The 54 additions comprise 20 exact USDA SR
Legacy reference records, 10 modeled dishes, and 24 restaurant models. No new
exact FNRI match was identified for this selection; retained FNRI sources still
take priority for ingredient values. All 2,819 pre-batch food rows and existing
nutrition, source, portion and estimate records are preserved.

Restaurant additions cover Botejyu, Panda Express, Royal Indian Curry House by
Swaadisht (Muntinlupa listing), Mister Kabab, Banana Leaf and Shake Shack.
Generic additions cover Japanese, Chinese, Indian, Middle Eastern and
Singaporean dishes; American food is represented by the Shake Shack models.
Naan, hummus, falafel, teriyaki sauce and Chinese soups have exact historical
USDA identities, not claimed Philippine brand equivalence. Malaysian dishes on
Banana Leaf's menu retain their Malaysian identities.

The 34 models are **Low confidence**, not human-verified restaurant nutrition.
Sources establish dish/menu identity only. The 211 component weights are
explicit assumptions; cooking yield, recipe proportions and proprietary sauces
remain unverified. Unknown nutrients remain blank. Models support weighed grams
only and require explicit estimate selection; they are excluded from default
app search. The 28 new household weights belong only to exact USDA references.
No production deployment was performed.

Batch records: `world-expansion-54.csv`, `world-reference-review.csv`,
`world-identity-review.csv`, `world-online-source-audit.csv`,
`world-estimate-components.csv`, and `2026-09-18-world-foods-54.json`.
Reproducible builders are `tools/world_food_sources.py`,
`tools/world_food_plans.py` and `tools/expand_world_foods.py`; integrity checks
are in `tools/test_world_foods.py`. The active immutable search snapshot is
`491cd9c83ec97255ba0647b5`. Existing meal snapshots remain unchanged.

### Previous bilingual and regional updates

Search displays the first FNRI common name alongside the complete English
identity when they differ (for example, `Sayote bunga, nilaga · Chayote fruit,
boiled`). Common names may be Tagalog or another regional/source name; no
language is guessed. Foods lacking a source common name retain their existing
label. Original names and nutrition remain unchanged. This display metadata
travels in the immutable catalog snapshot and new recent/favorite entries.

The bilingual search update adds 522 source-derived aliases (5,969 total),
including common-name discovery terms without comma qualifiers, such as
`Repolyo`. Shared terms return separate fully qualified choices, never a merged
food. 1,077 catalog identities have official FNRI common names; this does not
mean every food has a Tagalog translation. Historical cached snapshots remain
unchanged and may keep their older English-only display until reselected.

The **2026-09-18 regional batch adds 500 identities**, bringing the database to
**2,819 foods**, **2,514 default-searchable references**, and **281 explicit
estimates**. All 2,319 pre-batch food rows and prior nutrient/portion/estimate
records are preserved. No manually verified nutrient value was overwritten.

The additions are **250 FNRI references**, **150 USDA references**, **30 regional
dish estimates**, and **70 restaurant estimates**: Gerry's Grill 25, Max's
Restaurant 25, and Giligan's 20. The 400 references cover local produce, seafood,
fruit, legumes, grains, meats and prepared foods; they are not 400 restaurant
dishes. Raw, boiled, dried, canned and source-specific preparations remain
distinct. USDA records remain qualified historical SR Legacy references, not
Philippine brand formulations. FNRI values were checked against the retained
2026-09-16 primary snapshot, not represented as newly measured nutrition.

Regional models cover Ilocos, Cagayan Valley, Iloilo/Negros, Bicol, Mindanao,
Cordillera and Visayas. Examples include poqui-poqui, dinengdeng, batil patung,
sinanta, patupat, batchoy, Pancit Molo, KBL, kansi, pinangat, kinalas, sinantolan,
pastil, piaparan, linigid, palapa, dodol, pinikpikan, humba and bam-i. These are
specified reference mixtures, not authoritative regional recipes. Ingredient
substitutions and missing nutrients are documented. Menu/tourism pages support
identity only; **all 100 new models remain Low-confidence, explicitly selected
estimates excluded from default application search**. No official restaurant
nutrition panel or actual order weight is claimed.

This batch adds **234 source-recorded household portions** and **613 frozen
ingredient rows**. The 100 g reference basis is not a household serving. Unknown
weights do not enable pieces, bowls or ml conversion. Local-name and spelling
aliases preserve separate identities; new alias audit dates are 2026-09-18.

Batch files: `regional-expansion-500.csv`, `regional-estimate-components.csv`,
`regional-identity-review.csv`, `regional-online-source-audit.csv`,
`regional-source-exclusions.csv`, and `2026-09-18-regional-foods-500.json`.
Confidence tables, catalog export and immutable search snapshot are rebuilt.
Validation: 22 existing plus 5 expansion Python tests and PHP/JavaScript search
and measurement regression checks passed. The batch is local, not deployed.

## Previous restaurant and sweets batch (historical counts)

The latest Philippine restaurant/sweets batch adds **510 identities**, bringing
the catalog to **2,319 foods**, **2,114 default-searchable references**, and **181
explicit estimates**. All 1,809 prior food rows remain unchanged.

This batch includes 49 FNRI and 351 USDA references, plus 110 Low-confidence
restaurant estimates: Jollibee 25, McDonald's 25, KFC 16, Mang Inasal 12, Chowking
16, Ramen Kuroda 12, and Ramen Nagi 4. The source additions focus on sweets,
desserts, bakery foods, snacks, spreads, dairy and supporting ingredients.
USDA entries are exact historical reference foods, not verified Philippine
restaurant formulations. Source IDs and names are retained; all nutrients are
checked against the retained primary snapshots. Some generic source recipes may
resemble existing Filipino dishes but remain qualified by their source identity.

`ph-restaurant-estimates.csv` is the restaurant directory; its menu links establish
identity only. `ph-restaurant-components.csv` freezes 475 assumed component weights
and their source nutrition. Full Philippine manufacturer panels were not obtained.
Menu availability and customization vary. Ramen models include all modeled broth;
they do not establish the mass of a real bowl. No restaurant piece, scoop, bucket
or order weight has been invented, and combo-size repetitions do not inflate the
count. These models remain explicitly selected estimates, excluded from default
application search. Source audit: `ph-restaurant-source-audit.csv`.

Two newly imported FNRI records (seasoned roasted pork skin and canned tuna spread)
report sugar above carbohydrate. Original numbers remain intact; both are blocked
from default nutrition resolution and flagged in `ph-source-conflicts.csv`, with
status changes documented in `changes.csv`. Thus 398 of the 400 source references
are eligible. The batch adds 738 source-backed household portions. Palaman and
brand-spelling discovery aliases preserve separate food identities.

`2026-09-17-ph-foods-510.json` records the completed batch. Validation now includes
22 Python tests plus PHP/JavaScript search and measurement checks. The new assets
are local and have not been deployed.

## Previous personal-food batch (historical counts)

As of 2026-09-17, the personal-food expansion adds **500 identities**: 40 FNRI,
440 USDA, one Hawaii Seafood Council blue-marlin reference, and 19 explicit
estimates. Total: **1,809 foods**, **1,716 default-searchable**, **71 opt-in
estimates**, and **1,223 source-backed household portions**. All 1,309 pre-batch
food rows remain unchanged. The source phase added 904 portions and the fish
label added one. Separate manifests record the 480-source and 20-special phases.

`food-confidence.csv` tags every identity Good, Medium, Low or Unrated;
`estimate-confidence.csv` tags each selected estimate. The resolver, JSON export,
search snapshot and both application search screens expose these labels.
Good means a matched reference with all eight tracked nutrients; Medium means
missing tracked nutrients or the explicitly documented Athlene serving-unit
inference; Low means a recipe/proxy estimate; Unrated means no usable evidence.
These are evidence/completeness labels, not measured error percentages or a
guarantee that a reference matches a particular meal. Review dates do not imply
new laboratory measurements; the USDA source remains SR Legacy 2018.

`personal-food-coverage.csv` maps the requested foods, including existing chia,
yogurt and boiled-vegetable records reused without duplicate identities. Kenny
Rogers and Chooks-to-Go values are assumed ingredient/proxy models, not official
nutrition panels. Athlene Chocolate and Strawberry use manufacturer serving
values, but the panel omits the serving mass unit; inferred grams therefore
remain opt-in estimates. Missing fiber remains unknown. Blue marlin is modeled
from the correct species, not swordfish. Original label facts and snapshot hashes
are retained in `external-label-facts.csv` and `personal-online-source-evidence.json`.

`estimated-egg-portions.csv` includes small, medium, large, extra-large and jumbo
scrambled-egg equivalents. Only the source's 61 g large-egg portion is a measured
reference; other sizes are raw-size-ratio estimates kept outside automatic
household conversions. Restaurant entries have no invented scoop or piece
weights. “Thick yogurt” remains ambiguous until fat, flavor and style are chosen.

New estimate calculations are frozen in `personal-estimate-components.csv`;
`changes.csv` documents the pre-release coleslaw correction from an erroneous
cucumber ingredient link to green cabbage. No prior manually verified value
was overwritten. Estimates require explicit selection through the resolver or
export; they are not silently enabled in default application search.

Validation: Python source/preservation/arithmetic tests, PHP search/measurement
tests and JavaScript search/measurement tests. Assets are generated locally;
no deployment or authenticated production meal-save test is claimed.

## Previous Filipino-dish batch (historical counts)

The Filipino-dish batch adds **50 opt-in ingredient-based recipe estimates**, for
**1,309 identities** total. All 1,259 prior food rows and all prior nutrient,
portion and estimate records are preserved. The 50 new variants contain 406
explicit component weights. They cover adobo, tinola, sinigang, nilaga, monggo,
pinakbet, ginataan, laing, vegetable dishes, menudo, afritada, mechado, kaldereta,
kare-kare, Bicol Express, pancit, porridge, tokwa and two silog combinations.

**These are model-designed reference mixtures, not verified FNRI dish values or
published standardized recipes.** Component nutrient values come from the existing
source-backed food records, with FNRI preferred. Component amounts, retention and
final yield are assumptions. Mostly cooked component weights are summed with
retained water/sauce. No raw-to-cooked yield, standard bowl or cup weight is claimed.
Raw aromatics, egg preparation and tamarind proxies are documented in each estimate.
If any component lacks a nutrient, the dish's corresponding nutrient stays unknown.

`filipino-recipes.csv` lists all 50 variants and their estimate IDs.
`recipe-ingredients.csv` freezes every component weight, nutrient value and
per-nutrient source reference. `food_estimates.csv` contains the calculated values.
`filipino-dish-source-audit.csv` records why related canned/source dishes were not
substituted for these formulations. Existing aliases remain separate choices.

The catalog has 52 explicit estimates (including the prior two), and default
app search still offers 1,235 source-backed foods. The new recipe estimates are
available through explicit resolver selection and `food_catalog.json`'s
`explicit_estimates`; they are not yet selectable in the app's default search.
No household serving weights were added for these recipes. The existing 318
source portion records are unchanged.

Example explicit lookup for 150 g of the chicken adobo reference mixture:

```console
python tools/resolve_food.py FC001260 --estimate-id EST_PH_DISH_001_V1 --edible-grams 150
```

Without `--estimate-id`, this identity returns unknown nutrients. The app must
ask users to opt into estimates before exposing these records for logging.
18 integrity tests cover original-record preservation, independent recalculation,
unknown-value propagation, source reconciliation and explicit selection.

## Common-food and drink batch history

The targeted common-food and drink batch adds **112 identities: 82 FNRI and
30 USDA**, giving **1,259 identities**. All 1,147 prior food rows are unchanged.
Of the additions, 108 are loggable and four USDA source conflicts are quarantined
because reported sugar exceeds carbohydrate. Their source numbers are preserved,
not capped or silently corrected. Search offers 1,235 foods; 951 have all eight
tracked nutrients. The 19 broad identities and two opt-in estimates are unchanged.

There are now 82 beverage-category records (including powders and concentrates),
plus milk/dairy and alcoholic-beverage categories. Additions include bottled and
tap water, brewed/instant-prepared coffee, decaf coffee, espresso, almond milk,
oolong/chamomile tea, yogurt variants, fruit drinks and FNRI snacks/prepared foods.
USDA records retain precise preparation, fat and fortification qualifiers; they
are distinct fallback identities, not replacements for existing FNRI foods.

The batch adds 73 sourced household portions, totaling 318 retained records.
306 belong to currently loggable foods; 12 belong to the four quarantined records.
Only source-recorded weights are offered. No generic sachet, piece or density was
invented. Bottled water has a source-recorded 1 ml / 1 g portion; that conversion
must not be applied to unrelated drinks.

`food-display-labels.csv` documents 58 readable drink/dairy labels. It expands
abbreviations and identifies three dry coffee products from their source water
and energy values. Original `foods.csv` names and numeric values remain intact.
`nutrient-gap-audit.csv` records 349 FNRI nutrient gaps whose matching retained
source also has no numeric value. These remain blank. No existing nutrient was
filled by analogy, changed, or replaced with an AI estimate.

`expansion-common-foods.csv` records additions; `source-conflicts.csv` records
blocked source records; `expansion-common-foods-exclusions.csv` records the FNRI
candidate excluded for sugar exceeding carbohydrate. Source snapshots were
accessed September 16 and reviewed September 17; this is not a fresh source release.

Rebuild labels with `python tools/polish_food_labels.py`, then run the catalog
export and search build below. Application search snapshot is refreshed locally;
production deployment and authenticated logging are not verified by this batch.

## Second 500-food expansion history

The second 500-food expansion is complete: **1,147 food identities**. It adds
400 FNRI records and 100 USDA records, preserving every field in the existing
647 food records. No AI estimates or duplicate source IDs count toward the 500.

All 500 additions have calories, protein, carbohydrates and fat. Of the new
foods, 371 have all eight tracked nutrients and 129 retain source-missing blanks.
Overall there are 762 fully verified FNRI records, 250 partial FNRI records,
115 identities with other-source values, 19 unresolved identities and one
estimate-only identity. Default resolution is complete for 861 foods, with some
known nutrients for 1,127. The two existing estimates remain explicitly opt-in.

The USDA additions fill ingredient/preparation gaps: salmon, trout, broccoli,
spinach, berries, quinoa, lentils, nuts and related foods. Species, preparation,
salt, skin, bones and drained-weight qualifiers remain in the source names.
The batch adds 222 documented USDA portion weights, giving 245 total household
reference portions. The other 500 added portions are 100 g edible reference
weights; they are not invented cups or pieces.

`expansion-round2.csv` lists the new foods in five batches of 100.
`expansion-round2-exclusions.csv` records excluded FNRI candidates.
`2026-09-17-expand-500.json` records counts and preservation checks.
The batch uses the retained official FNRI and USDA snapshots listed in
`sources.csv`, with input hashes verified before import. Review date is
2026-09-17; snapshot access remains 2026-09-16. This is not a new source release.
Original pre-batch inputs are retained under `Food_DB/research/2026-09-17-expand-500/`.

`tools/expand_food_db_round2.py` applies this batch only once. Catalog, coverage,
alias audit and local app search releases have been rebuilt. Historical search
releases are retained so existing saved-food provenance stays available.

## First 500-food expansion history

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

## Alias audit and application search

The alias audit covers all 1,147 identities. There are 2,619 alias rows, including
189 new audit additions in the second expansion from official common names, expanded abbreviations, documented
munggo/monggo spellings, and explicitly linked broad-parent discovery names.
824 records have FNRI common names. No unsupported regional translations were
invented for the others. `aliases.csv` is the search authority; the original
embedded aliases in `foods.csv` remain preserved.

- `alias-audit.csv` records coverage for every food.
- `alias-changes.csv` records each addition and its basis.
- `alias-collisions.csv` lists 65 shared normalized names and their food IDs.
- `alias-audit-summary.json` records counts and the deployed-artifact version.
- `tools/build_food_search.py` rebuilds the audit and app search snapshot. Repeat
  runs do not add duplicate aliases. The pre-audit aliases are retained in research.

The PHP endpoint `api/food_catalog.php` searches exact normalized tokens across
canonical and alias names. Case, whitespace, punctuation and accented Latin
letters are normalized. Queries can combine a Filipino name with an English
preparation, such as `sayote boiled`. A short one-word misspelling can produce
suggestions only when no token match exists; the user must choose the suggestion
and then a specific food. Shared aliases never merge food IDs or auto-select one.

1,127 foods with known core macros are searchable. Unresolved parents and the
estimate-only identity are excluded from logging through this endpoint. Broad
parent aliases can discover linked, explicitly named variants. No AI estimate
is silently activated by searching or logging a food.

Both food-entry search screens call the local endpoint and retain library and
Open Food Facts results. Canonical names, preparation distinctions, source
labels and missing-nutrient notices appear in results. Local results are shown
before slower external results; stale responses cannot replace a newer search.

Deployable assets are `api/catalog-active.json` and the immutable JSON releases
in `api/catalog-history/`. Keep historical releases: saved food IDs include their
release hash so older logs retain the original per-nutrient provenance. The
server resolves catalog names and nutrients from the selected release, ignoring
client-submitted nutrient values. No database migration is required. These
assets are included by the existing API deployment rules; generating them does
not itself deploy the app.

Run `php tools/test_food_search.php` and `node tools/test_food_search_ui.cjs` for
source lookup, spelling/qualifier/collision behavior, immutable provenance,
frontend parsing and simulated asynchronous search checks. The tests do not
replace a signed-in production meal-save check.
