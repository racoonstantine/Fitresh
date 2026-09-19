# Handoff: split public/index.html into smaller files

Start a NEW session with: "Read docs/handoff-split-index-html.md and do the split."
Reason: the current session's history is huge; every step re-reads it. A fresh
session plus smaller files should cut token spend a lot.

## Goal
`public/index.html` is ~8,970 lines (CSS lines 10-645, HTML 646-1866, one inline
`<script>` at 1867-8969). Split so each area can be read/edited on its own.
NO behavior change. Ship in small commits, each verified.

## Constraints (learned the hard way)
- Top-level `function` declarations in the main script are GLOBAL and are called
  across sections; functions declared INSIDE the `(function(){ ... })();` blocks
  are private. Splitting must preserve this. A past bug: parseLabeledReply /
  firstNumber / copyTextToClipboard lived inside the Log Meal IIFE but were
  called from global code -> silent ReferenceError. Watch for the same.
- Load order matters: top-level `let`/`const` state (historyLog, checkedState,
  userTrainingPlan, dashSelectedDate, logSessionMode, etc.) must be defined
  before code that runs at load. Plain `<script src>` files (NOT modules) keep
  shared globals working; keep them in dependency order, deferred to end of body.
- Deploy is SFTP of the repo on push to main (.github/scripts/sftp_deploy.py);
  confirm new public/*.js files are picked up (personal-foods.js already is).
  Never commit a file that index.html references without committing the file.
- Git hygiene: a parallel session also edits food-db/ files. Stage explicit
  paths only; check `git status` first.

## Suggested plan
1. Move CSS (lines 10-645) to `public/app.css`; link it. Verify visually.
2. Move JS in stages, each its own commit, in this order (roughly by section):
   - core/state + helpers (storage, units, dates, escape, shared AI helpers)
   - today.js (Today at a Glance, ~2472+)
   - body.js (weight, sleep, water, steps, fasting pages)
   - food.js (search, Log Meal IIFEs ~7220-7780)
   - train.js (Log a Session, checklist, logged-today, stats form, Training Plan
     + Workout Plan library IIFE ~8271)
   - account.js (auth, onboarding, account/admin ~6709-7220)
3. After each stage run the checks below and a browser smoke test.

## Checks to run after every stage
```
node tools/test_ai_assist.cjs
node tools/test_food_icons.cjs
node tools/test_nutrition_notes.cjs
node tools/test_workout_catalog.cjs
node tools/test_workout_preparation.cjs
php tools/test_workouts.php
php tools/test_personal_foods.php
```
NOTE: test_ai_assist.cjs, test_food_icons.cjs and test_nutrition_notes.cjs slice
code out of public/index.html by function-name markers (indexOf). They WILL break
when code moves; update their file paths/markers as part of each stage.
Syntax check: extract each script and `new Function(code)`.

## Reusable test harness (build once, stop rebuilding it)
Create `tools/dev_harness/` that: copies api/*.php to a temp dir, swaps get_db()
for SQLite (`sqlite:` PDO, PRAGMA foreign_keys=ON), rewrites `NOW()` ->
`datetime('now')`, `ON DUPLICATE KEY UPDATE` -> `ON CONFLICT(...) DO UPDATE`,
DATE_ADD -> datetime('now','+N days'), strips FOR UPDATE, adds a config.local.php,
seeds workout_activities from data/workouts/catalog.json plus a test user, and
runs `php -S 127.0.0.1:PORT`. Gotcha: use double-quoted PHP strings when the SQL
contains `datetime('now')`. Log in via POST api/auth.php?action=login (JSON body),
then reload the page. Kill php.exe and delete the temp dir afterward.

## Current state (2026-09-19)
- main is clean and pushed (latest: faaf7f1 food DB batch, 4f5baf8 Today/Train UI).
- Pending manual step for the owner: run db/migrations/005_personal_foods.sql and
  006_password_resets.sql, and re-run db/workout_seed.sql, on the live MySQL DB.
- Known limitation: Train's tick-to-complete checklist is today-only (shared
  checkedState is not per-date); other dates use Rest/manual + Logged Training edit.
- The app itself makes no LLM API calls (AI Assist is copy/paste prompts).
