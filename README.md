# Full Circle — Fitness Tracker

Multi-user workout, nutrition, fasting, and weight tracker. Static frontend
(`public/`) + a small PHP/MySQL API (`api/`) so each account's data is private
to them. Deploys to Namecheap shared hosting automatically via GitHub Actions
on every push to `main`.

## How it fits together

- **`public/index.html`** — the whole frontend. One file, no build step, no
  framework. Talks to the API with `fetch()` for login/signup and for every
  read/write of workout, nutrition, weigh-in, etc. data.
- **`api/`** — PHP endpoints:
  - `auth.php` — register / login / logout / who-am-i, via PHP sessions.
    New signups are created with `status = 'pending'` and can't log in until
    approved (see "Admin approval for new signups" below).
  - `approve.php` — the link in the admin approval email hits this to
    approve/reject a pending signup.
  - `data.php` — get/save one user's data for a given resource (nutrition,
    weighins, history, checked, weights, theme), scoped to whoever is logged in
  - `config.local.php` — **not in git.** DB credentials + admin email, created
    once by hand directly on the server.
- **`db/schema.sql`** — the two tables (`users`, `user_data`). Run once, for a
  fresh install.
- **`db/migrations/`** — schema changes made after the initial install, run
  once each against your live database (phpMyAdmin → SQL tab).
- **`tools/seed-owner-data.js`** — a one-time console script to restore your
  own historical data (see below). Never deployed, never run by anyone else.
