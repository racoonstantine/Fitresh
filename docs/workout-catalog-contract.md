# Workout catalog v2: application integration

## Contents and installation

The catalog now contains 110 activities: 65 strength exercises, 12 cardio activities, 25 sports entries, and 8 mobility activities. Existing activity IDs and the two Strength A/B starter templates are retained.

Run `node tools/build_workout_seed.cjs` to regenerate:

- `data/workouts/catalog.json`: complete machine-readable catalog for tooling and plan builders.
- `db/workout_seed.sql`: rerunnable MySQL catalog upserts.

Catalog additions and metadata are authored in `tools/workout_catalog.cjs`; the original starter routines remain inputs to `tools/build_workout_seed.cjs`.

Install migration 004 if not already installed, then run the updated seed in MySQL. Deploy the updated `api/workouts.php`, `api/workout_validation.php`, and `public/workouts.js` together. No additional table migration is required: sport metrics use the existing metrics JSON column. Do not enable the expanded sport editor against an older validator, which would discard additional measurements. Live MySQL verification remains required.

## Read contract

Authenticated `GET api/workouts.php` returns `activities`, `templates`, `sessions`, `schemaVersion`, `sources`, and `recommendationPolicy`.

Each activity includes:

| Field | Consumer behavior |
| --- | --- |
| `id` | Stable reference from templates, plans, and completed sessions |
| `schemaVersion` | Version of this activity definition; new definitions use 2 |
| `category` | `strength`, `cardio`, `sport`, or `mobility` |
| `bodyParts` | Broad filter tags such as `back`, `legs`, `shoulders`, `biceps`, `triceps`, `core` |
| `primaryMuscles`, `secondaryMuscles` | More specific muscle tags; empty arrays are allowed for whole-session activities |
| `equipmentTags` | Equipment filter tags; not an assertion that the user owns every item |
| `movement` | Movement-pattern tag |
| `tracking` | `load`, `reps`, `hold`, or `session`; supported by the current logger |
| `measurements` | Fields, units, scope, requiredness, and numeric bounds |
| `loadConvention` | How external load and unilateral sets are counted |
| `goals`, `experienceLevels` | Descriptive matching metadata; not medical eligibility or clearance |
| `guidance` | Editable planning defaults indexed by goal and experience |
| `guidanceVersion` | Version of starting-target rules |

Keep the source identifiers stable. Do not rename existing IDs to match a display-name change. Old session snapshots may lack v2 fields and must still render.

## Measurement definitions

`scope` is `set`, `session`, or `activity`. Each definition has `key`, `unit`, `min`, `max`, `required`, and `integer` where relevant. `sets` is derived from the completed set array and is not an independent measurement to post.

Examples:

- Loaded exercises: completed set count, reps per set, total external kg per set.
- Bodyweight exercises: set count and reps; body mass is excluded from external load.
- Holds: set count and seconds per set.
- Running/cycling: duration and optional distance.
- Swimming: duration, optional distance and pool lengths (`laps` means lengths, not round trips).
- Pickleball: duration and games played.
- Tennis/badminton/table tennis/padel: duration, games, and sport sets (`sportSets`, distinct from lifting sets).
- Boxing/kickboxing: duration and rounds.
- Basketball shooting practice: duration, attempts, and successful attempts.
- Golf: duration, holes, distance, and steps.
- Climbing: duration and completed routes.

Calories, average heart rate, and perceived effort are optional session observations. Counts must be whole numbers within their declared bounds. Successful attempts require total attempts and must not exceed them. Unknown measurements remain null.

The current logger uses km and seconds in storage and minutes for duration input. It renders sport fields from the definition and the server accepts only catalog-declared additional fields. Legacy distance/calorie/heart-rate fields remain accepted for compatibility with old records.

## Planning defaults and weight selection

Select `activity.guidance[goal][experience]`, where goals currently include `general_fitness`, `muscle_gain`, `strength`, `muscular_endurance`, and `weight_management`; experience is `beginner` or `experienced`.

These are application starting defaults for generally healthy adults, not a personalized training prescription. The exact ranges and effort cue are product choices informed by general resistance-training principles; they are not all direct recommendations quoted from the source. See [ACSM's 2026 guidance](https://acsm.org/resistance-training-guidelines-update-2026/), which emphasizes individualization.

- Beginner resistance defaults use fewer sets and moderate rep ranges.
- Experienced strength defaults use lower rep ranges for suitable movements; isolation movements retain moderate ranges.
- Muscular-endurance defaults use higher rep ranges.
- Timed holds use seconds instead of reps.
- Sports/cardio/mobility use editable duration placeholders, not sport-specific performance prescriptions. Resistance-training goal selections do not turn a sport into a strength or hypertrophy recommendation.
- `suggestedWeightKg` is deliberately null. `weightMethod` describes calibration to target reps where external load applies.
- Gender alone never assigns a weight. Begin with a controllable load and adjust using technique, ability, recovery, and completed performance. The logger shows prior loads for the same activity as a reference only; it does not automatically increase them.
- No 1RM test, automatic progression, or gender-based multiplier is implemented.

Keep planned targets separate from results. Adding an activity creates empty set rows and displays guidance; it never fills in completed reps, weights, or time. The current session endpoint does not persist a training plan or its targets. A future plan endpoint should store prescribed values separately and copy only references into completed sessions.

Example future plan item assembled from the catalog:

```json
{
  "activityId": "cable-curl",
  "goal": "muscular_endurance",
  "experience": "experienced",
  "guidanceVersion": 1,
  "prescription": {
    "sets": 2,
    "repsMin": 12,
    "repsMax": 20,
    "restSeconds": 90,
    "weightKg": null,
    "weightMethod": "calibrate_to_target_reps"
  }
}
```

This is a proposed plan payload, not a supported save request. Completed sessions continue to post actual `items[].sets` and `items[].metrics` to `api/workouts.php`. Catalog snapshots and guidance are server-owned and are omitted from client save requests.

## Verification

Run:

```text
node tools/test_workout_catalog.cjs
php tools/test_workouts.php
node tools/test_workouts_ui.cjs
node --check public/workouts.js
php -l api/workouts.php
```

The catalog tests cover stable IDs, all body-part groups, schema consistency, goal defaults, and template references. PHP tests validate all 110 entries and round-trip each declared session measurement through normalization, including rejecting inconsistent shooting counts. These do not substitute for live MySQL persistence checks.
