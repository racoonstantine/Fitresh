# Fitresh — handoff (read this first in a new session)

Fitresh (live at https://fitresh.com; gedli.com 301-redirects to it; formerly "Full Circle") is a multi-user workout / nutrition / fasting / weight
tracker: a static frontend in `public/` plus a small PHP + MySQL API in `api/`. Every push to
`main` deploys to Namecheap over SFTP (GitHub Actions) into `/home/shergtjz/fitresh.com`
(the `REMOTE_PATH` secret; server-only `api/config.local.php` lives there and is never deployed). `docs/history.md` is a long dated archive;
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
2. cPanel cron `0 8 1,16 * *` → `/usr/local/bin/php /home/shergtjz/fitresh.com/api/food_review_digest.php`
   (details in `docs/food-review.md`; test first with `--dry-run`).
3. Done: fitresh.com is the primary domain (`'app_host' => 'fitresh.com'` set), gedli.com redirects.

## State and known gaps
- Done recently: split of `index.html` into `app.css` + 25 scripts; dev harness; thousands-separator
  numbers; cardio activity listing; Log a Session panel (routine / rest / manual / AI Assist);
  Logged Training with icons, stats, editing; edit locks; Favorites (grouped, filter, per-group
  "show more"); food origin tags; food review pipeline (opt-in → admin table → half-monthly digest);
  compact admin table; over-target bars/rings; Today workout/food insight tiles; Fitresh rename,
  new leaf icon set, green palette (`--color-accent-2` family; orange kept as secondary).
- Visual redesign from `design_handoff_fitresh/` (README + `Fitresh.dc.html` mockups), done on `main`
  in phases: **1** tokens/Outfit type/5-tab nav (no "Me" tab; avatar opens Account) and the dark
  leaf-F logo (`public/mark.png`, cut from a low-res crop — swap for the original vector when
  available; `icon-512`/favicon still old); **2** Today greeting + white glance cards; **3** white cards,
  dark-green chips, Account chip rail. `api/data.php` needs no change.
  **Remaining:** 4 Food meal-log bottom sheet (Search/Manual/AI) + floating "+ Log" button (replaces
  rest-timer button); 5 Train (7-day strip, dark Today card, session sheet); 6 Account Goals layout,
  BMI without "Overweight" chip; 7 polish/deep links. Also open: health-score ring (no backend
  score; hide or define client-side), Body readiness card, Week/Month/Year control, line icons.
  Workflow used: branch → `node tools/dev_harness/start.cjs --port 8124` → review locally → merge/push.
- Not done: warm-up / cool-down sections on session cards (design proposed, awaiting go-ahead:
  collapsible recommended routine per session, tick-off, custom sets — catalog already holds 28
  activities / 12 templates in `data/workouts`); per-date tick-to-complete checklist on Train
  (only "today" ticks; other dates log via "Select Workout Routine" in the panel).
- `food_search.php` depends on Open Food Facts (offline is handled with a note + Manual/AI fallbacks).
