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

## Local development

There's no build step. To preview the frontend against a local PHP server:
```bash
php -S localhost:8000 -t public
```
You'll also need a local MySQL database and `api/config.local.php` pointed at
it, and to run `php -S localhost:8000` from the repo root instead so `/api/`
resolves — e.g. `php -S localhost:8000` from the repo root, then browse to
`http://localhost:8000/public/index.html`.
