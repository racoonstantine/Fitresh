# Food logging measures

Implemented 2026-09-17. Nutrient values, aliases and the source portion CSV are unchanged. The search snapshot now carries the 245 existing `OTHER_SOURCE_PORTION` records, including source URL, status and notes. Archived snapshots remain immutable; older saved foods may have no household measures.

- Catalog nutrients remain per 100 g edible food. Weight ounces use exactly 28.349523125 g per oz. Fluid ounces are not offered.
- Each documented option represents its entire description. For example, two servings of a “3 oz” portion use twice the recorded edible weight, without multiplying by three again.
- No generic ml-to-g conversion is assumed. Foods whose nutrition basis is ml retain ml. Catalog foods can use ml only with an explicitly entered personal grams-per-ml measurement; pieces without a source weight similarly require personal grams per piece.
- Personal measurements are labeled in the entry form and are used for that entry only. They never modify verified food or portion data. No unsupported source densities were added.
- Both search loggers preview the normalized amount. The server independently validates and converts the requested measure before logging or editing. It looks up portion weights from the selected immutable food snapshot, ignoring client-supplied source weights.
- Saved entries use the food's canonical unit (grams for catalog foods), rounded to the existing database precision of 0.01. Original chosen units and personal conversion factors are not retained; history and amount editing display the normalized amount. Existing logs are not rewritten. This requires no schema migration.

Validation: `php tools/test_food_measurements.php`, `node tools/test_food_measurements_ui.cjs`, existing food search/UI checks and food database source reconciliation. Live authenticated MySQL logging still needs a deployment smoke test.