- **`.github/workflows/deploy.yml`** + **`.github/scripts/sftp_deploy.py`** —
  on every push to `main`, uploads `public/` and `api/` to your Namecheap
  server over SFTP (not rsync — Namecheap's SSH access here is SFTP/SCP-only,
  no remote shell, so rsync-over-ssh doesn't work). `config.local.php` is
  always excluded, so a deploy can never touch your DB credentials.

## One-time server setup (do this before the first deploy)

### 1. Create the MySQL database
In cPanel → **MySQL Databases**:
- Create a database (e.g. `yourcpaneluser_fitness`)
- Create a database user with a strong password
- Add that user to the database with **all privileges**

Then in **phpMyAdmin**, select the new database, open the **SQL** tab, and
paste in the contents of [`db/schema.sql`](db/schema.sql) and run it.

### 2. Create `api/config.local.php` on the server
Via cPanel **File Manager**, once the first deploy has run and `api/` exists
on the server (find it at your domain's actual **Document Root** — check
cPanel → **Domains** list, don't assume it's under `public_html`, addon
domains aren't always nested there): copy `api/config.example.php` to
`api/config.local.php` in the same folder, and fill in the DB name/user/
password from step 1, plus `admin_email` (see "Admin approval for new
signups" below). This file is gitignored on purpose — it only ever exists on
the server, never in the repo.

### 3. Set up the deploy SSH key
You already have SSH access (confirmed via cPanel → SSH Access). We'll make a
**second**, dedicated keypair just for GitHub Actions — don't reuse your
personal Mac key for this.

On your own machine (not here). Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\namecheap_deploy" -N '""' -C "github-actions-deploy"
```
Mac/Linux:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/namecheap_deploy -N "" -C "github-actions-deploy"
```
This creates two files: `namecheap_deploy` (private) and `namecheap_deploy.pub`
(public).

1. In cPanel → **SSH Access** → **Import Key**, paste the contents of
   `namecheap_deploy.pub`, give it a name, import it, then click **Manage** →
   **Authorize** on that key.
2. Find your SSH host and port: cPanel → SSH Access usually shows a "Connect
   via SSH" command with both (Namecheap shared hosting commonly uses port
   `21098`, not the default `22` — double check yours).
3. Find your deploy path: in File Manager, note the full path to your
   domain's web root (often `/home/<cpanelusername>/public_html`, or a
   subfolder if this domain is an addon domain).

### 4. Add GitHub Actions secrets
In your repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**, add:

| Secret name | Value |
|---|---|
| `NAMECHEAP_SSH_KEY` | contents of `namecheap_deploy` (the **private** key, whole file including the `-----BEGIN...-----` lines) |
| `NAMECHEAP_SSH_HOST` | your server hostname (from step 3) |
| `NAMECHEAP_SSH_PORT` | your SSH port (from step 3) |
| `NAMECHEAP_SSH_USER` | your cPanel username |
| `NAMECHEAP_REMOTE_PATH` | full path to your web root (from step 3) |

None of these ever pass through Claude — you're pasting them directly into
GitHub's own secret store.

### 5. Push
```bash
git push -u origin main
```
Watch the **Actions** tab in GitHub — that's your first automated deploy.
Every future `git push` to `main` redeploys automatically.

## Restoring your own historical data

Your original month of workout/nutrition history used to be hardcoded into
the app itself — that had to change, because it would've auto-inserted into
*every* friend's new account too. It now lives in
[`tools/seed-owner-data.js`](tools/seed-owner-data.js), which you run **once**,
manually, logged in as yourself:

1. Visit your live site and log in (or sign up) as yourself.
2. Open DevTools → Console.
3. Paste the entire contents of `tools/seed-owner-data.js`, press Enter.
4. Reload once you see "Owner data import complete" in the console.

## Admin approval for new signups

Anyone can submit a signup, but new accounts start out `pending` and can't log
in until you approve them. When someone signs up, the server emails
`admin_email` (set in `api/config.local.php`) with **Approve** / **Reject**
links — clicking one updates the account and, for approve, they can log in
right away.

This relies on PHP's built-in `mail()`, which uses the server's local mail
setup — on Namecheap shared hosting this generally works out of the box, but
check your spam folder the first time, and if nothing arrives at all, an
authenticated SMTP method (e.g. PHPMailer through a real cPanel email account)
is more reliable than `mail()` — worth switching to if delivery is flaky.

If you're setting this up on an existing database that predates this feature,
run [`db/migrations/001_add_signup_approval.sql`](db/migrations/001_add_signup_approval.sql)
once — it defaults existing accounts to `approved` so nobody already using the
app gets locked out; only new signups from that point on start `pending`.

## Inviting friends

Signup is open (anyone with the link can create an account) but every account
needs your approval before it can be used, and each approved account only
ever sees its own data. Share the URL, then check your email for the
approval request when someone signs up.

## Profile, username, and personalized targets

The first time someone logs in (no saved profile yet), they see a one-time
setup screen: an optional unique username (6+ characters, rejected if already
taken), plus gender/age/height/activity level/current & goal weight. This
computes their BMI and personal calorie/protein/water targets (Mifflin-St
Jeor BMR × activity multiplier, ± a deficit/surplus toward their goal weight)
— shown on the Insights screen, and used everywhere the app shows a nutrition
target. Skipping is always available; clicking your name in the sidebar
reopens the same form to fill in or change any of it later.

This replaced what used to be one person's own hardcoded diet targets
(140-150g protein, ≤30g carbs) applied to every account — the same class of
bug as the old hardcoded seed data. Generic, non-personal defaults are used
for anyone who hasn't filled in a profile yet.

If you're setting this up on an existing database, also run
[`db/migrations/002_add_username.sql`](db/migrations/002_add_username.sql)
once.

## Weight/height units (kg/lb, cm/ft-in)

Weight and height are always stored canonically in kg and cm — in
`weighIns`, `profile.currentWeightKg`/`goalWeightKg`/`heightCm`, and every
BMI/BMR/TDEE calculation — so switching units never touches historical data
or recomputes targets differently. `profile.weightUnit` ('kg' default or
'lbs') and `profile.heightUnit` ('cm' default or 'ft') only control the
display/input layer: a small set of helpers (`formatWeightKg()`,
`formatHeightCm()`, `kgToDisplayWeight()`/`displayWeightToKg()`,
`cmToFeetInches()`/`feetInchesToCm()`) convert at render time and when
reading form inputs back.

The profile setup/edit form (onboarding) has unit selects for both; toggling
either one live-converts whatever is currently typed in the weight or
height fields, instead of just relabeling them, so a half-filled form
doesn't get silently reinterpreted in the new unit. The Goals page also has
its own "Preferred weight unit" selector (defaults to kg) next to Target
Weight, wired to the same `profile.weightUnit`, since that's the more
likely place to flip units day-to-day — saving from either screen updates
weight displays everywhere at once (Today, Body, Insights, Account).

## Nutrition engine (real food search + logging)

Food's "Log a food" search box is backed by a proper normalized schema
(`nutrients`, `foods`, `food_nutrients`, `food_servings`, `meal_entries`,
`meal_components` — see [`docs/RandomHut_Nutrition_Tracking_Requirements_v1.0.docx`](docs/RandomHut_Nutrition_Tracking_Requirements_v1.0.docx)
for the design this follows) instead of the old flat "one row per day"
nutrition log. Both coexist: the old `nutritionLog` resource keeps showing in
the Dashboard/History/Trends for anything logged before this, new logging
goes through the tables below.

Run [`db/migrations/003_nutrition_engine.sql`](db/migrations/003_nutrition_engine.sql)
once against your database.

Search hits [Open Food Facts](https://world.openfoodfacts.org) (free, no API
key) server-side via `api/food_search.php`. Coverage skews toward
packaged/branded products — home-cooked and regional dishes usually won't be
there, which is what **+ Add a custom food** in the same screen is for.
`api/foods.php` handles saving a search result into your own library the
first time you log it (so it's instant and offline-searchable after that)
and creating custom foods; `api/meals.php` handles logging/reading/deleting
against a date.

**USDA FoodData Central** (better coverage for generic/whole foods and US
packaged items) isn't wired in yet — get a free instant API key at
https://fdc.nal.usda.gov/api-key-signup.html when you want it added; the
`http_get_with_fallback()` helper in `api/db.php` is already shaped to add a
second provider alongside Open Food Facts without reworking the search
endpoint.

Searching a food shows its macros (calories/protein/fat/carbs, live-scaled to
the amount you type) and requires an explicit **Save**/**Cancel** before
anything is logged — nothing commits on a single click anymore. Search-logged
meals (`meal_entries`/`meal_components`) are merged into the Nutrition
Dashboard's cards, banner, and macro split alongside anything logged the old
way (`nutritionLog`), so the numbers you see there always reflect both. This
merge is scoped to whatever date range the dashboard is currently showing
(day/week/month) — the historical calorie trend chart and the "Log a Day"
entry list below it still read from `nutritionLog` only.

## Fasting timer

A dedicated Start/End fasting timer lives above "Log a food" on the Food tab
(separate from the legacy "Fast duration (hours)" free-text field, which it
writes into when a fast ends). Pick a goal (12:12 through OMAD), start a fast,
and it ticks live with a progress bar toward that goal; the start time can be
edited directly (`<input type="datetime-local">` — chosen over a custom
scroll-wheel picker since native date/time inputs already give a scrollable
picker on mobile, for far less code). Ending a fast computes the elapsed hours
and writes them onto that day's `nutritionLog` entry, so it shows up in the
existing "Today's fast" dashboard card and history immediately. State (the
active fast's start time and last-used goal) is stored via the same generic
`api/data.php` resource mechanism as everything else (resource key
`fasting`).

**Note for local Windows PHP dev environments specifically:** some PHP
builds have the `curl` extension but no CA certificate bundle configured, so
outbound HTTPS calls fail with a cryptic SSL error. `http_get_with_fallback()`
already picks curl over `file_get_contents` for reliability, but if outbound
requests fail entirely in local dev, point PHP at a CA bundle (e.g.
`php -d curl.cainfo=/path/to/cacert.pem -d openssl.cafile=/path/to/cacert.pem -S localhost:8000`,
bundle from https://curl.se/ca/cacert.pem). Namecheap's shared hosting has
never shown this issue.

## Today at a Glance

The Today tab leads with a summary dashboard — weight (with delta from your
last weigh-in), food intake vs. target, a live fasting readout, water intake,
macronutrient rings, today's planned exercise, and calories burned — plus a
Quick Actions row (Log Food, Log Weight, Start Workout, About Me, My Goals)
and a unified "Today's Log" feed listing all of today's activity in one
place. It pulls from the same data as the rest of the app (nutritionLog +
meal_entries, weighins, checkedState/historyLog, the fasting timer) — nothing
new to maintain there. The original per-range workout dashboard (day/week/
month, session history, weekly plan) still lives below it, now defaulted to
"Today" instead of "This Week."

Water intake is a new lightweight resource (`water`, a `{date: ml}` map,
same generic `api/data.php` mechanism as everything else) — the +/− buttons
on the Water card log a glass (250ml) at a time. There's no dedicated water
logging screen yet; it's only editable from the Today card.

The "Calories Burned" ring's target (400 kcal) is a fixed placeholder —
there's no user-configurable exercise-calorie goal yet, unlike the food/
water/protein targets which all come from the health profile.

## Richer workout stats

"Log stats from watch" (now available on strength days too, not just
cardio) captures max heart rate, elevation gain, a training-stress score,
HR recovery drop, and HR zone minutes (warm-up/fat-burn/aerobic/anaerobic),
alongside the original distance/duration/calories/HR/pace/steps. All
optional, all just extra keys on the same `stats` object already in each
`history` entry — nothing here needed a schema migration. The two "Log
stats" flows (strength and cardio) now share one form (`#cardioStatsForm`,
despite the id) instead of duplicating it.

Custom foods (in the food search's "+ Add a custom food" flow) also
optionally capture fiber, sugar, sodium, and cholesterol now — the
underlying `food_nutrients` table already supported these codes
(`FIBTG`/`SUGAR`/`NA`/`CHOLE`), they just weren't exposed in that form yet.

## Migrating data from elsewhere

**Account → My data → "Import structured data (.json)"** reads a JSON file
matching [`public/data-import-schema.md`](public/data-import-schema.md) —
weigh-ins, sleep, fasting, water, day-by-day itemized food (with full
macros, not just day totals), and workouts with watch stats, all in one
file. That doc also has a ready-to-use prompt template for asking another
app/chat that already has your history to export it in this shape.

Food items import through the same real search/log engine as manual
logging (each becomes its own food-library entry + logged component) rather
than the legacy flat `nutritionLog` — deliberately not deduplicated by name
across days, since home-cooked meals vary day to day and reusing one
food record across different actual portions/macros would misrepresent
some of them. Expect it to take a while for a lot of history: it's one
food-creation call plus one log call per item, sequentially.

This is separate from **Download/Restore backup** just above it, which
round-trips this app's own raw internal storage format 1:1 (now including
`profile`, `fasting`, `water`, and `sleep`, which it was missing before) —
use backup/restore for a full snapshot of your own account, and structured
import for pulling in history that lived somewhere else first.

## Today/Train tab layout

The Today tab is now purely the daily glance view (Today at a Glance, Quick
Actions, Today's Log, a collapsed-by-default History Log). The per-range
Workout Dashboard and Weekly Plan moved to the Train tab, right below the
exercise list, so everything training-related lives in one place. On mobile,
Fasting and Food Intake swapped positions in the glance grid so Food Intake
sits directly above Macronutrients (same column) instead of two cards away.

## Goals page: categories, diet-style presets, full macro targets

Account → Goals is now grouped into **Nutrition / Body / Train / Misc**.
Nutrition gained a diet-style preset selector (Balanced, Low-Carb, Keto,
High-Protein, Mediterranean, Vegetarian, Vegan, Custom, or no specific diet)
that fills in Protein/Carbs/Fat from that style's illustrative macro split
(`DIET_PRESETS` in `public/index.html`) × your calorie target — filled in
for you to accept or edit, never saved until you hit Save. Sodium/fiber/
sugar targets live under a collapsed "More macros" toggle. Body/Train/Misc
add target weight, sleep hours, calorie-burn goal, and fasting goal (the
last one writes straight to the same `fastingState.goalHours` the Fasting
Timer already uses, so it's one source of truth, not a duplicate setting).

Saving shows a "✓ Goals saved" confirmation and immediately re-renders the
Food tab, Today glance, and Fasting Timer so new targets are visible right
away, without a reload. All the new overrides are additive fields on the
existing `profile` resource (`customCarbTarget`, `customFatTarget`,
`customSodiumTarget`, `customFiberTarget`, `customSugarTarget`,
`dietPreset`, `goalWeightKg` now also editable here, `sleepGoalHours`,
`calorieBurnGoal`) — `updateTargetsFromProfile()` uses them when present and
falls back to the existing calorie-percentage-derived defaults otherwise, so
nobody who hasn't touched Goals sees any change in behavior.

Diet-preset macro splits are illustrative starting points authored for this
prototype, explicitly not medical or clinical guidance — the UI says so in
the note under the selector, matching how the rest of the app treats
generic defaults.

The Nutrition Dashboard's macro breakdown also picks up optional Sodium/
Fiber/Sugar rows now (shown only once you've logged something with that
data) — itemized food-search logging already captured these per food, they
just weren't surfaced as day-level targets/progress before.

## Dedicated Log Meal and Fasting pages

Two full-page overlays (`#logMealScreen`, `#fastingScreen` in
`public/index.html` — fixed-position panels layered on top of the app,
opened/closed by JS rather than the tab router):

- **Log Meal** — opened from the Today tab's "Log Food" quick action or the
  Food tab's "+ Log a meal (full page)" button. Search (hits the local food
  catalog, your own library, then Open Food Facts, same as the inline Food
  tab search) or manual entry, either way items go into a running "This
  meal" list with a live total before anything is saved — add several
  items, review, then commit them all at once via Save to Log. This is
  additive; the existing inline search on the Food tab still works as
  before, unchanged.
- **Fasting** — opened from the Fasting Timer widget's "Details" link or the
  Today glance Fasting card. Same live timer as the compact widget (they
  share `fastingState`, so starting/ending/editing in one updates the
  other), plus a "Log a completed fast" form for entering a start and end
  time directly (for a fast you didn't time live), and a collapsible
  History section with a bar-chart trend and list, both built from
  `nutritionLog` entries that have `fastHours` set — no new storage needed.

The legacy "Log a Day (quick totals)" form's "Fast duration (hours)" field
was removed — fasting has its own tracking now, and the quick form was
overwriting it with blank on every save. It preserves whatever fastHours
is already on that date instead.

## Editing and deleting past entries

Every kind of entry can now be corrected after the fact, using the same
day-navigation pattern already used to browse history, rather than a
separate "edit mode":

- **Meals** — on the Nutrition Dashboard, navigate to the day, tap an item
  under "Logged via search" to reveal an amount field and Save (backed by a
  new `meals.php?action=update_component`; only the amount/unit changes, so
  nutrients keep scaling from the same food record).
- **Weight** — tap a past entry in the Body tab's weigh-in list; it
  populates the Date/kg fields above for editing, and Add overwrites that
  date (it already worked this way for same-day entries — this just makes
  it discoverable for past ones too).
- **Workouts** — expand an entry in History Log for Edit / Delete. Edit
  lets you correct each exercise's weight and the notes, plus an "Edit
  watch stats" shortcut that opens the shared stats form (Train tab)
  pre-filled for that specific past date rather than today's live session
  (`openStatsForm` now takes an optional date argument). Delete uses a
  two-tap "tap again to confirm" button instead of a native `confirm()`
  dialog, which can be unreliable in a standalone/home-screen web app.
- **Fasting** — the dedicated Fasting page's "Log or edit a fast" card now
  has day-nav (prev/next/jump-to-today), so you're not limited to
  freehand-picking a date in the datetime inputs.

## UI tidy-ups

- Train tab now leads with Weekly Plan and the Workout Dashboard, with the
  exercise tabs/warm-up/exercise list below them, so planning and reviewing
  come before the workout itself.
- The Nutrition Dashboard's secondary macros (sodium/fiber/sugar) are now
  three compact chips in one row instead of three full progress bars.
- Fasting history moved fully to the dedicated Fasting page (the Food tab's
  day-log list no longer shows a "fast Xh" badge) and is capped at the 10
  most recent fasts.
- Today's header now shows the current day and time (updates every 30s),
  and the daily quote pool includes Tagalog lines alongside the English
  ones.
- The Food tab's "Log a Day (quick totals)" entry list is now a collapsible
  "Diary / Meal Notes" section (collapsed by default), since it's really a
  short free-text daily note/summary rather than the main food log —
  distinct from the itemized search-logged meals shown above it.

## Today tab: tap-through navigation, fasting detail, and rotating quotes

- The workout History Log moved off the Today tab entirely — it now lives on
  the Train tab (retitled "Workout History Log"), right after the exercise
  list, since it's workout data rather than a Today-at-a-glance summary.
- Every Today at a Glance card except Fasting now navigates to its home tab
  on tap (Weight/Sleep → Body, Food Intake/Water/Macronutrients → Food,
  Exercise/Calories Burned → Train). Fasting keeps its existing behavior of
  opening the dedicated Fasting page. The tap target is a delegated click
  listener on each grid container (`data-nav-view` attributes on the cards),
  so it survives the grid's frequent re-renders without rebinding.
- The Fasting card (Today tab), the Nutrition Dashboard's "Today's Fast"
  card, and the dedicated Fasting page's live timer all share one helper
  (`fastingSummaryText()`) for their elapsed-time/percent/target-end-time
  text, so all three stay in sync. Both tile versions now open the dedicated
  Fasting page on tap.
- The daily quote pool grew to 23 phrases (was 12) mixing English and
  Tagalog; one is picked at random per session (not per day) so it changes
  every time the app is opened rather than once every 24 hours.

## Fasting page: target end time and a previous-fast summary

The live timer on the dedicated Fasting page now shows the target end
clock-time alongside the percent-complete text (e.g. "43% of 16h goal · ends
~1:05 PM"). Below "Log or edit a fast," a "Previous fast" summary shows the
most recently logged fast's total hours, percent of goal, and a verdict —
Goal Met, Not Met, or Exceeded target (>105% of goal) — so you can see at a
glance how the last fast went without opening History.

## Sleep (dedicated page)

Sleep moved off the Today card's inline edit form and the Body tab's
full day-nav section onto its own dedicated page (`window.openSleepScreen`),
mirroring the Fasting and Steps pages: day-nav (prev/next/jump-to-today) to
log or correct any past night, a 14-day trend chart, and a collapsible
history list (most recent 10). Both the Today glance card and a compact
summary tile on the Body tab (last night's hours, a short trend commentary
like "Averaging 6.2h the past 3 nights — below your 8h goal", and a mini
7-day bar chart) are now read-only and open the dedicated page on tap
instead of editing inline. All three surfaces read/write the same `sleep`
resource, so logging from the dedicated page shows up everywhere
immediately.

## Steps (manual entry)

A new `steps` resource (`{date: count}`, same generic `api/data.php`
mechanism as everything else — added to the allow-list in both the backend
and the frontend's local-backup resource list) tracks daily step counts.
Manual entry only for now, same as sleep; a note on the page says automatic
watch sync is a possible future update. It shows up as a tile on both the
Today glance grid and the Train tab (using the profile's step goal, same
`userHealthTargets.stepsGoal` used elsewhere), and both tiles open a
dedicated Steps page with day-nav, a 14-day trend chart, and collapsible
history — mirroring the Sleep and Fasting page patterns.

## Expanded Insights summary

The Trends Overview cards and the Day-by-Day Breakdown table on the Insights
tab now include sleep and steps alongside the existing workout/kcal/protein/
weight/fasting figures, so "Today," "This Week," and "This Month" all give a
full picture in one place. The day-by-day table's row layout got explicit
`flex-shrink:0` column widths and a `min-width` wrapper so the extra columns
scroll horizontally on narrow screens instead of getting squeezed unreadably
thin.

## Water (dedicated page)

Water gets the same treatment as Fasting/Steps/Sleep: the Today card's
quick +/− glass buttons still work in place, but tapping the card now opens
a dedicated page (`window.openWaterScreen`) with day-nav, a manual "set
exact amount" input alongside the +/− buttons, a 14-day trend chart, and
collapsible history. Same `water` resource (`{date: ml}`) as before.

## Trend charts: shared axis-labeled line chart

Every trend graph in the app (Weight, Sleep, Steps, Fasting, Water) now
renders through one shared `renderTrendLineChart()` helper instead of each
screen having its own bar-chart or bare-sparkline code: y-axis gridlines at
"nice" rounded values (a small D3-style tick-rounding helper, `niceTicks()`),
x-axis date labels, a line with dot markers, and an optional dashed
goal/target line. Weight's chart also gained axis labels and gridlines it
didn't have before, matching how the other trend pages already looked.

## Goals page: compact fields, inline weight-unit dropdown

The Goals page's simple "one label, one number" fields (macros, target
weight, sleep, steps, calorie burn, water, fasting) moved off `.hub-tile`
(designed for 150px-tall stat-display tiles, and mostly wasted space for a
plain input) onto a new lightweight `.goal-field` style — a compact bordered
box just tall enough for a label and an input. The standalone "Preferred
weight unit" tile is gone; its dropdown now sits inline in the "Target
weight" field's own label row (a `.goal-field-unit` select), and switching
it live-converts whatever's already typed rather than just relabeling.

## Onboarding/profile form: inline unit dropdowns

The Weight unit / Height unit selects used to take a full row of their own.
They're now small inline dropdowns in the "Height" and "Current weight"
field labels themselves (`.goal-field-unit`-style small `<select>`), with
the label text and the ft/in vs. cm field layout still updating live on
change — same behavior, tighter layout.

## Today at a Glance: Macronutrients tile relabel

The macro name (Carbs/Protein/Fat) now sits above each ring and the gram
target sits below it, instead of both being crammed into one line under
the ring — the combined "Carbs / 180g" line was cramped and started
overlapping at narrow widths.

## Food logging: search quality, day-nav race fix, grouped meals, notes

- **Search quality**: food search (both the Food tab and the dedicated Log
  Meal page) now drops any result with no usable calorie value
  (`hasUsableNutrients()` — missing, null, or 0 kcal), so a food with
  incomplete nutrition data never shows up as a pickable result. The
  "+ Add a custom food" form and the Log Meal page's manual-item form both
  now require a calorie value greater than 0 before saving, instead of
  silently defaulting to 0 — these were the actual source of the "0 kcal"
  entries showing up in the log, not the search itself.
- **Day-nav race condition**: rapidly clicking prev/next day in the
  Nutrition Dashboard could show a day-nav header, banner, and "Logged via
  search" list that each reflected a *different* day, because
  `renderNutrition()` re-read the live `nutriSelectedDate` global after its
  `await` instead of using the value it had actually fetched data for, and
  neither it nor `renderTodayMeals()`/`fetchMealTotals()` discarded
  responses that had been superseded by a newer click. Fixed with a
  captured-value-before-await pattern plus generation counters on all
  three, the same pattern already used elsewhere in the app (e.g. the food
  search's `foodSearchGeneration`).
- **Grouped, itemized display**: the "Logged via search" list now sorts
  entries into a fixed Breakfast → Lunch → Dinner → Snack → Misc order
  (previously whatever order the backend returned), and shows each item's
  protein/fat/carbs as a small line under the name, not just kcal.
- **Editing past days**: already worked (the list is driven by whichever
  day is selected in day-nav), it just wasn't obvious — tapping a logged
  item expands an inline amount editor for it, for any day.
- **"Log a Day (quick totals)" removed**: that legacy manual macro-entry
  form (and the day-by-day notes list it fed) is gone — the search-based
  Food tab flow and the dedicated Log Meal page (which has its own Notes
  field) are the only ways to log food now. Whatever free-text "meal" and
  "notes" a day already had from that old form still displays, but now
  inline at the bottom of that specific day's "Logged via search" card
  (`Notes for <date>`) instead of as a separate chronological history list.

## Dedicated-page fun facts

The Sleep, Water, Fasting, and Steps pages each show one random fact
(`SLEEP_FACTS`/`WATER_FACTS`/`FASTING_FACTS`/`STEPS_FACTS`, picked via
`randomFact()`) at the top every time the page opens — a different one per
visit, unlike the Today tab's `SESSION_QUOTE` which stays fixed for the
whole session.

## Day-nav loading feedback, "Daily" rename, mobile input zoom fix

- Rapid day-nav clicks on the Nutrition Dashboard now show immediate
  feedback: the nav row gets a `.day-nav-loading` class (a slow opacity
  pulse, pointer-events disabled) the instant you click, cleared again once
  `renderNutrition()`'s fetch actually resolves. Only the Nutrition
  Dashboard needed this — the Workout Dashboard and the Sleep/Steps/Water
  pages all read from data that's already loaded into memory at startup,
  so switching days there is instant with nothing to wait on.
- The "Today" range option (Nutrition Dashboard, Workout Dashboard,
  Insights Trends) is now labeled "Daily", since day-nav lets you move to
  any past day, not just today.
- Mobile Safari/Chrome auto-zoom the page when focusing a form field whose
  computed font-size is under 16px, which this app's many inline
  `font-size:13px`-ish inputs all trigger. Fixed with a `max-width:760px`
  media query forcing `font-size:16px !important` on every input/select/
  textarea (inline styles need `!important` to be overridden) — keeps the
  desktop layout's smaller text untouched and only changes behavior where
  the zoom actually happens.

## Recent & favorite foods

Every food actually logged (via search, the Log Meal page, or "+ Add a
custom food") is recorded into a new `recentFoods` resource (most-recent-
first, capped at 12, deduped by food id); starring one moves it into
`favoriteFoods` (capped at 20) instead of falling out when newer items get
logged. Both the Food tab's inline search and the dedicated Log Meal page
show a horizontally-scrollable "Recent & Favorites" strip above the search
box — tapping a chip drops that food straight into the same search-result
UI (measure picker, save button, everything) at position 0, so re-logging
something doesn't need a fresh search.

## Food icons

Logged meal items, search results, and Recent & Favorites chips all show a
small icon on the left, from a 55-icon reference pack
(`icons/full-circle-food-icons/`, copied into `public/icons/food/` so it
actually deploys) covering meats, rice/noodle/pasta dishes, produce,
drinks, and desserts, plus a `generic-meal` fallback. Classification
(`getFoodIcon()`, `public/index.html`) is deliberately kept separate from
rendering (`renderFoodIconSvg()`) per
[`food-icon-auto-assignment-spec.md`](icons/full-circle-food-icons/food-icon-auto-assignment-spec.md):
`iconOverride` > `icon` > name-based phrase/keyword rules > stored
category/subcategory > `generic-meal`. Name-based rules sit above category
on purpose, since a food's own stored category is often coarser ("meat")
than what its name actually tells you ("Chicken Sopas" should read as
soup, not chicken) — the phrase-rule table specifically resolves that kind
of mixed-dish ambiguity before the generic keyword list runs.
`tools/test_food_icons.cjs` extracts the classifier straight out of
`index.html` (no build step to hook into) and checks it against the
spec's own example table, with one deliberate deviation: the spec's test
list says "Pandesal → bread", but there's a dedicated `pandesal` icon in
the pack, so that's what gets used — more specific wins per the spec's
own "database metadata when available" principle.

## Favicon

Replaced the old inline data-URI favicon with `public/favicon.svg`, a
redrawn (not pixel-traced) simplification of the "Gedli / Full Circle"
concept mark — an orange-to-green arc, a leaf sweep, and a person
silhouette — sized for legibility at 16-32px.

## AI prompt-assist logging

A trial third logging option, alongside search and manual entry, for both
food (Log Meal page, "AI Assist" tab) and workouts (the "log stats from
watch" form's collapsible AI section). No API key or backend integration —
it's a clipboard-mediated round trip through whatever AI chat app the user
already has (ChatGPT, Gemini, etc.):

1. The user optionally enters a food name, weight/quantity, and description
   (or an activity description for workouts) — all fields are optional.
2. "Generate prompt" builds a plain-text prompt (not JSON — an AI chat reply
   pasted back in is always plain text, so keeping the whole round trip in
   that format avoids a pointless plain-text-to-JSON-and-back detour) that
   asks the AI to estimate the nutrition/stats and reply using a fixed
   labeled-line format the app knows how to parse. If the name/weight (or
   activity description) is missing, the prompt also tells the user to
   attach a photo of the food/workout to their AI chat to improve the
   estimate.
3. "Copy prompt" copies it to the clipboard for pasting into the AI chat.
4. The user pastes the AI's reply back into the app and hits "Parse & fill"
   (food) or "Parse & add" (workout) — a per-line regex extracts each
   labeled value, tolerant of extra commentary the AI adds around them.
5. For food, the meal prompt explicitly tells the AI to give each distinct
   item its own labeled block when the meal has more than one (e.g. rice +
   a main dish + a drink) instead of merging them into one estimate. Parsing
   splits the reply into one chunk per `Food:` line — regardless of whether
   the AI adds "Item 1:"-style headers — and adds every item with a usable
   calorie value straight into the current meal's item list in one go,
   sparing the user separate copy/paste rounds per item. Workout stats stay
   single-item, since one set of watch-style stats already describes one
   whole session.
6. Either way, results land in the *existing* Manual Log item list (food) or
   stats fields (workout) — no separate save path — so the user reviews/
   edits before hitting the normal Save/Add button, same validation as
   manual entry (e.g. a missing calorie estimate still blocks that item).

A full image-to-AI version (skipping the copy/paste round trip entirely) is
a possible future step, not built here. Prompt-generation and reply-parsing
logic, including the multi-item split, is unit-tested in
`tools/test_ai_assist.cjs`.

## Local development

There's no build step. To preview the frontend against a local PHP server:
```bash
php -S localhost:8000 -t public
```
You'll also need a local MySQL database and `api/config.local.php` pointed at
it, and to run `php -S localhost:8000` from the repo root instead so `/api/`
resolves — e.g. `php -S localhost:8000` from the repo root, then browse to
`http://localhost:8000/public/index.html`.
