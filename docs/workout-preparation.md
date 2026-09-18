# Warm-up and cooldown catalog

The catalog includes 28 phase-specific activities and 12 composable presets. Total catalog size is now 138 activities and 14 templates, including the original Strength A/B routines.

## Presets

Warm-ups: full body, upper body, lower body, walking/running, cycling, basketball/court sports, and pickleball/racket sports.

Cooldowns: full body, upper body, lower body, cycling, and court/racket sports.

Each preset starts with five minutes of easy walking/marching or cycling. Warm-ups then add controlled preparatory movements; cooldowns reduce pace first and then offer gentle stretches. These sequences are editable application defaults, not clinically validated or sport-specific injury-prevention programs.

General guidance is informed by the [American Heart Association's warm-up/cooldown advice](https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/warm-up-cool-down): increase and decrease activity gradually, allow roughly 5–10 minutes for warm-up/cooldown, and hold comfortable stretches for 10–30 seconds without bouncing. The exact exercise choices and preset sequences are application decisions.

## App use

- Select **Warm-ups** or **Cooldowns** in the category filter to find individual activities. Body-part and equipment filters still apply.
- Use **Warm-up or cooldown preset → Add preset to session** to attach a sequence without replacing existing exercises or entered results.
- Adding activities keeps warm-up items before main work and cooldown items after main work, preserving order within each phase.
- Presets create empty completed-result rows. Their targets are displayed separately; only enter work actually completed.
- Per-side activities use two sets, one for each side. The target is per side, not a combined total.
- A preset can also be loaded as a standalone session through the existing template selector. That selector's Load action replaces the draft after its usual confirmation.

## Consumer contract

Every generated activity has `phase: "warmup" | "main" | "cooldown"`. Existing main activity IDs retain their meaning. Preparation activities use dedicated stable `wu-`/`cd-` IDs and `category: "warmup" | "cooldown"`.

New activities include `phaseTarget` with `sets`, either `reps` or `durationSeconds`, and `perSide`. Measurement scope is per set, including timed walks/cycles in preparation presets. `tracking` remains `reps` or `hold`, so the existing set storage and validator can consume them without a table migration.

Presets are returned in `templates` by the existing authenticated workout API. They include `phase`, `suitableFor` matching hints, `sourceIds`, ordered `items`, and each item's structured `prescription`. Matching hints help a future plan builder select presets; they do not automatically assign one to the user.

The server stores activity phase in the completed activity snapshot. Plan prescriptions remain template data and are not saved as completed results. Consumers of old snapshots should treat a missing phase as `main`.

Preparation activities deliberately keep their own easy targets when the main workout's goal or experience selector changes. They do not acquire heavy strength targets or gender-based loads.

## Install and verify

Run `node tools/build_workout_seed.cjs`, then install the updated `db/workout_seed.sql` after migration 004. Deploy the updated workout frontend and API. No additional SQL table migration is needed. Back up and verify the live database through the existing deployment process.

Run `node tools/test_workout_preparation.cjs`, `node tools/test_workout_catalog.cjs`, `node tools/test_workouts_ui.cjs`, and `php tools/test_workouts.php`. Tests cover phase tags, preset references, guidance, per-side targets, insertion ordering, preservation of entered results, and compatibility with server validation. Live MySQL persistence remains a separate deployment check.
