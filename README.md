# Fitresh

Multi-user workout, nutrition, fasting and weight tracker. Static frontend (`public/`) plus a small
PHP/MySQL API (`api/`), so each account's data is private to it. Every push to `main` deploys to
Namecheap shared hosting through GitHub Actions (SFTP).

**Working on the code? Start with [`docs/handoff.md`](docs/handoff.md)** — layout, how to run the
tests and the local test app, deploy rules and current status. Long dated notes on how each feature was
built live in [`docs/history.md`](docs/history.md) (archive; the app was earlier called "Full Circle").
Other docs: `docs/food-review.md`, `docs/personal-foods.md`, `docs/workout-catalog-contract.md`,
`docs/workout-preparation.md`.

## Quick start (local)

```
node tools/dev_harness/start.cjs --port 8124    # http://127.0.0.1:8124, tester@example.com / testpass123
node tools/dev_harness/smoke.cjs                # API checks
```

## What is where

- `public/` — `index.html` (markup), `app.css`, `js/*.js` (25 scripts sharing globals), icons, manifest.
- `api/` — PHP endpoints (auth, per-user data store, foods/meals, workouts, admin, food review).
  `api/config.local.php` is **not in git**: DB credentials and admin email, created by hand on the server.
- `db/` — `schema.sql` (fresh install) and `migrations/` (run each once on the live database).
- `.github/` — deploy workflow and `sftp_deploy.py` (never touches `config.local.php`).
- `tools/` — food/workout data builders and all tests. `data/` — food DB and workout catalog sources.

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
