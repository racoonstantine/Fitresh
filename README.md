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
  - `auth.php` — register / login / logout / who-am-i, via PHP sessions
  - `data.php` — get/save one user's data for a given resource (nutrition,
    weighins, history, checked, weights, theme), scoped to whoever is logged in
  - `config.local.php` — **not in git.** DB credentials, created once by hand
    directly on the server.
- **`db/schema.sql`** — the two tables (`users`, `user_data`). Run once.
- **`tools/seed-owner-data.js`** — a one-time console script to restore your
  own historical data (see below). Never deployed, never run by anyone else.
- **`.github/workflows/deploy.yml`** — on every push to `main`, rsyncs
  `public/` and `api/` to your Namecheap server over SSH.

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
on the server: copy `api/config.example.php` to `api/config.local.php` in the
same folder, and fill in the DB name/user/password from step 1. This file is
gitignored on purpose — it only ever exists on the server, never in the repo.

### 3. Set up the deploy SSH key
You already have SSH access (confirmed via cPanel → SSH Access). We'll make a
**second**, dedicated keypair just for GitHub Actions — don't reuse your
personal Mac key for this.

On your own machine (not here):
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

## Inviting friends

Signup is open (anyone with the link can create an account) but each account
only ever sees its own data — the API scopes every read/write to the logged-in
user's session. Just share the URL.

## Local development

There's no build step. To preview the frontend against a local PHP server:
```bash
php -S localhost:8000 -t public
```
You'll also need a local MySQL database and `api/config.local.php` pointed at
it, and to run `php -S localhost:8000` from the repo root instead so `/api/`
resolves — e.g. `php -S localhost:8000` from the repo root, then browse to
`http://localhost:8000/public/index.html`.
