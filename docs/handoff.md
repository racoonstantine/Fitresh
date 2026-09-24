# Fitresh — handoff (read this first in a new session)

Fitresh (fitresh.com; formerly "Full Circle") is a multi-user workout / nutrition / fasting / weight
tracker: a static frontend in `public/` plus a small PHP + MySQL API in `api/`. Every push to
`main` deploys to Namecheap over SFTP (GitHub Actions). `docs/history.md` is a long dated archive;
you rarely need it.

## Safety net
- Git tag **`pre-ui-redesign`** = last known-good state before the big UI work (all tests green).
  `git diff pre-ui-redesign` to see changes; `git checkout pre-ui-redesign -- public` to restore.
- **Do UI work on a branch** (e.g. `ui-redesign`). Pushing `main` deploys to the live site.
- User data lives in MySQL, separate from code. Back it up (phpMyAdmin → Export) before any change
  that touches `api/` or `db/`.

## Layout
- `public/index.html` — markup only (~1,300 lines). `public/app.css` — all styles (CSS variables at
  the top; the app reads colours through `--forest`, `--ochre`, `--ink`, `--paper`, `--line`, so a
  re-theme is mostly changing those). `public/personal-foods.js/.css` — custom-food dialog.
- `public/js/*.js` — **25 classic (non-module) scripts sharing globals**, loaded in this order:
  `numbers, edit-lock, core, progress, today, food-icons, food-search, nutrition, trends,
  body-account, insights, weight-dashboard, plan-history, cardio-activity, log-session-panel,
  extra-exercises, logged-training, todays-session, stats-form, app-start, account, foodlog, pages,
  plan, boot`. Top-level `function`s are global; functions inside the `(function(){…})()` blocks
  (foodlog, pages, plan, boot, account) are private — a global caller of a private function fails
  silently. Keep the order; `let/const` state must be defined before load-time code runs.
- `api/*.php` — `auth`, `data` (per-user key/value JSON store), `foods`, `food_catalog`,
  `food_search` (Open Food Facts proxy), `meals`, `workouts`, `personal_foods`, `admin`,
  `admin_guard` (single hardcoded admin email), `food_review*` (+ CLI digest), `feedback`, resets.
- `db/schema.sql` + `db/migrations/001…007` (run each once on live MySQL). `data/` = food DB and
  workout catalog sources; `tools/` = build scripts and tests.

## Run and test
```
node tools/dev_harness/start.cjs --port 8124   # real API on SQLite + fixture data; live public/
node tools/dev_harness/smoke.cjs               # 16 API checks (own port)
```
Accounts (password `testpass123`): `tester@example.com` (data), `other@example.com` (empty),
`admin@example.com` (admin). Kill php + delete `%TEMP%\fc-harness-*` afterwards.

All tests (run before every push):
```
node tools/test_<name>.cjs      # ai_assist food_icons nutrition_notes workout_catalog
                                # workout_preparation bilingual_foods food_measurements_ui
                                # food_search_ui food_macro_preview cardio_activity train_panel
                                # food_search_outcome progress food_favorites
php tools/test_workouts.php  tools/test_personal_foods.php  tools/test_food_review.php
python tools/test_cache_bust.py
```
`tools/app_source.cjs` rebuilds the app as one script so tests can slice functions out of it by
marker strings — if you move or rename a function, update the tests that slice on it.

## Deploy
`.github/scripts/sftp_deploy.py` uploads `public/` and `api/` (never `config.local.php`). It stamps
`?v=<hash>` on every local css/js in the uploaded `index.html` (`cache_bust.py`), so browsers never
run new HTML with old assets. New files under `public/` deploy automatically.

## Conventions worth knowing
- Numbers: inputs are `type="text" inputmode="decimal" data-num`; commas are stripped as you type
  (`numbers.js`). Parse with `parseNum`, display with `fmtNum` / `fmtNumMax` (thousands commas).
- Past entries (steps/sleep/water/fast/foods/workouts) are read-only behind a ✎ Edit button
  (`edit-lock.js`, Logged Training, meal rows).
- Foods made by users are tagged: `source` `manual` (My Entry) / `ai` (AI Assist).
- Train "Log a Session" is a self-contained mountable panel (`log-session-panel.js`).
- Terminology: **Workout Routine** = one session (not "Workout Plan"); **Training Plan** = weekly schedule.
- Editing quirks on this Windows setup: bash heredocs with quotes can fail — write patch scripts to a
  file and run them; files are CRLF (preserve line endings); JS in `python` strings loses `\b`/`\n`
  escapes unless raw; `assert.deepEqual` on arrays from `vm` contexts fails — compare via JSON.

## Live-server to-do (only the owner can do these)
1. Run `db/migrations/007_food_review.sql` in phpMyAdmin (005/006 were reported done).
2. cPanel cron `0 8 1,16 * *` → `/usr/local/bin/php /home/shergtjz/public_html/api/food_review_digest.php`
   (details in `docs/food-review.md`; test first with `--dry-run`).
3. Point `fitresh.com` at the host + SSL; set `'app_host' => 'fitresh.com'` in the server's
   `api/config.local.php` (approval / reset email links use it).

## State and known gaps
- Done recently: split of `index.html` into `app.css` + 25 scripts; dev harness; thousands-separator
  numbers; cardio activity listing; Log a Session panel (routine / rest / manual / AI Assist);
  Logged Training with icons, stats, editing; edit locks; Favorites (grouped, filter, per-group
  "show more"); food origin tags; food review pipeline (opt-in → admin table → half-monthly digest);
  compact admin table; over-target bars/rings; Today workout/food insight tiles; Fitresh rename,
  new leaf icon set, green palette (`--color-accent-2` family; orange kept as secondary).
- Not done: the full visual redesign from the Fitresh concept mockups (white cards, ring dashboard,
  different type); warm-up / cool-down sections on session cards (design proposed, awaiting go-ahead:
  collapsible recommended routine per session, tick-off, custom sets — catalog already holds 28
  activities / 12 templates in `data/workouts`); per-date tick-to-complete checklist on Train
  (only "today" ticks; other dates log via "Select Workout Routine" in the panel).
- `food_search.php` depends on Open Food Facts (offline is handled with a note + Manual/AI fallbacks).
